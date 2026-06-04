import {
  type EntityId,
  type Language,
  type MimeType,
  type ObjectId,
  type CreatedAt,
  type EntityTag,
  type ObjectSize,
  type SearchText,
  type Description,
  type LastModifiedAt,
  type RecordTimestamp,
  type TextSearchFormat,
  v,
  EntityIdSchema,
} from "@z-rack/core";
import { sql } from "pgsql-template-tag";

const privateMetadataTable = sql.query("privateMetadataTable");

const entityId = sql.text("entityId").notNull().narrow<EntityId>();
const language = sql.text("language").narrow<Language | null>();
const mimeType = sql.text("mimeType").notNull().narrow<MimeType>();
const objectId = sql.text("objectId").notNull().narrow<ObjectId>();
const createdAt = sql.timestamp("createdAt").notNull().narrow<CreatedAt>();
const entityTag = sql.text("entityTag").notNull().narrow<EntityTag>();
const objectKey = sql.text("objectKey").notNull();
const objectSize = sql.bigint("objectSize").notNull().narrow<ObjectSize>();
const objectTags = sql.query("objectTags").notNull().narrow<sql.Sql<readonly string[]>>();
const searchText = sql.text("searchText").narrow<SearchText | null>();
const description = sql.text("description").narrow<Description | null>();
const keySegments = sql
  .query("keySegments")
  .notNull()
  .narrow<sql.Sql<readonly [...string[], string]>>();
const userMetadata = sql.jsonb("userMetadata").notNull();
const lastModifiedAt = sql.timestamp("lastModifiedAt").notNull().narrow<LastModifiedAt>();
const recordTimestamp = sql.timestamp("recordTimestamp").notNull().narrow<RecordTimestamp>();
const textSearchFormat = sql.text("textSearchFormat").notNull().narrow<TextSearchFormat>();

/**
 * メタデータを新規作成する SQL クエリーです。
 *
 * 指定されたすべてのパラメーターを使用して、新しいメタデータレコードを挿入します。
 */
export const CreateMetadataSql = sql`
INSERT INTO ${privateMetadataTable} (
  object_id,
  record_type,
  record_timestamp,
  key,
  _key,
  key_segments,
  entity_id,
  entity_tag,
  object_size,
  mime_type,
  created_at,
  last_modified_at,
  language,
  description,
  search_text,
  text_search_format,
  object_tags,
  user_metadata
) VALUES (
  ${objectId},
  'CREATE',
  ${recordTimestamp},
  ${objectKey},
  ${objectKey},
  ARRAY[${keySegments}],
  ${entityId},
  ${entityTag},
  ${objectSize},
  ${mimeType},
  ${createdAt},
  ${lastModifiedAt},
  ${language},
  ${description},
  ${searchText},
  ${textSearchFormat},
  ARRAY[${objectTags}]::TEXT[],
  ${userMetadata}
)
`;

/**
 * メタデータ作成時に競合が発生した場合のアップサート用 SQL フラグメントです。
 *
 * カラム `_key` で一意制約違反が発生した場合、既存のレコードを指定された値で上書きします。
 */
export const CreateMetadataOverwriteSql = sql`
WITH old_row AS (
  SELECT
    entity_id
  FROM ${privateMetadataTable}
  WHERE
    _key = ${objectKey}
),
_ AS (
  INSERT INTO ${privateMetadataTable} (
    object_id,
    record_type,
    record_timestamp,
    key,
    _key,
    key_segments,
    entity_id,
    entity_tag,
    object_size,
    mime_type,
    created_at,
    last_modified_at,
    language,
    description,
    search_text,
    text_search_format,
    object_tags,
    user_metadata
  ) VALUES (
    ${objectId},
    'CREATE',
    ${recordTimestamp},
    ${objectKey},
    ${objectKey},
    ARRAY[${keySegments}],
    ${entityId},
    ${entityTag},
    ${objectSize},
    ${mimeType},
    ${createdAt},
    ${lastModifiedAt},
    ${language},
    ${description},
    ${searchText},
    ${textSearchFormat},
    ARRAY[${objectTags}]::TEXT[],
    ${userMetadata}
  )
  ON CONFLICT (_key)
  DO UPDATE SET
    record_type        = EXCLUDED.record_type,
    record_timestamp   = EXCLUDED.record_timestamp,
    entity_id          = EXCLUDED.entity_id,
    entity_tag         = EXCLUDED.entity_tag,
    object_size        = EXCLUDED.object_size,
    mime_type          = EXCLUDED.mime_type,
    created_at         = EXCLUDED.created_at,
    last_modified_at   = EXCLUDED.last_modified_at,
    language           = EXCLUDED.language,
    description        = EXCLUDED.description,
    search_text        = EXCLUDED.search_text,
    text_search_format = EXCLUDED.text_search_format,
    object_tags        = EXCLUDED.object_tags,
    user_metadata      = EXCLUDED.user_metadata
)
SELECT *
FROM old_row;
`;

export const CreateMetadataResultSchema = v.pipe(
  v.array(v.object({ entity_id: (EntityIdSchema) })),
  v.maxLength(1),
  v.transform((rows) => rows[0]?.entity_id),
);
