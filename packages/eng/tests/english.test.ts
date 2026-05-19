import { describe, test } from "vitest";

import English from "../src/english.js";

describe("初期化されたとき", () => {
  test("メタデータが仕様通りの初期値になっている", ({ expect }) => {
    // Arrange
    const sut = new English();

    // Act & Assert
    expect(sut.format).toBe("package=%40z-rack%2Feng&version=0&class=English");
    expect(sut.textConfig).toBe("english");
    expect(sut.defaultLanguage).toBe("eng");

    expect(sut.supportedLanguages).toStrictEqual(["eng"]);

    expect(sut.isOpen).toBe(true);
  });
});

describe("normalize を実行したとき", () => {
  test("入力された文字列が NFKC 正規化される", ({ expect }) => {
    // Arrange
    const sut = new English();
    const text = "Ｈｅｌｌｏ １２３";
    const expected = "Hello 123";

    // Act
    const result = sut.normalize({ text });

    // Assert
    expect(result).toBe(expected);
  });

  test("丸囲み数字などの特殊記号が通常の文字に分解・正規化される", ({ expect }) => {
    // Arrange
    const sut = new English();
    const text = "①";
    const expected = "1";

    // Act
    const result = sut.normalize({ text });

    // Assert
    expect(result).toBe(expected);
  });

  test("空文字列を入力した場合、空文字列が返る", ({ expect }) => {
    // Arrange
    const sut = new English();
    const text = "";

    // Act
    const result = sut.normalize({ text });

    // Assert
    expect(result).toBe("");
  });

  test("制御文字が含まれていても、エラーを投げずに処理が完了する", ({ expect }) => {
    // Arrange
    const sut = new English();
    const text = "Hello\u0000World";

    // Act & Assert
    expect(() => sut.normalize({ text })).not.toThrow();
  });
});
