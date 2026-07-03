import { describe, test } from "vitest";

import { UnreachableError } from "../src/errors.js";
import unreachable from "../src/unreachable.js";

describe("unreachable 関数", () => {
  test("引数なしで呼び出したとき、 UnreachableError を投げる", ({ expect }) => {
    // 実行と検証
    expect(() => unreachable()).toThrow(UnreachableError);
  });

  test("引数なしで呼び出したとき、エラーメッセージが Unreachable code reached である", ({
    expect,
  }) => {
    // 実行と検証
    expect(() => unreachable()).toThrow("Unreachable code reached");
  });

  test("値を指定して呼び出したとき、 UnreachableError を投げる", ({ expect }) => {
    // 実行と検証
    expect(() => unreachable("some_value" as never)).toThrow(UnreachableError);
  });

  test("値を指定して呼び出したとき、エラーメッセージに値が含まれる", ({ expect }) => {
    // 実行と検証
    expect(() => unreachable("some_value" as never)).toThrow("some_value");
  });
});
