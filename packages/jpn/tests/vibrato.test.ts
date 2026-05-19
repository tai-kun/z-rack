import type { WasmSource } from "@z-rack/core";
import { describe, test as vitest } from "vitest";

import {
  Vibrato,
  type VibratoDictionaryDataZstd,
  VibratoNotOpenError,
  VibratoChecksumError,
} from "../lib/index.js";
import wasmUrl from "../wasm/vibrato_wasm.wasm?url";
import dictUrl from "./vibrato.dic.zst?url";

let wasmCache: Uint8Array;
let dictCache: Uint8Array;

// oxlint-disable-next-line jest/expect-expect jest/no-disabled-tests
const test = vitest.extend<{
  wasm: WasmSource;
  dict: VibratoDictionaryDataZstd;
}>({
  // oxlint-disable-next-line no-empty-pattern
  async wasm({}, use) {
    if (typeof document === "undefined") {
      const fsp = await import("node:fs/promises");
      const wasm = (wasmCache ??= await fsp.readFile("." + wasmUrl));
      await use(wasm);
    } else {
      await use(wasmUrl);
    }
  },
  // oxlint-disable-next-line no-empty-pattern
  async dict({}, use) {
    if (typeof document === "undefined") {
      const fsp = await import("node:fs/promises");
      const dict = (dictCache ??= await fsp.readFile("." + dictUrl));
      await use(dict);
    } else {
      await use({
        url: dictUrl,
        checksum: "82a6da70bb4a17be70f20ff44f650f9ad1d2b0b4fcb2f39c17fc797f92d0ab75",
      });
    }
  },
});

describe("初期化および状態管理", () => {
  test("Uint8Array の辞書データでインスタンスを生成したとき、未オープンの状態になる", async ({
    expect,
    dict,
  }) => {
    // Arrange & Act
    const vibrato = new Vibrato(dict);

    // Assert
    expect(vibrato.isOpen).toBe(false);

    // Cleanup
    vibrato.close();
  });

  test("URL 指定の辞書データでインスタンスを生成したとき、正常に初期化される", async ({
    expect,
  }) => {
    // Arrange
    const urlDict: VibratoDictionaryDataZstd = {
      url: "https://example.com/dict.zst",
      checksum: "valid-hash",
    };

    // Act
    const vibrato = new Vibrato(urlDict);

    // Assert
    expect(vibrato).toBeDefined();

    // Cleanup
    vibrato.close();
  });

  test("open メソッドを実行したとき、辞書がロードされオープン状態に遷移する", async ({
    expect,
    signal,
    wasm,
    dict,
  }) => {
    // Arrange
    Vibrato.setWasmSource(wasm);
    const vibrato = new Vibrato(dict);

    // Act
    await vibrato.open({ signal });

    // Assert
    expect(vibrato.isOpen).toBe(true);

    // Cleanup
    vibrato.close();
  });

  test("辞書フェッチ時のチェックサムが一致しないとき、VibratoChecksumError が発生する", async ({
    expect,
    signal,
    wasm,
    skip,
  }) => {
    skip(typeof document === "undefined");

    // Arrange
    Vibrato.setWasmSource(wasm);
    const invalidDict: VibratoDictionaryDataZstd = {
      url: dictUrl,
      checksum: "invalid-checksum-string",
    };
    const vibrato = new Vibrato(invalidDict);

    // Act & Assert
    await expect(vibrato.open({ signal })).rejects.toThrow(VibratoChecksumError);

    // Cleanup
    vibrato.close();
  });

  test("open メソッドを複数回呼び出したとき、2 回目以降の処理はスキップされる", async ({
    expect,
    signal,
    wasm,
    dict,
  }) => {
    // Arrange
    Vibrato.setWasmSource(wasm);
    const vibrato = new Vibrato(dict);
    await vibrato.open({ signal });

    // Act & Assert
    // 2 回目の呼び出しで例外が発生せず、正常に完了することを確認する。
    await expect(vibrato.open({ signal })).resolves.toBeUndefined();
    expect(vibrato.isOpen).toBe(true);

    // Cleanup
    vibrato.close();
  });

  test("open メソッドの処理中に AbortSignal が発火したとき、処理が中断されリジェクトされる", async ({
    expect,
    wasm,
    dict,
  }) => {
    // Arrange
    Vibrato.setWasmSource(wasm);
    const vibrato = new Vibrato(dict);
    const controller = new AbortController();

    // Act
    controller.abort();
    const openPromise = vibrato.open({ signal: controller.signal });

    // Assert
    await expect(openPromise).rejects.toThrow();

    // Cleanup
    vibrato.close();
  });
});

