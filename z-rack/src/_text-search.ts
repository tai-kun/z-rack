import {
  type Utf8,
  type Language,
  type ITextSearch,
  v,
  unreachable,
  LanguageSchema,
  SearchTextSchema,
} from "@z-rack/core";

import { UnsupportedLanguageError } from "./errors.js";

/**
 * テキスト検索エンジンの初期化に必要な静的データの検証スキーマです。
 */
const TsStaticSchema = v.object({
  /**
   * インデックスや検索の形式を表す文字列です。
   */
  format: v.string(),

  /**
   * テキスト検索の構成名です（例: `simple`）。
   */
  textConfig: v.string(),

  /**
   * BM25 関連度計算のパラメーターです。
   */
  bm25Params: v.optional(
    // デフォルト値：https://github.com/timescale/pg_textsearch/tree/5886b94f61767c0c06b31ec9d5de9b4b4d1094b8#index-options-1
    v.object({
      /**
       * 単語出現頻度がスコアに与える影響を調整します。
       */
      k1: v.optional(v.pipe(v.number(), v.finite(), v.minValue(0.1), v.maxValue(10)), 1.2),

      /**
       * 文書長がスコアに与える影響を調整します。
       */
      b: v.optional(v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(1)), 0.75),
    }),
    {
      k1: 1.2,
      b: 0.75,
    },
  ),

  /**
   * 言語が判別できない場合に適用されるデフォルト言語です。
   */
  defaultLanguage: LanguageSchema,

  /**
   * システムが受け付ける言語の集合です。配列または Set で指定します。
   */
  supportedLanguages: v.union([
    v.pipe(
      v.array(LanguageSchema),
      v.minLength(1),
      // 配列から Set に変換し、重複除去と高速な参照を実現します。
      v.transform((arr) => new Set(arr)),
    ),
    v.pipe(v.set(LanguageSchema), v.minSize(1)),
  ]),
});

/**
 * トークン配列を空白区切りの文字列に変換し、検索テキストとして検証するスキーマです。
 */
const TokenizeResultSchema = v.pipe(
  v.array(v.string()),
  v.transform((tokens) => tokens.join(" ")),
  SearchTextSchema,
);

/**
 * 正規化された文字列を検索テキストとして検証するスキーマです。
 */
const NormalizeResultSchema = SearchTextSchema;

/**
 * テキスト検索に関する処理を統括するクラスです。
 *
 * 外部の検索インターフェースを内包し、言語検証、トークナイズ、テキスト正規化を提供します。
 */
export default class TextSearch {
  private readonly ts: ITextSearch;

  /**
   * 検索処理が利用するデータの形式です。
   */
  public readonly format: string;

  /**
   * テキスト検索の構成名です（例: `simple`）。
   */
  public readonly textConfig: "simple" | (string & {});

  /**
   * BM25 関連度計算のパラメーターです。
   */
  public readonly bm25Params: {
    /**
     * 単語出現頻度の調整パラメーターです。
     */
    readonly k1: number;

    /**
     * 文書長の調整パラメーターです。
     */
    readonly b: number;
  };

  /**
   * 言語が判別できない場合のデフォルト言語です。
   */
  private readonly defaultLanguage: Language;

  /**
   * サポート対象の言語の集合です。
   */
  private readonly supportedLanguages: ReadonlySet<Language>;

  /**
   * サポート対象の言語のみを許容するバリデーションスキーマです。
   */
  public readonly SupportedLanguageSchema: v.BaseSchema<Language, Language, any>;

  public constructor(ts: ITextSearch) {
    // 外部から渡されたオブジェクトに必要な設定値が含まれているか検証します。
    const statics = v.parseInput(TsStaticSchema, ts);

    // デフォルト言語がサポート対象に含まれているか確認します。
    if (!statics.supportedLanguages.has(statics.defaultLanguage)) {
      throw new UnsupportedLanguageError({ lang: statics.defaultLanguage });
    }

    this.ts = ts;
    this.format = statics.format;
    this.textConfig = statics.textConfig;
    this.bm25Params = statics.bm25Params;
    this.defaultLanguage = statics.defaultLanguage;
    this.supportedLanguages = statics.supportedLanguages;
    this.SupportedLanguageSchema = v.picklist([...statics.supportedLanguages]);
  }

  /**
   * 検索エンジンとの接続が確立されているかどうかを取得します。
   *
   * @returns 確立されていれば `true`、それ以外は `false` です。
   */
  public get isOpen(): boolean {
    return Boolean(this.ts.isOpen);
  }

  /**
   * 検索エンジンの利用を開始します。
   *
   * @param signal 処理を中断するためのシグナルです。
   * @returns 準備完了を待機する Promise です。
   */
  public async open(signal: AbortSignal): Promise<void> {
    if (typeof this.ts.open !== "function") {
      return;
    }

    await this.ts.open({ signal });
  }

  /**
   * 検索エンジンの利用を終了し、接続を閉じます。
   *
   * @param signal 処理を中断するためのシグナルです。
   * @returns 切断完了を待機する Promise です。
   */
  public async close(signal: AbortSignal): Promise<void> {
    if (typeof this.ts.close !== "function") {
      return;
    }

    await this.ts.close({ signal });
  }

  /**
   * テキストを単語単位に分割し、空白区切りの文字列に変換します。
   *
   * @param signal 処理を中断するためのシグナルです。
   * @param language テキストの言語です。
   * @param text 分割対象の文字列です。
   * @returns 分割・整形された文字列です。
   */
  public async tokenize(signal: AbortSignal, language: Language, text: Utf8): Promise<Utf8> {
    // textConfig が "simple" 以外ではトークナイズを行いません。
    if (this.textConfig !== "simple") {
      unreachable();
    }

    // 呼び出し前に言語がサポート対象に含まれていることを前提とします。
    if (!this.supportedLanguages.has(language)) {
      unreachable(language as never);
    }

    const tokens =
      typeof this.ts.tokenize !== "function"
        ? // デフォルトでは空白による分割で代用します。
          text.split(/\s+/g)
        : await this.ts.tokenize({ text, signal, language });
    const output = v.parseOutput(TokenizeResultSchema, tokens);

    return output;
  }

  /**
   * テキストを検索に適した形式に正規化します（大文字小文字の統一など）。
   *
   * @param signal 処理を中断するためのシグナルです。
   * @param language テキストの言語です。
   * @param text 正規化前の文字列です。
   * @returns 正規化された文字列です。
   */
  public async normalize(signal: AbortSignal, language: Language, text: Utf8): Promise<Utf8> {
    if (!this.supportedLanguages.has(language)) {
      unreachable(language as never);
    }

    if (typeof this.ts.normalize !== "function") {
      return text;
    }

    const result = await this.ts.normalize({ text, signal, language });
    const output = v.parseOutput(NormalizeResultSchema, result);

    return output;
  }

  /**
   * テキストから使用されている言語を自動判別します。
   *
   * @param signal 処理を中断するためのシグナルです。
   * @param text 判別対象の文字列です。
   * @returns 判別された言語です。
   */
  public async detectLanguage(signal: AbortSignal, text: Utf8): Promise<Language> {
    if (typeof this.ts.detectLanguage !== "function") {
      return this.defaultLanguage;
    }

    const lang = await this.ts.detectLanguage({ text, signal });
    const output = v.parseOutput(this.SupportedLanguageSchema, lang);

    return output;
  }
}
