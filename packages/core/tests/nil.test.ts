import { describe, test } from "vitest";

import nil from "../src/nil.js";

describe("nil シンボル", () => {
  test("値が Symbol である", ({ expect }) => {
    // 実行と検証
    expect(nil).toBeTypeOf("symbol");
  });

  test("説明が @z-rack/core:nil である", ({ expect }) => {
    // 実行と検証
    expect(nil.description).toBe("@z-rack/core:nil");
  });

  test("同じシンボルとの比較で同値となる", ({ expect }) => {
    // 実行と検証
    expect(nil).toBe(nil);
  });

  test("別の Symbol との比較で異値となる", ({ expect }) => {
    // 実行と検証
    expect(nil).not.toBe(Symbol("@z-rack/core:nil"));
  });
});
