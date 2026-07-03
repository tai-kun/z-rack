import { describe, test } from "vitest";

import isError from "../src/is-error.js";

describe("正常系", () => {
  test("Error インスタンスを渡したとき、 true を返す", ({ expect }) => {
    // 実行と検証
    expect(isError(new Error())).toBe(true);
  });

  test("TypeError インスタンスを渡したとき、 true を返す", ({ expect }) => {
    // 実行と検証
    expect(isError(new TypeError())).toBe(true);
  });

  test("RangeError インスタンスを渡したとき、 true を返す", ({ expect }) => {
    // 実行と検証
    expect(isError(new RangeError())).toBe(true);
  });
});

describe("異常系", () => {
  test("プレーンオブジェクトを渡したとき、 false を返す", ({ expect }) => {
    // 実行と検証
    expect(isError({ message: "foo" })).toBe(false);
  });

  test("null を渡したとき、 false を返す", ({ expect }) => {
    // 実行と検証
    expect(isError(null)).toBe(false);
  });

  test("undefined を渡したとき、 false を返す", ({ expect }) => {
    // 実行と検証
    expect(isError(undefined)).toBe(false);
  });

  test("文字列を渡したとき、 false を返す", ({ expect }) => {
    // 実行と検証
    expect(isError("error")).toBe(false);
  });

  test("数値を渡したとき、 false を返す", ({ expect }) => {
    // 実行と検証
    expect(isError(42)).toBe(false);
  });
});
