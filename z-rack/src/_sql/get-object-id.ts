import type { ObjectId } from "@z-rack/core";
import { sql } from "pgsql-template-tag";

import slot from "./_slot.js";

const objectIdsTable = slot("objectIdsTable").sql();

const objectId = slot("objectId").uuid<ObjectId>();

export const RegisterObjectIdSql = sql`
INSERT INTO ${objectIdsTable} (object_id) VALUES (${objectId})
`;
