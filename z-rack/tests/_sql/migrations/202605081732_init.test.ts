import { Pglite } from "@z-rack/pglite";
import pgliteWorkerUri from "@z-rack/pglite/worker?url";
import { sql } from "pgsql-template-tag";
import { test as vitest } from "vitest";

import _000000000000_prelude from "../../../src/_sql/migrations/000000000000_prelude.js";
import _202605081732_init from "../../../src/_sql/migrations/202605081732_init.js";
import getSchema from "./_get-schema.js";

const migrations = [..._000000000000_prelude, ..._202605081732_init];

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
          // @ts-expect-error
          .fillAll({
            configTable: sql.raw("config"),
            entityIdsTable: sql.raw("entity_ids"),
            objectIdsTable: sql.raw("object_ids"),
            migrationsTable: sql.raw("migrations"),
            publicMetadataTable: sql.raw("public_metadata"),
            privateMetadataTable: sql.raw("private_metadata"),
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
        indexNames: "_z-rack-pkey-migrations-name",
        foreignKey: null,
      },
      finished_at: {
        dataType: "timestamp without time zone",
        nullable: true,
        indexNames: null,
        foreignKey: null,
      },
    },

    config: {
      key: {
        dataType: "text",
        nullable: false,
        indexNames: "_z-rack-pkey-config-key",
        foreignKey: null,
      },
      value: {
        dataType: "json",
        nullable: false,
        indexNames: null,
        foreignKey: null,
      },
    },

    entity_ids: {
      entity_id: {
        dataType: "text",
        nullable: false,
        indexNames: "_z-rack-pkey-entity_ids-entity_id",
        foreignKey: "private_metadata(entity_id)",
      },
    },

    object_ids: {
      object_id: {
        dataType: "uuid",
        nullable: false,
        indexNames: "_z-rack-pkey-object_ids-object_id",
        foreignKey: "private_metadata(object_id)",
      },
    },

    private_metadata: {
      object_id: {
        dataType: "uuid",
        nullable: false,
        indexNames: "_z-rack-pkey-private_metadata-object_id",
        foreignKey: null,
      },
      record_type: {
        dataType: "text",
        nullable: false,
        indexNames: null,
        foreignKey: null,
      },
      record_timestamp: {
        dataType: "timestamp without time zone",
        nullable: false,
        indexNames: null,
        foreignKey: null,
      },
      key: {
        dataType: "text",
        nullable: false,
        indexNames: null,
        foreignKey: null,
      },
      _key: {
        dataType: "text",
        nullable: true,
        indexNames: "_z_rack-unq-private_metadata-_key",
        foreignKey: null,
      },
      key_segments: {
        dataType: "text[]",
        nullable: false,
        indexNames: null,
        foreignKey: null,
      },
      entity_id: {
        dataType: "text",
        nullable: false,
        indexNames: "_z_rack-unq-private_metadata-entity_id",
        foreignKey: null,
      },
      entity_tag: {
        dataType: "text",
        nullable: true,
        indexNames: null,
        foreignKey: null,
      },
      object_size: {
        dataType: "bigint",
        nullable: false,
        indexNames: null,
        foreignKey: null,
      },
      mime_type: {
        dataType: "text",
        nullable: true,
        indexNames: null,
        foreignKey: null,
      },
      created_at: {
        dataType: "timestamp without time zone",
        nullable: true,
        indexNames: null,
        foreignKey: null,
      },
      last_modified_at: {
        dataType: "timestamp without time zone",
        nullable: true,
        indexNames: null,
        foreignKey: null,
      },
      language: {
        dataType: "text",
        nullable: true,
        indexNames: null,
        foreignKey: null,
      },
      description: {
        dataType: "text",
        nullable: true,
        indexNames: null,
        foreignKey: null,
      },
      search_text: {
        dataType: "text",
        nullable: true,
        indexNames: null,
        foreignKey: null,
      },
      text_search_format: {
        dataType: "text",
        nullable: true,
        indexNames: null,
        foreignKey: null,
      },
      object_tags: {
        dataType: "text[]",
        nullable: true,
        indexNames: null,
        foreignKey: null,
      },
      user_metadata: {
        dataType: "jsonb",
        nullable: true,
        indexNames: null,
        foreignKey: null,
      },
    },

    public_metadata: {
      id: {
        dataType: "uuid",
        nullable: true,
        indexNames: null,
        foreignKey: null,
      },
      record_type: {
        dataType: "text",
        nullable: true,
        indexNames: null,
        foreignKey: null,
      },
      record_timestamp: {
        dataType: "timestamp without time zone",
        nullable: true,
        indexNames: null,
        foreignKey: null,
      },
      key: {
        dataType: "text",
        nullable: true,
        indexNames: null,
        foreignKey: null,
      },
      size: {
        dataType: "bigint",
        nullable: true,
        indexNames: null,
        foreignKey: null,
      },
      mime_type: {
        dataType: "text",
        nullable: true,
        indexNames: null,
        foreignKey: null,
      },
      e_tag: {
        dataType: "text",
        nullable: true,
        indexNames: null,
        foreignKey: null,
      },
      created_at: {
        dataType: "timestamp without time zone",
        nullable: true,
        indexNames: null,
        foreignKey: null,
      },
      last_modified_at: {
        dataType: "timestamp without time zone",
        nullable: true,
        indexNames: null,
        foreignKey: null,
      },
      language: {
        dataType: "text",
        nullable: true,
        indexNames: null,
        foreignKey: null,
      },
      description: {
        dataType: "text",
        nullable: true,
        indexNames: null,
        foreignKey: null,
      },
      tags: {
        dataType: "text[]",
        nullable: true,
        indexNames: null,
        foreignKey: null,
      },
      user_metadata: {
        dataType: "jsonb",
        nullable: true,
        indexNames: null,
        foreignKey: null,
      },
    },
  });
});
