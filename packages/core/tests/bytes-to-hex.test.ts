import { describe, test } from "vitest";

import bytesToHex from "../src/bytes-to-hex.js";

describe("基本的な変換の振る舞い", () => {
  test("有効なバイト配列を渡したとき、 2 桁固定の小文字 16 進数文字列に変換される", ({
    expect,
  }) => {
    // 準備
    const bytes = new Uint8Array([0, 1, 2, 15, 16, 255]);

    // 実行
    const result = bytesToHex(bytes);

    // 検証
    expect(result).toBe("0001020f10ff");
  });

  test("空のバイト配列を渡したとき、空文字列を返す", ({ expect }) => {
    // 準備
    const bytes = new Uint8Array([]);

    // 実行
    const result = bytesToHex(bytes);

    // 検証
    expect(result).toBe("");
  });
});

describe("異常系", () => {
  test("引数に null を渡したとき、例外を投げる", ({ expect }) => {
    // 準備
    const input = null as unknown as Uint8Array;

    // 実行と検証
    expect(() => bytesToHex(input)).toThrow();
  });

  test("引数に undefined を渡したとき、例外を投げる", ({ expect }) => {
    // 準備
    const input = undefined as unknown as Uint8Array;

    // 実行と検証
    expect(() => bytesToHex(input)).toThrow();
  });
});
