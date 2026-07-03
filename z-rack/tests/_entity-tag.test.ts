import { describe, test } from "vitest";

import entityTag from "../src/_entity-tag.js";

const EMPTY_SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const HELLO_SHA256 = "185f8db32271fe25f561a6fc938b2e264306ec304eda518007d1764826381969";
const textEncoder = new TextEncoder();

describe("一括計算機能", () => {
  test("長さ 0 の空データを渡したとき、空データに対する SHA-256 のハッシュ値が返される", ({
    expect,
  }) => {
    // 準備
    const input = new Uint8Array(0);

    // 実行
    const result = entityTag.digest(input);

    // 検証
    expect(result).toBe(EMPTY_SHA256);
  });

  test("標準的なテキストデータを渡したとき、対応する正しい SHA-256 のハッシュ値が返される", ({
    expect,
  }) => {
    // 準備
    const input = textEncoder.encode("Hello");

    // 実行
    const result = entityTag.digest(input);

    // 検証
    expect(result).toBe(HELLO_SHA256);
  });

  test("同一のデータを持つ別インスタンスの配列を渡したとき、完全に一致するエンティティータグが返される", ({
    expect,
  }) => {
    // 準備
    const input1 = textEncoder.encode("Hello");
    const input2 = textEncoder.encode("Hello");

    // 実行
    const result1 = entityTag.digest(input1);
    const result2 = entityTag.digest(input2);

    // 検証
    expect(result1).toBe(result2);
  });

  test("1 ビットだけ異なるデータを渡したとき、全く異なるエンティティータグが返される", ({
    expect,
  }) => {
    // 準備
    const originalInput = textEncoder.encode("Hello");
    const modifiedInput = new Uint8Array(originalInput);
    modifiedInput[0] = modifiedInput[0]! ^ 1;

    // 実行
    const originalResult = entityTag.digest(originalInput);
    const modifiedResult = entityTag.digest(modifiedInput);

    // 検証
    expect(originalResult).not.toBe(modifiedResult);
  });
});

describe("逐次処理機構の生成", () => {
  test("機構を生成したとき、update および digest メソッドを持つオブジェクトが返される", ({
    expect,
  }) => {
    // 準備
    const hasher = entityTag.hasher();

    // 検証
    expect(hasher["update"]).toBeTypeOf("function");
    expect(hasher["digest"]).toBeTypeOf("function");
  });

  test("機構を複数回生成したとき、それぞれが内部状態を共有しない独立したインスタンスになる", ({
    expect,
  }) => {
    // 準備
    const hasher1 = entityTag.hasher();
    const hasher2 = entityTag.hasher();

    // 実行
    hasher1.update(textEncoder.encode("A"));
    hasher2.update(textEncoder.encode("B"));

    // 検証
    expect(hasher1.digest()).not.toBe(hasher2.digest());
  });
});

describe("逐次計算機能", () => {
  test("データを一度も投入せずに計算を完了したとき、空データのハッシュ値が返される", ({
    expect,
  }) => {
    // 準備
    const hasher = entityTag.hasher();

    // 実行
    const result = hasher.digest();

    // 検証
    expect(result).toBe(EMPTY_SHA256);
  });

  test("単一のデータを投入して計算を完了したとき、同じデータを一括計算した場合と同じハッシュ値が返される", ({
    expect,
  }) => {
    // 準備
    const input = textEncoder.encode("Hello");
    const hasher = entityTag.hasher();

    // 実行
    hasher.update(input);
    const result = hasher.digest();

    // 検証
    expect(result).toBe(entityTag.digest(input));
  });

  test("1 つのデータを分割して順に投入したとき、分割前のデータ全体を一括計算した場合と同じハッシュ値が返される", ({
    expect,
  }) => {
    // 準備
    const input = textEncoder.encode("HelloWorld");
    const part1 = input.subarray(0, 5);
    const part2 = input.subarray(5, 10);
    const hasher = entityTag.hasher();

    // 実行
    hasher.update(part1);
    hasher.update(part2);
    const result = hasher.digest();

    // 検証
    expect(result).toBe(entityTag.digest(input));
  });

  test("データの途中で空のバイト配列を投入したとき、空配列を無視して結合された状態のハッシュ値が返される", ({
    expect,
  }) => {
    // 準備
    const input1 = textEncoder.encode("Hel");
    const emptyInput = new Uint8Array(0);
    const input2 = textEncoder.encode("lo");
    const hasher = entityTag.hasher();

    // 実行
    hasher.update(input1);
    hasher.update(emptyInput);
    hasher.update(input2);
    const result = hasher.digest();

    // 検証
    expect(result).toBe(HELLO_SHA256);
  });
});

describe("境界値および特殊条件", () => {
  test("大容量のバイト配列を一括投入したとき、メモリー溢れを起こさずに正しいエンティティータグが返される", ({
    expect,
  }) => {
    // 準備
    const largeDataSize = 10 * 1024 * 1024; // 10MB
    const largeData = new Uint8Array(largeDataSize);

    // 実行
    const result = entityTag.digest(largeData);

    // 検証
    expect(result).toBeTypeOf("string");
    expect(result.length).toBe(64);
  });

  test("逐次処理で計算を完了したあとに再度完了処理を呼び出したとき、エラーが送出される", ({
    expect,
  }) => {
    // 準備
    const hasher = entityTag.hasher();
    hasher.update(textEncoder.encode("Hello"));
    hasher.digest();

    // 実行と検証
    expect(() => hasher.digest()).toThrow();
  });

  test("計算完了後にデータを追加投入したとき、内部状態の不整合を防ぐためエラーが送出される", ({
    expect,
  }) => {
    // 準備
    const hasher = entityTag.hasher();
    hasher.update(textEncoder.encode("Hello"));
    hasher.digest();

    // 実行と検証
    expect(() => hasher.update(textEncoder.encode("World"))).toThrow();
  });
});
