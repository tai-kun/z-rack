/**
 * `@z-rack/jpn` パッケージの公開 API です。
 *
 * Vibrato 形態素解析器の WASM バインディングを提供します。
 *
 * 日本語テキストの形態素解析および英語テキストの空白分割によるトークン化をサポートします。
 */

export {
  type VibratoChecksumErrorMeta,
  type VibratoChecksumErrorArgs,
  VibratoChecksumError,
  VibratoNotOpenError,
  VibratoWasmSourceNotSetError,
} from "./errors.js";

export type * from "./vibrato.js";
export { default as Vibrato } from "./vibrato.js";
