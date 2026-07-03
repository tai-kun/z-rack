import { type EntityId } from "@z-rack/core";
import { sql } from "pgsql-template-tag";
import { test } from "vitest";

import { RegisterEntityIdSql } from "../../src/_sql/get-entity-id.js";

test("RegisterEntityIdSql が entity_ids テーブルへの INSERT 文を生成する", ({ expect }) => {
  // 実行
  const { text, values } = RegisterEntityIdSql.fillAll({
    entityIdsTable: sql.raw("entity_ids"),
    entityId: "abc123xyz" as EntityId,
  }).toJSON();

  // 検証
  expect(text).toContain("INSERT INTO");
  expect(text).toContain("entity_ids");
  expect(values).toStrictEqual(["abc123xyz"]);
});
