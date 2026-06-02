import {
  type ObjectId,
  type SearchText,
  type TextSearchFormat,
  v,
  LanguageSchema,
  ObjectIdSchema,
  TimestampSchema,
  DescriptionSchema,
  TextSearchFormatSchema,
} from "@z-rack/core";
import { sql } from "pgsql-template-tag";

const configTable = sql.query("configTable");
const migrationsTable = sql.query("migrationsTable");
const privateMetadataTable = sql.query("privateMetadataTable");

const migrationName = sql.text("name").notNull();
const textSearchFormatNameConfig = sql.json("textSearchFormatName").notNull();
const textSearchFormatHashConfig = sql.json("textSearchFormatHash").notNull();

const objectId = sql.uuid("objectId").notNull().narrow<ObjectId>();
const searchText = sql.text("searchText").notNull().narrow<SearchText>();
const textSearchFormatEmbeded = sql.query("textSearchFormat");
const textSearchFormatBinding = sql.text("textSearchFormat").notNull().narrow<TextSearchFormat>();

const pgTextSearchBm25B = sql.query("bm25B");
const pgTextSearchBm25K1 = sql.query("bm25K1");
const pgTextSearchTextConfig = sql.query("textConfig");

/**
 * 最後に実行されたマイグレーションの情報を取得するための SQL クエリーです。
 */
export const FindLatestMigrationSql = sql`
SELECT
  name,
  finished_at AS "finishedAt"
FROM ${migrationsTable}
ORDER BY
  name DESC
LIMIT 1
`;

/**
 * 最新の名グレーション情報を取得した際の SQL 実行結果を検証し、単一のオブジェクトに変換するための Valibot スキーマです。
 */
export const FindLatestMigrationResultSchema = v.pipe(
  v.array(
    v.object({
      name: v.pipe(v.string(), v.regex(/^[0-9]{12}_.+$/)),
      finishedAt: v.nullable(TimestampSchema),
    }),
  ),
  v.maxLength(1),
  // 最新 1 件のみを取得するので、配列を単一のオブジェクトにできます。
  v.transform((rows) => rows[0]),
);

/**
 * 新しいマイグレーション履歴を挿入するための SQL クエリーです。この時点ではまだ未完了です。
 */
export const CreateMigrationSql = sql`
INSERT INTO ${migrationsTable} (name) VALUES (${migrationName})
`;

/**
 * マイグレーションの完了日時を現在時刻で更新するための SQL クエリーです。
 */
export const FinishMigrationSql = sql`
UPDATE ${migrationsTable}
SET
  finished_at = CURRENT_TIMESTAMP
WHERE
  name = ${migrationName}
`;

/**
 * テキスト検索の形式が古くなり、再生成が必要なメタデータ（Dirty な説明文）を 1 件取得するための SQL クエリーです。
 */
export const FindDirtyDescriptionSql = sql`
SELECT
  object_id AS "objectId",
  language,
  description
FROM ${privateMetadataTable}
WHERE
  search_text IS NOT NULL AND
  text_search_format != ${textSearchFormatBinding}
LIMIT 1
`;

/**
 * 再生成が必要なメタデータ（Dirty な説明文）の取得結果に対する検証および変換用のスキーマです。
 */
export const FindDirtyDescriptionResultSchema = v.pipe(
  v.array(
    v.object({
      objectId: ObjectIdSchema,
      language: LanguageSchema,
      description: DescriptionSchema,
    }),
  ),
  v.maxLength(1),
  // LIMIT 句で 1 件のみを取得するので、配列を単一のオブジェクトにできます。
  v.transform((rows) => rows[0]),
);

/**
 * メタデータテーブルの検索テキストとテキスト検索の形式の情報を更新するための SQL クエリーです。
 */
export const UpdateSearchTextSql = sql`
UPDATE ${privateMetadataTable}
SET
  search_text        = ${searchText},
  text_search_format = ${textSearchFormatBinding}
WHERE
  object_id = ${objectId}
`;

/**
 * PostgreSQL の拡張機能である pg_textsearch が存在しない場合に、新規作成するための SQL クエリーです。
 */
