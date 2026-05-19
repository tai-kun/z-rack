import { parentPort } from "node:worker_threads";

import { PGlite } from "@electric-sql/pglite";
import { pg_textsearch } from "@electric-sql/pglite/pg_textsearch";
import type { Row } from "@z-rack/core";
import { expose, proxy } from "comlink";
// @ts-expect-error
import nodeEndpoint from "comlink/dist/esm/node-adapter.mjs";

import type {
  ITransaction,
  IPGliteInWorker,
  IPGliteInWorkerConstructor,
  PGliteInWorkerOptions,
} from "./pglite.type.js";

class PGliteInWorker implements IPGliteInWorker {
  private readonly pglite: PGlite;

  public constructor(options: PGliteInWorkerOptions = {}) {
    this.pglite = new PGlite({
      ...options,
      extensions: {
        pg_textsearch,
      },
    });
  }

  public async waitReady(): Promise<void> {
    await this.pglite.waitReady;
  }

  public async syncToFs(): Promise<void> {
    await this.pglite.syncToFs();
  }

  public async close(): Promise<void> {
    await this.pglite.close();
  }

  public async query(query: string, params?: readonly unknown[]): Promise<Row[]> {
    const { rows } = await this.pglite.query<Row>(query, params as any[]);
    return rows;
  }

  public async transaction(
    callback: (query: ITransaction["query"], rollback: ITransaction["rollback"]) => Promise<void>,
  ): Promise<void> {
    await this.pglite.transaction(async (tx) => {
      await callback(
        proxy(async (query: string, params?: readonly unknown[]) => {
          const { rows } = await tx.query<Row>(query, params?.slice());
          return rows;
        }),
        proxy(async () => {
          await tx.rollback();
        }),
      );
    });
  }
}

expose(PGliteInWorker satisfies IPGliteInWorkerConstructor, nodeEndpoint(parentPort));

export default "";
