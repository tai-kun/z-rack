import { v } from "@z-rack/core";
import { sql } from "pgsql-template-tag";

import { type MetadataSelect, MetadataSelectResultSchema } from "./_schemas.js";

const privateMetadataTable = sql.query("privateMetadataTable");

const objectKey = sql.text("objectKey").notNull();

/**
 * 1 件のメタデータ取得クエリーにおける、SELECT 句の開始部分を定義する SQL フラグメントです。
 */
export const FindOneMetadataSelectSql = sql`
SELECT`;

/**
 * 1 件のメタデータ取得クエリーにおける、対象テーブルと基本的な抽出条件（FROM 句および WHERE 句）を定義する SQL フラグメントです。
 */
export const FindOneMetadataConditionsSql = sql`
FROM
  ${privateMetadataTable}
WHERE
  _key = ${objectKey}
`;

/**
 * メタデータを 1 件取得した際の SQL 実行結果を検証し、単一のオブジェクトに変換するための Valibot スキーマを作成します。
 *
 * @param select 取得対象となるメタデータの選択項目を定義したオブジェクトです。
 * @returns バリデーションと変換処理を行うスキーマオブジェクトを返します。
 */
export const FindOneMetadataResultSchema = (select: MetadataSelect) =>
  v.pipe(
    v.array(MetadataSelectResultSchema(select)),
    v.maxLength(1),
    // カラム `_key` には一意制約がかけられているので、配列を単一のオブジェクトにできます。
    v.transform((rows) => rows[0]),
  );
