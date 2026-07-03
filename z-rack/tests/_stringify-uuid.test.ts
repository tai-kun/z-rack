import { test } from "vitest";

import stringifyUUID from "../src/_stringify-uuid.js";

test("全ての要素が 0 のバイナリデータを渡したとき、すべて 0 のハイフン区切り文字列になる", ({
  expect,
}) => {
  // 準備
  const bytes = new Uint8Array(16);

  // 実行
  const result = stringifyUUID(bytes);

  // 検証
  expect(result).toStrictEqual("00000000-0000-0000-0000-000000000000");
});

test("各バイトが異なる値を持つ標準的なバイナリデータを渡したとき、対応する小文字のハイフン区切り文字列になる", ({
  expect,
}) => {
  // 準備
  const bytes = new Uint8Array([
    0x1b, 0x4e, 0x28, 0xba, 0x2f, 0xa1, 0x11, 0xe2, 0x88, 0x4c, 0x08, 0x00, 0x20, 0x0c, 0x9a, 0x66,
  ]);

  // 実行
  const result = stringifyUUID(bytes);

  // 検証
  expect(result).toStrictEqual("1b4e28ba-2fa1-11e2-884c-0800200c9a66");
});

test("各バイトが最大値である 255 のバイナリデータを渡したとき、すべて f のハイフン区切り文字列になる", ({
  expect,
}) => {
  // 準備
  const bytes = new Uint8Array(16).fill(255);

  // 実行
  const result = stringifyUUID(bytes);

  // 検証
  expect(result).toStrictEqual("ffffffff-ffff-ffff-ffff-ffffffffffff");
});

test("16 進数で 1 桁になる値を渡したとき、各バイトが 0 埋めされた文字列になる", ({ expect }) => {
  // 準備
  const bytes = new Uint8Array(16).fill(10);

  // 実行
  const result = stringifyUUID(bytes);

  // 検証
  expect(result).toStrictEqual("0a0a0a0a-0a0a-0a0a-0a0a-0a0a0a0a0a0a");
});

test("長さが 16 未満のバイナリデータを渡したとき、不正な文字列が生成される", ({ expect }) => {
  // 準備
  const shortBytes = new Uint8Array(4);

  // 実行
  const result = stringifyUUID(shortBytes);

  // 検証
  // 長さ不足により undefined が含まれる
  expect(result).toContain("undefined");
});

test("長さが 16 より大きいバイナリデータを渡したとき、先頭 16 バイトで UUID 文字列が生成される", ({
  expect,
}) => {
  // 準備
  const bytes = new Uint8Array(20).fill(255);

  // 実行
  const result = stringifyUUID(bytes);

  // 検証
  expect(result).toStrictEqual("ffffffff-ffff-ffff-ffff-ffffffffffff");
});
