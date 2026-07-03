import { v } from "@z-rack/core";
import { sql } from "pgsql-template-tag";
import { test, describe } from "vitest";

import { ExistsMetadataSql, ExistsMetadataResultSchema } from "../../src/_sql/exists.js";

describe("ExistsMetadataSql", () => {
  test("SQL にキープレースホルダーが含まれる", ({ expect }) => {
    // 実行
    const { text, values } = ExistsMetadataSql.fillAll({
      privateMetadataTable: sql.raw("private_metadata"),
      objectKey: "foo.mp4",
    }).toJSON();

    // 検証
    expect(text).toContain("SELECT 1");
    expect(text).toContain("FROM");
    expect(values).toStrictEqual(["foo.mp4"]);
  });
});

describe("ExistsMetadataResultSchema", () => {
  test("空の配列を渡すと false を返す", ({ expect }) => {
    // 実行
    const result = v.parseOutput(ExistsMetadataResultSchema, []);

    // 検証
    expect(result).toBe(false);
  });

  test("要素が 1 つ以上ある配列を渡すと true を返す", ({ expect }) => {
    // 実行
    const result = v.parseOutput(ExistsMetadataResultSchema, [{}]);

    // 検証
    expect(result).toBe(true);
  });

  test("配列以外を渡すとエラーになる", ({ expect }) => {
    // 実行と検証
    expect(() => v.parseOutput(ExistsMetadataResultSchema, null)).toThrow();
  });
});
