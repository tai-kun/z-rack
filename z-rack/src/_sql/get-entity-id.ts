import type { EntityId } from "@z-rack/core";
import { sql } from "pgsql-template-tag";

import slot from "./_slot.js";

const entityIdsTable = slot("entityIdsTable").sql();

const entityId = slot("entityId").uuid<EntityId>();

export const RegisterEntityIdSql = sql`
INSERT INTO ${entityIdsTable} (entity_id) VALUES (${entityId})
`;
