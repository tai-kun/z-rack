import { describe, test } from "vitest";

import loadWasm from "../src/load-wasm.js";

const MOCK_EXPORTS = { __wbindgen_start: () => {} } as unknown as WebAssembly.Exports;

describe("loadWasm", () => {
  test("WebAssembly.Exports に準拠したオブジェクトを渡したとき、そのまま返る", async ({
    expect,
  }) => {
    // 実行
    const result = await loadWasm(MOCK_EXPORTS);

    // 検証
    expect(result).toBe(MOCK_EXPORTS);
  });

  test("初期化関数を渡したとき、エクスポートオブジェクトが返る", async ({ expect }) => {
    // 実行
    const result = await loadWasm(() => MOCK_EXPORTS);

    // 検証
    expect(result).toBe(MOCK_EXPORTS);
  });

  test("null を渡したとき、エラーを投げる", async ({ expect }) => {
    // 実行と検証
    await expect(loadWasm(null as any)).rejects.toThrow();
  });

  test("数値を渡したとき、エラーを投げる", async ({ expect }) => {
    // 実行と検証
    await expect(loadWasm(42 as any)).rejects.toThrow();
  });
});
