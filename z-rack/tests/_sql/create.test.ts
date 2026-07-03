import { uuid58Encode } from "@nakanoaas/uuid58";
import {
  v,
  type CreatedAt,
  type EntityId,
  type EntityTag,
  type LastModifiedAt,
  type MimeType,
  type ObjectId,
  type ObjectSize,
  type RecordTimestamp,
  type TextSearchFormat,
} from "@z-rack/core";
import { sql } from "pgsql-template-tag";
import { test, describe } from "vitest";

import {
  CreateMetadataSql,
  CreateMetadataOverwriteSql,
  CreateMetadataResultSchema,
} from "../../src/_sql/create.js";

const VALID_UUID_V7 = "018f0a9e-2b37-7000-8000-000000000000";
const VALID_ENTITY_ID = uuid58Encode(VALID_UUID_V7);

const FORMAT = "11111111111111111111111111111111111111111111";

const createSlots = {
  privateMetadataTable: sql.raw("private_metadata"),
  entityId: VALID_ENTITY_ID as EntityId,
  language: null,
  mimeType: "video/mp4" as MimeType,
  objectId: VALID_UUID_V7 as ObjectId,
  createdAt: 1760000000000 as CreatedAt,
  entityTag: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" as EntityTag,
  objectKey: "path/to/foo.mp4",
  objectSize: 1024 as ObjectSize,
  objectTags: sql.join(["tag1", "tag2"]),
  searchText: null,
  description: null,
  keySegments: sql.join(["path", "to", "foo.mp4"]),
  userMetadata: "{}",
  lastModifiedAt: 1760000000000 as LastModifiedAt,
  recordTimestamp: 1760000000000 as RecordTimestamp,
  textSearchFormat: FORMAT as TextSearchFormat,
};

describe("CreateMetadataSql", () => {
  test("INSERT 文に 18 カラムすべてが含まれる", ({ expect }) => {
    // 実行
    const { text } = CreateMetadataSql.fillAll(createSlots).toJSON();

    // 検証
    const columns = [
      "object_id",
      "record_type",
      "record_timestamp",
      "key",
      "_key",
      "key_segments",
      "entity_id",
      "entity_tag",
      "object_size",
      "mime_type",
      "created_at",
      "last_modified_at",
      "language",
      "description",
      "search_text",
      "text_search_format",
      "object_tags",
      "user_metadata",
    ];
    for (const col of columns) {
      expect(text).toContain(col);
    }
  });
});

describe("CreateMetadataOverwriteSql", () => {
  test("ON CONFLICT 句で競合解決する", ({ expect }) => {
    // 実行
    const { text } = CreateMetadataOverwriteSql.fillAll(createSlots).toJSON();

    // 検証
    expect(text).toContain("ON CONFLICT");
    expect(text).toContain("DO UPDATE");
  });

  test("競合時に古い entity_id を返す", ({ expect }) => {
    // 実行
    const { text } = CreateMetadataOverwriteSql.fillAll(createSlots).toJSON();

    // 検証
    expect(text).toContain("old_row");
  });
});

describe("CreateMetadataResultSchema", () => {
  test("entity_id を含む行から entity_id を取り出せる", ({ expect }) => {
    // 実行
    const result = v.parseOutput(CreateMetadataResultSchema, [{ entity_id: VALID_ENTITY_ID }]);

    // 検証
    expect(result).toBe(VALID_ENTITY_ID);
  });

  test("空の配列を渡すと undefined を返す", ({ expect }) => {
    // 実行
    const result = v.parseOutput(CreateMetadataResultSchema, []);

    // 検証
    expect(result).toBeUndefined();
  });

  test("配列以外を渡すとエラーになる", ({ expect }) => {
    // 実行と検証
    expect(() => v.parseOutput(CreateMetadataResultSchema, null)).toThrow();
  });
});
