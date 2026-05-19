import { describe, test } from "vitest";

import isArrayBuffer from "../src/_is-array-buffer.js";

describe("有効な ArrayBuffer を渡す場合", () => {
  test("標準的なサイズの ArrayBuffer を渡したとき、true を返す", ({ expect }) => {
    // Arrange
    const value = new ArrayBuffer(8);

    // Act
    const result = isArrayBuffer(value);

    // Assert
    expect(result).toBe(true);
  });
});

describe("ArrayBuffer ではない値を渡す場合", () => {
  test("null を渡したとき、false を返す", ({ expect }) => {
    // Arrange
    const value = null;

    // Act
    const result = isArrayBuffer(value);

    // Assert
    expect(result).toBe(false);
  });

  test("undefined を渡したとき、false を返す", ({ expect }) => {
    // Arrange
    const value = undefined;

    // Act
    const result = isArrayBuffer(value);

    // Assert
    expect(result).toBe(false);
  });

  test("TypedArray である Uint8Array を渡したとき、false を返す", ({ expect }) => {
    // Arrange
    const value = new Uint8Array(8);

    // Act
    const result = isArrayBuffer(value);

    // Assert
    expect(result).toBe(false);
  });

  test("DataView インスタンスを渡したとき、false を返す", ({ expect }) => {
    // Arrange
    const buffer = new ArrayBuffer(8);
    const value = new DataView(buffer);

    // Act
    const result = isArrayBuffer(value);

    // Assert
    expect(result).toBe(false);
  });

  test("byteLength プロパティを持つだけのプレーンオブジェクトを渡したとき、false を返す", ({
    expect,
  }) => {
    // Arrange
    const value = { byteLength: 8 };

    // Act
    const result = isArrayBuffer(value);

    // Assert
    expect(result).toBe(false);
  });

  test("数値を渡したとき、false を返す", ({ expect }) => {
    // Arrange
    const value = 123;

    // Act
    const result = isArrayBuffer(value);

    // Assert
    expect(result).toBe(false);
  });

  test("文字列を渡したとき、false を返す", ({ expect }) => {
    // Arrange
    const value = "ArrayBuffer";

    // Act
    const result = isArrayBuffer(value);

    // Assert
    expect(result).toBe(false);
  });

  test("空のオブジェクトを渡したとき、false を返す", ({ expect }) => {
    // Arrange
    const value = {};

    // Act
    const result = isArrayBuffer(value);

    // Assert
    expect(result).toBe(false);
  });

  test("SharedArrayBuffer を渡したとき、false を返す", ({ expect, skip }) => {
    // Arrange
    // 環境によって SharedArrayBuffer が未定義の場合がある。
    skip(typeof SharedArrayBuffer === "undefined");

    const value = new SharedArrayBuffer(8);

    // Act
    const result = isArrayBuffer(value);

    // Assert
    expect(result).toBe(false);
  });
});

describe("特殊な状況下での判定", () => {
  test("Symbol.toStringTag によって ArrayBuffer を偽装したプレーンオブジェクトを渡したとき、true を返す", ({
    expect,
  }) => {
    // Arrange
    // 仕様に基づき、タグ判定を用いているためこのケースは true となる。
    const value = { [Symbol.toStringTag]: "ArrayBuffer" };

    // Act
    const result = isArrayBuffer(value);

    // Assert
    expect(result).toBe(true);
  });
});
