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

const TsStaticSchema = v.object({
  format: v.string(),
  textConfig: v.string(),
  bm25Params: v.optional(
    // https://github.com/timescale/pg_textsearch/tree/5886b94f61767c0c06b31ec9d5de9b4b4d1094b8#index-options-1
    v.object({
      k1: v.optional(v.pipe(v.number(), v.finite(), v.minValue(0.1), v.maxValue(10)), 1.2),
      b: v.optional(v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(1)), 0.75),
    }),
    {
      k1: 1.2,
      b: 0.75,
    },
  ),
  defaultLanguage: LanguageSchema,
  supportedLanguages: v.union([
    v.pipe(
      v.array(LanguageSchema),
      v.minLength(1),
      v.transform((arr) => new Set(arr)),
    ),
    v.pipe(v.set(LanguageSchema), v.minSize(1)),
  ]),
});

const TokenizeResultSchema = v.pipe(
  v.array(v.string()),
  v.transform((tokens) => tokens.join(" ")),
  SearchTextSchema,
);

const NormalizeResultSchema = SearchTextSchema;

export default class TextSearch {
  private readonly ts: ITextSearch;

  public readonly format: string;

  public readonly textConfig: "simple" | (string & {});

  public readonly bm25Params: {
    readonly k1: number;
    readonly b: number;
  };

  private readonly defaultLanguage: Language;

  private readonly supportedLanguages: ReadonlySet<Language>;

  public readonly SupportedLanguageSchema: v.BaseSchema<Language, Language, any>;

  public constructor(ts: ITextSearch) {
    const statics = v.parseInput(TsStaticSchema, ts);
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

  public get isOpen(): boolean {
    return Boolean(this.ts.isOpen);
  }

  public async open(signal: AbortSignal): Promise<void> {
    if (typeof this.ts.open !== "function") {
      return;
    }

    await this.ts.open({ signal });
  }

  public async close(signal: AbortSignal): Promise<void> {
    if (typeof this.ts.close !== "function") {
      return;
    }

    await this.ts.close({ signal });
  }

  private async _tokenize(
    signal: AbortSignal,
    language: Language,
    text: string,
  ): Promise<readonly string[]> {
    if (this.textConfig !== "simple") {
      unreachable();
    }

    if (!this.supportedLanguages.has(language)) {
      unreachable(language as never);
    }

    if (typeof this.ts.tokenize !== "function") {
      return text.split(/\s+/g);
    }

    return await this.ts.tokenize({ text, signal, language });
  }

  public async tokenize(signal: AbortSignal, language: Language, text: Utf8): Promise<Utf8> {
    const tokens = await this._tokenize(signal, language, text);
    const output = v.parseOutput(TokenizeResultSchema, tokens);

    return output;
  }

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

  public async detectLanguage(signal: AbortSignal, text: Utf8): Promise<Language> {
    if (typeof this.ts.detectLanguage !== "function") {
      return this.defaultLanguage;
    }

    const lang = await this.ts.detectLanguage({ text, signal });
    const output = v.parseOutput(this.SupportedLanguageSchema, lang);

    return output;
  }
}
