import {
  type ObjectId,
  type RecordTimestamp,
  v,
  EntityIdSchema,
  ObjectIdSchema,
} from "@z-rack/core";
import { sql } from "pgsql-template-tag";

const privateMetadataTable = sql.query("privateMetadataTable");

const objectId = sql.text("objectId").notNull().narrow<ObjectId>();
const objectKey = sql.text("objectKey").notNull();
const recordTimestamp = sql.timestamp("recordTimestamp").notNull().narrow<RecordTimestamp>();

/**
 * メタデータのレコードステータスを `'DELETE'` に更新するための SQL クエリーです。
 *
 * 論理削除されたメタデータの `object_id` と `entity_id` を返します。
 */
export const UpdateMetadataDeletedSql = sql`
UPDATE ${privateMetadataTable}
SET
  record_type        = 'DELETE',
  record_timestamp   = ${recordTimestamp},
  _key               = NULL,
  entity_tag         = NULL,
  mime_type          = NULL,
  created_at         = NULL,
  last_modified_at   = NULL,
  language           = NULL,
  description        = NULL,
  search_text        = NULL,
  text_search_format = NULL,
  object_tags        = NULL,
  user_metadata      = NULL
WHERE
  _key = ${objectKey}
RETURNING
  object_id AS "objectId",
  entity_id AS "entityId"
`;

/**
 * {@link UpdateMetadataDeletedSql} の実行結果を検証し、単一のオブジェクトに変換するための Valibot スキーマです。
 */
export const UpdateMetadataDeletedResultSchema = v.pipe(
  v.array(
    v.object({
      entityId: EntityIdSchema,
      objectId: ObjectIdSchema,
    }),
  ),
  v.maxLength(1),
  // カラム `_key` には一意制約がかけられているので、配列を単一のオブジェクトにできます。
  v.transform((rows) => rows[0]),
);

/**
 * 指定されたオブジェクト ID を持つメタデータレコードを物理削除するための SQL クエリーです。
 *
 * オブジェクト ID に一致するレコードを非公開メタデータテーブルから完全に削除します。
 */
export const DeleteMetadataSql = sql`
DELETE FROM ${privateMetadataTable}
WHERE
  object_id = ${objectId}
`;
