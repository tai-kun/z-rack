import { test, describe } from "vitest";

import {
  UnsupportedLanguageError,
  ZRackIsOpenError,
  ZRackIsNotOpenError,
  ObjectExistsError,
  ObjectNotFoundError,
} from "../src/errors.js";

describe("UnsupportedLanguageError", () => {
  test("エラー名が ZRackUnsupportedLanguageError である", ({ expect }) => {
    // 準備と実行
    const error = new UnsupportedLanguageError({ lang: "fra" });

    // 検証
    expect(error.name).toBe("ZRackUnsupportedLanguageError");
  });

  test("メタデータに言語コードが格納される", ({ expect }) => {
    // 準備と実行
    const error = new UnsupportedLanguageError({ lang: "fra" });

    // 検証
    expect(error.meta).toStrictEqual({ lang: "fra" });
  });

  test("英語のエラーメッセージが生成される", ({ expect }) => {
    // 準備と実行
    const error = new UnsupportedLanguageError({ lang: "jpn" });

    // 検証
    expect(error.message).toBe('Unsupported language: "jpn"');
  });

  test("cause を渡せる", ({ expect }) => {
    // 準備
    const cause = new Error("原因");

    // 実行
    const error = new UnsupportedLanguageError({ lang: "fra", cause });

    // 検証
    expect(error.cause).toBe(cause);
  });
});

describe("ZRackIsOpenError", () => {
  test("エラー名が ZRackIsOpenError である", ({ expect }) => {
    // 準備と実行
    const error = new ZRackIsOpenError();

    // 検証
    expect(error.name).toBe("ZRackIsOpenError");
  });

  test("英語のエラーメッセージが生成される", ({ expect }) => {
    // 準備と実行
    const error = new ZRackIsOpenError();

    // 検証
    expect(error.message).toBe("ZRack is open");
  });

  test("cause を渡せる", ({ expect }) => {
    // 準備
    const cause = new Error("原因");

    // 実行
    const error = new ZRackIsOpenError({ cause });

    // 検証
    expect(error.cause).toBe(cause);
  });
});

describe("ZRackIsNotOpenError", () => {
  test("エラー名が ZRackIsNotOpenError である", ({ expect }) => {
    // 準備と実行
    const error = new ZRackIsNotOpenError();

    // 検証
    expect(error.name).toBe("ZRackIsNotOpenError");
  });

  test("英語のエラーメッセージが生成される", ({ expect }) => {
    // 準備と実行
    const error = new ZRackIsNotOpenError();

    // 検証
    expect(error.message).toBe("ZRack is not open");
  });
});

describe("ObjectExistsError", () => {
  test("エラー名が ZRackObjectExistsError である", ({ expect }) => {
    // 準備と実行
    const error = new ObjectExistsError({ key: "foo.mp4" });

    // 検証
    expect(error.name).toBe("ZRackObjectExistsError");
  });

  test("メタデータにキーが格納される", ({ expect }) => {
    // 準備と実行
    const error = new ObjectExistsError({ key: "foo.mp4" });

    // 検証
    expect(error.meta).toStrictEqual({ key: "foo.mp4" });
  });

  test("英語のエラーメッセージが生成される", ({ expect }) => {
    // 準備と実行
    const error = new ObjectExistsError({ key: "foo.mp4" });

    // 検証
    expect(error.message).toBe('Object exists: "foo.mp4"');
  });

  test("cause を渡せる", ({ expect }) => {
    // 準備
    const cause = new Error("原因");

    // 実行
    const error = new ObjectExistsError({ key: "foo.mp4", cause });

    // 検証
    expect(error.cause).toBe(cause);
  });
});

describe("ObjectNotFoundError", () => {
  test("エラー名が ZRackObjectNotFoundError である", ({ expect }) => {
    // 準備と実行
    const error = new ObjectNotFoundError({ key: "bar.mp4" });

    // 検証
    expect(error.name).toBe("ZRackObjectNotFoundError");
  });

  test("メタデータにキーが格納される", ({ expect }) => {
    // 準備と実行
    const error = new ObjectNotFoundError({ key: "bar.mp4" });

    // 検証
    expect(error.meta).toStrictEqual({ key: "bar.mp4" });
  });

  test("英語のエラーメッセージが生成される", ({ expect }) => {
    // 準備と実行
    const error = new ObjectNotFoundError({ key: "bar.mp4" });

    // 検証
    expect(error.message).toBe('Object not found: "bar.mp4"');
  });

  test("cause を渡せる", ({ expect }) => {
    // 準備
    const cause = new Error("原因");

    // 実行
    const error = new ObjectNotFoundError({ key: "bar.mp4", cause });

    // 検証
    expect(error.cause).toBe(cause);
  });
});
