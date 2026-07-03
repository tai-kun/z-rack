import { sql } from "pgsql-template-tag";
import { test, describe } from "vitest";

import {
  FindManyMetadataSelectSql,
  FindManyMetadataBasicConditionsSql,
  FindManyMetadataPaginationSql,
} from "../../src/_sql/find-many.js";

describe("find-many SQL 断片", () => {
  test("FindManyMetadataSelectSql がテキストを含む SQL を生成する", ({ expect }) => {
    // 実行
    const compiled = FindManyMetadataSelectSql.toJSON();

    // 検証
    expect(compiled.text.length).toBeGreaterThan(0);
  });

  test("FindManyMetadataBasicConditionsSql に FROM 句と WHERE 句が含まれる", ({ expect }) => {
    // 実行
    const compiled = FindManyMetadataBasicConditionsSql.fillAll({
      privateMetadataTable: sql.raw("private_metadata"),
    }).toJSON();

    // 検証
    expect(compiled.text).toContain("FROM");
    expect(compiled.text).toContain("_key IS NOT NULL");
  });

  test("FindManyMetadataPaginationSql に LIMIT 句と OFFSET 句が含まれる", ({ expect }) => {
    // 実行
    const compiled = FindManyMetadataPaginationSql.fillAll({
      take: sql.raw("10"),
      skip: sql.raw("0"),
    }).toJSON();

    // 検証
    expect(compiled.text).toContain("LIMIT");
    expect(compiled.text).toContain("OFFSET");
  });
});
