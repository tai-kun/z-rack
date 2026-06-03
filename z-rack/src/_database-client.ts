import { type Row, type ITransaction, type IDatabaseClient, IdleTaskQueue } from "@z-rack/core";
import { sql } from "pgsql-template-tag";

/**
 * データベースクエリーの結果を表すインターフェースです。
 *
 * `Promise<void>` を継承しており、結果を待機するか、反復処理や全件取得を行うことができます。
 */
export interface QueryResult extends Promise<void> {
  /**
   * クエリーの結果を非同期ジェネレーターとして反復処理するためのメソッドです。
   *
   * @returns 非同期ジェネレーターを解決する Promise です。
   */
  iter(): Promise<AsyncGenerator<Row, void, unknown>>;

  /**
   * クエリーの結果をすべての行の配列として取得するためのメソッドです。
   *
   * @returns 取得した行の配列を解決する Promise です。
   */
  collect(): Promise<Row[]>;
}

/**
 * 渡された Promise オブジェクトを `QueryResult` インターフェースに準拠した Promise オブジェクトに変換します。
 *
 * @param promise 変換対象となる `AsyncIterable<Row>` または `Iterable<Row>` を内包する Promise です。
 * @returns `QueryResult` の仕様を満たすように拡張された Promise オブジェクトです。
 */
function toQueryResult(promise: Promise<AsyncIterable<Row> | Iterable<Row>>): QueryResult {
  // @ts-expect-error
  return new Proxy(promise, {
    get(target, p, receiver) {
      switch (p) {
        case "then":
          /**
           * Promise の `then` メソッドをオーバーライドします。
           *
           * クエリー の結果を最後まで消費して処理の完了を保証します。
           *
           * @param onfulfilled 成功時に呼び出されるコールバック関数です。
           * @param onrejected 失敗時に呼び出されるコールバック関数です。
           * @returns 新しい Promise オブジェクトです。
           */
          return function then(...args: any) {
            return Promise.try(async () => {
              for await (const _ of await promise) {
                // 空のループで結果をすべて読み飛ばします。
              }
            }).then(...args);
          };

        case "iter":
          /**
           * クエリー結果を非同期ジェネレーターとして取得します。
           *
           * @returns 非同期ジェネレーターを解決する Promise です。
           */
          return async function iter() {
            const iter = await promise;

            return (async function* () {
              yield* iter;
            })();
          };

        case "collect":
          /**
           * クエリー結果の全行を配列として収集します。
           *
           * @returns 取得した行の配列を解決する Promise です。
           */
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
 * データベースのトランザクションを表すクラスです。
 */
class Transaction {
  /**
   * 内部で保持するトランザクションインターフェースです。
   */
  private readonly tx: ITransaction;

  /**
   * トランザクションの生存期間やキャンセルを制御する中断シグナルです。
   */
  public readonly signal: AbortSignal;

  /**
   * `Transaction` クラスの新しいインスタンスを作成します。
   *
   * @param tx トランザクションインターフェースです。
   * @param signal 中断シグナルです。
   */
  public constructor(tx: ITransaction, signal: AbortSignal) {
    this.tx = tx;
    this.signal = signal;
  }

  /**
   * トランザクション内でクエリーを実行します。
   *
   * @param sql 実行する SQL 文字列またはオブジェクトです。
   * @returns クエリーの実行結果を含む `QueryResult` です。
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
   * 現在のトランザクションをロールバックします。
   *
   * @returns ロールバック操作の完了を待機する Promise です。
   */
  public async rollback(): Promise<void> {
    await this.tx.rollback({});
  }
}

export type { Transaction };

/**
 * データベースとの接続を管理するメインのクライアントクラスです。
 */
export default class DatabaseClient {
  /**
   * 内部で保持するデータベースクライアントインターフェースです。
   */
  private readonly db: IDatabaseClient;

  /**
   * バックグラウンドで実行されるタスクを管理するアイドルタスクキューです。
   */
  private readonly bg: IdleTaskQueue;

  /**
   * `DatabaseClient` クラスの新しいインスタンスを作成します。
   *
   * @param db データベースクライアントインターフェースです。
   */
  public constructor(db: IDatabaseClient) {
    this.db = db;
    this.bg = new IdleTaskQueue();
  }

  /**
   * データベース の接続が開いているかどうかを取得します。
   *
   * @returns 接続が開いている場合は `true`、それ以外の場合は `false` です。
   */
  public get isOpen(): boolean {
    return Boolean(this.db.isOpen);
  }

  /**
   * バッファーされているデータを永続化します。
   *
   * @param signal 処理をキャンセルするための中断シグナルです。
   * @returns 永続化処理の完了を待機する Promise です。
   */
  private async flush(signal: AbortSignal): Promise<void> {
    if (typeof this.db.flush !== "function") {
      return;
    }

    await this.db.flush({ signal });
  }

  /**
   * データベースへの接続を開きます。
   *
   * @param signal 処理をキャンセルするための中断シグナルです。
   * @returns 接続が完了するのを待機する Promise です。
   */
  public async open(signal: AbortSignal): Promise<void> {
    if (typeof this.db.open !== "function") {
      return;
    }

    await this.db.open({ signal });
  }

  /**
   * データベースへの接続を閉じます。
   *
   * バックグラウンドタスクの状態に応じて、適切にタスクを破棄または待機した後に、クリーンアップを行います。
   *
   * @param signal 処理をキャンセルするための中断シグナルです。
   * @param reason 接続を閉じる原因となった エラー などの理由情報です。
   * @returns 接続が完全に閉じるのを待機する Promise です。
   */
  public async close(signal: AbortSignal, reason: unknown): Promise<void> {
    if (this.bg.isEmpty) {
      // キューが空の場合は、現在実行中のタスクを中断し、その完了を待ちます。
      this.bg.abort(reason);
      await this.bg.wait();
    } else {
      // キューに残っている未実行のタスクがある場合は、キューをクリアした上で現在実行中のタスクに対して中断を要求します。
      this.bg.clear();
      this.bg.abort(reason);
      await this.bg.wait();

      // 残留データを物理データベースへ書き出すためにフラッシュを実行します。
      await this.flush(signal);
    }

    if (typeof this.db.close !== "function") {
      return;
    }

    await this.db.close({ signal });
  }

  /**
   * データベースに対してクエリーを実行します。
   *
   * @param signal 処理をキャンセルするための中断シグナルです。
   * @param sql 実行する SQL 文字列またはオブジェクトです。
   * @returns クエリーの実行結果を含む `QueryResult` です。
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
   * データベースのトランザクションを開始し、指定されたコールバック関数を実行します。
   *
   * @template T コールバック関数が返す戻り値の型です。
   * @param signal 処理をキャンセルするための中断シグナルです。
   * @param callback トランザクション内で実行される非同期コールバック関数です。
   * @returns コールバック関数の実行結果を返す Promise です。
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
   * データを永続化するための フラッシュ 処理を、バックグラウンドのアイドルタスクキューに要求します。
   */
  public requestFlush(): void {
    this.bg.add(async (signal) => {
      await this.flush(signal);
    });
  }
}
