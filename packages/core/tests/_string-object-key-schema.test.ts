import { safeParse } from "valibot";
import { describe, test } from "vitest";

import StringObjectKeySchema from "../src/_string-object-key-schema.js";

describe("正常系", () => {
  test("1 文字のとき、検証に成功し変換されたオブジェクトを返す", ({ expect }) => {
    // 準備
    const input = "a";

    // 実行
    const result = safeParse(StringObjectKeySchema, input);

    // 検証
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.output).toBe("a");
    }
  });

  test("1024 文字かつ 1024 バイトのとき、検証に成功する", ({ expect }) => {
    // 準備
    const input = "a".repeat(1024);

    // 実行
    const result = safeParse(StringObjectKeySchema, input);

    // 検証
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.output).toBe(input);
    }
  });

  test("最大バイトサイズ境界内（1023 バイト）のとき、検証に成功する", ({ expect }) => {
    // 準備
    // "あ" は 3 バイト。 341 * 3 = 1023 バイト
    const input = "あ".repeat(341);

    // 実行
    const result = safeParse(StringObjectKeySchema, input);

    // 検証
    expect(result.success).toBe(true);
  });

  test("孤立サロゲートにより UTF-16 で文字化けしていても、有効な UTF-8 であれば検証に成功する", ({
    expect,
  }) => {
    // 準備
    const input = "�"; // 上位サロゲート "\uD800" が孤立している

    // 実行
    const result = safeParse(StringObjectKeySchema, input);

    // 検証
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.output).toBe(input);
    }
  });
});

describe("異常系", () => {
  test("空文字のとき、最小文字数エラーになる", ({ expect }) => {
    // 準備
    const input = "";

    // 実行
    const result = safeParse(StringObjectKeySchema, input);

    // 検証
    expect(result.success).toBe(false);
  });

  test("1025 文字のとき、最大文字数エラーになる", ({ expect }) => {
    // 準備
    const input = "a".repeat(1025);

    // 実行
    const result = safeParse(StringObjectKeySchema, input);

    // 検証
    expect(result.success).toBe(false);
  });

  test("文字数（.length）が範囲内でも 1024 バイトを超えると、バイトサイズエラーになる", ({
    expect,
  }) => {
    // 準備
    // "あ" は 3 バイト。 342 * 3 = 1026 バイト（文字数は 342 文字で 1024 以下）
    const input = "あ".repeat(342);

    // 実行
    const result = safeParse(StringObjectKeySchema, input);

    // 検証
    expect(result.success).toBe(false);
  });

  test("文字列以外の型が渡されたとき、型エラーになる", ({ expect }) => {
    // 準備
    const input = 123 as unknown as string;

    // 実行
    const result = safeParse(StringObjectKeySchema, input);

    // 検証
    expect(result.success).toBe(false);
  });
});
