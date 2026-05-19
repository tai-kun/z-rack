import { NinjaPromise } from "ninja-promise";

import throwIfAborted from "./throw-if-aborted.js";

/**
 * 指定された AbortSignal に基づいて、中断時に拒否される Promise を作成します。
 *
 * @param signal 操作の中断を監視するための AbortSignal インスタンスです。
 * @returns 初期状態が保留で、中断時にのみ拒否される NinjaPromise です。
 */
export default function createAbortPromise(signal: AbortSignal): NinjaPromise<never> {
  throwIfAborted(signal);

  // oxlint-disable-next-line typescript/unbound-method
  const { reject, promise } = NinjaPromise.withResolvers<never>();

  function handleAbort(this: AbortSignal): void {
    reject(this.reason !== undefined ? this.reason : new DOMException("Aborted", "AbortError"));
  }

  signal.addEventListener("abort", handleAbort, { once: true });

  return promise;
}
