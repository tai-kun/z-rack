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

export type WorkerLike = Endpoint | NodeEndpoint;

export type PgliteOptions = PGliteInWorkerOptions;

export default class Pglite implements IDatabaseClient {
  #con: null | {
    isOpen: boolean;
    pglite: Remote<IPGliteInWorker>;
  };

  readonly #options: PgliteOptions;

  readonly #PGliteInWorker: Remote<IPGliteInWorkerConstructor>;

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

  public get isOpen(): boolean {
    return this.#con?.isOpen === true;
  }

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

  public async close(args: IDatabaseClient.CloseArgs): Promise<void> {
    const { pglite } = this.#con!;
    const { signal } = args;
    const abortPromise = createAbortPromise(signal);
    await Promise.race([abortPromise, pglite.close()]);
    this.#con!.isOpen = false;
  }

  public async flush(): Promise<void> {
    const { pglite } = this.#con!;
    await pglite.syncToFs();
  }

  public async query(args: IDatabaseClient.QueryArgs): Promise<Row[]> {
    const { pglite } = this.#con!;
    const { signal, bindings, queryText } = args;

    const abortPromise = createAbortPromise(signal);

    logger.debug(queryText);

    const rows = await Promise.race([abortPromise, pglite.query(queryText, bindings)]);

    return rows;
  }

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
