import {
  type ObjectId,
  type RecordTimestamp,
  v,
  EntityIdSchema,
  ObjectIdSchema,
} from "@z-rack/core";
import { sql } from "pgsql-template-tag";

import slot from "./_slot.js";

const privateMetadataTable = slot("privateMetadataTable").sql();

const objectId = slot("objectId").text<ObjectId>();
const objectKey = slot("objectKey").text();
const recordTimestamp = slot("recordTimestamp").timestamp<RecordTimestamp>();

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

export const UpdateMetadataDeletedResultSchema = v.pipe(
  v.array(
    v.object({
      entityId: EntityIdSchema,
      objectId: ObjectIdSchema,
    }),
  ),
  v.maxLength(1),
  v.transform((rows) => rows[0]),
);

export const DeleteMetadataSql = sql`
DELETE FROM ${privateMetadataTable}
WHERE
  object_id = ${objectId}
`;
