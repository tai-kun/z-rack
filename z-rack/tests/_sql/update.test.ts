import { v, type MimeType } from "@z-rack/core";
import { sql } from "pgsql-template-tag";
import { test, describe } from "vitest";

import {
  UpdateMetadataBaseSql,
  UpdateTagsColumnSql,
  UpdateLanguageColumnSql,
  UpdateMimeTypeColumnSql,
  UpdateMetadataConditionSql,
  UpdateMetadataResultSchema,
} from "../../src/_sql/update.js";

describe("UpdateMetadataBaseSql", () => {
  test("UPDATE 文と SET 句の開始を含む", ({ expect }) => {
    // 実行
    const { text } = UpdateMetadataBaseSql.toJSON();

    // 検証
    expect(text).toContain("UPDATE");
    expect(text).toContain("SET");
    expect(text).toContain("UPDATE_METADATA");
  });
});

describe("各カラム更新断片", () => {
  test("UpdateTagsColumnSql が object_tags を含む", ({ expect }) => {
    // 実行
    const { text } = UpdateTagsColumnSql.fillAll({ objectTags: sql.join(["a"]) }).toJSON();

    // 検証
    expect(text).toContain("object_tags");
  });

  test("UpdateLanguageColumnSql が language を含む", ({ expect }) => {
    // 実行
    const { text } = UpdateLanguageColumnSql.fillAll({ language: "jpn" }).toJSON();

    // 検証
    expect(text).toContain("language");
  });

  test("UpdateMimeTypeColumnSql が mime_type を含む", ({ expect }) => {
    // 実行
    const { text } = UpdateMimeTypeColumnSql.fillAll({
      mimeType: "text/html" as MimeType,
    }).toJSON();

    // 検証
    expect(text).toContain("mime_type");
  });
});

describe("UpdateMetadataConditionSql", () => {
  test("WHERE 句と RETURNING 句を含む", ({ expect }) => {
    // 実行
    const { text, values } = UpdateMetadataConditionSql.fillAll({
      privateMetadataTable: sql.raw("private_metadata"),
      objectKey: "foo.mp4",
    }).toJSON();

    // 検証
    expect(text).toContain("_key =");
    expect(text).toContain("RETURNING");
    expect(values).toStrictEqual(["foo.mp4"]);
  });
});

describe("UpdateMetadataResultSchema", () => {
  test("空の配列を渡すと false を返す", ({ expect }) => {
    // 実行
    const result = v.parseOutput(UpdateMetadataResultSchema, []);

    // 検証
    expect(result).toBe(false);
  });

  test("要素が 1 つ以上ある配列を渡すと true を返す", ({ expect }) => {
    // 実行
    const result = v.parseOutput(UpdateMetadataResultSchema, [{}]);

    // 検証
    expect(result).toBe(true);
  });

  test("配列以外を渡すとエラーになる", ({ expect }) => {
    // 実行と検証
    expect(() => v.parseOutput(UpdateMetadataResultSchema, null)).toThrow();
  });
});
