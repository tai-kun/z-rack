import { describe, test } from "vitest";

import utf8 from "../src/utf8.js";

describe("utf8 インスタンス", () => {
  test("有効な文字列をエンコードしたとき、正しいバイト列が返る", ({ expect }) => {
    // 準備
    const input = "Hello, 世界";

    // 実行
    const encoded = utf8.encode(input);

    // 検証
    expect(encoded).toBeInstanceOf(Uint8Array);
    expect(utf8.decode(encoded)).toBe(input);
  });

  test("空文字列をエンコードしたとき、空のバイト列が返る", ({ expect }) => {
    // 実行
    const encoded = utf8.encode("");

    // 検証
    expect(encoded).toStrictEqual(new Uint8Array([]));
  });

  test("不正なバイト列をデコードしたとき、エラーを投げる", ({ expect }) => {
    // 準備
    const invalidBytes = new Uint8Array([0xff, 0xfe, 0x00]);

    // 実行と検証
    expect(() => utf8.decode(invalidBytes)).toThrow();
  });

  test("BOM 付きのバイト列をデコードしたとき、 BOM が除去される", ({ expect }) => {
    // 準備
    const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
    const text = utf8.encode("Hello");
    const withBom = new Uint8Array(bom.length + text.length);
    withBom.set(bom);
    withBom.set(text, bom.length);

    // 実行
    const decoded = utf8.decode(withBom);

    // 検証
    expect(decoded).toBe("Hello");
  });
});
