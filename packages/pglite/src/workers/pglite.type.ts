import type { Row } from "@z-rack/core";

export interface ITransaction {
  query(query: string, params?: readonly unknown[]): Promise<Row[]>;

  rollback(): Promise<void>;
}

export interface IPGliteInWorker {
  waitReady(): Promise<void>;

  syncToFs(): Promise<void>;

  close(): Promise<void>;

  query(query: string, params?: readonly unknown[]): Promise<Row[]>;

  transaction(
    callback: (query: ITransaction["query"], rollback: ITransaction["rollback"]) => Promise<void>,
  ): Promise<void>;
}

export type PGliteInWorkerOptions = {
  readonly dataDir?: string;
};

export interface IPGliteInWorkerConstructor {
  new (options?: PGliteInWorkerOptions): IPGliteInWorker;
}
