import { sql } from "pgsql-template-tag";
import { test, describe } from "vitest";

import {
  SearchMetadataSelectSql,
  SearchMetadataBasicConditionsSql,
  SearchMetadataOrderAndPaginationSql,
} from "../../src/_sql/search.js";

describe("search SQL 断片", () => {
  test("SearchMetadataSelectSql に bm25query が含まれる", ({ expect }) => {
    // 実行
    const compiled = SearchMetadataSelectSql.fillAll({ query: "test" }).toJSON();

    // 検証
    expect(compiled.text).toContain("bm25query");
  });

  test("SearchMetadataBasicConditionsSql に検索条件が含まれる", ({ expect }) => {
    // 実行
    const compiled = SearchMetadataBasicConditionsSql.fillAll({
      privateMetadataTable: sql.raw("private_metadata"),
      textSearchFormat: "fmt",
    }).toJSON();

    // 検証
    expect(compiled.text).toContain("search_text IS NOT NULL");
  });

  test("SearchMetadataOrderAndPaginationSql に並び替えとページネーションが含まれる", ({ expect }) => {
    // 実行
    const compiled = SearchMetadataOrderAndPaginationSql.fillAll({
      take: sql.raw("10"),
      skip: sql.raw("0"),
    }).toJSON();

    // 検証
    expect(compiled.text).toContain("ORDER BY");
    expect(compiled.text).toContain("LIMIT");
    expect(compiled.text).toContain("OFFSET");
  });
});
