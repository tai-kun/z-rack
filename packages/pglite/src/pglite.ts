import { type Row, type IDatabaseClient, createAbortPromise } from "@z-rack/core";
import { throwIfAborted } from "abort-signal-utils";
import { type Remote, type Endpoint, wrap, proxy } from "comlink";
import type { NodeEndpoint } from "comlink/dist/esm/node-adapter.js";
// @ts-expect-error
import nodeEndpoint from "comlink/dist/esm/node-adapter.mjs";

import logger from "./_logger.js";
import type {
  IPGliteInWorker,
  IPGliteInWorkerConstructor,
  PGliteInWorkerOptions,
} from "./workers/pglite.type.js";

/**
 * ワーカーのエンドポイントとして受け入れ可能な型です。
 *
 * ブラウザー環境では `Endpoint`、Node.js 環境では `NodeEndpoint` を使用します。
 */
export type WorkerLike = Endpoint | NodeEndpoint;

/**
 * Pglite クライアントのオプションです。
 */
export type PgliteOptions = PGliteInWorkerOptions;

/**
 * PGlite をワーカー内で動作させるデータベースクライアントです。
 *
 * `IDatabaseClient` インターフェースを実装し、メインスレッドからワーカー内の PGlite インスタンスと Comlink を介して通信します。
 *
 * @example
 * ```ts
 * import { Pglite } from "@z-rack/pglite";
 * import pgliteWorkerUri from "@z-rack/pglite/worker?url";
 *
 * const worker = new Worker(new URL(pgliteWorkerUri, import.meta.url), {
 *   type: "module",
 * });
 * const pglite = new Pglite(worker, { dataDir: "opfs-ahp://.tmp/meta" });
 * ```
 */
export default class Pglite implements IDatabaseClient {
  #con: null | {
    isOpen: boolean;
    pglite: Remote<IPGliteInWorker>;
  };

  readonly #options: PgliteOptions;

  readonly #PGliteInWorker: Remote<IPGliteInWorkerConstructor>;

  /**
   * Pglite クライアントを生成します。
   *
   * @param worker ワーカーのエンドポイントです。ブラウザーでは `Worker` インスタンス、Node.js では `worker_threads.Worker` インスタンスを渡します。
   * @param options データベースの設定オプションです。
   */
  public constructor(worker: WorkerLike, options: PgliteOptions = {}) {
    let endpoint: Endpoint;
    if (typeof document !== "undefined") {
      endpoint = worker as Endpoint;
    } else {
      endpoint = nodeEndpoint(worker);
    }

    this.#con = null;
    this.#options = { ...options };
    this.#PGliteInWorker = wrap(endpoint);
  }

  /**
   * クライアントが現在オープン状態であるかを示します。
   */
  public get isOpen(): boolean {
    return this.#con?.isOpen === true;
  }

  /**
   * データベースへの接続を確立します。
   *
   * ワーカー内で PGlite インスタンスを生成し、準備が完了するまで待機します。
   *
   * @param args 接続設定および中断シグナルを含む引数です。
   */
  public async open(args: IDatabaseClient.OpenArgs): Promise<void> {
    if (this.#con) {
      this.#con.isOpen = true;
      return;
    }

    const { signal } = args;
    const abortPromise = createAbortPromise(signal);
    const pglite = await new this.#PGliteInWorker(this.#options);
    await Promise.race([abortPromise, pglite.waitReady()]);

    this.#con = {
      isOpen: true,
      pglite,
    };
  }

  /**
   * データベースとの接続を切断し、ワーカー内のリソースを解放します。
   *
   * @param args 切断処理に関する引数です。
   */
  public async close(args: IDatabaseClient.CloseArgs): Promise<void> {
    const { pglite } = this.#con!;
    const { signal } = args;
    const abortPromise = createAbortPromise(signal);
    await Promise.race([abortPromise, pglite.close()]);
    this.#con!.isOpen = false;
  }

  /**
   * メモリー上の未書き込みのデータを強制的にファイルシステムへ同期します。
   */
  public async flush(): Promise<void> {
    const { pglite } = this.#con!;
    await pglite.syncToFs();
  }

  /**
   * SQL クエリーを実行し、結果の行を返します。
   *
   * @param args クエリー内容、バインディング、および中断シグナルを含む引数です。
   * @returns クエリー結果の行配列です。
   */
  public async query(args: IDatabaseClient.QueryArgs): Promise<Row[]> {
    const { pglite } = this.#con!;
    const { signal, bindings, queryText } = args;

    const abortPromise = createAbortPromise(signal);

    logger.debug(queryText);

    const rows = await Promise.race([abortPromise, pglite.query(queryText, bindings)]);

    return rows;
  }

  /**
   * トランザクションを開始し、コールバック内でクエリーとロールバックを制御します。
   *
   * コールバックが正常終了した場合はコミット、エラーが投げられた場合または明示的にロールバックされた場合は変更を破棄します。
   *
   * @param args トランザクション内で実行されるコールバックを含む引数です。
   */
  public async transaction(args: IDatabaseClient.TransactionArgs): Promise<void> {
    const { pglite } = this.#con!;
    const { signal, callback } = args;

    throwIfAborted(signal);

    await pglite.transaction(
      proxy(async (query, rollback) => {
        await callback({
          async query(args) {
            const abortPromise = createAbortPromise(signal);
            const { bindings, queryText } = args;

            logger.debug(queryText);

            return await Promise.race([abortPromise, query(queryText, bindings)]);
          },
          async rollback() {
            logger.debug("Rollback");

            await rollback();
          },
        });
      }),
    );
  }
}
