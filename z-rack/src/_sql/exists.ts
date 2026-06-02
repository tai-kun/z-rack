import { v } from "@z-rack/core";
import { sql } from "pgsql-template-tag";

const privateMetadataTable = sql.query("privateMetadataTable");

const objectKey = sql.text("objectKey").notNull();

/**
 * 指定されたオブジェクトのキーに紐づくメタデータが存在するかを確認するための SQL クエリーです。
 *
 * 非公開メタデータテーブルから該当するキーを検索し、存在する場合は値として 1 を返します。
 */
export const ExistsMetadataSql = sql`
SELECT 1
FROM ${privateMetadataTable}
WHERE
  _key = ${objectKey}
`;

/**
 * メタデータの存在確認クエリーの実行結果を検証および変換する Valibot スキーマです。
 *
 * クエリーの実行結果である配列を受け取り、レコードが存在する場合は true を、存在しない場合は false を返します。
 */
export const ExistsMetadataResultSchema = v.pipe(
  v.array(v.object({})),
  v.transform((rows) => rows.length > 0),
);
