import { v } from "@z-rack/core";
import { sql } from "pgsql-template-tag";

import { type MetadataSelect, MetadataSelectResultSchema } from "./_schemas.js";
import slot from "./_slot.js";

const privateMetadataTable = slot("privateMetadataTable").sql();

const objectKey = slot("objectKey").text();

export const FindOneMetadataSelectSql = sql`
SELECT`;

export const FindOneMetadataConditionsSql = sql`
FROM
  ${privateMetadataTable}
WHERE
  _key = ${objectKey}
`;

export const FindOneMetadataResultSchema = (select: MetadataSelect) =>
  v.pipe(
    v.array(MetadataSelectResultSchema(select)),
    v.maxLength(1),
    v.transform((rows) => rows[0]),
  );
