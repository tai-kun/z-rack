// oxlint-disable typescript/unbound-method

import { Memory } from "@unikvs/memory";
import { ObjectKey } from "@z-rack/core";
import { Vibrato } from "@z-rack/jpn";
import vibratoWasmUri from "@z-rack/jpn/vibrato.wasm?url";
import { Pglite } from "@z-rack/pglite";
import pgliteWorkerUri from "@z-rack/pglite/worker?url";
import { UniKvs } from "unikvs";
import { describe, test as vitest } from "vitest";

import { ObjectExistsError, ObjectNotFoundError } from "../src/errors.js";
import ZRack from "../src/z-rack.js";
import vibratoDictUri from "./vibrato.dic.zst?url";

function concatUint8Arrays(arrays: readonly Uint8Array[]): Uint8Array<ArrayBuffer> {
  let totalLength = 0;

  for (const array of arrays) {
    totalLength += array.length;
  }

  const result = new Uint8Array(totalLength);

  let offset = 0;

  for (const array of arrays) {
    result.set(array, offset);
    offset += array.length;
  }

  return result;
}

let vibratoWasmCache: Uint8Array<ArrayBuffer>;
let vibratoDictCache: Uint8Array<ArrayBuffer>;

// oxlint-disable-next-line jest/expect-expect jest/no-disabled-tests
const test = vitest.extend<{
  rack: ZRack;
}>({
  // oxlint-disable-next-line no-empty-pattern
  async rack({}, use) {
    if (typeof document === "undefined") {
      const { readFile } = await import("node:fs/promises");
      const { Worker } = await import("node:worker_threads");

      const uri2path = (uri: string) =>
        uri.startsWith("/@fs") ? uri.substring("/@fs".length) : "." + uri;

      const vibratoWasm = (vibratoWasmCache ??= await readFile(uri2path(vibratoWasmUri)));
      const vibratoDict = (vibratoDictCache ??= await readFile(uri2path(vibratoDictUri)));

      Vibrato.setWasmSource(vibratoWasm);

      const pgliteWorker = new Worker(uri2path(pgliteWorkerUri));
      await using rack = new ZRack({
        textSearch: new Vibrato(vibratoDict, { omitPos: ["助詞"] }),
        storageSystem: UniKvs.config().appendStorage(new Memory()).create(),
        databaseClient: new Pglite(pgliteWorker),
      });

      await use(rack);
    } else {
      Vibrato.setWasmSource(vibratoWasmUri);

      const pgliteWorker = new Worker(new URL(pgliteWorkerUri, import.meta.url), {
        type: "module",
      });
      await using rack = new ZRack({
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

      await use(rack);
    }
  },
});

describe("putObject", () => {
  test("単一オブジェクトでオブジェクトを作成できる", async ({ rack, expect, signal }) => {
    await rack.open({ signal });
    await rack.ready;
    const key = "foo.mp4";
    const data = new Uint8Array();

    await expect(rack.putObject({ key, data, signal })).resolves.toBe(undefined);
  });

  test("複数引数でオブジェクトを作成できる", async ({ rack, expect, signal }) => {
    await rack.open({ signal });
    await rack.ready;
    const key = "foo.mp4";
    const data = new Uint8Array();

    await expect(rack.putObject(key, data, { signal })).resolves.toBe(undefined);
  });

  test("オブジェクトを上書きできる", async ({ rack, expect, signal }) => {
    await rack.open({ signal });
    await rack.ready;
    const key = "foo.mp4";
    const data = new Uint8Array();

    await expect(rack.putObject({ key, data, signal })).resolves.toBe(undefined);
    await expect(rack.putObject({ key, data, signal })).resolves.toBe(undefined);
  });

  test("排他モードでオブジェクトを新規作成できる", async ({ rack, expect, signal }) => {
    await rack.open({ signal });
    await rack.ready;
    const key = "foo.mp4";
    const data = new Uint8Array();

    await expect(rack.putObject({ key, data, mode: "wx", signal })).resolves.toBe(undefined);
  });

  test("排他モードでオブジェクトを上書きしようとしてエラー", async ({ rack, expect, signal }) => {
    await rack.open({ signal });
    await rack.ready;
    const key = "foo.mp4";
    const data = new Uint8Array();

    await expect(rack.putObject({ key, data, mode: "wx", signal })).resolves.toBe(undefined);
    await expect(rack.putObject({ key, data, mode: "wx", signal })).rejects.toThrow(
      ObjectExistsError,
    );
  });
});

describe("getObject", () => {
  test("単一オブジェクトでオブジェクトを取得できる", async ({ rack, expect, signal }) => {
    await rack.open({ signal });
    await rack.ready;
    const key = "path/to/foo.mp4";
    const data = new Uint8Array([1, 2, 3]);
    await rack.putObject({ key, data, signal });

    const object = await rack.getObject({ key, signal });

    expect(object).toBeInstanceOf(File);
    expect(object.key).toBeInstanceOf(ObjectKey);
    expect(object.key.toString()).toBe(key);
    expect(object.name).toBe("foo.mp4");
    expect(object.type).toBe("video/mp4");
    expect(object.type).toBe(object.mimeType);
    expect(object.size).toBe(3);
    expect(new Uint8Array(await object.arrayBuffer())).toStrictEqual(new Uint8Array([1, 2, 3]));
    expect(object.lastModified).toBe(object.lastModifiedAt);
  });

  test("複数引数でオブジェクトを取得できる", async ({ rack, expect, signal }) => {
    await rack.open({ signal });
    await rack.ready;
    const key = "path/to/foo.mp4";
    const data = new Uint8Array([1, 2, 3]);
    await rack.putObject({ key, data, signal });

    const object = await rack.getObject(key, { signal });

    expect(object).toBeInstanceOf(File);
    expect(object.key).toBeInstanceOf(ObjectKey);
    expect(object.key.toString()).toBe(key);
    expect(object.name).toBe("foo.mp4");
    expect(object.type).toBe("video/mp4");
    expect(object.type).toBe(object.mimeType);
    expect(object.size).toBe(3);
    expect(new Uint8Array(await object.arrayBuffer())).toStrictEqual(new Uint8Array([1, 2, 3]));
    expect(object.lastModified).toBe(object.lastModifiedAt);
  });

  test("メタデータと共にオブジェクトを取得できる", async ({ rack, expect, signal }) => {
    await rack.open({ signal });
    await rack.ready;
    const key = "path/to/foo.mp4";
    const data = new Uint8Array([1, 2, 3]);
    await rack.putObject({
      key,
      data,
      signal,
      userMetadata: {
        foo: "bar",
      },
    });

    const object = await rack.getObject({
      key,
      select: {
        eTag: undefined,
        language: false,
        description: true,
        userMetadata: true,
      },
      signal,
    });

    expect(object).toBeInstanceOf(File);
    expect(object).not.toHaveProperty("eTag");
    expect(object).not.toHaveProperty("language");
    expect(object.description).toBe(null);
    expect(object.userMetadata).toStrictEqual({
      foo: "bar",
    });
  });

  test("存在しないオブジェクトを取得しようとしてエラー", async ({ rack, expect, signal }) => {
    await rack.open({ signal });
    await rack.ready;
    const key = "path/to/foo.mp4";

    await expect(rack.getObject({ key, signal })).rejects.toThrow(ObjectNotFoundError);
  });
});

describe("getObjectStream", () => {
  test("単一オブジェクトでオブジェクトを取得できる", async ({ rack, expect, signal }) => {
    await rack.open({ signal });
    await rack.ready;
    const key = "path/to/foo.mp4";
    const data = new Uint8Array([1, 2, 3]);
    await rack.putObject({ key, data, signal });

    const stream = await rack.getObjectStream({ key, signal });

    expect(stream).toBeInstanceOf(ReadableStream);
    expect(stream.key).toBeInstanceOf(ObjectKey);
    expect(stream.key.toString()).toBe(key);
    expect(concatUint8Arrays(await Array.fromAsync(stream))).toStrictEqual(
      new Uint8Array([1, 2, 3]),
    );
  });

  test("複数引数でオブジェクトを取得できる", async ({ rack, expect, signal }) => {
    await rack.open({ signal });
    await rack.ready;
    const key = "path/to/foo.mp4";
    const data = new Uint8Array([1, 2, 3]);
    await rack.putObject({ key, data, signal });

    const stream = await rack.getObjectStream(key, { signal });

    expect(stream).toBeInstanceOf(ReadableStream);
    expect(stream.key).toBeInstanceOf(ObjectKey);
    expect(stream.key.toString()).toBe(key);
    expect(concatUint8Arrays(await Array.fromAsync(stream))).toStrictEqual(
      new Uint8Array([1, 2, 3]),
    );
  });

  test("メタデータと共にオブジェクトを取得できる", async ({ rack, expect, signal }) => {
    await rack.open({ signal });
    await rack.ready;
    const key = "path/to/foo.mp4";
    const data = new Uint8Array([1, 2, 3]);
    await rack.putObject({
      key,
      data,
      tags: ["一般", "動画"],
      signal,
    });

    const stream = await rack.getObjectStream({
      key,
      select: {
        eTag: undefined,
        tags: true,
        language: false,
      },
      signal,
    });

    expect(stream).not.toHaveProperty("eTag");
    expect(stream).not.toHaveProperty("language");
    expect(stream.tags).toStrictEqual(new Set(["一般", "動画"]));
  });

  test("存在しないメタデータを取得しようとしてエラー", async ({ rack, expect, signal }) => {
    await rack.open({ signal });
    await rack.ready;
    const key = "path/to/foo.mp4";

    await expect(rack.getObjectStream({ key, signal })).rejects.toThrow(ObjectNotFoundError);
  });
});

describe("listObjects", () => {
  test("単一オブジェクトでオブジェクトをリストアップできる", async ({ rack, expect, signal }) => {
    await rack.open({ signal });
    await rack.ready;
    await rack.putObject({ key: "foo.mp4", data: new Uint8Array(), signal });
    await rack.putObject({ key: "bar.mp4", data: new Uint8Array(), signal });

    const asyncGenerator = await rack.listObjects({ signal });
    const objects = await Array.fromAsync(asyncGenerator);

    expect(asyncGenerator).toBeTypeOf("object");
    expect(asyncGenerator.next).toBeTypeOf("function");
    expect(objects).toHaveLength(2);
    expect(objects[0]!.key.toString()).toBe("bar.mp4");
    expect(objects[1]!.key.toString()).toBe("foo.mp4");
  });

  test("複数引数でオブジェクトをリストアップできる", async ({ rack, expect, signal }) => {
    await rack.open({ signal });
    await rack.ready;
    await rack.putObject({ key: "path/to/foo.mp4", data: new Uint8Array(), signal });
    await rack.putObject({ key: "path/to/bar.mp4", data: new Uint8Array(), signal });

    const asyncGenerator = await rack.listObjects("path/to/", { signal });
    const objects = await Array.fromAsync(asyncGenerator);

    expect(asyncGenerator).toBeTypeOf("object");
    expect(asyncGenerator.next).toBeTypeOf("function");
    expect(objects).toHaveLength(2);
    expect(objects[0]!.key.toString()).toBe("path/to/bar.mp4");
    expect(objects[1]!.key.toString()).toBe("path/to/foo.mp4");
  });

  test("キーが特定の接頭辞で始まるオブジェクトをリストアップできる", async ({
    rack,
    expect,
    signal,
  }) => {
    await rack.open({ signal });
    await rack.ready;
    await rack.putObject({ key: "fuga-foo-2.mp4", data: new Uint8Array(), signal });
    await rack.putObject({ key: "fuga-foo-1.mp4", data: new Uint8Array(), signal });
    await rack.putObject({ key: "hoge-bar-2.mp4", data: new Uint8Array(), signal });
    await rack.putObject({ key: "hoge-bar-1.mp4", data: new Uint8Array(), signal });

    const asyncGenerator = await rack.listObjects({ prefix: "fuga-", signal });
    const objects = await Array.fromAsync(asyncGenerator);

    expect(objects).toHaveLength(2);
    expect(objects[0]!.key.toString()).toBe("fuga-foo-1.mp4");
    expect(objects[1]!.key.toString()).toBe("fuga-foo-2.mp4");
  });

  test("キーが特定のディレクトリーで始まるオブジェクトをリストアップできる", async ({
    rack,
    expect,
    signal,
  }) => {
    await rack.open({ signal });
    await rack.ready;
    await rack.putObject({ key: "foo/2.mp4", data: new Uint8Array(), signal });
    await rack.putObject({ key: "foo/1.mp4", data: new Uint8Array(), signal });
    await rack.putObject({ key: "bar/2.mp4", data: new Uint8Array(), signal });
    await rack.putObject({ key: "bar/1.mp4", data: new Uint8Array(), signal });

    const asyncGenerator = await rack.listObjects({ prefix: "foo/", signal });
    const objects = await Array.fromAsync(asyncGenerator);

    expect(objects).toHaveLength(2);
    expect(objects[0]!.key.toString()).toBe("foo/1.mp4");
    expect(objects[1]!.key.toString()).toBe("foo/2.mp4");
  });

  test("並び順を変更できる", async ({ rack, expect, signal }) => {
    await rack.open({ signal });
    await rack.ready;
    await rack.putObject({ key: "foo.mp4", data: new Uint8Array(), signal });
    await rack.putObject({ key: "bar.mp4", data: new Uint8Array(), signal });

    const asyncGenerator = await rack.listObjects({
      order: {
        direction: "DESC",
      },
      signal,
    });
    const objects = await Array.fromAsync(asyncGenerator);

    expect(objects).toHaveLength(2);
    expect(objects[0]!.key.toString()).toBe("foo.mp4");
    expect(objects[1]!.key.toString()).toBe("bar.mp4");
  });

  test("ページネーションを設定できる", async ({ rack, expect, signal }) => {
    await rack.open({ signal });
    await rack.ready;
    await rack.putObject({ key: "foo.mp4", data: new Uint8Array(), signal });
    await rack.putObject({ key: "bar.mp4", data: new Uint8Array(), signal });
    await rack.putObject({ key: "baz.mp4", data: new Uint8Array(), signal });

    const asyncGenerator = await rack.listObjects({
      skip: 1,
      take: 1,
      signal,
    });
    const objects = await Array.fromAsync(asyncGenerator);

    expect(objects).toHaveLength(1);
    expect(objects[0]!.key.toString()).toBe("baz.mp4");
  });
});

describe("searchObjects", () => {
  test("単一オブジェクトでオブジェクトをリストアップできる", async ({ rack, expect, signal }) => {
    await rack.open({ signal });
    await rack.ready;
    await rack.putObject({ key: "foo.mp4", description: "あ", data: new Uint8Array(), signal });
    await rack.putObject({ key: "bar.mp4", description: "い", data: new Uint8Array(), signal });

    const asyncGenerator = await rack.searchObjects({
      query: "あ",
      signal,
    });
    const objects = await Array.fromAsync(asyncGenerator);

    expect(asyncGenerator).toBeTypeOf("object");
    expect(asyncGenerator.next).toBeTypeOf("function");
    expect(objects).toHaveLength(1);
    expect(objects[0]!.key.toString()).toBe("foo.mp4");
    expect(objects[0]!.score).toBeGreaterThan(0);
  });

  test("複数引数でオブジェクトをリストアップできる", async ({ rack, expect, signal }) => {
    await rack.open({ signal });
    await rack.ready;
    await rack.putObject({ key: "foo.mp4", description: "あ", data: new Uint8Array(), signal });
    await rack.putObject({ key: "bar.mp4", description: "い", data: new Uint8Array(), signal });

    const asyncGenerator = await rack.searchObjects("あ", { signal });
    const objects = await Array.fromAsync(asyncGenerator);

    expect(asyncGenerator).toBeTypeOf("object");
    expect(asyncGenerator.next).toBeTypeOf("function");
    expect(objects).toHaveLength(1);
    expect(objects[0]!.key.toString()).toBe("foo.mp4");
  });

  test("キーが特定の接頭辞で始まるオブジェクトをリストアップできる", async ({
    rack,
    expect,
    signal,
  }) => {
    await rack.open({ signal });
    await rack.ready;
    const putOpts = { data: new Uint8Array(), signal };
    await rack.putObject({ key: "fuga-foo-2.mp4", description: "あ", ...putOpts });
    await rack.putObject({ key: "fuga-foo-1.mp4", description: "い", ...putOpts });
    await rack.putObject({ key: "hoge-bar-2.mp4", description: "あ", ...putOpts });
    await rack.putObject({ key: "hoge-bar-1.mp4", description: "い", ...putOpts });

    const asyncGenerator = await rack.searchObjects({
      query: "あ",
      prefix: "fuga-",
      signal,
    });
    const objects = await Array.fromAsync(asyncGenerator);

    expect(objects).toHaveLength(1);
    expect(objects[0]!.key.toString()).toBe("fuga-foo-2.mp4");
  });

  test("キーが特定のディレクトリーで始まるオブジェクトをリストアップできる", async ({
    rack,
    expect,
    signal,
  }) => {
    await rack.open({ signal });
    await rack.ready;
    const putOpts = { data: new Uint8Array(), signal };
    await rack.putObject({ key: "foo/2.mp4", description: "あ", ...putOpts });
    await rack.putObject({ key: "foo/1.mp4", description: "い", ...putOpts });
    await rack.putObject({ key: "bar/2.mp4", description: "あ", ...putOpts });
    await rack.putObject({ key: "bar/1.mp4", description: "い", ...putOpts });

    const asyncGenerator = await rack.searchObjects({
      query: "あ",
      prefix: "foo/",
      signal,
    });
    const objects = await Array.fromAsync(asyncGenerator);

    expect(objects).toHaveLength(1);
    expect(objects[0]!.key.toString()).toBe("foo/2.mp4");
  });

  test("ページネーションを設定できる", async ({ rack, expect, signal }) => {
    await rack.open({ signal });
    await rack.ready;
    const putOpts = { data: new Uint8Array(), signal };
    await rack.putObject({ key: "foo.mp4", description: "あ", ...putOpts });
    await rack.putObject({ key: "bar.mp4", description: "あ", ...putOpts });
    await rack.putObject({ key: "baz.mp4", description: "あ", ...putOpts });

    const asyncGenerator = await rack.searchObjects({
      query: "あ",
      skip: 1,
      take: 1,
      signal,
    });
    const objects = await Array.fromAsync(asyncGenerator);

    expect(objects).toHaveLength(1);
    expect(objects[0]!.key.toString()).toBe("baz.mp4");
  });

  test("同じスコアー同士で名前順になる", async ({ rack, expect, signal }) => {
    await rack.open({ signal });
    await rack.ready;
    const putOpts = { data: new Uint8Array(), signal };
    await rack.putObject({ key: "C.mp4", description: "あ", ...putOpts });
    await rack.putObject({ key: "B.mp4", description: "あ", ...putOpts });
    await rack.putObject({ key: "A.mp4", description: "い", ...putOpts });

    const asyncGenerator = await rack.searchObjects({
      query: "あ",
      signal,
    });
    const objects = await Array.fromAsync(asyncGenerator);

    expect(objects).toHaveLength(2);
    expect(objects[0]!.key.toString()).toBe("B.mp4");
    expect(objects[1]!.key.toString()).toBe("C.mp4");
  });
});

describe("deleteObject", () => {
  test("単一オブジェクトでオブジェクトを削除できる", async ({ rack, expect, signal }) => {
    await rack.open({ signal });
    await rack.ready;
    await rack.putObject({ key: "foo.mp4", data: new Uint8Array(), signal });

    await expect(rack.deleteObject({ key: "foo.mp4", signal })).resolves.toBe(undefined);
  });

  test("複数引数でオブジェクトを削除できる", async ({ rack, expect, signal }) => {
    await rack.open({ signal });
    await rack.ready;
    await rack.putObject({ key: "foo.mp4", data: new Uint8Array(), signal });

    await expect(rack.deleteObject("foo.mp4", { signal })).resolves.toBe(undefined);
  });

  test("存在しないオブジェクトを削除しようとしてエラー", async ({ rack, expect, signal }) => {
    await rack.open({ signal });
    await rack.ready;

    await expect(rack.deleteObject({ key: "foo.mp4", signal })).rejects.toThrow(
      ObjectNotFoundError,
    );
  });
});

describe("getObjectMetadata", () => {
  test("単一オブジェクトでメタデータを取得できる", async ({ rack, expect, signal }) => {
    await rack.open({ signal });
    await rack.ready;
    const key = "path/to/foo.mp4";
    const data = new Uint8Array([1, 2, 3]);
    await rack.putObject({ key, data, signal });

    const object = await rack.getObjectMetadata({ key, signal });

    expect(object.key).toBeInstanceOf(ObjectKey);
    expect(object.key.toString()).toBe(key);
    expect(object.size).toBe(3);
  });

  test("複数引数でオブジェクトを取得できる", async ({ rack, expect, signal }) => {
    await rack.open({ signal });
    await rack.ready;
    const key = "path/to/foo.mp4";
    const data = new Uint8Array([1, 2, 3]);
    await rack.putObject({ key, data, signal });

    const object = await rack.getObjectMetadata(key, { signal });

    expect(object.key).toBeInstanceOf(ObjectKey);
    expect(object.key.toString()).toBe(key);
    expect(object.size).toBe(3);
  });

  test("特定のメタデータを取得できる", async ({ rack, expect, signal }) => {
    await rack.open({ signal });
    await rack.ready;
    const key = "path/to/foo.mp4";
    const data = new Uint8Array([1, 2, 3]);
    await rack.putObject({
      key,
      data,
      signal,
      userMetadata: {
        foo: "bar",
      },
    });

    const object = await rack.getObjectMetadata({
      key,
      select: {
        eTag: undefined,
        language: false,
        description: true,
        userMetadata: true,
      },
      signal,
    });

    expect(object).not.toHaveProperty("key");
    expect(object).not.toHaveProperty("eTag");
    expect(object).not.toHaveProperty("language");
    expect(object.description).toBe(null);
    expect(object.userMetadata).toStrictEqual({
      foo: "bar",
    });
  });

  test("存在しないメタデータを取得しようとしてエラー", async ({ rack, expect, signal }) => {
    await rack.open({ signal });
    await rack.ready;
    const key = "path/to/foo.mp4";

    await expect(rack.getObjectMetadata({ key, signal })).rejects.toThrow(ObjectNotFoundError);
  });
});

describe("updateObjectMetadata", () => {
  test("単一オブジェクトでメタデータを取得できる", async ({ rack, expect, signal }) => {
    await rack.open({ signal });
    await rack.ready;
    const key = "path/to/foo.mp4";
    const data = new Uint8Array([1, 2, 3]);
    await rack.putObject({ key, data, signal });

    await rack.updateObjectMetadata({
      key,
      signal,
      description: "説明文",
      userMetadata: {
        foo: "bar",
      },
    });

    await expect(
      rack.getObjectMetadata({
        key,
        select: {
          language: true,
          userMetadata: true,
        },
        signal,
      }),
    ).resolves.toStrictEqual({
      language: "jpn",
      userMetadata: {
        foo: "bar",
      },
    });
  });

  test("複数引数でメタデータを取得できる", async ({ rack, expect, signal }) => {
    await rack.open({ signal });
    await rack.ready;
    const key = "path/to/foo.mp4";
    const data = new Uint8Array([1, 2, 3]);
    await rack.putObject({ key, data, signal });

    await rack.updateObjectMetadata({
      key,
      signal,
      description: "説明文",
      userMetadata: {
        foo: "bar",
      },
    });

    await expect(
      rack.getObjectMetadata({
        key,
        select: {
          language: true,
          userMetadata: true,
        },
        signal,
      }),
    ).resolves.toStrictEqual({
      language: "jpn",
      userMetadata: {
        foo: "bar",
      },
    });
  });

  test("存在しないメタデータを更新しようとしてエラー", async ({ rack, expect, signal }) => {
    await rack.open({ signal });
    await rack.ready;
    const key = "path/to/foo.mp4";

    await expect(rack.updateObjectMetadata({ key, signal })).rejects.toThrow(ObjectNotFoundError);
  });

  test("更新時刻が更新される", async ({ rack, expect, signal }) => {
    await rack.open({ signal });
    await rack.ready;
    const key = "path/to/foo.mp4";
    const data = new Uint8Array([1, 2, 3]);
    await rack.putObject({ key, data, signal });

    const prevUpdate = await rack.getObjectMetadata({
      key,
      select: {
        recordTimestamp: true,
        lastModifiedAt: true,
      },
      signal,
    });
    await rack.updateObjectMetadata({ key, signal, description: "説明文" });
    const postUpdate = await rack.getObjectMetadata({
      key,
      select: {
        recordTimestamp: true,
        lastModifiedAt: true,
      },
      signal,
    });

    expect(prevUpdate.lastModifiedAt).toBe(prevUpdate.recordTimestamp);
    expect(postUpdate.lastModifiedAt).toBe(postUpdate.recordTimestamp);
    expect(postUpdate.lastModifiedAt).toBeGreaterThan(prevUpdate.lastModifiedAt);
  });
});
