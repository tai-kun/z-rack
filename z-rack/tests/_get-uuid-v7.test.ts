import { bytesToHex } from "@z-rack/core";
import { test } from "vitest";

import getUUIDv7 from "../src/_get-uuid-v7.js";

test("UUID を生成したとき、長さ 16 の Uint8Array になる", ({ expect }) => {
  // 準備と実行
  const result = getUUIDv7();

  // 検証
  expect(result).toBeInstanceOf(Uint8Array);
  expect(result.length).toBe(16);
});

test("連続して UUID を生成したとき、それぞれ異なる値になる", ({ expect }) => {
  // 準備と実行
  const first = getUUIDv7();
  const second = getUUIDv7();

  // 検証
  expect(first).not.toStrictEqual(second);
});

test("時間を空けて UUID を生成したとき、後の生成値が辞書順で大きくなる", async ({ expect }) => {
  // 準備
  const first = getUUIDv7();

  // 10 ミリ秒待機して時間を進める。
  await new Promise((resolve) => setTimeout(resolve, 10));

  const second = getUUIDv7();

  // 実行
  const firstHex = bytesToHex(first);
  const secondHex = bytesToHex(second);

  // 検証
  // 前者が後者より辞書順で小さいことを検証する。
  expect(firstHex).not.toBe(secondHex);

  // テスト失敗時に差分が意味を持つよう、配列構造の比較を用いる。
  const expectedOrder = [firstHex, secondHex].sort();
  expect([firstHex, secondHex]).toStrictEqual(expectedOrder);
});

test("連続して UUID を生成したとき、それぞれ異なるメモリ参照の配列になる", ({ expect }) => {
  // 準備と実行
  const first = getUUIDv7();
  const second = getUUIDv7();

  // 検証
  expect(first).not.toBe(second);
});

test("generated UUID v7 のバージョンを示す 4 ビット目が 0111 である", ({ expect }) => {
  // 準備と実行
  const result = getUUIDv7();

  // 検証
  // UUID v7 では、バイトオフセット 6 の上位 4 ビットが 0111 (0x70) になります。
  expect((result[6]! & 0xf0) >> 4).toBe(7);
});

test("バリアントを示す上位 2 ビットが 10 である", ({ expect }) => {
  // 準備と実行
  const result = getUUIDv7();

  // 検証
  // RFC 4122 に従い、バイトオフセット 8 の上位 2 ビットは 10 になります。
  expect((result[8]! & 0xc0) >> 6).toBe(2);
});
