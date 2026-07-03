import { describe, test } from "vitest";

import English from "../src/english.js";

describe("初期化されたとき", () => {
  test("メタデータが仕様通りの初期値になっている", ({ expect }) => {
    // 準備
    const sut = new English();

    // 実行と検証
    expect(sut.format).toBe("package=%40z-rack%2Feng&version=0&class=English");
    expect(sut.textConfig).toBe("english");
    expect(sut.defaultLanguage).toBe("eng");

    expect(sut.supportedLanguages).toStrictEqual(["eng"]);

    expect(sut.isOpen).toBe(true);
  });
});

describe("normalize を実行したとき", () => {
  test("入力された文字列が NFKC 正規化される", ({ expect }) => {
    // 準備
    const sut = new English();
    const text = "Ｈｅｌｌｏ １２３";
    const expected = "Hello 123";

    // 実行
    const result = sut.normalize({ text });

    // 検証
    expect(result).toBe(expected);
  });

  test("丸囲み数字などの特殊記号が通常の文字に分解・正規化される", ({ expect }) => {
    // 準備
    const sut = new English();
    const text = "①";
    const expected = "1";

    // 実行
    const result = sut.normalize({ text });

    // 検証
    expect(result).toBe(expected);
  });

  test("空文字列を入力した場合、空文字列が返る", ({ expect }) => {
    // 準備
    const sut = new English();
    const text = "";

    // 実行
    const result = sut.normalize({ text });

    // 検証
    expect(result).toBe("");
  });

  test("制御文字が含まれていても、エラーを投げずに処理が完了する", ({ expect }) => {
    // 準備
    const sut = new English();
    const text = "Hello\u0000World";

    // 実行と検証
    expect(() => sut.normalize({ text })).not.toThrow();
  });
});
