import { sha256 } from "@noble/hashes/sha2.js";
import { type WasmSource, type ITextSearch, bytesToHex, HttpResponseError } from "@z-rack/core";

import * as vibrato from "../build/vibrato_wasm.js";
import loadVibratoWasmOnce from "./_load-vibrato-wasm-once.js";
import logger from "./_logger.js";
import once from "./_once.js";
import { VibratoNotOpenError, VibratoChecksumError } from "./errors.js";

/**
 * zstd 圧縮された Vibrato 辞書データ、またはその参照情報です。
 *
 * 直接バイナリデータを渡すか、URL と SHA-256 チェックサムのペアを指定します。
 */
export type VibratoDictionaryDataZstd =
  | Uint8Array
  | {
      /**
       * 辞書ファイルのダウンロード URL です。
       */
      readonly url: string;

      /**
       * データの整合性を検証するための SHA-256 チェックサム（16 進数）です。
       */
      readonly checksum: string;
    };

/**
 * `Vibrato` コンストラクターのオプションです。
 */
export type VibratoOptions = {
  /**
   * トークン化の際に除外する品詞のリストです。
   *
   * @default []
   */
  readonly omitPos?: Iterable<string> | undefined;
};

/**
 * Vibrato 形態素解析器を用いたテキスト検索機能を提供します。
 *
 * zstd 圧縮された辞書データから WASM 版の Vibrato トークナイザーを構築し、日本語の形態素解析と英語の空白分割によるトークン化を行います。
 *
 * {@link ITextSearch} インターフェースを実装しています。
 */
export default class Vibrato implements ITextSearch {
  /**
   * 使用する WASM モジュールのソースをグローバルに設定します。
   *
   * このメソッドはインスタンス化前に一度だけ呼び出す必要があります。
   *
   * 設定されたソースは `_z_rack_jpn__vibrato_wasm_source` に格納され、全インスタンスで共有されます。
   *
   * @param wasmSource WASM モジュールのソースです。
   */
  public static setWasmSource(wasmSource: WasmSource): void {
    logger.debug`WASM source set globally`;

    globalThis._z_rack_jpn__vibrato_wasm_source = wasmSource;
  }

  #wasm:
    | { readonly vibrato: vibrato.VibratoWasm }
    | {
        readonly dictUrl: string;
        readonly checksum: string;
      }
    | { readonly dictData: Uint8Array };

  readonly #omitPos: readonly string[];

  /**
   * インスタンスを識別するフォーマットクエリー文字列です。
   *
   * パッケージ名、バージョン、クラス名、辞書チェックサム、除外品詞がエンコードされています。
   */
  public readonly format: string;

  public readonly textConfig: "simple";

  public readonly defaultLanguage: "jpn";

  public readonly supportedLanguages: readonly ["jpn", "eng"];

  /**
   * @param dictionaryDataZstd zstd 圧縮された辞書データ、または URL とチェックサムのペアです。
   * @param options オプションです。
   */
  public constructor(dictionaryDataZstd: VibratoDictionaryDataZstd, options: VibratoOptions = {}) {
    const dictChecksum =
      dictionaryDataZstd instanceof Uint8Array
        ? bytesToHex(sha256(dictionaryDataZstd))
        : dictionaryDataZstd.checksum;

    const omitPos = [...new Set(options.omitPos || [])].sort();

    const fmt = new URLSearchParams();
    fmt.append("package", "@z-rack/jpn");
    fmt.append("version", "0");
    fmt.append("class", "Vibrato");
    fmt.append("dict_checksum", dictChecksum);
    for (const pos of omitPos) {
      fmt.append("omitPos", pos);
    }

    this.#wasm =
      dictionaryDataZstd instanceof Uint8Array
        ? {
            dictData: dictionaryDataZstd,
          }
        : {
            dictUrl: dictionaryDataZstd.url,
            checksum: dictionaryDataZstd.checksum,
          };
    this.#omitPos = omitPos;
    this.format = fmt.toString();
    this.textConfig = "simple";
    this.defaultLanguage = "jpn";
    this.supportedLanguages = ["jpn", "eng"];

    logger.debug`Vibrato instance created with format: ${this.format}`;
  }

  /**
   * インスタンスが開かれており、トークン化の準備ができているかを示します。
   */
  public get isOpen(): boolean {
    return "vibrato" in this.#wasm;
  }

  /**
   * インスタンスを初期化し、トークン化の準備をします。
   *
   * 1. WASM モジュールをロードします（初回のみ）。
   * 2. 辞書が URL 指定の場合はダウンロードし、SHA-256 チェックサムを検証します。
   * 3. 辞書データから WASM トークナイザーを構築します。
   *
   * @param args オープン引数です。`signal` で処理を中断できます。
   */
  public async open(args: ITextSearch.OpenArgs): Promise<void> {
    if ("vibrato" in this.#wasm) {
      return;
    }

    const { signal } = args;

    await loadVibratoWasmOnce(signal);

    if ("dictUrl" in this.#wasm) {
      const { dictUrl, checksum } = this.#wasm;

      const dictData = await once(`vibrato_dict_${checksum}`, signal, async (signal) => {
        const resp = await fetch(dictUrl, { signal, redirect: "follow" });
        if (resp.status !== 200) {
          throw new HttpResponseError({ response: resp });
        }

        const buff = await resp.arrayBuffer();
        const data = new Uint8Array(buff);
        const hash = bytesToHex(sha256(data));

        if (hash !== checksum) {
          throw new VibratoChecksumError({
            actual: hash,
            expected: checksum,
          });
        }

        return data;
      });
      this.#wasm = { dictData };
    }

    const { dictData } = this.#wasm;
    this.#wasm = {
      vibrato: vibrato.VibratoWasm.from_zstd(dictData, true),
    };
  }

  /**
   * インスタンスを閉じ、WASM リソースを解放します。
   */
  public close(): void {
    if ("vibrato" in this.#wasm) {
      this.#wasm.vibrato.free();
    }
  }

  /**
   * テキストを NFKC 正規化します。
   *
   * @param args 正規化するテキストです。
   * @returns NFKC 正規化された文字列です。
   */
  public normalize(args: Pick<ITextSearch.NormalizeArgs, "text">): string {
    const { text } = args;
    return text.normalize("NFKC");
  }

  /**
   * テキストをトークン化します。
   *
   * - 言語が `"eng"` の場合は空白区切りで分割します。
   * - 言語が `"jpn"` の場合は Vibrato で形態素解析し、`omitPos` に該当する品詞を除外します。
   *
   * @param args トークン化するテキストと言語です。
   * @returns トークンの配列です。
   */
  public tokenize(args: Pick<ITextSearch.TokenizeArgs, "language" | "text">): string[] {
    if (!("vibrato" in this.#wasm)) {
      throw new VibratoNotOpenError();
    }

    const { text, language } = args;

    if (text === "") {
      return [];
    }

    if (language === "eng") {
      return text.split(/\s+/g);
    }

    const { vibrato } = this.#wasm;

    if (this.#omitPos.length > 0) {
      return vibrato.tokenize(text, this.#omitPos.slice());
    } else {
      return vibrato.tokenize_all(text);
    }
  }
}
