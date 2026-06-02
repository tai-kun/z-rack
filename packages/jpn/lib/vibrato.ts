import { sha256 } from "@noble/hashes/sha2.js";
import { type WasmSource, type ITextSearch, bytesToHex, HttpResponseError } from "@z-rack/core";

import * as vibrato from "../build/vibrato_wasm.js";
import loadVibratoWasmOnce from "./_load-vibrato-wasm-once.js";
import logger from "./_logger.js";
import once from "./_once.js";
import { VibratoNotOpenError, VibratoChecksumError } from "./errors.js";

/**
 * Vibrato の辞書データを表す型定義です。
 *
 * 直接的なバイナリーデータ（Uint8Array）、または外部 URL とチェックサムのペアを受け入れます。
 *
 * 辞書ファイルは Zstandard で圧縮されている必要があります。
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
 * Vibrato インスタンスの初期化時に指定するオプションの型定義です。
 */
export type VibratoOptions = {
  /**
   * トークン化の際に取り除く（無視する）品詞のリストです。
   */
  readonly omitPos?: Iterable<string> | undefined;
};

/**
 * Vibrato アルゴリズムを使用したテキスト検索および形態素解析機能を提供するクラスです。
 *
 * {@link ITextSearch} インターフェースを実装しています。
 */
export default class Vibrato implements ITextSearch {
  /**
   * 使用する WASM ソースをグローバルに設定します。
   *
   * @param wasmSource ロード対象の WASM ソース情報です。
   */
  public static setWasmSource(wasmSource: WasmSource): void {
    logger.debug`WASM source set globally`;

    globalThis._z_rack_jpn__vibrato_wasm_source = wasmSource;
  }

  /**
   * 内部状態を管理する非公開プロパティーです。
   *
   * 初期化状態に応じて、WASM インスタンス、URL 情報、または未処理の辞書データを保持します。
   */
  #wasm:
    | { readonly vibrato: vibrato.VibratoWasm }
    | {
        readonly dictUrl: string;
        readonly checksum: string;
      }
    | { readonly dictData: Uint8Array };

  /**
   * 除外対象となる品詞の内部リストです。
   */
  readonly #omitPos: readonly string[];

  public readonly format: string;

  public readonly textConfig: "simple";

  public readonly defaultLanguage: "jpn";

  public readonly supportedLanguages: readonly ["jpn", "eng"];

  /**
   * Vibrato クラスの新しいインスタンスを作成します。
   *
   * @param dictionaryDataZstd zstd 圧縮された辞書データ、またはその参照情報です。
   * @param options 解析時のオプション設定です。
   */
  public constructor(dictionaryDataZstd: VibratoDictionaryDataZstd, options: VibratoOptions = {}) {
    // 辞書データのチェックサムを計算、または取得します。
    const dictChecksum =
      dictionaryDataZstd instanceof Uint8Array
        ? bytesToHex(sha256(dictionaryDataZstd))
        : dictionaryDataZstd.checksum;

    // 除外品詞リストを正規化します。
    const omitPos = [...new Set(options.omitPos || [])].sort();

    // 内部状態を識別するためのフォーマットクエリーパラメーターを構築します。
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

  public get isOpen(): boolean {
    return "vibrato" in this.#wasm;
  }

  public async open(args: ITextSearch.OpenArgs): Promise<void> {
    // 既に初期化済みの場合は何もしません。
    if ("vibrato" in this.#wasm) {
      return;
    }

    const { signal } = args;

    // WASM モジュール自体のロードを確実に実行します。
    await loadVibratoWasmOnce(signal);

    // 状態が URL 参照である場合、ネットワーク経由で辞書データを取得します。
    if ("dictUrl" in this.#wasm) {
      const { dictUrl, checksum } = this.#wasm;

      // 同一チェックサムの辞書取得が重複しないように制御しつつ、データを取得します。
      const dictData = await once(`vibrato_dict_${checksum}`, signal, async (signal) => {
        const resp = await fetch(dictUrl, { signal, redirect: "follow" });
        if (resp.status !== 200) {
          throw new HttpResponseError(resp);
        }

        const buff = await resp.arrayBuffer();
        const data = new Uint8Array(buff);
        const hash = bytesToHex(sha256(data));

        // 取得したデータの整合性をチェックサムで検証します。
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

    // 取得済みのバイナリーデータから、Vibrato WASM のラッパークラスをインスタンス化します。
    const { dictData } = this.#wasm;
    this.#wasm = {
      vibrato: vibrato.VibratoWasm.from_zstd(dictData, true),
    };
  }

  public close(): void {
    if ("vibrato" in this.#wasm) {
      this.#wasm.vibrato.free();
    }
  }

  public normalize(args: Pick<ITextSearch.NormalizeArgs, "text">): string {
    const { text } = args;
    return text.normalize("NFKC");
  }

  public tokenize(args: Pick<ITextSearch.TokenizeArgs, "language" | "text">): string[] {
    // 解析インスタンスが準備できていない場合は処理を中断します。
    if (!("vibrato" in this.#wasm)) {
      throw new VibratoNotOpenError();
    }

    const { text, language } = args;

    // 空文字列の場合は空の配列を返します。
    if (text === "") {
      return [];
    }

    // 英語（"eng"）の場合は、単純な空白区切りでトークン化します。
    if (language === "eng") {
      return text.split(/\s+/g);
    }

    const { vibrato } = this.#wasm;

    if (this.#omitPos.length > 0) {
      // 特定の品詞を除外してトークン化を実行します。
      return vibrato.tokenize(text, this.#omitPos.slice());
    } else {
      // すべての形態素を取得します。
      return vibrato.tokenize_all(text);
    }
  }
}
