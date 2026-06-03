import type { Row, IDatabaseClient } from "@z-rack/core";
import { sql } from "pgsql-template-tag";
import { test, describe, vi } from "vitest";

import DatabaseClient from "../src/_database-client.js";

describe("isOpen", () => {
  test("インターフェースの isOpen が真のとき、isOpen を呼び出すと true になる", ({ expect }) => {
    // Arrange
    const mockDb: IDatabaseClient = {
      isOpen: 1 as any,
      query() {
        return [];
      },
      async transaction() {},
    };
    const client = new DatabaseClient(mockDb);

    // Act
    const result = client.isOpen;

    // Assert
    expect(result).toBe(true);
  });

  test("インターフェースの isOpen が偽のとき、isOpen を呼び出すと false になる", ({ expect }) => {
    // Arrange
    const mockDb: IDatabaseClient = {
      isOpen: 0 as any,
      query() {
        return [];
      },
      async transaction() {},
    };
    const client = new DatabaseClient(mockDb);

    // Act
    const result = client.isOpen;

    // Assert
    expect(result).toBe(false);
  });
});

describe("open", () => {
  test("中止シグナルを渡して open を実行したとき、インターフェースの接続関数がシグナルを伴って呼び出され完了する", async ({
    expect,
    signal,
  }) => {
    // Arrange
    const openFn = vi.fn<() => void>();
    const mockDb: IDatabaseClient = {
      isOpen: false,
      open: openFn,
      query() {
        return [];
      },
      async transaction() {},
    };
    const client = new DatabaseClient(mockDb);

    // Act & Assert
    await expect(client.open(signal)).resolves.toBe(undefined);
    expect(openFn.mock.calls).toStrictEqual([[{ signal }]]);
  });

  test("インターフェースに open 関数が存在しないとき、エラーを投げずに正常に処理がスキップされ完了する", async ({
    expect,
    signal,
  }) => {
    // Arrange
    const mockDb: IDatabaseClient = {
      isOpen: false,
      query() {
        return [];
      },
      async transaction() {},
    };
    const client = new DatabaseClient(mockDb);

    // Act & Assert
    await expect(client.open(signal)).resolves.toBe(undefined);
  });
});

describe("close, requestFlush", () => {
  test("タスクキューが空のとき、close を実行すると現在実行中のタスクへ中断が要求され、完了待機した後に内部の切断関数が呼ばれる", async ({
    expect,
    signal,
  }) => {
    // Arrange
    const { promise: flushPromise, resolve: resolveFlush } = Promise.withResolvers<void>();
    const closeFn = vi.fn<() => void>();
    const flushFn = vi
      .fn<(args: IDatabaseClient.FlushArgs) => Promise<void>>()
      .mockReturnValue(flushPromise);
    const mockDb: IDatabaseClient = {
      isOpen: false,
      close: closeFn,
      query() {
        return [];
      },
      async transaction() {},
      flush: flushFn,
    };
    const client = new DatabaseClient(mockDb);
    const reason = new Error("中断の理由");

    // Act
    client.requestFlush(); // タスクをキューに追加
    const [flushArgs] = await vi.waitUntil(() => flushFn.mock.calls[0]); // タスク内で flush が呼ばれる
    const closePromise = client.close(signal, reason); // 切断する
    await vi.waitUntil(() => flushArgs.signal.aborted); // タスクが中断される
    resolveFlush(); // タスクを終了する

    // Assert
    await expect(closePromise).resolves.toBe(undefined);
    expect(flushFn.mock.calls).toStrictEqual([[{ signal: expect.any(AbortSignal) }]]);
    expect(flushFn.mock.calls[0]![0].signal.reason).toBe(reason);
    expect(closeFn.mock.calls).toStrictEqual([[{ signal }]]);
  });

  test("タスクキューに未実行タスクがあるとき、close を実行するとキューが初期化され、実行中タスクへ中断が要求された後、データの書き出しと切断関数が実行される", async ({
    expect,
    signal,
  }) => {
    // Arrange
    const closeFn = vi.fn<() => void>();
    const flushFn = vi.fn<() => void>();
    const mockDb: IDatabaseClient = {
      isOpen: false,
      close: closeFn,
      query() {
        return [];
      },
      async transaction() {},
      flush: flushFn,
    };
    const client = new DatabaseClient(mockDb);

    // Act
    client.requestFlush(); // タスクをキューに追加
    await client.close(signal, "中断の理由"); // 切断する

    // Assert
    expect(flushFn.mock.calls).toStrictEqual([[{ signal: expect.any(AbortSignal) }]]);
    expect(closeFn.mock.calls).toStrictEqual([[{ signal }]]);
  });

  test("インターフェースに close 関数が存在しないとき、キューの処理や書き出しを終えた後、エラーを投げずに正常終了する", async ({
    expect,
    signal,
  }) => {
    // Arrange
    const mockDb: IDatabaseClient = {
      isOpen: false,
      query() {
        return [];
      },
      async transaction() {},
    };
    const client = new DatabaseClient(mockDb);

    // Act & Assert
    await expect(client.close(signal, "中断の理由")).resolves.toBe(undefined);
  });
});

