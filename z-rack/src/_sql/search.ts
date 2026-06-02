import { sql } from "pgsql-template-tag";

const privateMetadataTable = sql.query("privateMetadataTable");

const skip = sql.query("skip");
const take = sql.query("take");
const index = sql.query("index");
const query = sql.text("query").notNull();
const score = sql.real("score").notNull();
const minLength = sql.bigint("minLength").notNull();
const objectKeyPrefix = sql.query("objectKeyPrefix");
const objectKeySegment = sql.text("objectKeySegment").notNull();
const textSearchFormat = sql.text("textSearchFormat").notNull();

/**
 * 検索スコアを算出する SELECT 句の開始部分を定義する SQL フラグメントです。
 *
 * pg_textsearch のスコアは負の値として計算されるため、`-1` を乗算して正のスコアに反転させています。
 */
export const SearchMetadataSelectSql = sql`
SELECT
  (search_text <@> to_bm25query(${query}, '_z_rack-idx-private_metadata-search_text')) * -1 AS score,`;

/**
 * 検索スコア算出クエリーにおける、対象テーブルと基本的な抽出条件（FROM 句および WHERE 句）を定義する SQL フラグメントです。
 *
 * カラム `search_text` が NULL ではないことが条件であるため、カラム `_key` も NULL ではなく、したがって存在するメタデータのみを検索対象とします。
 */
export const SearchMetadataBasicConditionsSql = sql`
FROM ${privateMetadataTable}
WHERE
  search_text IS NOT NULL AND
  text_search_format = ${textSearchFormat}`;

/**
 * オブジェクトキーの接頭辞による前方一致検索の条件（AND 句）を追加する SQL フラグメントです。
 */
export const SearchMetadataKeyPrefixConditionSql = sql` AND
  _key LIKE '${objectKeyPrefix}%'`;

/**
 * パスセグメント配列の長さが指定された最小長さ以上であるという条件（AND 句）を追加する SQL フラグメントです。
 */
export const SearchMetadataPathSegmentsConditionSql = sql` AND
  array_length(key_segments, 1) >= ${minLength}`;

/**
 * パスセグメント配列内の特定のインデックスの位置にある文字列が、指定された値と一致するという条件（AND 句）を追加する SQL フラグメントです。
 */
export const SearchMetadataPathSegmentConditionSql = sql` AND
  key_segments[${index}] = ${objectKeySegment}`;

/**
 * 算出された検索スコアが指定された閾値より大きいデータのみに絞り込む条件（AND 句）を追加する SQL フラグメントです。
 */
export const SearchMetadataScoreConditionSql = sql` AND
  (search_text <@> to_bm25query(${query}, '_z_rack-idx-private_metadata-search_text')) * -1 > ${score}`;

/**
 * スコアの降順ソートおよびページネーション（LIMIT/OFFSET）を適用する SQL フラグメントです。
 */
export const SearchMetadataOrderAndPaginationSql = sql`
ORDER BY
  score DESC
LIMIT ${take}
OFFSET ${skip}
`;
