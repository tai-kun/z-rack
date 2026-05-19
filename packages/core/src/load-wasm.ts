import { type MaybePromise, isThenable } from "maypromise";

import isArrayBuffer from "./_is-array-buffer.js";
import { HttpResponseError, InvalidInputTypeError } from "./errors.js";

/**
 * WebAssembly インスタンスを初期化するための関数型定義です。
 */
export interface IWebAssemblyInstanceInitializer {
  /**
   * @param options インポートオブジェクト、または未定義です。
   * @returns WebAssembly インスタンスの Promise、またはインスタンスそのものです。
   */
  (options: WebAssembly.Imports | undefined): MaybePromise<WebAssembly.Instance>;
}

/**
 * WebAssembly のソースとして許容される型をまとめた定義です。
 */
export type WasmSource =
  | string
  | ArrayBuffer
  | ArrayBufferView<ArrayBuffer>
  | MaybePromise<Response>
  | WebAssembly.Module
  | WebAssembly.Exports
  | WebAssembly.Instance
  | WebAssembly.WebAssemblyInstantiatedSource
  | IWebAssemblyInstanceInitializer;

/**
 * エラーメッセージで使用するための、期待されるソース型の文字列表現です。
 */
const WasmSourceString = `(${[
  "string",
  "ArrayBuffer",
  "ArrayBufferView<ArrayBuffer>",
  "MaybePromise<Response>",
  "WebAssembly.Module",
  "WebAssembly.Exports",
  "WebAssembly.Instance",
  "WebAssembly.WebAssemblyInstantiatedSource",
  "IWebAssemblyInstanceInitializer",
].join(" | ")})`;

/**
 * WebAssembly の読み込み時に指定するオプションの型定義です。
 */
export type LoadWasmOptions = {
  /**
   * インスタンスに渡すインポートオブジェクトです。
   */
  readonly imports?: WebAssembly.Imports | undefined;

  /**
   * 非同期処理を中断するためのシグナルです。
   */
  readonly signal?: AbortSignal | undefined;
};

/**
 * 値が文字列かどうかを判定します。
 *
 * @param x 判定対象の値です。
 * @returns 文字列であれば true、そうでなければ false を返します。
 */
function isString(x: unknown): x is string {
  return typeof x === "string";
}

/**
 * 値が ArrayBufferView かどうかを判定します。
 *
 * @param x 判定対象の値です。
 * @returns ArrayBufferView であれば true、そうでなければ false を返します。
 */
function isArrayBufferView(x: unknown): x is ArrayBufferView<ArrayBuffer> {
  return ArrayBuffer.isView(x) && isArrayBuffer(x.buffer);
}

/**
 * 値が Response オブジェクトかどうかを判定します。
 *
 * @param x 判定対象の値です。
 * @returns Response オブジェクトであれば true、そうでなければ false を返します。
 */
function isResponse(x: unknown): x is Response {
  return x instanceof Response;
}

/**
 * 値が WebAssembly のエクスポートオブジェクトかどうかを判定します。
 *
 * @param x 判定対象の値です。
 * @returns エクスポートオブジェクトであれば true、そうでなければ false を返します。
 */
function isWasmExports(x: unknown): x is WebAssembly.Exports {
  return typeof x === "object" && x !== null && "__wbindgen_start" in x;
}

/**
 * 値が WebAssembly.Instance かどうかを判定します。
 *
 * @param x 判定対象の値です。
 * @returns インスタンスであれば true、そうでなければ false を返します。
 */
function isWasmInstance(x: unknown): x is WebAssembly.Instance {
  return x instanceof WebAssembly.Instance;
}

/**
 * 値が WebAssembly.WebAssemblyInstantiatedSource かどうかを判定します。
 *
 * @param x 判定対象の値です。
 * @returns インスタンスとモジュールを含むオブジェクトであれば true、そうでなければ false を返します。
 */
function isWasmInstantiatedSource(x: unknown): x is WebAssembly.WebAssemblyInstantiatedSource {
  return typeof x === "object" && x !== null && "instance" in x && "module" in x;
}

/**
 * 値が WebAssembly インスタンスの初期化関数かどうかを判定します。
 *
 * @param x 判定対象の値です。
 * @returns 関数であれば true、そうでなければ false を返します。
 */
