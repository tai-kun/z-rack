import { Memory } from "@unikvs/memory";
import { Vibrato } from "@z-rack/jpn";
import vibratoWasmUri from "@z-rack/jpn/vibrato.wasm?url";
import { Pglite } from "@z-rack/pglite";
import pgliteWorkerUri from "@z-rack/pglite/worker?url";
import { UniKvs } from "unikvs";
import { test as vitest } from "vitest";

import ZRack from "../src/z-rack.js";
import vibratoDictUri from "./vibrato.dic.zst?url";

let vibratoWasmCache: Uint8Array<ArrayBuffer>;
let vibratoDictCache: Uint8Array<ArrayBuffer>;

// oxlint-disable-next-line jest/expect-expect jest/no-disabled-tests
const test = vitest.extend<{
  zr: ZRack;
}>({
  // oxlint-disable-next-line no-empty-pattern
  async zr({}, use) {
    if (typeof document === "undefined") {
      const { readFile } = await import("node:fs/promises");
      const { Worker } = await import("node:worker_threads");

      const uri2path = (uri: string) =>
        uri.startsWith("/@fs") ? uri.substring("/@fs".length) : "." + uri;

      const vibratoWasm = (vibratoWasmCache ??= await readFile(uri2path(vibratoWasmUri)));
      const vibratoDict = (vibratoDictCache ??= await readFile(uri2path(vibratoDictUri)));

      Vibrato.setWasmSource(vibratoWasm);

      const pgliteWorker = new Worker(uri2path(pgliteWorkerUri));
      await using zr = new ZRack({
        textSearch: new Vibrato(vibratoDict, { omitPos: ["助詞"] }),
        storageSystem: UniKvs.config().appendStorage(new Memory()).create(),
        databaseClient: new Pglite(pgliteWorker),
      });

      await use(zr);
    } else {
      Vibrato.setWasmSource(vibratoWasmUri);

      const pgliteWorker = new Worker(pgliteWorkerUri);
      await using zr = new ZRack({
        textSearch: new Vibrato(
          {
            url: vibratoDictUri,
            checksum: "82a6da70bb4a17be70f20ff44f650f9ad1d2b0b4fcb2f39c17fc797f92d0ab75",
          },
          { omitPos: ["助詞"] },
        ),
        storageSystem: UniKvs.config().appendStorage(new Memory()).create(),
        databaseClient: new Pglite(pgliteWorker),
      });

      await use(zr);
    }
  },
});

test("a", { timeout: 15e3 }, async ({ expect, zr }) => {
  await zr.open();

  await zr.putObject("foo/bar/baz.txt", Uint8Array.from([0, 1, 2]), {
    description: "すもももももももものうち",
  });
  await zr.putObject("foo/bar/xxx.txt", Uint8Array.from([0, 1, 2]));
  await zr.putObject("foo/bar.txt", Uint8Array.from([0, 1, 2]), {
    description: "吾輩は猫である",
  });
  await zr.ready;

  const foo = await zr.getObject("foo/bar/baz.txt", {
    select: {
      description: true,
      userMetadata: true,
    },
  });

  console.log(foo);
  console.log(foo.description);
  console.log(foo.userMetadata);
  console.log(await foo.arrayBuffer());

  await zr.updateObjectMetadata("foo/bar.txt", {
    description: "ももを買ってくる",
  });

  console.log(
    JSON.parse(
      JSON.stringify(
        await Array.fromAsync(
          await zr.listObjects({
            prefix: "foo/",
            select: {
              key: true,
              description: true,
            },
          }),
        ),
      ),
    ),
  );

  console.log(
    JSON.parse(
      JSON.stringify(
        await Array.fromAsync(
          await zr.searchObjects({
            query: "もも",
            prefix: "foo/",
            select: {
              key: true,
              description: true,
            },
          }),
        ),
      ),
    ),
  );

  await zr.close();

  expect(true).toBe(true);
});
