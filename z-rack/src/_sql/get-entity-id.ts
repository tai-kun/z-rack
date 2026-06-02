import type { EntityId } from "@z-rack/core";
import { sql } from "pgsql-template-tag";

const entityIdsTable = sql.query("entityIdsTable");

const entityId = sql.uuid("entityId").notNull().narrow<EntityId>();

/**
 * 新しいエンティティ ID をデータベースに登録するための SQL クエリーです。
 */
export const RegisterEntityIdSql = sql`
INSERT INTO ${entityIdsTable} (entity_id) VALUES (${entityId})
`;