function isWasmInstanceInitializer(x: unknown): x is IWebAssemblyInstanceInitializer {
  return typeof x === "function";
}

/**
 * 値が WebAssembly.Module かどうかを判定します。
 *
 * @param x 判定対象の値です。
 * @returns モジュールであれば true、そうでなければ false を返します。
 */
function isWasmModule(x: unknown): x is WebAssembly.Module {
  return x instanceof WebAssembly.Module;
}

/**
 * さまざまなソースから WebAssembly を読み込み、エクスポートを返します。
 *
 * @template TExports エクスポートオブジェクトの型定義です。デフォルトは WebAssembly.Exports です。
 * @param source WebAssembly のソース（URL 文字列、バイナリー、Response 等）です。
 * @param options インポートやシグナルを制御するオプションです。
 * @returns 型定義された WebAssembly のエクスポートを含む Promise です。
 */
export default async function loadWasm<TExports extends WebAssembly.Exports = WebAssembly.Exports>(
  source: WasmSource,
  options: LoadWasmOptions | undefined = {},
): Promise<TExports> {
  // 渡された source の型に応じて再帰的に処理を行い、最終的に WebAssembly.Exports を取得します。
  switch (true) {
    case isWasmExports(source):
      // すでにエクスポートオブジェクトである場合はそのまま返します。
      return source as TExports;

    case isString(source):
      // 文字列の場合は、環境に応じてネットワーク経由またはファイルシステムから取得します。
      if (typeof document !== "undefined") {
        // ブラウザー環境の場合、fetch を使用してリソースを取得します。
        const { signal = null } = options;
        const request = new Request(source, { signal, redirect: "follow" });
        const response = fetch(request);
        return await loadWasm(response, options);
      } else {
        // Node.js 環境の場合、fs プロミスを使用してローカルファイルを読み込みます。
        const fs = await import("node:fs/promises");
        const { signal } = options;
        const buffer = await fs.readFile(source, { signal });
        return await loadWasm(buffer, options);
      }

    case isArrayBuffer(source):
    case isArrayBufferView(source): {
      // バイナリーデータ（ArrayBuffer 等）から直接インスタンス化を行います。
      const { imports } = options;
      const { instance } = await WebAssembly.instantiate(source, imports);
      return await loadWasm(instance, options);
    }

    case isResponse(source):
      // HTTP レスポンスを処理します。
      if (source.status !== 200) {
        throw new HttpResponseError(source);
      }

      // ストリーミング・コンパイルがサポートされている場合は優先的に使用します。
      if ("instantiateStreaming" in WebAssembly) {
        const { imports } = options;
        const { instance } = await WebAssembly.instantiateStreaming(source, imports);
        return await loadWasm(instance, options);
      } else {
        // サポートされていない場合は、source 自体を再度 loadWasm に渡して代替処理（バイナリー化等）を待ちます。
        return await loadWasm(source, options);
      }

    case isThenable<Response>(source): {
      // プロミス（または Thenable）の場合は、解決を待ってから再帰的に処理します。
      const response = await source;
      return await loadWasm(response, options);
    }

    case isWasmInstance(source): {
      // インスタンスからエクスポートを抽出して再帰的に処理します。
      const { exports } = source;
      return await loadWasm(exports, options);
    }

    case isWasmInstantiatedSource(source): {
      // インスタンス化済みのソースオブジェクトからインスタンスを取得します。
      const { instance } = source;
      return await loadWasm(instance, options);
    }

    case isWasmInstanceInitializer(source): {
      // 初期化関数の場合は、オプションのインポートを渡して実行します。
      const { imports } = options;
      const instance = await source(imports);
      return await loadWasm(instance, options);
    }

    case isWasmModule(source): {
      // モジュールオブジェクトからインスタンスを作成します。
      const { imports } = options;
      const { exports } = await WebAssembly.instantiate(source, imports);
      return await loadWasm(exports, options);
    }

    default:
      // いずれの型にも当てはまらない場合は、不正な入力としてエラーを投げます。
      throw new InvalidInputTypeError({
        input: source satisfies never,
        expectedType: WasmSourceString,
      });
  }
}
