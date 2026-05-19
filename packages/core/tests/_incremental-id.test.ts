import { describe, test } from "vitest";

import IncrementalId from "../src/_incremental-id.js";

describe("get メソッド", () => {
  test("インスタンス生成直後に get を実行したとき、1 が返却される", ({ expect }) => {
    // Arrange
    const sut = new IncrementalId();

    // Act
    const result = sut.get();

    // Assert
    expect(result).toBe(1);
  });

  test("get を 3 回連続で実行したとき、1、2、3 と順番に返却される", ({ expect }) => {
    // Arrange
    const sut = new IncrementalId();

    // Act
    const results = [sut.get(), sut.get(), sut.get()];

    // Assert
    expect(results).toStrictEqual([1, 2, 3]);
  });

  test("一度 get を実行したあと再度 get を実行したとき、前回の値に 1 加算された値が返却される", ({
    expect,
  }) => {
    // Arrange
    const sut = new IncrementalId();
    sut.get();

    // Act
    const result = sut.get();

    // Assert
    expect(result).toBe(2);
  });

  test("インスタンス A と B を生成しそれぞれ get を実行したとき、一方の操作がもう一方の戻り値に影響を与えない", ({
    expect,
  }) => {
    // Arrange
    const sutA = new IncrementalId();
    const sutB = new IncrementalId();

    // Act
    sutA.get();
    sutA.get();
    const resultA = sutA.get();
    const resultB = sutB.get();

    // Assert
    expect(resultA).toBe(3);
    expect(resultB).toBe(1);
  });
});
