import { type ObjectId } from "@z-rack/core";
import { sql } from "pgsql-template-tag";
import { test } from "vitest";

import { RegisterObjectIdSql } from "../../src/_sql/get-object-id.js";

test("RegisterObjectIdSql が object_ids テーブルへの INSERT 文を生成する", ({ expect }) => {
  // 実行
  const { text, values } = RegisterObjectIdSql.fillAll({
    objectIdsTable: sql.raw("object_ids"),
    objectId: "550e8400-e29b-41d4-a716-446655440000" as ObjectId,
  }).toJSON();

  // 検証
  expect(text).toContain("INSERT INTO");
  expect(text).toContain("object_ids");
  expect(values).toStrictEqual(["550e8400-e29b-41d4-a716-446655440000"]);
});