describe("テキスト処理", () => {
  test("全角数字を含むテキストを正規化したとき、半角数字に変換される", ({ expect, dict }) => {
    // Arrange
    const vibrato = new Vibrato(dict);
    const text = "全角１２３";

    // Act
    const result = vibrato.normalize({ text });

    // Assert
    expect(result).toBe("全角123");

    // Cleanup
    vibrato.close();
  });

  test("辞書をオープンする前にトークン化を実行したとき、VibratoNotOpenError が発生する", ({
    expect,
    dict,
  }) => {
    // Arrange
    const vibrato = new Vibrato(dict);

    // Act & Assert
    expect(() => vibrato.tokenize({ language: "jpn", text: "テスト" })).toThrow(
      VibratoNotOpenError,
    );

    // Cleanup
    vibrato.close();
  });

  test("空文字のトークン化を実行したとき、WASM を呼び出さず空配列を返す", async ({
    expect,
    signal,
    wasm,
    dict,
  }) => {
    // Arrange
    Vibrato.setWasmSource(wasm);
    const vibrato = new Vibrato(dict);
    await vibrato.open({ signal });

    // Act
    const result = vibrato.tokenize({ language: "jpn", text: "" });

    // Assert
    expect(result).toStrictEqual([]);

    // Cleanup
    vibrato.close();
  });

  test("英語のテキストをトークン化したとき、空白区切りで分割される", async ({
    expect,
    signal,
    wasm,
    dict,
  }) => {
    // Arrange
    Vibrato.setWasmSource(wasm);
    const vibrato = new Vibrato(dict);
    await vibrato.open({ signal });

    // Act
    const result = vibrato.tokenize({ language: "eng", text: "Hello World" });

    // Assert
    expect(result).toStrictEqual(["Hello", "World"]);

    // Cleanup
    vibrato.close();
  });

  test("日本語のテキストをトークン化したとき、形態素の配列が返される", async ({
    expect,
    signal,
    wasm,
    dict,
  }) => {
    // Arrange
    Vibrato.setWasmSource(wasm);
    const vibrato = new Vibrato(dict);
    await vibrato.open({ signal });

    // Act
    const result = vibrato.tokenize({
      language: "jpn",
      text: "すもももももももものうち",
    });

    // Assert
    expect(result).toStrictEqual(["すもも", "も", "もも", "も", "もも", "の", "うち"]);

    // Cleanup
    vibrato.close();
  });

  test("品詞除外フィルタを指定したとき、該当するトークンが取り除かれる", async ({
    expect,
    signal,
    wasm,
    dict,
  }) => {
    // Arrange
    Vibrato.setWasmSource(wasm);
    const vibrato = new Vibrato(dict, { omitPos: ["助詞"] });
    await vibrato.open({ signal });

    // Act
    const result = vibrato.tokenize({
      language: "jpn",
      text: "すもももももももものうち",
    });

    // Assert
    // 「も」と「の」が除外されることを期待する。
    expect(result).toStrictEqual(["すもも", "もも", "もも", "うち"]);

    // Cleanup
    vibrato.close();
  });
});

describe("境界値および異常系", () => {
  test("存在しない URL から辞書をフェッチしたとき、エラーが適切に伝播される", async ({
    expect,
    signal,
    wasm,
  }) => {
    // Arrange
    Vibrato.setWasmSource(wasm);
    const nonExistentDict: VibratoDictionaryDataZstd = {
      url: "https://example.com/non-existent.dic.zst",
      checksum: "any-hash",
    };
    const vibrato = new Vibrato(nonExistentDict);

    // Act & Assert
    await expect(vibrato.open({ signal })).rejects.toThrow();
  });
});
