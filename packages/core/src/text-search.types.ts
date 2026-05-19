import type { MaybePromise } from "maypromise";

import type { LanguageLike, Language } from "./schemas.js";

/**
 * テキスト検索に関連する型定義を格納する名前空間です。
 */
export namespace ITextSearch {
  /**
   * 検索エンジンのリソースを開始する際の引数定義です。
   */
  export type OpenArgs = {
    /**
     * 非同期処理を中断するためのシグナルです。
     */
    signal: AbortSignal;
  };

  /**
   * 検索エンジンのリソースを終了する際の引数定義です。
   */
  export type CloseArgs = {
    /**
     * 非同期処理を中断するためのシグナルです。
     */
    signal: AbortSignal;
  };

  export type DetectLanguageArgs = {
    text: string;

    /**
     * 非同期処理を中断するためのシグナルです。
     */
    signal: AbortSignal;
  };

  /**
   * テキストを正規化する際の引数定義です。
   */
  export type NormalizeArgs = {
    /**
     * 正規化のルールを決定するために使用する言語コード（ISO 639-2 Tコード）です。
     */
    language: Language;

    /**
     * 正規化対象となる生の文字列データです。
     */
    text: string;

    /**
     * 非同期処理を中断するためのシグナルです。
     */
    signal: AbortSignal;
  };

  /**
   * テキストをトークンに分割する際の引数定義です。
   */
  export type TokenizeArgs = {
    /**
     * トークナイザーの挙動（分かち書きのアルゴリズムなど）を決定するための言語コード（ISO 639-2 Tコード）です。
     */
    language: Language;

    /**
     * 分割対象となる正規化後の文字列データです。
     */
    text: string;

    /**
     * 非同期処理を中断するためのシグナルです。
     */
    signal: AbortSignal;
  };
}

/**
 * テキスト検索およびトークンナイズの振る舞いを規定するインターフェースです。
 */
export interface ITextSearch {
  /**
   * トークンナイズの結果として出力されるデータの形式を示す文字列です。
   *
   * 例えば、コンストラクターで渡されたオプションが挙動（辞書選択や正規化ルールなど）に影響を与える場合、それらのパラメーターをシリアライズした結果などを含めることができます。
   */
  readonly format: string;

  /**
   * テキスト処理の基本構成を指定するプロパティーです。
   *
   * - `"simple"`: 基本的な空白区切りなどの単純な処理を指します。
   * - `"english"`: 英語特有のステミングなどを考慮した処理を指します。
   * - `string`: その他のカスタムな設定名を指定します。
   */
  readonly textConfig: "simple" | "english" | (string & {});

  /**
   * BM25（Best Matching 25）ランキング関数のためのパラメーター定義です。
   *
   * 検索のスコアリング計算における重み付けを調整するために使用されます。
   */
  readonly bm25Params?:
    | {
        /**
         * 単語頻度の飽和度を制御するパラメーターです。
         *
         * 一般的には 1.2 から 2.0 の間の値が設定されます。
         *
         * @default 1.2
         */
        readonly k1?: number | undefined;

        /**
         * 文書長の正規化の程度を制御するパラメーターです。
         *
         * 0（正規化なし）から 1（完全な正規化）の範囲で設定されます。
         *
         * @default 0.75
         */
        readonly b?: number | undefined;
      }
    | undefined;

  /**
   * 明示的な言語指定がない場合に使用される標準の言語コード（ISO 639-2 Tコード）です。
   */
  readonly defaultLanguage: LanguageLike;

  /**
   * この検索エンジンがサポートしている言語コード（ISO 639-2 Tコード）のリストです。1 つ以上の言語コードを含む必要があります。
   */
  readonly supportedLanguages: readonly LanguageLike[] | ReadonlySet<LanguageLike>;

  /**
   * 検索エンジンのリソースが現在利用可能であるかどうかを示します。
   */
  readonly isOpen: boolean;

  /**
   * 検索エンジンが必要とする外部リソースや辞書データの読み込みを開始します。
   *
   * 実装クラスにおいて初期化処理が必要な場合に定義されます。
   *
   * @param args オープン処理に必要なパラメーターです。
   * @returns 処理の完了を待機する Promise、または同期的な void です。
   */
  open?(args: ITextSearch.OpenArgs): MaybePromise<void>;

  /**
   * 使用中のリソースを解放し、検索エンジンを終了します。
   *
   * データベースのコネクション切断やメモリーの解放処理が必要な場合に定義されます。
   *
   * @param args クローズ処理に必要なパラメーターです。
   * @returns 処理の完了を待機する Promise、または同期的な void です。
   */
  close?(args: ITextSearch.CloseArgs): MaybePromise<void>;

  detectLanguage?(args: ITextSearch.DetectLanguageArgs): MaybePromise<LanguageLike>;

  /**
   * 指定されたテキストを正規化します。
   *
   * @param args 正規化に必要なテキストおよび制御用パラメーターです。
   * @returns 正規化されたテキストです。
   */
  normalize?(args: ITextSearch.NormalizeArgs): MaybePromise<string>;

  /**
   * 指定されたテキストを解析し、検索インデックスに適したトークンの配列へと分割します。
   *
   * `normalize` メソッドを実装している場合、テキストは正規化されています。
   *
   * @param args トークンナイズに必要なテキストおよび制御用パラメーターです。
   * @returns 分割されたトークンの読み取り専用配列です。
   */
  tokenize?(args: ITextSearch.TokenizeArgs): MaybePromise<readonly string[]>;
}
