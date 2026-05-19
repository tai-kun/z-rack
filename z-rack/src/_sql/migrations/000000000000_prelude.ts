import { sql } from "pgsql-template-tag";

import slot from "../_slot.js";

const migrationsTable = slot("migrationsTable").sql();

// oxfmt-ignore
export default [

sql`
CREATE TABLE IF NOT EXISTS ${migrationsTable} (
  name        TEXT      NOT NULL,
  finished_at TIMESTAMP
)
`,

]
