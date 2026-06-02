import {
  type Language,
  type MimeType,
  type SearchText,
  type Description,
  type LastModifiedAt,
  type RecordTimestamp,
  v,
} from "@z-rack/core";
import { sql } from "pgsql-template-tag";

const privateMetadataTable = sql.query("privateMetadataTable");

const language = sql.text("language").narrow<Language | null>();
const mimeType = sql.text("mimeType").notNull().narrow<MimeType>();
const objectKey = sql.text("objectKey").notNull();
const objectTags = sql.query("objectTags").notNull().narrow<sql.Sql<readonly string[]>>();
const searchText = sql.text("searchText").narrow<SearchText | null>();
const description = sql.text("description").narrow<Description | null>();
const userMetadata = sql.jsonb("userMetadata").notNull();
const lastModifiedAt = sql.timestamp("lastModifiedAt").notNull().narrow<LastModifiedAt>();
const recordTimestamp = sql.timestamp("recordTimestamp").notNull().narrow<RecordTimestamp>();

/**
 * メタデータ更新用 SQL の基底部分を定義するフラグメントです。
 */
export const UpdateMetadataBaseSql = sql`
UPDATE ${privateMetadataTable} SET
  record_type      = 'UPDATE_METADATA'`;

export const UpdateTagsColumnSql = sql`,
  object_tags      = ${objectTags}`;

export const UpdateLanguageColumnSql = sql`,
  language         = ${language}`;

export const UpdateMimeTypeColumnSql = sql`,
  mime_type        = ${mimeType}`;

export const UpdateDescriptionColumnSql = sql`,
  description      = ${description}`;

export const UpdateSearchTextColumnSql = sql`,
  search_text      = ${searchText}`;

export const UpdateUserMetadataColumnSql = sql`,
  user_metadata    = ${userMetadata}`;

export const UpdateLastModifiedAtColumnSql = sql`,
  last_modified_at = ${lastModifiedAt}`;

export const UpdateRecordTimestampColumnSql = sql`,
  record_timestamp = ${recordTimestamp}`;

export const UpdateMetadataConditionSql = sql`
WHERE
  _key = ${objectKey}
RETURNING
  1
`;

/**
 * メタデータ更新処理の結果を検証および変換するための Valibot スキーマです。
 */
export const UpdateMetadataResultSchema = v.pipe(
  v.array(v.object({})),
  v.maxLength(1),
  v.transform((rows) => rows.length > 0),
);
