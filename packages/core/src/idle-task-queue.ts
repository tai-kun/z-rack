import type { MaybePromise } from "maypromise";

import logger from "./_logger.js";
import nil from "./nil.js";

/**
 * タスクを継続して実行（再キューイング）することを示す特別なシンボルです。
 */
const CONTINUE = Symbol("@z-rack/core:IdleTaskQueue:CONTINUE");

/**
 * キューに格納されるアイテムの定義です。
 */
type QueuedItem = {
  /**
   * 実行されるアイドルタスクのコールバックです。
   */
  readonly cb: IdleTask;
};

/**
 * アイドル時に実行されるタスクの型定義です。
 *
 * @param signal タスクの中断を検知するための中断シグナルです。
 * @returns タスクの完了を示す Promise です。IdleTaskQueue.CONTINUE を返すとタスクを再キューイングします。
 */
export interface IdleTask {
  (signal: AbortSignal): MaybePromise<void | typeof IdleTaskQueue.CONTINUE>;
}

/**
 * ブラウザーやランタイムのアイドル時間を利用してタスクを順次実行するキュークラスです。
 */
export default class IdleTaskQueue {
  /**
   * タスクを継続して実行（再キューイング）することを示す特別なシンボルです。
   */
  public static readonly CONTINUE = CONTINUE;

  /**
   * 待機中のタスクアイテムを保持する配列です。
   */
  readonly #queue: QueuedItem[];

  /**
   * キューが空になるのを待機しているプロミスを解決するための関数配列です。
   */
  readonly #waiters: (() => void)[];

  /**
   * 現在実行中のタスクの状態を管理するフラグです。
   *
   * 排他制御に使用され、前のタスクが完了するまで次のタスクの開始を抑制します。
   */
  #running: boolean;

  /**
   * タスクの実行（スケジュール）が既に予約されているかどうかを示すフラグです。
   */
  #scheduled: boolean;

  /**
   * タスクの実行を中断するためのコントローラーです。
   */
  #controller: AbortController;

  /**
   * IdleTaskQueue の新しいインスタンスを初期化します。
   */
  public constructor() {
    this.#queue = [];
    this.#waiters = [];
    this.#running = false;
    this.#scheduled = false;
    this.#controller = new AbortController();
  }

  /**
   * 待機中のプロミス（waiters）をすべて解決し、通知を行います。
   */
  #notify(): void {
    let resolve: (() => void) | undefined;
    while ((resolve = this.#waiters.shift())) {
      resolve();
    }
  }

  /**
   * 次のアイドルタイミングでタスクを実行するようにスケジュールします。
   */
  #schedule(): void {
    // 実行中のタスクがある場合はスケジュールしないようにします。
    if (this.#running) {
      return;
    }

    // 既にスケジュール済みの場合は重複してスケジュールしないようにします。
    if (this.#scheduled) {
      return;
    }

    this.#running = true;
    this.#scheduled = true;

    const runner = (): void => {
      this.#scheduled = false;

      const item = this.#queue.shift();
      if (item === undefined) {
        // アイテムがない場合は完了処理を試みて終了します。
        this.#notify();
        return;
      }

      void (async () => {
        try {
          const result = await item.cb(this.#controller.signal);
          if (result === CONTINUE) {
            // 戻り値が CONTINUE シンボルの場合は、再度キューの末尾に追加します。
            this.#queue.push(item);
          }
        } catch (ex) {
          logger.warn`Failed to run task: ${ex}`;
        } finally {
          this.#running = false;
        }

        if (this.#queue.length <= 0) {
          // すべてのタスクが終了したため、待機者に通知します。
          this.#notify();
        } else {
          // キューにまだタスクが残っている場合は、再度スケジュールを行います。
          this.#schedule();
        }
      })();
    };

    switch (true) {
      case typeof requestIdleCallback === "function":
        // ブラウザー標準のアイドル呼び出しを使用します。
        requestIdleCallback(runner);
        break;
      case typeof setImmediate === "function":
        // Node.js 等で利用可能な即時実行を使用します。
        setImmediate(runner);
        break;
      default:
        // 上記が利用できない場合は、最小遅延のタイマーで代用します。
        setTimeout(runner, 0);
    }
  }

  /**
   * すべてのタスクが完了し、キューが空であることを示します。
   */
  public get done(): boolean {
    return !this.#running && this.isEmpty;
  }

  /**
   * キューが空であれば true、そうでなければ false です。
   */
  public get isEmpty(): boolean {
    return this.#queue.length <= 0;
  }

  /**
   * キューに新しいアイドルタスクを追加します。
   *
   * @param task 実行するアイドルタスクです。
   */
  public add(task: IdleTask): void {
    this.#queue.push({
      cb: task,
    });
    this.#schedule();
  }

  /**
   * 現在のキューに含まれるすべてのタスクが完了するまで待機します。
   *
   * @returns すべてのタスクが完了したときに解決される Promise です。
   */
  public wait(): Promise<void> {
    if (this.done) {
      return Promise.resolve();
    }

    // 完了時に呼び出してもらうための解決関数をリストに登録します。
    return new Promise<void>((resolve) => {
      this.#waiters.push(resolve);
    });
  }

  /**
   * 現在実行中および待機中のすべてのタスクに中断信号（AbortSignal）を送信します。
   *
   * @param reason 中断の理由です。省略した場合はデフォルトの中断処理が行われます。
   */
  public abort(reason: unknown = nil): void {
    if (reason === nil) {
      this.#controller.abort();
    } else {
      this.#controller.abort(reason);
    }

    // 中断後は新しい AbortController を作成し、次回のタスクに備えます。
    this.#controller = new AbortController();

    if (this.done) {
      // すべてのタスクが終了しているため、待機者に通知します。
      this.#notify();
    }
  }

  /**
   * 耐機中のタスクを破棄します。
   */
  public clear(): void {
    this.#queue.length = 0;
  }
}
