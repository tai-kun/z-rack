import { Pglite } from "@z-rack/pglite";
import pgliteWorkerUri from "@z-rack/pglite/worker?url";
import { sql } from "pgsql-template-tag";
import { test as vitest } from "vitest";

import _000000000000_prelude from "../../../src/_sql/migrations/000000000000_prelude.js";
import getSchema from "./_get-schema.js";

const migrations = [..._000000000000_prelude];

// oxlint-disable-next-line jest/expect-expect jest/no-disabled-tests
const test = vitest.extend<{
  db: Pglite;
}>({
  // oxlint-disable-next-line no-empty-pattern
  async db({ signal }, use) {
    let pgliteWorker: any;
    if (typeof document === "undefined") {
      const { Worker } = await import("node:worker_threads");

      const uri2path = (uri: string) =>
        uri.startsWith("/@fs") ? uri.substring("/@fs".length) : "." + uri;

      pgliteWorker = new Worker(uri2path(pgliteWorkerUri));
    } else {
      pgliteWorker = new Worker(new URL(pgliteWorkerUri, import.meta.url), {
        type: "module",
      });
    }

    let db: Pglite | undefined;
    try {
      const pglite = new Pglite(pgliteWorker);
      await pglite.open({ signal });
      db = pglite;
      for (const query of migrations) {
        const { text, values } = query
          .fillAll({
            migrationsTable: sql.raw("migrations"),
          })
          .toJSON();
        await db.query({
          signal,
          bindings: values,
          queryText: text,
        });
      }

      await use(db);
    } finally {
      await db?.close({ signal });
    }
  },
});

test("期待するスキーマになっている", async ({ db, expect, signal }) => {
  const schema = await getSchema(db, signal);

  expect(schema).toStrictEqual({
    migrations: {
      name: {
        dataType: "text",
        nullable: false,
        indexNames: "_z-rack-pk-migrations-name",
        foreignKey: null,
      },
      finished_at: {
        dataType: "timestamp without time zone",
        nullable: true,
        indexNames: null,
        foreignKey: null,
      },
    },
  });
});
