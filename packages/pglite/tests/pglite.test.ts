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
    // 準備
    const db: IDatabaseClient = new Pglite(worker);

    // 実行
    await db.open!({ signal });

    // 検証
    expect(db.isOpen).toBe(true);

    // Cleanup
    await db.close!({ signal });
  });

  test("接続処理を中断したとき、AbortError を送出し isOpen は false のままである", async ({
    expect,
    worker,
  }) => {
    // 準備
    const db: IDatabaseClient = new Pglite(worker);
    const ac = new AbortController();
    ac.abort();

    // 実行と検証
    await expect(db.open!({ signal: ac.signal })).rejects.toThrow(/aborted/);
    expect(db.isOpen).toBe(false);
  });

  test("正常に接続された状態で close を呼び出したとき、isOpen が false になる", async ({
    expect,
    signal,
    worker,
  }) => {
    // 準備
    const db: IDatabaseClient = new Pglite(worker);
    await db.open!({ signal });

    // 実行
    await db.close!({ signal });

    // 検証
    expect(db.isOpen).toBe(false);
  });

  test("接続済みの状態で open を再呼び出ししても isOpen が true のままである", async ({
    expect,
    signal,
    worker,
  }) => {
    // 準備
    const db: IDatabaseClient = new Pglite(worker);
    await db.open!({ signal });

    // 実行
    await db.open!({ signal });

    // 検証
    expect(db.isOpen).toBe(true);

    // Cleanup
    await db.close!({ signal });
  });

  test("未接続の状態で close を呼び出すとエラーを投げる", async ({ expect, signal, worker }) => {
    // 準備
    const db: IDatabaseClient = new Pglite(worker);

    // 実行と検証
    await expect(db.close!({ signal })).rejects.toThrow();
  });

  test("flush を呼び出すとデータが同期され、isOpen は true のままである", async ({
    expect,
    signal,
    worker,
  }) => {
    // 準備
    const db: IDatabaseClient = new Pglite(worker);
    await db.open!({ signal });

    // 実行
    await db.flush!({ signal });

    // 検証
    expect(db.isOpen).toBe(true);

    // Cleanup
    await db.close!({ signal });
  });

  test("未接続の状態で flush を呼び出すとエラーを投げる", async ({ expect, signal, worker }) => {
    // 準備
    const db: IDatabaseClient = new Pglite(worker);

    // 実行と検証
    await expect(db.flush!({ signal })).rejects.toThrow();
  });
});

describe("IDatabaseClient のクエリー実行", () => {
  test("クエリーを実行したとき、期待した構造のデータが取得できる", async ({
    expect,
    signal,
    worker,
  }) => {
    // 準備
    const db: IDatabaseClient = new Pglite(worker);
    await db.open!({ signal });

    // 実行
    const iterable = await db.query({
      queryText: "SELECT $1 AS id, $2 AS name",
      bindings: [1, "Alice"],
      signal,
    });
    const result = await Array.fromAsync(iterable);

    // 検証
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
    // 準備
    const db: IDatabaseClient = new Pglite(worker);

    // 実行と検証
    await expect(
      db.query({
        queryText: "SELECT 1",
        bindings: [],
        signal,
      }),
    ).rejects.toThrow();
  });

  test("中断されたシグナルでクエリーを実行したとき、AbortError を投げる", async ({
    expect,
    worker,
  }) => {
    // 準備
    const db: IDatabaseClient = new Pglite(worker);
    await db.open!({ signal: AbortSignal.timeout(10_000) });
    const ac = new AbortController();
    ac.abort();

    // 実行と検証
    await expect(
      db.query({
        queryText: "SELECT 1",
        bindings: [],
        signal: ac.signal,
      }),
    ).rejects.toThrow(/aborted/);

    // Cleanup
    await db.close!({ signal: AbortSignal.timeout(10_000) });
  });

  test("複数行を返すクエリーが正しく反復処理できる", async ({ expect, signal, worker }) => {
    // 準備
    const db: IDatabaseClient = new Pglite(worker);
    await db.open!({ signal });

    // 実行
    const iterable = await db.query({
      queryText: "SELECT * FROM (VALUES (1, 'a'), (2, 'b'), (3, 'c')) AS t(id, name)",
      bindings: [],
      signal,
    });
    const result = await Array.fromAsync(iterable);

    // 検証
    expect(result).toHaveLength(3);
    expect(result[0]!["name"]).toBe("a");
    expect(result[1]!["name"]).toBe("b");
    expect(result[2]!["name"]).toBe("c");

    // Cleanup
    await db.close!({ signal });
  });

  test("DDL と DML の一連の操作が正しく動作する", async ({ expect, signal, worker }) => {
    // 準備
    const db: IDatabaseClient = new Pglite(worker);
    await db.open!({ signal });

    // 実行: CREATE TABLE → INSERT → SELECT
    await db.query({
      queryText: "CREATE TABLE IF NOT EXISTS test_users (id INT, name TEXT)",
      bindings: [],
      signal,
    });
    await db.query({
      queryText: "INSERT INTO test_users VALUES ($1, $2)",
      bindings: [1, "Alice"],
      signal,
    });
    await db.query({
      queryText: "INSERT INTO test_users VALUES ($1, $2)",
      bindings: [2, "Bob"],
      signal,
    });
    const iterable = await db.query({
      queryText: "SELECT * FROM test_users ORDER BY id",
      bindings: [],
      signal,
    });
    const result = await Array.fromAsync(iterable);

    // 検証
    expect(result).toHaveLength(2);
    expect(result[0]!["name"]).toBe("Alice");
    expect(result[1]!["name"]).toBe("Bob");

    // Cleanup
    await db.query({
      queryText: "DROP TABLE IF EXISTS test_users",
      bindings: [],
      signal,
    });
    await db.close!({ signal });
  });
});

