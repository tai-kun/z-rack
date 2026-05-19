import { sql } from "pgsql-template-tag";

import slot from "./_slot.js";

const privateMetadataTable = slot("privateMetadataTable").sql();

const skip = slot("skip").sql();
const take = slot("take").sql();
const index = slot("index").sql();
const minLength = slot("minLength").bigint();
const basenameIndex = slot("basenameIndex").sql();
const collationName = slot("collationName").sql();
const orderDirection = slot("orderDirection").sql();
const objectKeyPrefix = slot("objectKeyPrefix").sql();
const objectKeySegment = slot("objectKeySegment").text();
const objectKeySegmentCount = slot("objectKeySegmentCount").bigint();

export const FindManyMetadataSelectSql = sql`
SELECT`;

export const FindManyMetadataDistinctOnBasenameAndKindSql = sql`
  DISTINCT ON (_basename, _is_object)
  key_segments[${basenameIndex}] AS _basename,
  array_length(key_segments, 1) = ${objectKeySegmentCount} AS _is_object,`;

export const FindManyMetadataBasicConditionsSql = sql`
FROM ${privateMetadataTable}
WHERE
  _key IS NOT NULL`;

export const FindManyMetadataKeyPrefixConditionSql = sql` AND
  _key LIKE '${objectKeyPrefix}%'`;

export const FindManyMetadataPathSegmentsConditionSql = sql` AND
  array_length(key_segments, 1) >= ${minLength}`;

export const FindManyMetadataPathSegmentConditionSql = sql` AND
  key_segments[${index}] = ${objectKeySegment}`;

export const FindManyMetadataKeyOrderWithoutCollationSql = sql`
ORDER BY
  _key ${orderDirection}`;

export const FindManyMetadataKeyOrderWithCollationSql = sql`
ORDER BY
  _key COLLATE ${collationName} ${orderDirection}`;

export const FindManyMetadataBasenameOrderWithoutCollationSql = sql`
ORDER BY
  _is_object DESC,
  _basename ${orderDirection}`;

export const FindManyMetadataBasenameOrderWithCollationSql = sql`
ORDER BY
  _is_object DESC,
  _basename COLLATE ${collationName} ${orderDirection}`;

export const FindManyMetadataPaginationSql = sql`
LIMIT ${take}
OFFSET ${skip}
`;
