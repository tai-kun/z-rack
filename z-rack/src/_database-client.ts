import { type Row, type ITransaction, type IDatabaseClient, IdleTaskQueue } from "@z-rack/core";
import { sql } from "pgsql-template-tag";

/**
 * データベースクエリーの結果を表すインターフェースです。
 *
 * `Promise<void>` を継承し、結果の待機、反復処理、全件取得の 3 通りの利用方法を提供します。
 */
export interface QueryResult extends Promise<void> {
  /**
   * クエリー結果を非同期ジェネレーターとして反復します。
   *
   * @returns 非同期ジェネレーターを解決する Promise です。
   */
  iter(): Promise<AsyncGenerator<Row, void, unknown>>;

  /**
   * クエリー結果の全行を配列として取得します。
   *
   * @returns 取得した行の配列を解決する Promise です。
   */
  collect(): Promise<Row[]>;
}

/**
 * Promise を `QueryResult` インターフェースに準拠するよう拡張します。
 *
 * @param promise 変換対象の `AsyncIterable<Row>` または `Iterable<Row>` を内包する Promise です。
 * @returns `QueryResult` 仕様を満たすよう拡張された Promise です。
 */
function toQueryResult(promise: Promise<AsyncIterable<Row> | Iterable<Row>>): QueryResult {
  // @ts-expect-error
  return new Proxy(promise, {
    get(target, p, receiver) {
      switch (p) {
        case "then":
          return function then(...args: any) {
            return Promise.try(async () => {
              for await (const _ of await promise) {
                // 空ループで結果を全て読み飛ばします。
              }
            }).then(...args);
          };

        case "iter":
          return async function iter() {
            const iter = await promise;

            return (async function* () {
              yield* iter;
            })();
          };

        case "collect":
          return async function collect() {
            const iter = await promise;

            return await Array.fromAsync(iter);
          };

        default:
          return Reflect.get(target, p, receiver);
      }
    },
  });
}

/**
 * データベーストランザクションをラップするクラスです。
 */
class Transaction {
  private readonly tx: ITransaction;

  /**
   * トランザクションのキャンセルを制御する中断シグナルです。
   */
  public readonly signal: AbortSignal;

  public constructor(tx: ITransaction, signal: AbortSignal) {
    this.tx = tx;
    this.signal = signal;
  }

  /**
   * トランザクション内でクエリーを実行します。
   *
   * @param sql 実行する SQL 文字列またはオブジェクトです。
   * @returns クエリー結果を含む `QueryResult` です。
   */
  public query(sql: sql.Sql | string): QueryResult {
    let queryText: string;
    let bindings: unknown[];

    if (typeof sql === "string") {
      queryText = sql;
      bindings = [];
    } else {
      queryText = sql.text;
      bindings = sql.values.slice();
    }

    return toQueryResult(
      Promise.try(async () => {
        return await this.tx.query({ bindings, queryText });
      }),
    );
  }

  /**
   * トランザクションをロールバックします。
   *
   * @returns ロールバック完了を待機する Promise です。
   */
  public async rollback(): Promise<void> {
    await this.tx.rollback({});
  }
}

export type { Transaction };

/**
 * データベース接続を管理するクライアントです。
 */
export default class DatabaseClient {
  private readonly db: IDatabaseClient;

  private readonly bg: IdleTaskQueue;

  public constructor(db: IDatabaseClient) {
    this.db = db;
    this.bg = new IdleTaskQueue();
  }

  /**
   * データベースの接続が開いているかどうかを取得します。
   *
   * @returns 開いている場合は `true`、それ以外は `false` です。
   */
  public get isOpen(): boolean {
    return Boolean(this.db.isOpen);
  }

  /**
   * バッファーされたデータを永続化します。
   *
   * @param signal 処理を中断するためのシグナルです。
   * @returns 永続化完了を待機する Promise です。
   */
  private async flush(signal: AbortSignal): Promise<void> {
    if (typeof this.db.flush !== "function") {
      return;
    }

    await this.db.flush({ signal });
  }

  /**
   * データベース接続を開きます。
   *
   * @param signal 処理を中断するためのシグナルです。
   * @returns 接続完了を待機する Promise です。
   */
  public async open(signal: AbortSignal): Promise<void> {
    if (typeof this.db.open !== "function") {
      return;
    }

    await this.db.open({ signal });
  }

  /**
   * データベース接続を閉じます。
   *
   * バックグラウンドタスクの状態に応じてタスクを破棄または待機した後にクリーンアップします。
   *
   * @param signal 処理を中断するためのシグナルです。
   * @param reason 閉じる原因となったエラーなどの理由です。
   * @returns 切断完了を待機する Promise です。
   */
  public async close(signal: AbortSignal, reason: unknown): Promise<void> {
    if (this.bg.isEmpty) {
      // 実行中のタスクを中断し完了を待ちます。
      this.bg.abort(reason);
      await this.bg.wait();
    } else {
      // 未実行タスクをクリアした上で実行中のタスクに中断を要求します。
      this.bg.clear();
      this.bg.abort(reason);
      await this.bg.wait();

      // 残留データを物理データベースへ書き出します。
      await this.flush(signal);
    }

    if (typeof this.db.close !== "function") {
      return;
    }

    await this.db.close({ signal });
  }

  /**
   * データベースにクエリーを実行します。
   *
   * @param signal 処理を中断するためのシグナルです。
   * @param sql 実行する SQL 文字列またはオブジェクトです。
   * @returns クエリー結果を含む `QueryResult` です。
   */
  public query(signal: AbortSignal, sql: sql.Sql | string): QueryResult {
    let queryText: string;
    let bindings: unknown[];

    if (typeof sql === "string") {
      queryText = sql;
      bindings = [];
    } else {
      queryText = sql.text;
      bindings = sql.values.slice();
    }

    return toQueryResult(
      Promise.try(async () => {
        return await this.db.query({ signal, bindings, queryText });
      }),
    );
  }

  /**
   * トランザクションを開始し、コールバック内でクエリーを実行します。
   *
   * @template T コールバックの戻り値の型です。
   * @param signal 処理を中断するためのシグナルです。
   * @param callback トランザクション内で実行される非同期コールバックです。
   * @returns コールバックの実行結果です。
   */
  public async transaction<T>(
    signal: AbortSignal,
    callback: (tx: Transaction) => Promise<T>,
  ): Promise<T> {
    let result: T;
    await this.db.transaction({
      signal,
      async callback(tx) {
        result = await callback(new Transaction(tx, signal));
      },
    });

    return result!;
  }

  /**
   * データ永続化のフラッシュ処理をバックグラウンドタスクキューに要求します。
   */
  public requestFlush(): void {
    this.bg.add(async (signal) => {
      await this.flush(signal);
    });
  }
}
