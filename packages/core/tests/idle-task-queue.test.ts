import { describe, test, vi, beforeEach, afterEach } from "vitest";

import IdleTaskQueue from "../src/idle-task-queue.js";

// スケジューラのシミュレーションのためタイマーを偽装する。
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("タスクの追加と実行の基本動作", () => {
  test("単一のタスクをキューに追加したとき、そのタスクが実行され完了する", async ({ expect }) => {
    // 準備
    const queue = new IdleTaskQueue();
    let executed = false;
    const task = async () => {
      executed = true;
    };

    // 実行
    queue.add(task);
    await vi.runAllTimersAsync();

    // 検証
    expect(executed).toBe(true);
  });

  test("複数のタスクを連続で追加したとき、各タスクが順番に実行される", async ({ expect }) => {
    // 準備
    const queue = new IdleTaskQueue();
    const results: number[] = [];
    const task1 = async () => {
      results.push(1);
    };
    const task2 = async () => {
      results.push(2);
    };
    const task3 = async () => {
      results.push(3);
    };

    // 実行
    queue.add(task1);
    queue.add(task2);
    queue.add(task3);
    await vi.runAllTimersAsync();

    // 検証
    expect(results).toStrictEqual([1, 2, 3]);
  });

  test("タスクが CONTINUE を返したとき、そのタスクが再度キューの末尾に追加され実行される", async ({
    expect,
  }) => {
    // 準備
    const queue = new IdleTaskQueue();
    let callCount = 0;
    const task = async () => {
      callCount++;
      return callCount === 1 ? IdleTaskQueue.CONTINUE : undefined;
    };

    // 実行
    queue.add(task);
    // 最初の実行をスケジュール
    await vi.runAllTimersAsync();

    // 検証
    expect(callCount).toBe(2);
  });
});

describe("待機（wait）の振る舞い", () => {
  test("キューが空の状態で wait を呼び出したとき、即座に解決される", async ({ expect }) => {
    // 準備
    const queue = new IdleTaskQueue();

    // 実行と検証
    // 解決されることを検証する。
    await expect(queue.wait()).resolves.toBeUndefined();
  });

  test("実行中のタスクがある状態で wait を呼び出したとき、全てのタスクが完了した後に解決される", async ({
    expect,
  }) => {
    // 準備
    const queue = new IdleTaskQueue();
    let finishedCount = 0;
    const task = async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      finishedCount++;
    };

    // 実行
    queue.add(task);
    queue.add(task);
    const waitPromise = queue.wait();

    // タイマーを進めてタスクを完了させる。
    await vi.runAllTimersAsync();
    await waitPromise;

    // 検証
    expect(finishedCount).toBe(2);
  });

  test("複数の場所から wait を呼び出したとき、全ての待機者が一斉に解決される", async ({
    expect,
  }) => {
    // 準備
    const queue = new IdleTaskQueue();
    queue.add(async () => {});

    // 実行
    const p1 = queue.wait();
    const p2 = queue.wait();
    await vi.runAllTimersAsync();

    // 検証
    await expect(p1).resolves.toBeUndefined();
    await expect(p2).resolves.toBeUndefined();
  });
});

describe("排他制御とスケジューリング", () => {
  test("前のタスクが非同期実行中のとき、次のタスクは前のタスクの完了を待機してから開始される", async ({
    expect,
  }) => {
    // 準備
    const queue = new IdleTaskQueue();
    const order: string[] = [];
    const task1 = async () => {
      order.push("task1-start");
      await new Promise((resolve) => setTimeout(resolve, 100));
      order.push("task1-end");
    };
    const task2 = async () => {
      order.push("task2");
    };

    // 実行
    queue.add(task1);
    queue.add(task2);
    await vi.runAllTimersAsync();

    // 検証
    expect(order).toStrictEqual(["task1-start", "task1-end", "task2"]);
  });

  test("実行中のタスク内で add を呼び出したとき、新しいタスクが正常にキューに追加され実行される", async ({
    expect,
  }) => {
    // 準備
    const queue = new IdleTaskQueue();
    const results: string[] = [];
    const outerTask = async () => {
      results.push("outer");
      queue.add(async () => {
        results.push("inner");
      });
    };

    // 実行
    queue.add(outerTask);
    await vi.runAllTimersAsync();

    // 検証
    expect(results).toStrictEqual(["outer", "inner"]);
  });
});

describe("中断（abort）の処理", () => {
  test("abort を実行したとき、実行中のタスクに渡されている AbortSignal が中断状態になる", async ({
    expect,
  }) => {
    // 準備
    const queue = new IdleTaskQueue();
    let caughtSignal: AbortSignal | undefined;
    const task = async (signal: AbortSignal) => {
      caughtSignal = signal;
      // 中断されるまで待機するダミープルーフ。
      return new Promise<void>(() => {});
    };

    // 実行
    queue.add(task);
    // タスクの開始を確実にするためタイマーを回す。
    await vi.runAllTimersAsync();
    queue.abort("cancelled");

    // 検証
    expect(caughtSignal).toBeDefined();
    expect(caughtSignal!.aborted).toBe(true);
    expect(caughtSignal!.reason).toBe("cancelled");
  });

  test("abort を実行したあと新しいタスクを追加すると、新しいタスクが実行される", async ({
    expect,
  }) => {
    // 準備
    const queue = new IdleTaskQueue();
    queue.abort();

    let executed = false;
    const newTask = async (signal: AbortSignal) => {
      signal.throwIfAborted();
      executed = true;
    };

    // 実行
    queue.add(newTask);
    await vi.runAllTimersAsync();

    // 検証
    expect(executed).toBe(true);
  });
});

describe("エラーハンドリング", () => {
  test("タスク内で例外が発生したとき、後続のタスク実行が停止しない", async ({ expect }) => {
    // 準備
    const queue = new IdleTaskQueue();
    const order: string[] = [];
    const errorTask = async () => {
      throw new Error("Task Failed");
    };
    const nextTask = async () => {
      order.push("next");
    };

    // 実行
    queue.add(errorTask);
    queue.add(nextTask);
    await vi.runAllTimersAsync();

    // 検証
    expect(order).toStrictEqual(["next"]);
  });
});
