import { describe, test } from "vitest";

import ISO639_PART2_ALPHA3_CODES, {
  type Iso639Part2Alpha3Code,
} from "../src/iso639-part2-alpha3-codes.js";

describe("配列の整合性", () => {
  test("定義済みのコード aar を確認したとき、配列に含まれていると判定される", ({ expect }) => {
    // Arrange
    const target = "aar";

    // Act
    const result = ISO639_PART2_ALPHA3_CODES.includes(target as Iso639Part2Alpha3Code);

    // Assert
    expect(result).toBe(true);
  });

  test("無効な文字列 invalid を確認したとき、配列に含まれていないと判定される", ({ expect }) => {
    // Arrange
    const target = "invalid";

    // Act
    const result = ISO639_PART2_ALPHA3_CODES.includes(target as any);

    // Assert
    expect(result).toBe(false);
  });

  test("すべての要素は 3 文字の小文字のアルファベットで表現される", ({ expect }) => {
    // Assert
    for (const code of ISO639_PART2_ALPHA3_CODES) {
      expect(code).toMatch(/^[a-z]{3}$/);
    }
  });
});

describe("境界値と特殊条件", () => {
  test("重複要素を確認したとき、配列内に重複したコードが存在しない", ({ expect }) => {
    // Arrange
    const originalLength = ISO639_PART2_ALPHA3_CODES.length;

    // Act
    const uniqueCount = new Set(ISO639_PART2_ALPHA3_CODES).size;

    // Assert
    expect(uniqueCount).toBe(originalLength);
  });
});
