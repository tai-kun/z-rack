import type { IDatabaseClient } from "@z-rack/core";
import { Vibrato } from "@z-rack/jpn";
import vibratoWasmUri from "@z-rack/jpn/vibrato.wasm?url";
import { Pglite } from "@z-rack/pglite";
import pgliteWorkerUri from "@z-rack/pglite/worker?url";
import { test as vitest } from "vitest";

import Metabase from "../src/_metabase.js";
import TextSearch from "../src/_text-search.js";
import vibratoDictUri from "./vibrato.dic.zst?url";

let vibratoWasmCache: Uint8Array<ArrayBuffer>;
let vibratoDictCache: Uint8Array<ArrayBuffer>;

// oxlint-disable-next-line jest/expect-expect jest/no-disabled-tests
const test = vitest.extend<{
  db: IDatabaseClient;
  ts: TextSearch;
  meta: Metabase;
}>({
  // oxlint-disable-next-line no-empty-pattern
  async db({}, use) {
    let db: IDatabaseClient;
    if (typeof document === "undefined") {
      const { Worker } = await import("node:worker_threads");

      const uri2path = (uri: string) =>
        uri.startsWith("/@fs") ? uri.substring("/@fs".length) : "." + uri;

      const pgliteWorker = new Worker(uri2path(pgliteWorkerUri));
      db = new Pglite(pgliteWorker);
    } else {
      const pgliteWorker = new Worker(new URL(pgliteWorkerUri, import.meta.url), {
        type: "module",
      });
      db = new Pglite(pgliteWorker);
    }

    await use(db);
  },
  // oxlint-disable-next-line no-empty-pattern
  async ts({}, use) {
    let ts: TextSearch;
    if (typeof document === "undefined") {
      const { readFile } = await import("node:fs/promises");

      const uri2path = (uri: string) =>
        uri.startsWith("/@fs") ? uri.substring("/@fs".length) : "." + uri;

      const vibratoWasm = (vibratoWasmCache ??= await readFile(uri2path(vibratoWasmUri)));
      const vibratoDict = (vibratoDictCache ??= await readFile(uri2path(vibratoDictUri)));

      Vibrato.setWasmSource(vibratoWasm);

      ts = new TextSearch(new Vibrato(vibratoDict, { omitPos: ["助詞"] }));
    } else {
      Vibrato.setWasmSource(vibratoWasmUri);

      ts = new TextSearch(
        new Vibrato(
          {
            url: vibratoDictUri,
            checksum: "82a6da70bb4a17be70f20ff44f650f9ad1d2b0b4fcb2f39c17fc797f92d0ab75",
          },
          { omitPos: ["助詞"] },
        ),
      );
    }

    await use(ts);
  },
  // oxlint-disable-next-line no-empty-pattern
  async meta({ db, ts, signal }, use) {
    const meta = new Metabase("public", db, ts);
    try {
      await use(meta);
    } finally {
      if (meta.isOpen) {
        await meta.close(signal, null);
      }
    }
  },
});

test("エンティティー ID を取得できる", async ({ meta, expect, signal }) => {
  // 準備
  await meta.open(signal);

  // 実行
  const entityId = await meta.getEntityId(signal);

  // 検証
  expect(entityId).toMatch(/^[0-9a-z]+$/i);
});
