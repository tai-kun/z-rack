import type { MaybePromise } from "maypromise";

/**
 * データベースの 1 行を表すデータ構造です。
 *
 * キーにカラム名、値にそのデータの内容を持ちます。
 */
export type Row = {
  /**
   * カラム名をキーとした、読み取り専用のデータです。
   */
  readonly [column: string]: unknown;
};

/**
 * トランザクション操作に関連する型定義を格納する名前空間です。
 */
export namespace ITransaction {
  /**
   * クエリー実行時に渡される引数の型定義です。
   */
  export type QueryArgs = {
    /**
     * 実行する SQL クエリーのテキストです。
     */
    queryText: string;
    /**
     * クエリーに埋め込むプレースホルダーの値の配列です。
     */
    bindings: unknown[];
  };

  /**
   * ロールバック実行時に渡される引数の型定義です。
   */
  export type RoolbackArgs = {};
}

/**
 * データベースのトランザクションを制御するためのインターフェースです。
 */
export interface ITransaction {
  /**
   * トランザクション内でクエリーを実行します。
   *
   * @param args クエリー実行に必要な引数です。
   * @returns 取得された行データの反復子（同期または非同期）を返します。
   */
  query(args: ITransaction.QueryArgs): MaybePromise<AsyncIterable<Row> | Iterable<Row>>;

  /**
   * 現在のトランザクションをロールバックし、変更を破棄します。
   *
   * @param args ロールバックに必要な引数です。
   * @returns 非同期処理、または完了を示す Promise を返します。
   */
  rollback(args: ITransaction.RoolbackArgs): MaybePromise<void>;
}

/**
 * データベースクライアントに関連する型定義を格納する名前空間です。
 */
export namespace IDatabaseClient {
  /**
   * データベースの接続開始時に渡される引数の型定義です。
   */
  export type OpenArgs = {
    /**
     * 接続処理を中断するための中断シグナルです。
     */
    signal: AbortSignal;
  };

  /**
   * データベースの切断時に渡される引数の型定義です。
   */
  export type CloseArgs = {
    /**
     * 切断処理を中断するための中断シグナルです。
     */
    signal: AbortSignal;
  };

  /**
   * データのフラッシュ（書き出し）時に渡される引数の型定義です。
   */
  export type FlushArgs = {
    /**
     * フラッシュ処理を中断するための中断シグナルです。
     */
    signal: AbortSignal;
  };

  /**
   * クエリー実行時に渡される引数の型定義です。
   */
  export type QueryArgs = {
    /**
     * 実行する SQL クエリーのテキストです。
     */
    queryText: string;

    /**
     * クエリーに埋め込むプレースホルダーの値の配列です。
     */
    bindings: unknown[];

    /**
     * クエリー実行を中断するための中断シグナルです。
     */
    signal: AbortSignal;
  };

  /**
   * トランザクション処理を開始する際に渡される引数の型定義です。
   */
  export type TransactionArgs = {
    /**
     * トランザクション内で実行されるコールバック関数です。
     *
     * @param tx トランザクション操作を行うためのオブジェクトです。
     */
    callback: (tx: ITransaction) => Promise<void>;

    /**
     * トランザクション開始を中断するための中断シグナルです。
     */
    signal: AbortSignal;
  };
}

/**
 * データベース操作を管理するメインのクライアントインターフェースです。
 */
export interface IDatabaseClient {
  /**
   * クライアントが現在オープン状態であるかを示す読み取り専用のプロパティーです。
   */
  readonly isOpen: boolean;

  /**
   * データベースへの接続を確立します。
   *
   * 任意の実装ですが、接続が必要なクライアントでは必須となります。
   *
   * @param args 接続設定および中断シグナルを含む引数です。
   * @returns 接続完了を示す Promise、または void です。
   */
  open?(args: IDatabaseClient.OpenArgs): MaybePromise<void>;

  /**
   * データベースとの接続を切断します。
   *
   * リソースの解放が必要な場合に使用します。
   *
   * @param args 切断処理に関する引数です。
   * @returns 切断完了を示す Promise、または void です。
   */
  close?(args: IDatabaseClient.CloseArgs): MaybePromise<void>;

  /**
   * バッファーに溜まっている未書き込みのデータを強制的にデータベースへ書き出します。
   *
   * @param args フラッシュ操作に関する引数です。
   * @returns 処理完了を示す Promise、または void です。
   */
  flush?(args: IDatabaseClient.FlushArgs): MaybePromise<void>;

  /**
   * クエリーを直接実行します。
   *
   * @param args クエリー内容、バインディング、および中断シグナルを含む引数です。
   * @returns 取得された行データの反復子を返します。
   */
  query(args: IDatabaseClient.QueryArgs): MaybePromise<AsyncIterable<Row> | Iterable<Row>>;

  /**
   * トランザクションのスコープを開始します。
   *
   * 実装上の注意:
   * 1. コールバックが開始される前にトランザクションを開始します。
   * 2. コールバックが正常終了した場合、通常はコミットを行います。
   * 3. コールバック内でエラーが投げられた場合、または明示的にロールバックされた場合は、変更を破棄します。
   *
   * @param args トランザクション内で実行する処理（コールバック）を含む引数です。
   * @returns トランザクション全体の一連の処理が完了したことを示す Promise です。
   */
  transaction(args: IDatabaseClient.TransactionArgs): PromiseLike<void>;
}
