import { PGlite } from "@electric-sql/pglite";
import { pg_textsearch } from "@electric-sql/pglite/pg_textsearch";
import type { Row } from "@z-rack/core";
import { expose, proxy } from "comlink";

import type {
  ITransaction,
  IPGliteInWorker,
  IPGliteInWorkerConstructor,
  PGliteInWorkerOptions,
} from "./pglite.type.js";

/**
 * ブラウザーの Web Worker 内で動作する PGlite ラッパーです。
 */
class PGliteInWorker implements IPGliteInWorker {
  private readonly pglite: PGlite;

  /**
   * @param options PGlite の設定オプションです。
   */
  public constructor(options: PGliteInWorkerOptions = {}) {
    this.pglite = new PGlite({
      ...options,
      extensions: {
        pg_textsearch,
      },
    });
  }

  /**
   * PGlite の準備が完了するまで待機します。
   */
  public async waitReady(): Promise<void> {
    await this.pglite.waitReady;
  }

  /**
   * メモリー上の変更をファイルシステムに同期します。
   */
  public async syncToFs(): Promise<void> {
    await this.pglite.syncToFs();
  }

  /**
   * データベース接続を閉じ、リソースを解放します。
   */
  public async close(): Promise<void> {
    await this.pglite.close();
  }

  /**
   * SQL クエリーを実行します。
   *
   * @param query  実行する SQL クエリーのテキストです。
   * @param params クエリーに埋め込むプレースホルダーの値の配列です。
   * @returns クエリー結果の行配列です。
   */
  public async query(query: string, params?: readonly unknown[]): Promise<Row[]> {
    const { rows } = await this.pglite.query<Row>(query, params as unknown[]);

    return rows;
  }

  /**
   * トランザクションを開始し、コールバック内でクエリーとロールバックを制御します。
   *
   * @param callback トランザクション内で実行されるコールバックです。
   */
  public async transaction(
    callback: (query: ITransaction["query"], rollback: ITransaction["rollback"]) => Promise<void>,
  ): Promise<void> {
    await this.pglite.transaction(async (tx) => {
      await callback(
        proxy(async (query: string, params?: readonly unknown[]) => {
          const { rows } = await tx.query<Row>(query, params as any[]);
          return rows;
        }),
        proxy(async () => {
          await tx.rollback();
        }),
      );
    });
  }
}

expose(PGliteInWorker satisfies IPGliteInWorkerConstructor);

export default "";
