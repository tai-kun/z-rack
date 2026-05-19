import { type Row, type ITransaction, type IDatabaseClient, IdleTaskQueue } from "@z-rack/core";
import { sql } from "pgsql-template-tag";

import { ZRackIsNotOpenError } from "./errors.js";

export interface QueryResult extends Promise<void> {
  iter(): Promise<AsyncGenerator<Row, void, unknown>>;
  collect(): Promise<Row[]>;
}

function toQueryResult(promise: Promise<AsyncIterable<Row> | Iterable<Row>>): QueryResult {
  const then = promise.then.bind(promise);

  return Object.assign<any, PromiseLike<void> & Pick<QueryResult, "iter" | "collect">>(
    promise as any,
    {
      // oxlint-disable-next-line unicorn/no-thenable
      then(onfulfilled, onrejected) {
        return Promise.try(async () => {
          for await (const _ of await then()) {
          }
        }).then(onfulfilled, onrejected);
      },
      async iter() {
        const iter = await then();

        return (async function* () {
          yield* iter;
        })();
      },
      async collect() {
        return await Array.fromAsync(await this.iter());
      },
    },
  );
}

class Transaction {
  private readonly tx: ITransaction;

  public readonly signal: AbortSignal;

  public constructor(tx: ITransaction, signal: AbortSignal) {
    this.tx = tx;
    this.signal = signal;
  }

  public query(sql: sql.Sql | string): QueryResult {
    return toQueryResult(
      Promise.try(async () => {
        let queryText: string;
        let bindings: unknown[];
        if (typeof sql === "string") {
          queryText = sql;
          bindings = [];
        } else {
          queryText = sql.text;
          bindings = sql.values.slice();
        }

        return await this.tx.query({ bindings, queryText });
      }),
    );
  }

  public async rollback(): Promise<void> {
    await this.tx.rollback({});
  }
}

export type { Transaction };

export default class DatabaseClient {
  private readonly db: IDatabaseClient;

  private readonly bg: IdleTaskQueue;

  public constructor(db: IDatabaseClient) {
    this.db = db;
    this.bg = new IdleTaskQueue();
  }

  public get isOpen(): boolean {
    return Boolean(this.db.isOpen);
  }

  private async flush(signal: AbortSignal): Promise<void> {
    if (typeof this.db.flush !== "function") {
      return;
    }

    await this.db.flush({ signal });
  }

  public async open(signal: AbortSignal): Promise<void> {
    if (typeof this.db.open !== "function") {
      return;
    }

    await this.db.open({ signal });
  }

  public async close(signal: AbortSignal): Promise<void> {
    if (this.bg.isEmpty) {
      this.bg.abort(new ZRackIsNotOpenError());
      await this.bg.wait();
    } else {
      this.bg.clear();
      this.bg.abort(new ZRackIsNotOpenError());
      await this.bg.wait();
      await this.flush(signal);
    }

    if (typeof this.db.close !== "function") {
      return;
    }

    await this.db.close({ signal });
  }

  public query(signal: AbortSignal, sql: sql.Sql | string): QueryResult {
    return toQueryResult(
      Promise.try(async () => {
        let queryText: string;
        let bindings: unknown[];
        if (typeof sql === "string") {
          queryText = sql;
          bindings = [];
        } else {
          queryText = sql.text;
          bindings = sql.values.slice();
        }

        return await this.db.query({ signal, bindings, queryText });
      }),
    );
  }

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

  public requestFlush(): void {
    this.bg.add(async (signal) => {
      await this.flush(signal);
    });
  }
}
