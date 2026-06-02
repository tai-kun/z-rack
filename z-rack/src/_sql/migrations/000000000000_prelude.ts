import { sql } from "pgsql-template-tag";

const migrationsTable = sql.query("migrationsTable");

// oxfmt-ignore
export default [

// マイグレーション管理用のテーブルの作成
//
// このテーブルは、適用済みのマイグレーション履歴を追跡・記録するために使用されます。
// テーブルが存在しない場合のみ新規作成を行います。
//
// カラム構成:
// - name         実行されたマイグレーションの名前です。
// - finished_at  マイグレーションが完了した日時です。
sql`
CREATE TABLE IF NOT EXISTS ${migrationsTable} (
  name        TEXT      PRIMARY KEY,
  finished_at TIMESTAMP
)
`,

];
