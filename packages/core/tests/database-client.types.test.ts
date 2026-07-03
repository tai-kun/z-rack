import { describe, test } from "vitest";

import type { Row, IDatabaseClient, ITransaction } from "../src/database-client.types.js";

describe("ITransaction", () => {
  test("インターフェースに準拠した実装が動作する", ({ expect }) => {
    // 準備
    const mockTransaction: ITransaction = {
      query() {
        return [];
      },
      rollback() {},
    };

    // 実行と検証
    expect(typeof mockTransaction.query).toBe("function");
    expect(typeof mockTransaction.rollback).toBe("function");
  });
});

describe("IDatabaseClient", () => {
  test("インターフェースに準拠した実装が動作する", ({ expect }) => {
    // 準備
    const mockClient: IDatabaseClient = {
      isOpen: true,
      query() {
        return [];
      },
      transaction() {
        return Promise.resolve();
      },
    };

    // 実行と検証
    expect(mockClient.isOpen).toBe(true);
    expect(typeof mockClient.query).toBe("function");
    expect(typeof mockClient.transaction).toBe("function");
  });
});

describe("Row", () => {
  test("任意のキーと値を持つオブジェクトが Row 型として扱える", ({ expect }) => {
    // 準備
    const row: Row = { id: 1, name: "Alice" };

    // 実行と検証
    expect(row["id"]).toBe(1);
    expect(row["name"]).toBe("Alice");
  });
});
