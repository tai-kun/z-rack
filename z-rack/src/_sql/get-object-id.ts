import type { ObjectId } from "@z-rack/core";
import { sql } from "pgsql-template-tag";

const objectIdsTable = sql.query("objectIdsTable");

const objectId = sql.uuid("objectId").notNull().narrow<ObjectId>();

/**
 * 新しいオブジェクト ID をデータベースのテーブルに登録するための SQL クエリーです。
 */
export const RegisterObjectIdSql = sql`
INSERT INTO ${objectIdsTable} (object_id) VALUES (${objectId})
`;
