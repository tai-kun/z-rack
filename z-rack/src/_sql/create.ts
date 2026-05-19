import type {
  EntityId,
  Language,
  MimeType,
  ObjectId,
  CreatedAt,
  EntityTag,
  ObjectSize,
  SearchText,
  Description,
  LastModifiedAt,
  RecordTimestamp,
  TextSearchFormat,
} from "@z-rack/core";
import { type Sql, sql } from "pgsql-template-tag";

import slot from "./_slot.js";

const privateMetadataTable = slot("privateMetadataTable").sql();

const entityId = slot("entityId").text<EntityId>();
const language = slot("language").text<Language>().nullable();
const mimeType = slot("mimeType").text<MimeType>();
const objectId = slot("objectId").text<ObjectId>();
const createdAt = slot("createdAt").timestamp<CreatedAt>();
const entityTag = slot("entityTag").text<EntityTag>();
const objectKey = slot("objectKey").text();
const objectSize = slot("objectSize").bigint<ObjectSize>();
const objectTags = slot("objectTags").sql<Sql<readonly string[]>>();
const searchText = slot("searchText").text<SearchText>().nullable();
const description = slot("description").text<Description>().nullable();
const keySegments = slot("keySegments").sql<Sql<readonly [...string[], string]>>();
const userMetadata = slot("userMetadata").jsonb();
const lastModifiedAt = slot("lastModifiedAt").timestamp<LastModifiedAt>();
const recordTimestamp = slot("recordTimestamp").timestamp<RecordTimestamp>();
const textSearchFormat = slot("textSearchFormat").text<TextSearchFormat>();

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
)`;

export const CreateMetadataOverwriteSql = sql`
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
`;

// export const CreateMetadataReturningSql = sql`
// RETURNING
//   (
//     xmax = 0 OR
//     search_text != (SELECT search_text FROM ${privateMetadataTable} WHERE _key = ${objectKey})
//   ) AS "searchTextChanged";
// `;

// export const CreateMetadataResultSchema = v.pipe(
//   v.array(
//     v.object({
//       searchTextChanged: v.nullable(v.boolean(), true),
//     }),
//   ),
//   v.length(1),
//   v.transform((rows) => rows[0]!),
// );
