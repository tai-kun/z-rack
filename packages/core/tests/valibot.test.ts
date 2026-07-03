import { describe, test } from "vitest";

import { InvalidInputError, InvalidOutputError, UnexpectedError } from "../src/errors.js";
import * as v from "../src/valibot.js";

const stringSchema = v.pipe(v.string(), v.minLength(1));

describe("parseInput", () => {
  test("有効な値を渡したとき、検証済みの値が返る", ({ expect }) => {
    // 実行
    const result = v.parseInput(stringSchema, "hello");

    // 検証
    expect(result).toBe("hello");
  });

  test("無効な値を渡したとき、 InvalidInputError を投げる", ({ expect }) => {
    // 実行と検証
    expect(() => v.parseInput(stringSchema, "")).toThrow(InvalidInputError);
  });

  test("無効な値を渡したとき、エラーメッセージに検証結果が含まれる", ({ expect }) => {
    // 実行と検証
    expect(() => v.parseInput(stringSchema, 123)).toThrow();
  });
});

describe("parseOutput", () => {
  test("有効な値を渡したとき、検証済みの値が返る", ({ expect }) => {
    // 実行
    const result = v.parseOutput(stringSchema, "hello");

    // 検証
    expect(result).toBe("hello");
  });

  test("無効な値を渡したとき、 InvalidOutputError を投げる", ({ expect }) => {
    // 実行と検証
    expect(() => v.parseOutput(stringSchema, "")).toThrow(InvalidOutputError);
  });
});

describe("expect", () => {
  test("有効な値を渡したとき、検証済みの値が返る", ({ expect }) => {
    // 実行
    const result = v.expect(stringSchema, "hello");

    // 検証
    expect(result).toBe("hello");
  });

  test("無効な値を渡したとき、 UnexpectedError を投げる", ({ expect }) => {
    // 実行と検証
    expect(() => v.expect(stringSchema, "")).toThrow(UnexpectedError);
  });
});
