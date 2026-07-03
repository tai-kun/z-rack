import { uuid58Encode } from "@nakanoaas/uuid58";
import { v, type EntityId, type ObjectId, type RecordTimestamp } from "@z-rack/core";
import { sql } from "pgsql-template-tag";
import { test, describe } from "vitest";

import {
  UpdateMetadataDeletedSql,
  UpdateMetadataDeletedResultSchema,
  DeleteMetadataSql,
  DeleteObjectIdSql,
  DeleteEntityIdSql,
} from "../../src/_sql/delete.js";

const VALID_UUID_V7 = "018f0a9e-2b37-7000-8000-000000000000";
const VALID_ENTITY_ID = uuid58Encode(VALID_UUID_V7);

const tables = {
  privateMetadataTable: sql.raw("private_metadata"),
  objectIdsTable: sql.raw("object_ids"),
  entityIdsTable: sql.raw("entity_ids"),
};

describe("UpdateMetadataDeletedSql", () => {
  test("UPDATE 文で論理削除する", ({ expect }) => {
    // 実行
    const { text } = UpdateMetadataDeletedSql.fillAll({
      ...tables,
      objectKey: "foo.mp4",
      recordTimestamp: 1760000000000 as RecordTimestamp,
    }).toJSON();

    // 検証
    expect(text).toContain("SET");
    expect(text).toContain("record_type");
    expect(text).toContain("'DELETE'");
  });

  test("論理削除でカラムが NULL に設定される", ({ expect }) => {
    // 実行
    const { text } = UpdateMetadataDeletedSql.fillAll({
      ...tables,
      objectKey: "foo.mp4",
      recordTimestamp: 1760000000000 as RecordTimestamp,
    }).toJSON();

    // 検証
    expect(text).toContain("_key               = NULL");
    expect(text).toContain("search_text        = NULL");
  });

  test("RETURNING 句で object_id と entity_id を返す", ({ expect }) => {
    // 実行
    const { text } = UpdateMetadataDeletedSql.fillAll({
      ...tables,
      objectKey: "foo.mp4",
      recordTimestamp: 1760000000000 as RecordTimestamp,
    }).toJSON();

    // 検証
    expect(text).toContain("RETURNING");
    expect(text).toContain("object_id");
    expect(text).toContain("entity_id");
  });
});

describe("UpdateMetadataDeletedResultSchema", () => {
  test("有効な行から objectId と entityId を取り出せる", ({ expect }) => {
    // 準備
    const input = [{ objectId: VALID_UUID_V7, entityId: VALID_ENTITY_ID }];

    // 実行
    const result = v.parseOutput(UpdateMetadataDeletedResultSchema, input);

    // 検証
    expect(result!.objectId).toBe(VALID_UUID_V7);
    expect(result!.entityId).toBe(VALID_ENTITY_ID);
  });

  test("空の配列を渡すと undefined を返す", ({ expect }) => {
    // 実行
    const result = v.parseOutput(UpdateMetadataDeletedResultSchema, []);

    // 検証
    expect(result).toBeUndefined();
  });

  test("不正なデータでエラーになる", ({ expect }) => {
    // 実行と検証
    expect(() => v.parseOutput(UpdateMetadataDeletedResultSchema, [{ objectId: null }])).toThrow();
  });
});

describe("DeleteMetadataSql", () => {
  test("private_metadata から物理削除する", ({ expect }) => {
    // 実行
    const { text } = DeleteMetadataSql.fillAll({ ...tables, objectId: VALID_UUID_V7 as ObjectId }).toJSON();

    // 検証
    expect(text).toContain("DELETE FROM");
    expect(text).toContain("private_metadata");
  });
});

describe("DeleteObjectIdSql", () => {
  test("object_ids から削除する", ({ expect }) => {
    // 実行
    const { text } = DeleteObjectIdSql.fillAll({ ...tables, objectId: VALID_UUID_V7 as ObjectId }).toJSON();

    // 検証
    expect(text).toContain("DELETE FROM");
    expect(text).toContain("object_ids");
  });
});

describe("DeleteEntityIdSql", () => {
  test("entity_ids から削除する", ({ expect }) => {
    // 実行
    const { text } = DeleteEntityIdSql.fillAll({ ...tables, entityId: VALID_ENTITY_ID as EntityId }).toJSON();

    // 検証
    expect(text).toContain("DELETE FROM");
    expect(text).toContain("entity_ids");
  });
});
