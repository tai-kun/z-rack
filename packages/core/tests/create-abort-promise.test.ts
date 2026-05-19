import { describe, test, vi, beforeAll, afterEach } from "vitest";

import createAbortPromise from "../src/create-abort-promise.js";

const registerSpy = vi.fn<() => void>();
const unregisterSpy = vi.fn<() => void>();

beforeAll(() => {
  vi.stubGlobal(
    "FinalizationRegistry",
    class FinalizationRegistryStub {
      register = registerSpy;
      unregister = unregisterSpy;
    },
  );
});

afterEach(() => {
  registerSpy.mockClear();
  unregisterSpy.mockClear();
});

describe("AbortSignal の状態監視", () => {
  test("既に中断されている AbortSignal を渡したとき、即座に例外を投げる", ({ expect }) => {
    // Arrange
    const controller = new AbortController();
    controller.abort(new Error("Already aborted"));
    const signal = controller.signal;

    // Act & Assert
    expect(() => createAbortPromise(signal)).toThrow("Already aborted");
  });

  test("保留中の AbortSignal が後から中断されたとき、Promise が指定された理由で reject される", async ({
    expect,
  }) => {
    // Arrange
    const controller = new AbortController();
    const signal = controller.signal;
    const customError = new Error("Abort target");

    // Act
    const promise = createAbortPromise(signal);
    controller.abort(customError);

    // Assert
    await expect(promise).rejects.toThrow(customError);
  });
});
