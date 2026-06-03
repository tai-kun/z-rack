import { Pglite } from "@z-rack/pglite";
import { sql } from "pgsql-template-tag";

const { text: queryText } = sql`
  SELECT
    t.relname AS table_name,
    a.attname AS column_name,
    pg_catalog.format_type(a.atttypid, a.atttypmod) AS "dataType",
    CASE
      WHEN a.attnotnull THEN
        FALSE
      ELSE
        TRUE
    END AS nullable,
    -- インデックス名の取得（主キーや一意制約を含む）
    idx.index_names AS "indexNames",
    -- 外部キー制約の取得（接続先テーブルとカラム）
    fk.fk_info AS "foreignKey"
  FROM
    pg_catalog.pg_class t
  JOIN
    pg_catalog.pg_namespace n ON n.oid = t.relnamespace
  JOIN
    pg_catalog.pg_attribute a ON a.attrelid = t.oid
  -- インデックス情報の集計
  LEFT JOIN (
    SELECT
      i.indrelid,
      ia.attname AS col_name,
      string_agg(c.relname, ', ') AS index_names
    FROM
      pg_catalog.pg_index i
    JOIN
      pg_catalog.pg_class c ON c.oid = i.indexrelid
    JOIN
      pg_catalog.pg_attribute ia ON ia.attrelid = i.indrelid AND ia.attnum = ANY(i.indkey)
    GROUP BY
      i.indrelid, ia.attname
  ) idx ON idx.indrelid = t.oid AND idx.col_name = a.attname
  -- 外部キー情報の取得
  LEFT JOIN (
    SELECT
      con.conrelid,
      att.attname AS local_col,
      confrel.relname || '(' || confatt.attname || ')' AS fk_info
    FROM
      pg_catalog.pg_constraint con
    JOIN
      pg_catalog.pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
    JOIN
      pg_catalog.pg_class confrel ON confrel.oid = con.confrelid
    JOIN
      pg_catalog.pg_attribute confatt ON confatt.attrelid = con.confrelid AND confatt.attnum = con.confkey[1]
    WHERE
      con.contype = 'f'
  ) fk ON fk.conrelid = t.oid AND fk.local_col = a.attname
  WHERE
    n.nspname = current_schema() -- 現在のスキーマに限定
    AND t.relkind IN ('r', 'v')  -- 通常のテーブルとビューのみ
    AND a.attnum > 0             -- システムカラムを除外
    AND NOT a.attisdropped       -- 削除済みのカラムを除外
  ORDER BY
    table_name,
    a.attnum;
`;

export default async function getSchema(
  db: Pglite,
  signal: AbortSignal,
): Promise<
  Record<
    string, // テーブル名
    Record<
      string, // カラム名
      {
        dataType: string;
        nullable: boolean;
        indexNames: string;
        foreignKey: string;
      }
    >
  >
> {
  const rows = await db.query({
    signal,
    bindings: [],
    queryText,
  });
  const tables: any = {};
  for (const { table_name, column_name, ...row } of rows) {
    const columns = (tables[table_name as string] ||= {});
    columns[column_name as string] = row;
  }

  return tables;
}
