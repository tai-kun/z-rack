import type { Row } from "@z-rack/core";

/**
 * ワーカー内のトランザクション操作を定義するインターフェースです。
 */
export interface ITransaction {
  /**
   * トランザクション内で SQL クエリーを実行します。
   *
   * @param query 実行する SQL クエリーのテキストです。
   * @param params クエリーに埋め込むプレースホルダーの値の配列です。
   * @returns クエリー結果の行配列です。
   */
  query(query: string, params?: readonly unknown[]): Promise<Row[]>;

  /**
   * 現在のトランザクションをロールバックし、変更を破棄します。
   */
  rollback(): Promise<void>;
}

/**
 * ワーカー内で動作する PGlite インスタンスのインターフェースです。
 */
export interface IPGliteInWorker {
  /**
   * PGlite の準備が完了するまで待機します。
   */
  waitReady(): Promise<void>;

  /**
   * メモリー上の変更をファイルシステムに同期します。
   */
  syncToFs(): Promise<void>;

  /**
   * データベース接続を閉じ、リソースを解放します。
   */
  close(): Promise<void>;

  /**
   * SQL クエリーを実行します。
   *
   * @param query 実行する SQL クエリーのテキストです。
   * @param params クエリーに埋め込むプレースホルダーの値の配列です。
   * @returns クエリー結果の行配列です。
   */
  query(query: string, params?: readonly unknown[]): Promise<Row[]>;

  /**
   * トランザクションを開始し、コールバック内でクエリーとロールバックを制御します。
   *
   * @param callback トランザクション内で実行されるコールバックです。
   */
  transaction(
    callback: (query: ITransaction["query"], rollback: ITransaction["rollback"]) => Promise<void>,
  ): Promise<void>;
}

/**
 * PGlite ワーカーのオプションです。
 */
export type PGliteInWorkerOptions = {
  /**
   * データベースファイルの保存先ディレクトリーです。
   *
   * OPFS を使用する場合は `opfs://` 形式の URI を指定します。
   */
  readonly dataDir?: string;
};

/**
 * ワーカー内で PGlite インスタンスを生成するコンストラクターのインターフェースです。
 */
export interface IPGliteInWorkerConstructor {
  new (options?: PGliteInWorkerOptions): IPGliteInWorker;
}
