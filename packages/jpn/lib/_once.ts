import { callAbortableFnOnce } from "call-fn-once";

declare global {
  /**
   * 同一キーに対する非同期処理の重複を防ぐキャッシュマップです。
   */
  var _z_rack_jpn__once: callAbortableFnOnce.CacheMap | undefined;
}

/**
 * 同一キーに対する非同期処理の重複実行を防ぎます。
 *
 * キャッシュマップをグローバルスコープで管理し、`callAbortableFnOnce` で多重呼び出しを制御します。
 *
 * @param key 処理を識別するキーです。
 * @param signal 中断シグナルです。
 * @param fn 実行する非同期関数です。
 * @returns `callAbortableFnOnce` の戻り値です。
 */
export default function once<T>(
  key: unknown,
  signal: AbortSignal,
  fn: (signal: AbortSignal) => T,
): callAbortableFnOnce.Return<T> {
  const cacheMap = (globalThis._z_rack_jpn__once ||= new Map());
  return callAbortableFnOnce(cacheMap, key, fn, signal);
}
