import { v, type ObjectId, type Utf8, type TextSearchFormat } from "@z-rack/core";
import { sql } from "pgsql-template-tag";
import { test, describe } from "vitest";

import {
  FindLatestMigrationSql,
  FindLatestMigrationResultSchema,
  CreateMigrationSql,
  FinishMigrationSql,
  FindDirtyDescriptionSql,
  FindDirtyDescriptionResultSchema,
  UpdateSearchTextSql,
  CreatePgTextsearchExtensionSql,
  FindTextSearchFormatHashConfigSql,
  FindTextSearchFormatHashConfigResultSchema,
  CreateTextSearchFormatConfigSql,
  DeletePgTextsearchIndexSql,
  FindAllCollationNamesSql,
  FindAllCollationNamesResultSchema,
} from "../../src/_sql/open.js";

const VALID_UUID_V7 = "018f0a9e-2b37-7000-8000-000000000000";

const tables = {
  configTable: sql.raw("config"),
  migrationsTable: sql.raw("migrations"),
  privateMetadataTable: sql.raw("private_metadata"),
};

const FORMAT = "11111111111111111111111111111111111111111111";

describe("FindLatestMigrationSql", () => {
  test("マイグレーションテーブルから最大 name を取得する", ({ expect }) => {
    // 実行
    const { text } = FindLatestMigrationSql.fillAll(tables).toJSON();

    // 検証
    expect(text).toContain("SELECT");
    expect(text).toContain("FROM");
    expect(text).toContain("migrations");
  });
});

describe("FindLatestMigrationResultSchema", () => {
  test("有効なマイグレーション情報を検証できる", ({ expect }) => {
    // 準備
    const input = [{ name: "202605081732_init", finishedAt: new Date("2026-06-01").getTime() }];

    // 実行
    const result = v.parseOutput(FindLatestMigrationResultSchema, input);

    // 検証
    expect(result!.name).toBe("202605081732_init");
  });

  test("finishedAt が null でも検証できる", ({ expect }) => {
    // 準備
    const input = [{ name: "202605081732_init", finishedAt: null }];

    // 実行
    const result = v.parseOutput(FindLatestMigrationResultSchema, input);

    // 検証
    expect(result!.finishedAt).toBeNull();
  });

  test("空の配列を渡すと undefined を返す", ({ expect }) => {
    // 実行
    const result = v.parseOutput(FindLatestMigrationResultSchema, []);

    // 検証
    expect(result).toBeUndefined();
  });

  test("無効な名前でエラーになる", ({ expect }) => {
    // 実行と検証
    expect(() =>
      v.parseOutput(FindLatestMigrationResultSchema, [{ name: "invalid", finishedAt: null }]),
    ).toThrow();
  });
});

describe("CreateMigrationSql", () => {
  test("INSERT 文を生成する", ({ expect }) => {
    // 実行
    const { text } = CreateMigrationSql.fillAll({ ...tables, name: "test" }).toJSON();

    // 検証
    expect(text).toContain("INSERT INTO");
  });
});

describe("FinishMigrationSql", () => {
  test("UPDATE 文を生成する", ({ expect }) => {
    // 実行
    const { text } = FinishMigrationSql.fillAll({ ...tables, name: "test" }).toJSON();

    // 検証
    expect(text).toContain("UPDATE");
  });
});

describe("FindDirtyDescriptionSql", () => {
  test("search_text が NULL でない行を検索する", ({ expect }) => {
    // 実行
    const { text } = FindDirtyDescriptionSql.fillAll({
      ...tables,
      textSearchFormat: FORMAT as TextSearchFormat,
    }).toJSON();

    // 検証
    expect(text).toContain("search_text IS NOT NULL");
  });
});

