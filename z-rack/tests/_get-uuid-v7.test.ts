import { bytesToHex } from "@z-rack/core";
import { test } from "vitest";

import getUUIDv7 from "../src/_get-uuid-v7.js";

test("UUID を生成したとき、長さ 16 の Uint8Array になる", ({ expect }) => {
  // Arrange & Act
  const result = getUUIDv7();

  // Assert
  expect(result).toBeInstanceOf(Uint8Array);
  expect(result.length).toBe(16);
});

test("連続して UUID を生成したとき、それぞれ異なる値になる", ({ expect }) => {
  // Arrange & Act
  const first = getUUIDv7();
  const second = getUUIDv7();

  // Assert
  expect(first).not.toStrictEqual(second);
});

test("時間を空けて UUID を生成したとき、後の生成値が辞書順で大きくなる", async ({ expect }) => {
  // Arrange
  const first = getUUIDv7();

  // 10 ミリ秒待機して時間を進める。
  await new Promise((resolve) => setTimeout(resolve, 10));

  const second = getUUIDv7();

  // Act
  const firstHex = bytesToHex(first);
  const secondHex = bytesToHex(second);

  // Assert
  // 前者が後者より辞書順で小さいことを検証する。
  expect(firstHex).not.toBe(secondHex);

  // テスト失敗時に差分が意味を持つよう、配列構造の比較を用いる。
  const expectedOrder = [firstHex, secondHex].sort();
  expect([firstHex, secondHex]).toStrictEqual(expectedOrder);
});

test("連続して UUID を生成したとき、それぞれ異なるメモリ参照の配列になる", ({ expect }) => {
  // Arrange & Act
  const first = getUUIDv7();
  const second = getUUIDv7();

  // Assert
  expect(first).not.toBe(second);
});
