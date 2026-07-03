/**
 * `@z-rack/pglite` パッケージの公開 API です。
 *
 * PGlite（PostgreSQL の WebAssembly 実装）をワーカー内で動作させ、データベースクライアントインターフェースを提供します。
 */

export type * from "./pglite.js";
export { default as Pglite } from "./pglite.js";
