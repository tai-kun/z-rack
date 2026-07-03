import { sql } from "pgsql-template-tag";
import { test, describe } from "vitest";

import {
  IdColumnSql,
  ETagColumnSql,
  SizeColumnSql,
  TagsColumnSql,
  KeyColumnSql,
  EntityIdColumnSql,
  LanguageColumnSql,
  MimeTypeColumnSql,
  CreatedAtColumnSql,
  RecordTypeColumnSql,
  DescriptionColumnSql,
  UserMetadataColumnSql,
  LastModifiedAtColumnSql,
  RecordTimestampColumnSql,
} from "../../src/_sql/private-metadata-columns.js";

const fragments = [
  ["IdColumnSql", IdColumnSql],
  ["ETagColumnSql", ETagColumnSql],
  ["SizeColumnSql", SizeColumnSql],
  ["TagsColumnSql", TagsColumnSql],
  ["KeyColumnSql", KeyColumnSql],
  ["EntityIdColumnSql", EntityIdColumnSql],
  ["LanguageColumnSql", LanguageColumnSql],
  ["MimeTypeColumnSql", MimeTypeColumnSql],
  ["CreatedAtColumnSql", CreatedAtColumnSql],
  ["RecordTypeColumnSql", RecordTypeColumnSql],
  ["DescriptionColumnSql", DescriptionColumnSql],
  ["UserMetadataColumnSql", UserMetadataColumnSql],
  ["LastModifiedAtColumnSql", LastModifiedAtColumnSql],
  ["RecordTimestampColumnSql", RecordTimestampColumnSql],
] as const;

describe("private-metadata-columns", () => {
  for (const [name, fragment] of fragments) {
    test(`${name} がテキストを含む SQL を生成する`, ({ expect }) => {
      // 実行
      const compiled = sql.join([fragment], ",").toJSON();

      // 検証
      expect(compiled.text.length).toBeGreaterThan(0);
    });
  }

  test("すべてのカラムを結合してもエラーにならない", ({ expect }) => {
    // 実行
    const compiled = sql.join(fragments.map(([, f]) => f), ",").toJSON();

    // 検証
    expect(compiled.text.length).toBeGreaterThan(0);
  });
});