describe("query", () => {
  test("SQL 文字列を指定して query を実行したとき、内部のクエリー関数へ空の配列と指定文字列が渡され、結果オブジェクトから全行取得ができる", async ({
    expect,
    signal,
  }) => {
    // Arrange
    const queryFn = vi.fn<() => Row[]>().mockReturnValue([{ id: 1, name: "tai-kun" }]);
    const mockDb: IDatabaseClient = {
      isOpen: true,
      query: queryFn,
      async transaction() {},
    };
    const client = new DatabaseClient(mockDb);
    const sqlString = "SELECT * FROM user";

    // Act
    const result = await client.query(signal, sqlString).collect();

    // Assert
    expect(queryFn.mock.calls).toStrictEqual([
      [
        {
          queryText: sqlString,
          bindings: [],
          signal,
        },
      ],
    ]);
    expect(result).toStrictEqual([{ id: 1, name: "tai-kun" }]);
  });

  test("プレースホルダーを含む構造化された SQL オブジェクトを指定して query を実行したとき、内部のクエリー関数へ複製された配列と解析済みの文字列が正しく渡される", async ({
    expect,
    signal,
  }) => {
    // Arrange
    const queryFn = vi.fn<() => Row[]>().mockReturnValue([{ id: 1, name: "tai-kun" }]);
    const mockDb: IDatabaseClient = {
      isOpen: true,
      query: queryFn,
      async transaction() {},
    };
    const client = new DatabaseClient(mockDb);
    const sqlObject = sql`SELECT * FROM user WHERE id = ${1}`;

    // Act
    const result = await client.query(signal, sqlObject).collect();

    // Assert
    expect(queryFn.mock.calls).toStrictEqual([
      [
        {
          queryText: "SELECT * FROM user WHERE id = $1",
          bindings: [1],
          signal,
        },
      ],
    ]);
    expect(result).toStrictEqual([{ id: 1, name: "tai-kun" }]);
  });

  test("返された結果の .then() を呼び出したとき、反復子に含まれるすべての行データが最後まで自動的に読み飛ばされ、クエリー処理の完了が保証される", async ({
    expect,
    signal,
  }) => {
    // Arrange
    let iterated = false;
    const queryFn = vi.fn<() => Generator<Row>>().mockReturnValue(
      (function* () {
        yield { id: 1, name: "tai-kun" };
        yield { id: 1, name: "tai-kun" };
        yield { id: 1, name: "tai-kun" };
        iterated = true;
      })(),
    );
    const mockDb: IDatabaseClient = {
      isOpen: true,
      query: queryFn,
      async transaction() {},
    };
    const client = new DatabaseClient(mockDb);

    // Act
    const result = await client.query(signal, "");

    // Assert
    expect(result).toBe(undefined);
    expect(iterated).toBe(true);
  });
});

describe("transaction", () => {
  test("正常終了時、コールバック関数の返り値を取得できる", async ({ expect, signal }) => {
    // Arrange
    const mockTx = {
      query() {
        return [];
      },
      rollback() {},
    };
    const mockDb: IDatabaseClient = {
      isOpen: true,
      query() {
        return [];
      },
      async transaction({ callback }: IDatabaseClient.TransactionArgs) {
        return await callback(mockTx);
      },
    };
    const client = new DatabaseClient(mockDb);

    // Act
    const result = await client.transaction(signal, async () => {
      return "success";
    });

    // Assert
    expect(result).toBe("success");
  });

  test("例外発生時、transaction を実行するとコールバック関数内で投げられたエラーがそのまま呼び出し元へ伝播し処理が中断される", async ({
    expect,
    signal,
  }) => {
    // Arrange
    const error = new Error("トランザクション内エラー");
    const mockTx = {
      query() {
        return [];
      },
      rollback() {},
    };
    const mockDb: IDatabaseClient = {
      isOpen: true,
      query() {
        return [];
      },
      async transaction({ callback }: IDatabaseClient.TransactionArgs) {
        return await callback(mockTx);
      },
    };
    const client = new DatabaseClient(mockDb);

    // Act & Assert
    await expect(
      client.transaction(signal, async () => {
        throw error;
      }),
    ).rejects.toThrow(error);
  });
});
