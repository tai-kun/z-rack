import { test, vi } from "vitest";

import combineSignals from "../src/combine-signals.js";

test("複数の Signal を結合し、いずれか一つが中断されたとき、戻り値の Signal も中断される", ({
  expect,
}) => {
  // Arrange
  const c1 = new AbortController();
  const c2 = new AbortController();
  const result = combineSignals([c1.signal, c2.signal]);

  // Act
  c2.abort();

  // Assert
  expect(result.aborted).toBe(true);
});

test("Signal が中断されたとき、その中断理由（reason）が正確に伝搬される", ({ expect }) => {
  // Arrange
  const c1 = new AbortController();
  const result = combineSignals([c1.signal]);
  const expectedReason = "timeout error";

  // Act
  c1.abort(expectedReason);

  // Assert
  expect(result.reason).toBe(expectedReason);
});

test("既に中断されている Signal を渡したとき、即座に中断状態の Signal を返す", ({ expect }) => {
  // Arrange
  const c1 = new AbortController();
  c1.abort("already aborted");

  // Act
  const result = combineSignals([c1.signal]);

  // Assert
  expect(result.aborted).toBe(true);
  expect(result.reason).toBe("already aborted");
});

test("複数の中断済み Signal を渡したとき、配列の先頭に近い方の理由を優先して即座に中断される", ({
  expect,
}) => {
  // Arrange
  const c1 = new AbortController();
  const c2 = new AbortController();
  c1.abort("first");
  c2.abort("second");

  // Act
  const result = combineSignals([c1.signal, c2.signal]);

  // Assert
  expect(result.reason).toBe("first");
});

test("いずれかの Signal が中断されたとき、すべての監視対象からリスナーが解除される", ({
  expect,
}) => {
  // Arrange
  const c1 = new AbortController();
  const c2 = new AbortController();

  const addSpy1 = vi.spyOn(c1.signal, "addEventListener");
  const addSpy2 = vi.spyOn(c2.signal, "addEventListener");
  const removeSpy1 = vi.spyOn(c1.signal, "removeEventListener");
  const removeSpy2 = vi.spyOn(c2.signal, "removeEventListener");

  combineSignals([c1.signal, c2.signal]);

  // Act
  c1.abort();

  // Assert
  expect(addSpy1.mock.calls).toHaveLength(removeSpy1.mock.calls.length);
  expect(addSpy2.mock.calls).toHaveLength(removeSpy2.mock.calls.length);
});

test("非 Signal オブジェクトが混入していても、クラッシュせずに無視して処理を続行する", ({
  expect,
}) => {
  // Arrange
  const c1 = new AbortController();
  const signals = [{} as AbortSignal, c1.signal];

  // Act
  const result = combineSignals(signals);
  c1.abort("valid");

  // Assert
  expect(result.aborted).toBe(true);
  expect(result.reason).toBe("valid");
});
