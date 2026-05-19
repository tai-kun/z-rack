import { callAbortableFnOnce } from "call-fn-once";

declare global {
  /**
   * グローバルスコープに追加される、シングルトンキャッシュ用のマップです。
   */
  var _z_rack_jpn__once: callAbortableFnOnce.CacheMap | undefined;
}

export default function once<T>(
  key: unknown,
  signal: AbortSignal,
  fn: (signal: AbortSignal) => T,
): callAbortableFnOnce.Return<T> {
  const cacheMap = (globalThis._z_rack_jpn__once ||= new Map());
  return callAbortableFnOnce(cacheMap, key, fn, signal);
}