export const CreatePgTextsearchExtensionSql = sql`
CREATE EXTENSION IF NOT EXISTS pg_textsearch
`;

/**
 * 設定テーブルから、テキスト検索の形式のハッシュ設定を取得するための SQL クエリーです。
 */
export const FindTextSearchFormatHashConfigSql = sql`
SELECT *
FROM ${configTable}
WHERE
  key = 'textSearchFormatHash'
`;

/**
 * テキスト検索の形式のハッシュ設定の取得結果に対する検証および変換用の Valibot スキーマです。
 */
export const FindTextSearchFormatHashConfigResultSchema = v.pipe(
  v.array(
    v.object({
      key: v.string(),
      value: v.unknown(),
    }),
  ),
  // カラム `key` はプライマリーキーなので最大 1 件です。
  v.maxLength(1),
  // 配列形式のキー・値のペアから、JavaScript のオブジェクトを作成します。
  v.transform((config) => Object.fromEntries(config.map((c) => [c.key, c.value]))),
  // 設定がない場合もあるので、`textSearchFormatHash` の有無は任意です。
  v.object({
    textSearchFormatHash: v.optional(TextSearchFormatSchema),
  }),
  // オブジェクトから textSearchFormatHash の値のみを抽出して返します。
  v.transform((result) => result.textSearchFormatHash),
);

/**
 * テキスト検索の形式に関する初期設定（名前およびハッシュ値）を一括で挿入するための SQL クエリーです。
 */
export const CreateTextSearchFormatConfigSql = sql`
INSERT INTO ${configTable} (key, value)
VALUES
  ('textSearchFormatName', ${textSearchFormatNameConfig}),
  ('textSearchFormatHash', ${textSearchFormatHashConfig})
`;

/**
 * テキスト検索の形式名の設定値を更新するための SQL クエリーです。
 */
export const UpdateTextSearchFormatNameConfigSql = sql`
UPDATE ${configTable}
SET
  value = ${textSearchFormatNameConfig}
WHERE
  key = 'textSearchFormatName'
`;

/**
 * テキスト検索の形式のハッシュ設定値を更新するための SQL クエリーです。
 */
export const UpdateTextSearchFormatHashConfigSql = sql`
UPDATE ${configTable}
SET
  value = ${textSearchFormatHashConfig}
WHERE
  key = 'textSearchFormatHash'
`;

/**
 * 非公開メタデータテーブルに存在する既存の pg_textsearch インデックスを削除するための SQL クエリーです。
 */
export const DeletePgTextsearchIndexSql = sql`
DROP INDEX IF EXISTS "_z_rack-idx-private_metadata-search_text"
`;

/**
 * 非公開メタデータテーブルの検索テキストに対して、BM25 アルゴリズムを使用した専用のインデックスを作成するための SQL クエリーです。
 *
 * インデックスは、指定されたテキスト検索の形式と一致するレコードのみを対象とする部分インデックスとして作成されます。
 */
export const CreatePgTextsearchIndexSql = sql`
CREATE INDEX "_z_rack-idx-private_metadata-search_text" ON ${privateMetadataTable}
USING bm25 (search_text)
WITH (
  text_config = ${pgTextSearchTextConfig},
  k1          = ${pgTextSearchBm25K1},
  b           = ${pgTextSearchBm25B}
)
WHERE
  text_search_format = ${textSearchFormatEmbeded}
`;

/**
 * PostgreSQL に定義されているすべての照合順序の名前を取得するための SQL クエリーです。
 */
export const FindAllCollationNamesSql = sql`
SELECT collname FROM pg_collation
`;

/**
 * すべての照合順序の名前の取得結果に対する検証および変換用の Valibot スキーマです。
 *
 * 取得した行から名前を抽出し、重複を排除した一意な配列として返します。
 */
export const FindAllCollationNamesResultSchema = v.pipe(
  v.array(
    v.object({
      collname: v.string(),
    }),
  ),
  // 重複する照合順序名を排除するために、Set オブジェクトを経由して一意な配列に再構築します。
  v.transform((rows) => [...new Set(rows.map((row) => row.collname))]),
);
