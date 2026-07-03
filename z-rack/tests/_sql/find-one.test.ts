import { type ObjectKey, v } from "@z-rack/core";
import { sql } from "pgsql-template-tag";
import { test, describe } from "vitest";

import {
  FindOneMetadataSelectSql,
  FindOneMetadataConditionsSql,
  FindOneMetadataResultSchema,
} from "../../src/_sql/find-one.js";

const VALID_UUID_V7 = "018f0a9e-2b37-7000-8000-000000000000";
const VALID_ENTITY_TAG = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

describe("FindOneMetadataSelectSql", () => {
  test("SELECT 句の開始を表す", ({ expect }) => {
    // 実行
    const { text } = FindOneMetadataSelectSql.toJSON();

    // 検証
    expect(text).toContain("SELECT");
  });
});

describe("FindOneMetadataConditionsSql", () => {
  test("_key で検索する WHERE 句を含む", ({ expect }) => {
    // 実行
    const { text, values } = FindOneMetadataConditionsSql.fillAll({
      privateMetadataTable: sql.raw("private_metadata"),
      objectKey: "foo.mp4",
    }).toJSON();

    // 検証
    expect(text).toContain("FROM");
    expect(text).toContain("_key =");
    expect(values).toStrictEqual(["foo.mp4"]);
  });
});

describe("FindOneMetadataResultSchema", () => {
  test("選択したカラムの行を検証できる", ({ expect }) => {
    // 準備
    const schema = FindOneMetadataResultSchema({ id: true, key: true, eTag: true });

    // 実行
    const result = v.parseOutput(schema, [
      { id: VALID_UUID_V7, key: "foo/bar.mp4", eTag: VALID_ENTITY_TAG },
    ]);

    // 検証
    expect(result!.id).toBe(VALID_UUID_V7);
    expect((result!.key as ObjectKey).toString()).toBe("foo/bar.mp4");
    expect(result!.eTag).toBe(VALID_ENTITY_TAG);
  });

  test("空の配列を渡すと undefined を返す", ({ expect }) => {
    // 準備
    const schema = FindOneMetadataResultSchema({ id: true });

    // 実行
    const result = v.parseOutput(schema, []);

    // 検証
    expect(result).toBeUndefined();
  });

  test("選択しなかったカラムは結果に含まれない", ({ expect }) => {
    // 準備
    const schema = FindOneMetadataResultSchema({ id: true });

    // 実行
    const result = v.parseOutput(schema, [
      { id: VALID_UUID_V7, key: "foo.mp4", eTag: VALID_ENTITY_TAG },
    ]);

    // 検証
    expect(result!.id).toBe(VALID_UUID_V7);
    expect(result!).not.toHaveProperty("key");
    expect(result!).not.toHaveProperty("eTag");
  });
});
