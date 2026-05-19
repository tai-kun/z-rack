import {
  type Language,
  type MimeType,
  type SearchText,
  type Description,
  type LastModifiedAt,
  type RecordTimestamp,
  v,
} from "@z-rack/core";
import { sql, Sql } from "pgsql-template-tag";

import slot from "./_slot.js";

const privateMetadataTable = slot("privateMetadataTable").sql();

const language = slot("language").text<Language>().nullable();
const mimeType = slot("mimeType").text<MimeType>();
const objectKey = slot("objectKey").text();
const objectTags = slot("objectTags").sql<Sql<readonly string[]>>();
const searchText = slot("searchText").text<SearchText>().nullable();
const description = slot("description").text<Description>().nullable();
const userMetadata = slot("userMetadata").jsonb();
const lastModifiedAt = slot("lastModifiedAt").timestamp<LastModifiedAt>();
const recordTimestamp = slot("recordTimestamp").timestamp<RecordTimestamp>();

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

export const UpdateMetadataResultSchema = v.pipe(
  v.array(v.object({})),
  v.maxLength(1),
  v.transform((rows) => rows.length > 0),
);
