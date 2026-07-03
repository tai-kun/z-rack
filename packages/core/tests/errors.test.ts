import { describe, test } from "vitest";

import {
  ErrorBase,
  InvalidUsageErrorBase,
  InvalidInputError,
  InvalidOutputError,
  InvalidInputTypeError,
  HttpResponseError,
  UnexpectedErrorBase,
  UnreachableError,
  UnexpectedError,
} from "../src/errors.js";

describe("ErrorBase", () => {
  test("インスタンスを生成したとき、 Error を継承する", ({ expect }) => {
    // 実行
    const error = new ErrorBase(undefined, "");

    // 検証
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ErrorBase);
  });
});

describe("InvalidUsageErrorBase", () => {
  test("インスタンスを生成したとき、 ErrorBase を継承する", ({ expect }) => {
    // 実行
    const error = new InvalidUsageErrorBase(undefined, "");

    // 検証
    expect(error).toBeInstanceOf(ErrorBase);
    expect(error).toBeInstanceOf(InvalidUsageErrorBase);
  });
});

describe("InvalidInputError", () => {
  test("値を与えてインスタンスを生成したとき、 issues のメッセージがコロンとスペースで連結されたメッセージになる", ({
    expect,
  }) => {
    // 準備
    const value = 123;
    const issues = [{ message: "expected string" }, { message: "received number" }] as any;

    // 実行
    const error = new InvalidInputError({ value, issues });

    // 検証
    expect(error.message).toBe("expected string: received number");
  });

  test("1 つの issue を与えたとき、そのメッセージがそのままエラーメッセージになる", ({
    expect,
  }) => {
    // 準備
    const issues = [{ message: "validation error" }] as any;

    // 実行
    const error = new InvalidInputError({ value: null, issues });

    // 検証
    expect(error.message).toBe("validation error");
  });

  test("エラー名が ZRackInvalidInputError である", ({ expect }) => {
    // 準備
    const error = new InvalidInputError({ value: 123, issues: [{ message: "e" }] as any });

    // 実行と検証
    expect(error.name).toBe("ZRackInvalidInputError");
  });
});

describe("InvalidOutputError", () => {
  test("値を与えてインスタンスを生成したとき、 issues のメッセージがコロンとスペースで連結されたメッセージになる", ({
    expect,
  }) => {
    // 準備
    const issues = [{ message: "expected valid output" }] as any;

    // 実行
    const error = new InvalidOutputError({ value: "invalid data", issues });

    // 検証
    expect(error.message).toBe("expected valid output");
  });

  test("エラー名が ZRackInvalidOutputError である", ({ expect }) => {
    // 準備
    const error = new InvalidOutputError({ value: "invalid", issues: [{ message: "e" }] as any });

    // 実行と検証
    expect(error.name).toBe("ZRackInvalidOutputError");
  });
});

describe("InvalidInputTypeError", () => {
  test("数値入力を与えたとき、自動的に型名が検出される", ({ expect }) => {
    // 実行
    const error = new InvalidInputTypeError({ input: 42, expectedType: "string" });

    // 検証
    expect(error.message).toContain("number");
    expect(error.message).toContain("string");
  });

  test("カスタム inputType を指定したとき、その型名がメッセージに使用される", ({ expect }) => {
    // 実行
    const error = new InvalidInputTypeError({
      input: 42,
      inputType: "custom",
      expectedType: "string",
    });

    // 検証
    expect(error.message).toContain("custom");
    expect(error.message).toContain("string");
  });

  test("エラー名が ZRackInvalidInputTypeError である", ({ expect }) => {
    // 準備
    const error = new InvalidInputTypeError({ input: 42, expectedType: "string" });

    // 実行と検証
    expect(error.name).toBe("ZRackInvalidInputTypeError");
  });
});

describe("HttpResponseError", () => {
  test("レスポンスを与えたとき、ステータスコードとステータステキストがメッセージに含まれる", ({
    expect,
  }) => {
    // 準備
    const response = new Response(null, { status: 404, statusText: "Not Found" });

    // 実行
    const error = new HttpResponseError({ response });

    // 検証
    expect(error.message).toContain("404");
    expect(error.message).toContain("Not Found");
  });

  test("エラー名が ZRackHttpResponseError である", ({ expect }) => {
    // 準備
    const response = new Response(null, { status: 200 });
    const error = new HttpResponseError({ response });

    // 実行と検証
    expect(error.name).toBe("ZRackHttpResponseError");
  });
});

describe("UnexpectedErrorBase", () => {
  test("インスタンスを生成したとき、 ErrorBase を継承する", ({ expect }) => {
    // 実行
    const error = new UnexpectedErrorBase(undefined, "");

    // 検証
    expect(error).toBeInstanceOf(ErrorBase);
    expect(error).toBeInstanceOf(UnexpectedErrorBase);
  });
});

describe("UnreachableError", () => {
  test("値を与えずにインスタンスを生成したとき、デフォルトメッセージが設定される", ({ expect }) => {
    // 実行
    const error = new UnreachableError({});

    // 検証
    expect(error.message).toBe("Unreachable code reached");
  });

  test("値を与えてインスタンスを生成したとき、メッセージに値が含まれる", ({ expect }) => {
    // 実行
    const error = new UnreachableError({ value: "unexpected_value" });

    // 検証
    expect(error.message).toContain("unexpected_value");
  });

  test("エラー名が ZRackUnreachableError である", ({ expect }) => {
    // 準備
    const error = new UnreachableError({});

    // 実行と検証
    expect(error.name).toBe("ZRackUnreachableError");
  });
});

describe("UnexpectedError", () => {
  test("値を与えてインスタンスを生成したとき、 issues のメッセージがコロンとスペースで連結されたメッセージになる", ({
    expect,
  }) => {
    // 準備
    const issues = [{ message: "validation failed" }] as any;

    // 実行
    const error = new UnexpectedError({ value: "unexpected", issues });

    // 検証
    expect(error.message).toBe("validation failed");
  });

  test("エラー名が ZRackUnexpectedError である", ({ expect }) => {
    // 準備
    const error = new UnexpectedError({ value: "x", issues: [{ message: "e" }] as any });

    // 実行と検証
    expect(error.name).toBe("ZRackUnexpectedError");
  });
});
