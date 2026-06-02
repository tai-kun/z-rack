import { getAbortReason, throwIfAborted } from "abort-signal-utils";
import { NinjaPromise } from "ninja-promise";

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
    reject(getAbortReason(this));
  }

  signal.addEventListener("abort", handleAbort, { once: true });

  return promise;
}