describe("FindDirtyDescriptionResultSchema", () => {
  test("有効な行から objectId と言語と説明文を取り出せる", ({ expect }) => {
    // 準備
    const input = [{ objectId: VALID_UUID_V7, language: "jpn", description: "説明文" }];

    // 実行
    const result = v.parseOutput(FindDirtyDescriptionResultSchema, input);

    // 検証
    expect(result!.objectId).toBe(VALID_UUID_V7);
    expect(result!.language).toBe("jpn");
    expect(result!.description).toBe("説明文");
  });

  test("空の配列を渡すと undefined を返す", ({ expect }) => {
    // 実行
    const result = v.parseOutput(FindDirtyDescriptionResultSchema, []);

    // 検証
    expect(result).toBeUndefined();
  });
});

describe("UpdateSearchTextSql", () => {
  test("private_metadata の検索テキストを更新する", ({ expect }) => {
    // 実行
    const { text } = UpdateSearchTextSql.fillAll({
      ...tables,
      objectId: VALID_UUID_V7 as ObjectId,
      searchText: "text" as Utf8,
      textSearchFormat: FORMAT as TextSearchFormat,
    }).toJSON();

    // 検証
    expect(text).toContain("UPDATE");
  });
});

describe("CreatePgTextsearchExtensionSql", () => {
  test("pg_textsearch 拡張を作成する", ({ expect }) => {
    // 実行
    const { text } = CreatePgTextsearchExtensionSql.toJSON();

    // 検証
    expect(text).toContain("CREATE EXTENSION");
    expect(text).toContain("pg_textsearch");
  });
});

describe("FindTextSearchFormatHashConfigSql", () => {
  test("設定テーブルから textSearchFormatHash を検索する", ({ expect }) => {
    // 実行
    const { text } = FindTextSearchFormatHashConfigSql.fillAll(tables).toJSON();

    // 検証
    expect(text).toContain("config");
    expect(text).toContain("textSearchFormatHash");
  });
});

describe("FindTextSearchFormatHashConfigResultSchema", () => {
  const FORMAT = "11111111111111111111111111111111111111111111";

  test("設定が存在するとき値を返す", ({ expect }) => {
    // 準備
    const input = [{ key: "textSearchFormatHash", value: FORMAT }];

    // 実行
    const result = v.parseOutput(FindTextSearchFormatHashConfigResultSchema, input);

    // 検証
    expect(result).toBe(FORMAT);
  });

  test("設定が存在しないとき undefined を返す", ({ expect }) => {
    // 実行
    const result = v.parseOutput(FindTextSearchFormatHashConfigResultSchema, []);

    // 検証
    expect(result).toBeUndefined();
  });
});

describe("CreateTextSearchFormatConfigSql", () => {
  test("config テーブルに初期設定を挿入する", ({ expect }) => {
    // 実行
    const { text } = CreateTextSearchFormatConfigSql.fillAll({
      ...tables,
      textSearchFormatName: '"text"',
      textSearchFormatHash: '"hash"',
    }).toJSON();

    // 検証
    expect(text).toContain("INSERT INTO");
  });
});

describe("DeletePgTextsearchIndexSql", () => {
  test("既存の全文検索インデックスを削除する", ({ expect }) => {
    // 実行
    const { text } = DeletePgTextsearchIndexSql.toJSON();

    // 検証
    expect(text).toContain("DROP INDEX");
  });
});

describe("FindAllCollationNamesSql", () => {
  test("pg_collation から照合順序名を取得する", ({ expect }) => {
    // 実行
    const { text } = FindAllCollationNamesSql.toJSON();

    // 検証
    expect(text).toContain("pg_collation");
  });
});

describe("FindAllCollationNamesResultSchema", () => {
  test("重複を排除して照合順序名の配列を返す", ({ expect }) => {
    // 準備
    const input = [{ collname: "en-x-icu" }, { collname: "ja-x-icu" }, { collname: "en-x-icu" }];

    // 実行
    const result = v.parseOutput(FindAllCollationNamesResultSchema, input);

    // 検証
    expect(result).toStrictEqual(["en-x-icu", "ja-x-icu"]);
  });

  test("空の配列を渡すと空の配列を返す", ({ expect }) => {
    // 実行
    const result = v.parseOutput(FindAllCollationNamesResultSchema, []);

    // 検証
    expect(result).toStrictEqual([]);
  });
});
