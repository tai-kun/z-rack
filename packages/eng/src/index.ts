/**
 * @module @z-rack/eng
 *
 * 英語テキストの全文検索機能を提供するパッケージです。
 * トークナイズは行わず、Unicode NFKC 正規化のみを実装しています。
 */

export type * from "./english.js";
export { default as English } from "./english.js";
