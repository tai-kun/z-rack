import { sql } from "pgsql-template-tag";

const privateMetadataTable = sql.query("privateMetadataTable");

const skip = sql.query("skip");
const take = sql.query("take");
const index = sql.query("index");
const minLength = sql.bigint("minLength").notNull();
const basenameIndex = sql.query("basenameIndex");
const collationName = sql.query("collationName");
const orderDirection = sql.query("orderDirection");
const objectKeyPrefix = sql.query("objectKeyPrefix");
const objectKeySegment = sql.text("objectKeySegment").notNull();
const objectKeySegmentCount = sql.bigint("objectKeySegmentCount").notNull();

/**
 * 複数件のメタデータ取得クエリーにおける、SELECT 句の開始部分を定義する SQL フラグメントです。
 */
export const FindManyMetadataSelectSql = sql`
SELECT`;

/**
 * ベースネーム（`_basename`）とオブジェクトフラグ（`_is_object`）の組み合わせで重複を除外するための DISTINCT ON 句を定義する SQL フラグメントです。
 */
export const FindManyMetadataDistinctOnBasenameAndKindSql = sql`
  DISTINCT ON (_basename, _is_object)
  key_segments[${basenameIndex}] AS _basename,
  array_length(key_segments, 1) = ${objectKeySegmentCount} AS _is_object,`;

/**
 * 複数件のメタデータ取得クエリーにおける、対象テーブルと基本的な抽出条件（FROM 句および WHERE 句）を定義する SQL フラグメントです。
 */
export const FindManyMetadataBasicConditionsSql = sql`
FROM ${privateMetadataTable}
WHERE
  _key IS NOT NULL`;

/**
 * オブジェクトキーの接頭辞による前方一致検索の条件（AND 句）を追加する SQL フラグメントです。
 */
export const FindManyMetadataKeyPrefixConditionSql = sql` AND
  _key LIKE '${objectKeyPrefix}%'`;

/**
 * パスセグメント配列の長さが指定された最小長さ以上であるという条件（AND 句）を追加する SQL フラグメントです。
 */
export const FindManyMetadataPathSegmentsConditionSql = sql` AND
  array_length(key_segments, 1) >= ${minLength}`;

/**
 * パスセグメント配列内の特定のインデックスの位置にある文字列が、指定された値と一致するという条件（AND 句）を追加する SQL フラグメントです。
 */
export const FindManyMetadataPathSegmentConditionSql = sql` AND
  key_segments[${index}] = ${objectKeySegment}`;

/**
 * 照合順序を指定せずに、オブジェクトキーで並び替えを行うための ORDER BY 句を定義する SQL フラグメントです。
 */
export const FindManyMetadataKeyOrderWithoutCollationSql = sql`
ORDER BY
  _key ${orderDirection}`;

/**
 * 照合順序を指定して、オブジェクトキーで並び替えを行うための ORDER BY 句を定義する SQL フラグメントです。
 */
export const FindManyMetadataKeyOrderWithCollationSql = sql`
ORDER BY
  _key COLLATE ${collationName} ${orderDirection}`;

/**
 * オブジェクトフラグ（`_is_object`）と照合順序を指定しないベースネーム（`_basename`）で並び替えを行うための ORDER BY 句を定義する SQL フラグメントです。
 */
export const FindManyMetadataBasenameOrderWithoutCollationSql = sql`
ORDER BY
  _is_object DESC,
  _basename ${orderDirection}`;

/**
 * オブジェクトフラグ（`_is_object`）と照合順序を指定してベースネーム（`_basename`）で並び替えを行うための ORDER BY 句を定義する SQL フラグメントです。
 */
export const FindManyMetadataBasenameOrderWithCollationSql = sql`
ORDER BY
  _is_object DESC,
  _basename COLLATE ${collationName} ${orderDirection}`;

/**
 * クエリー結果の取得件数と開始位置（LIMIT 句および OFFSET 句）によるページネーションを定義する SQL フラグメントです。
 */
export const FindManyMetadataPaginationSql = sql`
LIMIT ${take}
OFFSET ${skip}
`;
