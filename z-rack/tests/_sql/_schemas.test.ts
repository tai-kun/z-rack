import { uuid58Encode } from "@nakanoaas/uuid58";
import { type ObjectKey, v } from "@z-rack/core";
import { test, describe } from "vitest";

import { MetadataSelectResultSchema } from "../../src/_sql/_schemas.js";

const VALID_UUID_V7 = "018f0a9e-2b37-7000-8000-000000000000";
const VALID_ENTITY_TAG = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const VALID_ENTITY_ID = uuid58Encode(VALID_UUID_V7);

describe("MetadataSelectResultSchema", () => {
  test("すべてのカラムを選択したとき、入力がすべて検証される", ({ expect }) => {
    // 準備
    const schema = MetadataSelectResultSchema({
      id: true,
      key: true,
      eTag: true,
      size: true,
      tags: true,
      entityId: true,
      language: true,
      mimeType: true,
      createdAt: true,
      recordType: true,
      description: true,
      userMetadata: true,
      lastModifiedAt: true,
      recordTimestamp: true,
    });
    const input = {
      id: VALID_UUID_V7,
      key: "foo/bar.mp4",
      eTag: VALID_ENTITY_TAG,
      size: "3",
      tags: ["tag1", "tag2"],
      entityId: VALID_ENTITY_ID,
      language: "jpn",
      mimeType: "text/html",
      createdAt: new Date("2026-01-01").getTime(),
      recordType: "CREATE",
      description: "説明文",
      userMetadata: { foo: "bar" },
      lastModifiedAt: new Date("2026-01-02").getTime(),
      recordTimestamp: new Date("2026-01-03").getTime(),
    };

    // 実行
    const result = v.parseOutput(schema, input);

    // 検証
    expect(result.id).toBe(VALID_UUID_V7);
    expect((result.key as ObjectKey).toString()).toBe("foo/bar.mp4");
    expect(result.eTag).toBe(VALID_ENTITY_TAG);
    expect(result.tags).toStrictEqual(new Set(["tag1", "tag2"]));
    expect(result.size).toBe(3);
  });

  test("一部のカラムのみを選択したとき、選択したカラムだけが検証される", ({ expect }) => {
    // 準備
    const schema = MetadataSelectResultSchema({ id: true, key: true });

    // 実行
    const result = v.parseOutput(schema, {
      id: VALID_UUID_V7,
      key: "foo/bar.mp4",
      eTag: VALID_ENTITY_TAG,
    });

    // 検証
    expect(result.id).toBe(VALID_UUID_V7);
    expect((result.key as ObjectKey).toString()).toBe("foo/bar.mp4");
    expect(result).not.toHaveProperty("eTag");
  });

  test("選択するカラムがないとき、空のオブジェクトが返る", ({ expect }) => {
    // 準備
    const schema = MetadataSelectResultSchema({});

    // 実行
    const result = v.parseOutput(schema, {});

    // 検証
    expect(result).toStrictEqual({});
  });

  test("size が文字列でも数値に変換される", ({ expect }) => {
    // 準備
    const schema = MetadataSelectResultSchema({ size: true });

    // 実行
    const result = v.parseOutput(schema, { size: "12345" });

    // 検証
    expect(result.size).toBe(12345);
  });

  test("size が bigint でも数値に変換される", ({ expect }) => {
    // 準備
    const schema = MetadataSelectResultSchema({ size: true });

    // 実行
    const result = v.parseOutput(schema, { size: 12345n });

    // 検証
    expect(result.size).toBe(12345);
  });

  test("size が数値のとき、そのまま使われる", ({ expect }) => {
    // 準備
    const schema = MetadataSelectResultSchema({ size: true });

    // 実行
    const result = v.parseOutput(schema, { size: 12345 });

    // 検証
    expect(result.size).toBe(12345);
  });

  test("tags が配列のとき、Set に変換される", ({ expect }) => {
    // 準備
    const schema = MetadataSelectResultSchema({ tags: true });

    // 実行
    const result = v.parseOutput(schema, { tags: ["a", "b", "c"] });

    // 検証
    expect(result.tags).toStrictEqual(new Set(["a", "b", "c"]));
  });

  test("base 引数でスキーマを拡張できる", ({ expect }) => {
    // 準備
    const schema = MetadataSelectResultSchema(
      { id: true },
      { score: v.pipe(v.number(), v.finite()) },
    );

    // 実行
    const result = v.parseOutput(schema, { id: VALID_UUID_V7, score: 0.5 });

    // 検証
    expect(result.id).toBeTypeOf("string");
    expect(result.score).toBe(0.5);
  });

  test("NULL が許容されているカラムに null を渡せる", ({ expect }) => {
    // 準備
    const schema = MetadataSelectResultSchema({ language: true, description: true });

    // 実行
    const result = v.parseOutput(schema, { language: null, description: null });

    // 検証
    expect(result.language).toBeNull();
    expect(result.description).toBeNull();
  });

  test("無効な言語コードで検証エラーになる", ({ expect }) => {
    // 準備
    const schema = MetadataSelectResultSchema({ language: true });

    // 実行と検証
    expect(() => v.parseOutput(schema, { language: "invalid" })).toThrow();
  });
});
