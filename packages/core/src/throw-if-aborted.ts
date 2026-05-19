let throwIfAborted: (signal: AbortSignal) => void;

if (
  "throwIfAborted" in AbortSignal.prototype &&
  typeof AbortSignal.prototype.throwIfAborted === "function"
) {
  // oxlint-disable-next-line typescript/unbound-method
  throwIfAborted = function throwIfAborted(signal): void {
    signal.throwIfAborted();
  };
} else {
  throwIfAborted = function throwIfAborted(signal): void {
    if (signal.aborted) {
      throw signal.reason !== undefined ? signal.reason : new DOMException("Aborted", "AbortError");
    }
  };
}

export default throwIfAborted;
