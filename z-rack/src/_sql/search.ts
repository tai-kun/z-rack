import { sql } from "pgsql-template-tag";

import slot from "./_slot.js";

const privateMetadataTable = slot("privateMetadataTable").sql();

const skip = slot("skip").sql();
const take = slot("take").sql();
const index = slot("index").sql();
const query = slot("query").text();
const score = slot("score").bigint();
const minLength = slot("minLength").bigint();
const objectKeyPrefix = slot("objectKeyPrefix").sql();
const objectKeySegment = slot("objectKeySegment").text();
const textSearchFormat = slot("textSearchFormat").text();

export const SearchMetadataSelectSql = sql`
SELECT
  (search_text <@> to_bm25query(${query}, '_z_rack-idx-private_metadata-search_text')) * -1 AS score,`;

export const SearchMetadataBasicConditionsSql = sql`
FROM ${privateMetadataTable}
WHERE
  search_text IS NOT NULL AND
  text_search_format = ${textSearchFormat}`;

export const SearchMetadataKeyPrefixConditionSql = sql` AND
  _key LIKE '${objectKeyPrefix}%'`;

export const SearchMetadataPathSegmentsConditionSql = sql` AND
  array_length(key_segments, 1) >= ${minLength}`;

export const SearchMetadataPathSegmentConditionSql = sql` AND
  key_segments[${index}] = ${objectKeySegment}`;

export const SearchMetadataScoreConditionSql = sql` AND
  (search_text <@> to_bm25query(${query}, '_z_rack-idx-private_metadata-search_text')) * -1 > ${score}`;

export const SearchMetadataOrderAndPaginationSql = sql`
ORDER BY
  score DESC
LIMIT ${take}
OFFSET ${skip}
`;
