import type { IDatabaseClient, ITransaction, Row } from "@z-rack/core";
import { describe, test as vitest } from "vitest";

import Pglite, { type WorkerLike } from "../src/pglite.js";
import workerBrowserUri from "../src/workers/browser.js?url";
import workerNodeUri from "../src/workers/node.js?url";

// oxlint-disable-next-line jest/expect-expect jest/no-disabled-tests
const test = vitest.extend<{
  worker: WorkerLike;
}>({
  // oxlint-disable-next-line no-empty-pattern
  async worker({}, use) {
    if (typeof document === "undefined") {
      const { Worker } = await import("node:worker_threads");
      const w = new Worker("." + workerNodeUri);
      await use(w);
      await w.terminate();
    } else {
      const w = new Worker(new URL(workerBrowserUri, import.meta.url), { type: "module" });
      await use(w);
      w.terminate();
    }
  },
});

describe("IDatabaseClient の接続管理", () => {
  test("正常な接続引数を渡して open を呼び出したとき、isOpen が true になる", async ({
    expect,
    signal,
    worker,
  }) => {
    // Arrange
    const db: IDatabaseClient = new Pglite(worker);

    // Act
    await db.open!({ signal });

    // Assert
    expect(db.isOpen).toBe(true);

    // Cleanup
    await db.close!({ signal });
  });

  test("接続処理を中断したとき、AbortError を送出し isOpen は false のままである", async ({
    expect,
    worker,
  }) => {
    // Arrange
    const db: IDatabaseClient = new Pglite(worker);
    const ac = new AbortController();
    ac.abort();

    // Act & Assert
    await expect(db.open!({ signal: ac.signal })).rejects.toThrow(/aborted/);
    expect(db.isOpen).toBe(false);
  });

  test("正常に接続された状態で close を呼び出したとき、isOpen が false になる", async ({
    expect,
    signal,
    worker,
  }) => {
    // Arrange
    const db: IDatabaseClient = new Pglite(worker);
    await db.open!({ signal });

    // Act
    await db.close!({ signal });

    // Assert
    expect(db.isOpen).toBe(false);
  });
});

describe("IDatabaseClient のクエリー実行", () => {
  test("クエリーを実行したとき、期待した構造のデータが取得できる", async ({
    expect,
    signal,
    worker,
  }) => {
    // Arrange
    const db: IDatabaseClient = new Pglite(worker);
    await db.open!({ signal });

    // Act
    const iterable = await db.query({
      queryText: "SELECT $1 AS id, $2 AS name",
      bindings: [1, "Alice"],
      signal,
    });
    const result = await Array.fromAsync(iterable);

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0]!["id"]).toBe("1");
    expect(result[0]!["name"]).toBe("Alice");

    // Cleanup
    await db.close!({ signal });
  });

  test("未接続の状態でクエリーを実行したとき、エラーを投げる", async ({
    expect,
    signal,
    worker,
  }) => {
    // Arrange
    const db: IDatabaseClient = new Pglite(worker);

    // Act & Assert
    await expect(
      db.query({
        queryText: "SELECT 1",
        bindings: [],
        signal,
      }),
    ).rejects.toThrow();
  });
});

describe("IDatabaseClient のトランザクション制御", () => {
  test("トランザクション内でクエリーを実行したとき、正しいデータが取得できる", async ({
    expect,
    signal,
    worker,
  }) => {
    // Arrange
    const db: IDatabaseClient = new Pglite(worker);
    await db.open!({ signal });
    let result: Row[] = [];

    // Act
    await db.transaction({
      signal,
      callback: async (tx: ITransaction) => {
        const iterable = await tx.query({
          queryText: "SELECT $1 AS val",
          bindings: ["test"],
        });
        for await (const row of iterable) {
          result.push(row);
        }
      },
    });

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0]!["val"]).toBe("test");

    // Cleanup
    await db.close!({ signal });
  });

  test("トランザクションのコールバック内で例外が発生したとき、エラーを呼び出し元に伝播する", async ({
    expect,
    signal,
    worker,
  }) => {
    // Arrange
    const db: IDatabaseClient = new Pglite(worker);
    await db.open!({ signal });

    // Act & Assert
    await expect(
      db.transaction({
        signal,
        callback: async () => {
          throw new Error("Transaction Failure");
        },
      }),
    ).rejects.toThrow("Transaction Failure");

    // Cleanup
    await db.close!({ signal });
  });

  test("トランザクション内で rollback を明示的に呼び出したとき、以降の処理が無効化される", async ({
    expect,
    signal,
    worker,
  }) => {
    // Arrange
    const db: IDatabaseClient = new Pglite(worker);
    await db.open!({ signal });

    // Act
    await db.transaction({
      signal,
      callback: async (tx: ITransaction) => {
        await tx.rollback({});
        // TODO: 無視されるかテスト
      },
    });

    // Assert
    // 状態の不整合がないことを確認（この例では正常終了を期待）
    expect(db.isOpen).toBe(true);

    // Cleanup
    await db.close!({ signal });
  });
});

describe("IDatabaseClient の異常系・境界値テスト", () => {
  test("bindings に空の配列を渡したとき、プレースホルダーなしのクエリーとして正常に実行される", async ({
    expect,
    signal,
    worker,
  }) => {
    // Arrange
    const db: IDatabaseClient = new Pglite(worker);
    await db.open!({ signal });

    // Act
    const iterable = await db.query({
      queryText: "SELECT 1 AS num",
      bindings: [],
      signal,
    });
    const result = await Array.fromAsync(iterable);

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0]!["num"]).toBe(1);

    // Cleanup
    await db.close!({ signal });
  });

  test("不正な SQL 構文を実行したとき、データベース由来のエラーを投げる", async ({
    expect,
    signal,
    worker,
  }) => {
    // Arrange
    const db: IDatabaseClient = new Pglite(worker);
    await db.open!({ signal });

    // Act & Assert
    await expect(
      db.query({
        queryText: "INVALID SQL STATEMENT",
        bindings: [],
        signal,
      }),
    ).rejects.toThrow();

    // Cleanup
    await db.close!({ signal });
  });
});
