import { sql } from "pgsql-template-tag";

import slot from "../_slot.js";

const configTable = slot("configTable").sql();
const entityIdsTable = slot("entityIdsTable").sql();
const objectIdsTable = slot("objectIdsTable").sql();
const publicMetadataTable = slot("publicMetadataTable").sql();
const privateMetadataTable = slot("privateMetadataTable").sql();

// oxfmt-ignore
export default [

sql`
CREATE TABLE ${configTable} (
  key   TEXT PRIMARY KEY,
  value JSON NOT NULL
)
`,

sql`
CREATE TABLE ${privateMetadataTable} (
  object_id UUID PRIMARY KEY,

  record_type      TEXT      NOT NULL,
  record_timestamp TIMESTAMP NOT NULL,

  key          TEXT   NOT NULL,
  _key         TEXT,
  key_segments TEXT[] NOT NULL,

  entity_id  TEXT NOT NULL,
  entity_tag TEXT,

  object_size BIGINT NOT NULL,
  mime_type   TEXT,

  created_at       TIMESTAMP,
  last_modified_at TIMESTAMP,

  language           TEXT,
  description        TEXT,
  search_text        TEXT,
  text_search_format TEXT,
  object_tags        TEXT[],
  user_metadata      JSONB
)
`,

sql`
CREATE UNIQUE INDEX "_z_rack-unq-private_metadata-_key" ON ${privateMetadataTable} (_key)
`,

sql`
CREATE UNIQUE INDEX "_z_rack-unq-private_metadata-entity_id" ON ${privateMetadataTable} (entity_id)
`,

sql`
CREATE TABLE ${objectIdsTable} (
  object_id UUID PRIMARY KEY
)
`,

sql`
ALTER TABLE ${privateMetadataTable}
ADD CONSTRAINT "_z_rack-fk-object_id"
FOREIGN KEY (object_id)
REFERENCES ${objectIdsTable} (object_id)
ON UPDATE RESTRICT
ON DELETE CASCADE;
`,

sql`
CREATE TABLE ${entityIdsTable} (
  entity_id TEXT PRIMARY KEY
)
`,

sql`
ALTER TABLE ${privateMetadataTable}
ADD CONSTRAINT "_z_rack-fk-entity_id"
FOREIGN KEY (entity_id)
REFERENCES ${entityIdsTable} (entity_id)
ON UPDATE CASCADE
ON DELETE CASCADE;
`,

sql`
CREATE VIEW ${publicMetadataTable}
AS
SELECT
  object_id         AS id,
  record_type,
  record_timestamp,
  key,
  object_size       AS size,
  mime_type,
  entity_tag        AS e_tag,
  created_at,
  last_modified_at,
  language,
  description,
  object_tags       AS tags,
  user_metadata
FROM
  ${privateMetadataTable}
WHERE
  _key IS NOT NULL
`,

]
