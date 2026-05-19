import { v } from "@z-rack/core";
import { sql } from "pgsql-template-tag";

import slot from "./_slot.js";

const privateMetadataTable = slot("privateMetadataTable").sql();

const objectKey = slot("objectKey").text();

export const ExistsMetadataSql = sql`
SELECT 1
FROM ${privateMetadataTable}
WHERE
  _key = ${objectKey}
`;

export const ExistsMetadataResultSchema = v.pipe(
  v.array(v.object({})),
  v.maxLength(1),
  v.transform((rows) => rows.length > 0),
);
