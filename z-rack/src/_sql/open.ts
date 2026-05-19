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

import slot from "./_slot.js";

const configTable = slot("configTable").sql();
const migrationsTable = slot("migrationsTable").sql();
const privateMetadataTable = slot("privateMetadataTable").sql();

const migrationName = slot("name").text();
const textSearchFormatNameConfig = slot("textSearchFormatName").json();
const textSearchFormatHashConfig = slot("textSearchFormatHash").json();

const objectId = slot("objectId").uuid<ObjectId>();
const searchText = slot("searchText").text<SearchText>();
const textSearchFormatEmbeded = slot("textSearchFormat").sql();
const textSearchFormatBinding = slot("textSearchFormat").text<TextSearchFormat>();

const pgTextSearchBm25B = slot("bm25B").sql();
const pgTextSearchBm25K1 = slot("bm25K1").sql();
const pgTextSearchTextConfig = slot("textConfig").sql();

export const FindLatestMigrationSql = sql`
SELECT
  name,
  finished_at AS "finishedAt"
FROM ${migrationsTable}
ORDER BY
  name DESC
LIMIT 1
`;

export const FindLatestMigrationResultSchema = v.pipe(
  v.array(
    v.object({
      name: v.pipe(v.string(), v.regex(/^[0-9]{12}_.+$/)),
      finishedAt: v.nullable(TimestampSchema),
    }),
  ),
  v.maxLength(1),
  v.transform((rows) => rows[0]),
);

export const CreateMigrationSql = sql`
INSERT INTO ${migrationsTable} (name) VALUES (${migrationName})
`;

export const FinishMigrationSql = sql`
UPDATE ${migrationsTable}
SET
  finished_at = CURRENT_TIMESTAMP
WHERE
  name = ${migrationName}
`;

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

export const FindDirtyDescriptionResultSchema = v.pipe(
  v.array(
    v.object({
      objectId: ObjectIdSchema,
      language: LanguageSchema,
      description: DescriptionSchema,
    }),
  ),
  v.maxLength(1),
  v.transform((rows) => rows[0]),
);

export const UpdateSearchTextSql = sql`
UPDATE ${privateMetadataTable}
SET
  search_text        = ${searchText},
  text_search_format = ${textSearchFormatBinding}
WHERE
  object_id = ${objectId}
`;

export const CreatePgTextsearchExtensionSql = sql`
CREATE EXTENSION IF NOT EXISTS pg_textsearch
`;

export const FindTextSearchFormatHashConfigSql = sql`
SELECT *
FROM ${configTable}
WHERE
  key = 'textSearchFormatHash'
`;

export const FindTextSearchFormatHashConfigResultSchema = v.pipe(
  v.array(
    v.object({
      key: v.string(),
      value: v.unknown(),
    }),
  ),
  v.maxLength(1),
  v.transform((config) => Object.fromEntries(config.map((c) => [c.key, c.value]))),
  v.object({
    textSearchFormatHash: v.optional(TextSearchFormatSchema),
  }),
  v.transform((result) => result.textSearchFormatHash),
);

export const CreateTextSearchFormatConfigSql = sql`
INSERT INTO ${configTable} (key, value)
VALUES
  ('textSearchFormatName', ${textSearchFormatNameConfig}),
  ('textSearchFormatHash', ${textSearchFormatHashConfig})
`;

export const UpdateTextSearchFormatNameConfigSql = sql`
UPDATE ${configTable}
SET
  value = ${textSearchFormatNameConfig}
WHERE
  key = 'textSearchFormatName'
`;

export const UpdateTextSearchFormatHashConfigSql = sql`
UPDATE ${configTable}
SET
  value = ${textSearchFormatHashConfig}
WHERE
  key = 'textSearchFormatHash'
`;

export const DeletePgTextsearchIndexSql = sql`
DROP INDEX IF EXISTS "_z_rack-idx-private_metadata-search_text"
`;

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

export const FindAllCollationNamesSql = sql`
SELECT collname FROM pg_collation
`;

export const FindAllCollationNamesResultSchema = v.pipe(
  v.array(
    v.object({
      collname: v.string(),
    }),
  ),
  v.transform((rows) => [...new Set(rows.map((row) => row.collname))]),
);
