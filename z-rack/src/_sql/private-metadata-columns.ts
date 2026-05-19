import { sql } from "pgsql-template-tag";

export const IdColumnSql = sql`
  object_id        AS id`;

export const ETagColumnSql = sql`
  entity_tag       AS "eTag"`;

export const SizeColumnSql = sql`
  object_size      AS size`;

export const TagsColumnSql = sql`
  object_tags      AS "tags"`;

export const KeyColumnSql = sql`
  key`;

export const EntityIdColumnSql = sql`
  entity_id        AS "entityId"`;

export const LanguageColumnSql = sql`
  language`;

export const MimeTypeColumnSql = sql`
  mime_type        AS "mimeType"`;

export const CreatedAtColumnSql = sql`
  created_at       AS "createdAt"`;

export const RecordTypeColumnSql = sql`
  record_type      AS "recordType"`;

export const DescriptionColumnSql = sql`
  description      AS "description"`;

export const UserMetadataColumnSql = sql`
  user_metadata    AS "userMetadata"`;

export const LastModifiedAtColumnSql = sql`
  last_modified_at AS "lastModifiedAt"`;

export const RecordTimestampColumnSql = sql`
  record_timestamp AS "recordTimestamp"`;