describe("IDatabaseClient のトランザクション制御", () => {
  test("トランザクション内でクエリーを実行したとき、正しいデータが取得できる", async ({
    expect,
    signal,
    worker,
  }) => {
    // 準備
    const db: IDatabaseClient = new Pglite(worker);
    await db.open!({ signal });
    let result: Row[] = [];

    // 実行
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

    // 検証
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
    // 準備
    const db: IDatabaseClient = new Pglite(worker);
    await db.open!({ signal });

    // 実行と検証
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
    // 準備
    const db: IDatabaseClient = new Pglite(worker);
    await db.open!({ signal });

    // 実行
    await db.transaction({
      signal,
      callback: async (tx: ITransaction) => {
        await tx.rollback({});
        // TODO: 無視されるかテスト
      },
    });

    // 検証
    // 状態の不整合がないことを確認（この例では正常終了を期待）
    expect(db.isOpen).toBe(true);

    // Cleanup
    await db.close!({ signal });
  });

  test("未接続の状態で transaction を呼び出すとエラーを投げる", async ({
    expect,
    signal,
    worker,
  }) => {
    // 準備
    const db: IDatabaseClient = new Pglite(worker);

    // 実行と検証
    await expect(
      db.transaction({
        signal,
        callback: async () => {},
      }),
    ).rejects.toThrow();
  });

  test("中断されたシグナルで transaction を実行したとき、AbortError を投げる", async ({
    expect,
    worker,
  }) => {
    // 準備
    const db: IDatabaseClient = new Pglite(worker);
    await db.open!({ signal: AbortSignal.timeout(10_000) });
    const ac = new AbortController();
    ac.abort();

    // 実行と検証
    await expect(
      db.transaction({
        signal: ac.signal,
        callback: async () => {},
      }),
    ).rejects.toThrow(/aborted/);

    // Cleanup
    await db.close!({ signal: AbortSignal.timeout(10_000) });
  });

  test("トランザクション内で複数のクエリーを実行したとき、すべての結果が取得できる", async ({
    expect,
    signal,
    worker,
  }) => {
    // 準備
    const db: IDatabaseClient = new Pglite(worker);
    await db.open!({ signal });
    const results: Row[] = [];

    // 実行
    await db.transaction({
      signal,
      callback: async (tx: ITransaction) => {
        const iterable1 = await tx.query({
          queryText: "SELECT $1 AS a",
          bindings: [1],
        });
        for await (const row of iterable1) {
          results.push(row);
        }

        const iterable2 = await tx.query({
          queryText: "SELECT $1 AS b",
          bindings: [2],
        });
        for await (const row of iterable2) {
          results.push(row);
        }
      },
    });

    // 検証
    expect(results).toHaveLength(2);
    expect(results[0]!["a"]).toBe("1");
    expect(results[1]!["b"]).toBe("2");

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
    // 準備
    const db: IDatabaseClient = new Pglite(worker);
    await db.open!({ signal });

    // 実行
    const iterable = await db.query({
      queryText: "SELECT 1 AS num",
      bindings: [],
      signal,
    });
    const result = await Array.fromAsync(iterable);

    // 検証
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
    // 準備
    const db: IDatabaseClient = new Pglite(worker);
    await db.open!({ signal });

    // 実行と検証
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
