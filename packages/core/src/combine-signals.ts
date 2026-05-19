/**
 * 複数の AbortSignal を 1 つに結合します。
 *
 * @param signals 結合対象となる AbortSignal、または null / undefined の配列です。
 * @returns 結合された新しい AbortSignal です。
 */
let combineSignals: (signals: readonly (AbortSignal | null | undefined)[]) => AbortSignal;

if ("any" in AbortSignal && typeof AbortSignal.any === "function") {
  // AbortSignal.any がネイティブでサポートされている場合はそれを使用します。

  const AbortSignalAny = AbortSignal.any.bind(AbortSignal);
  combineSignals = function combineSignals(inputSignals) {
    const signals = inputSignals.filter((signal) => signal instanceof AbortSignal);
    return AbortSignalAny(signals);
  };
} else {
  // AbortSignal.any が未実装の環境向けのポリフィル実装です。

  combineSignals = function combineSignals(inputSignals) {
    const ac = new AbortController();
    const signals: AbortSignal[] = [];
    for (const signal of inputSignals) {
      if (signal instanceof AbortSignal) {
        if (signal.aborted) {
          // すでに中断されている場合は、その理由（reason）を使用して即座に中断処理を行います。
          ac.abort(signal.reason);
          return ac.signal;
        }

        signals.push(signal);
      }
    }

    function handleAbort(this: AbortSignal): void {
      ac.abort(this.reason);

      for (const signal of signals) {
        signal.removeEventListener("abort", handleAbort);
      }
    }

    for (const signal of signals) {
      signal.addEventListener("abort", handleAbort, { once: true });
    }

    return ac.signal;
  };
}

export default combineSignals;
