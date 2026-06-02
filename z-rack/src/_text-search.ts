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
 * テキスト検索エンジンの初期化に必要な静的データの検証用スキーマです。
 */
const TsStaticSchema = v.object({
  /**
   * インデックスや検索の形式を表現する文字列です。
   */
  format: v.string(),

  /**
   * テキスト検索の構成名称です。簡易的な処理を表す `simple` などが入ります。
   */
  textConfig: v.string(),

  /**
   * 検索の関連度を計算するアルゴリズムである BM25 の詳細パラメーターです。
   */
  bm25Params: v.optional(
    // デフォルト値：https://github.com/timescale/pg_textsearch/tree/5886b94f61767c0c06b31ec9d5de9b4b4d1094b8#index-options-1
    v.object({
      /**
       * 単語の出現頻度がスコアに与える影響を調整する数値です。
       */
      k1: v.optional(v.pipe(v.number(), v.finite(), v.minValue(0.1), v.maxValue(10)), 1.2),

      /**
       * 文書の長さがスコアに与える影響を調整する数値です。
       */
      b: v.optional(v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(1)), 0.75),
    }),
    {
      k1: 1.2,
      b: 0.75,
    },
  ),

  /**
   * 言語が判別できない場合などに適用される既定の言語設定です。
   */
  defaultLanguage: LanguageSchema,

  /**
   * システムが受け付ける言語の集合です。配列、またはセットの形式から受け付けます。
   */
  supportedLanguages: v.union([
    v.pipe(
      v.array(LanguageSchema),
      v.minLength(1),
      // 配列で渡された場合は、重複を除外して参照を高速化するために `Set` へ変換します。
      v.transform((arr) => new Set(arr)),
    ),
    v.pipe(v.set(LanguageSchema), v.minSize(1)),
  ]),
});

/**
 * 分割された単語の配列を空白区切りの文字列に変換し、検索テキストとして検証するスキーマです。
 */
const TokenizeResultSchema = v.pipe(
  v.array(v.string()),
  v.transform((tokens) => tokens.join(" ")),
  SearchTextSchema,
);

/**
 * 標準化された文字列が検索テキストとして適切か検証するスキーマです。
 */
const NormalizeResultSchema = SearchTextSchema;

/**
 * テキスト検索に関する処理を統括するクラスです。
 *
 * 外部の検索インターフェースを内包し、言語の検証や単語の分割、テキストの標準化などの機能を提供します。
 */
export default class TextSearch {
  /**
   * 内部で保持する、テキスト検索の具体的な処理を担う実体オブジェクトです。
   */
  private readonly ts: ITextSearch;

  /**
   * 検索処理が利用するデータの形式です。
   */
  public readonly format: string;

  /**
   * テキスト検索の構成情報です。
   */
  public readonly textConfig: "simple" | (string & {});

  /**
   * 関連度計算に用いる BM25 パラメーターの保持領域です。
   */
  public readonly bm25Params: {
    /**
     * 単語の頻出度に関する調整パラメーターです。
     */
    readonly k1: number;

    /**
     * 文書長に関する調整パラメーターです。
     */
    readonly b: number;
  };

  /**
   * 既定として設定されている言語です。
   */
  private readonly defaultLanguage: Language;

  /**
   * サポート対象となっている言語の一覧です。
   */
  private readonly supportedLanguages: ReadonlySet<Language>;

  /**
   * 現在のインスタンスがサポートしている言語のみを許容する動的な検証用スキーマです。
   */
  public readonly SupportedLanguageSchema: v.BaseSchema<Language, Language, any>;

  /**
   * 新しいテキスト検索インスタンスを構築します。
   *
   * @param ts テキスト検索の実装を持つオブジェクトです。
   */
  public constructor(ts: ITextSearch) {
    // 外部から渡されたオブジェクトに必要な設定値が含まれているか検証します。
    const statics = v.parseInput(TsStaticSchema, ts);

    // 既定の言語として設定されているものが、サポート対象の言語に含まれているか確認します。
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
   * @returns 接続が有効であれば真を、それ以外は偽を返します。
   */
  public get isOpen(): boolean {
    return Boolean(this.ts.isOpen);
  }

  /**
   * 検索エンジンの利用を開始するための準備処理を行います。
   *
   * @param signal 処理を途中で中断するためのシグナルオブジェクトです。
   * @returns 準備が完了すると解決される Promise です。
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
   * @param signal 処理を途中で中断するためのシグナルオブジェクトです。
   * @returns 切断処理が完了すると解決される Promise です。
   */
  public async close(signal: AbortSignal): Promise<void> {
    if (typeof this.ts.close !== "function") {
      return;
    }

    await this.ts.close({ signal });
  }

  /**
   * テキストを単語単位に分割し、空白で連結したデータ形式に変換します。
   *
   * @param signal 処理を途中で中断するためのシグナルオブジェクトです。
   * @param language 文字列の言語情報です。
   * @param text 分割対象となる文字列です。
   * @returns 単語ごとに区切られて整形された文字列を返します。
   */
  public async tokenize(signal: AbortSignal, language: Language, text: Utf8): Promise<Utf8> {
    // 現在の実装では、textConfig が "simple" のとき以外はトークンナイズを行わないはずです。
    if (this.textConfig !== "simple") {
      unreachable();
    }

    // 現在の実装では、このメソッドを呼び出す前に指定された言語がサポート対象に含まれているはずです。
    if (!this.supportedLanguages.has(language)) {
      unreachable(language as never);
    }

    const tokens =
      typeof this.ts.tokenize !== "function"
        ? // 内部オブジェクトに分割用の関数が実装されていない場合は、単純な空白文字による区切り処理で代用します。
          text.split(/\s+/g)
        : await this.ts.tokenize({ text, signal, language });
    const output = v.parseOutput(TokenizeResultSchema, tokens);

    return output;
  }

  /**
   * 大文字小文字の統一や揺らぎの補正など、テキストを検索に適した形式に標準化します。
   *
   * @param signal 処理を途中で中断するためのシグナルオブジェクトです。
   * @param language 処理対象とするテキストの言語です。
   * @param text 標準化を行う前の文字列です。
   * @returns 標準化が施された文字列を返します。
   */
  public async normalize(signal: AbortSignal, language: Language, text: Utf8): Promise<Utf8> {
    // 現在の実装では、このメソッドを呼び出す前に指定された言語がサポート対象に含まれているはずです。
    if (!this.supportedLanguages.has(language)) {
      unreachable(language as never);
    }

    // 内部オブジェクトに標準化を担う関数が定義されていない場合は、元の文字列をそのまま返します。
    if (typeof this.ts.normalize !== "function") {
      return text;
    }

    const result = await this.ts.normalize({ text, signal, language });
    const output = v.parseOutput(NormalizeResultSchema, result);

    return output;
  }

  /**
   * 与えられたテキストから、使われている言語を自動的に判別します。
   *
   * @param signal 処理を途中で中断するためのシグナルオブジェクトです。
   * @param text 言語の判別を行いたい文字列です。
   * @returns 判別された言語の種類を返します。
   */
  public async detectLanguage(signal: AbortSignal, text: Utf8): Promise<Language> {
    // 内部オブジェクトに自動判別の仕組みが備わっていない場合は、あらかじめ設定された既定の言語を返します。
    if (typeof this.ts.detectLanguage !== "function") {
      return this.defaultLanguage;
    }

    const lang = await this.ts.detectLanguage({ text, signal });
    const output = v.parseOutput(this.SupportedLanguageSchema, lang);

    return output;
  }
}
