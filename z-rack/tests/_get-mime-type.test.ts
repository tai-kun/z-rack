import { test } from "vitest";

import getMimeType from "../src/_get-mime-type.js";

test("拡張子が .html の文字列を渡すと、text/html になる", ({ expect }) => {
  // 準備
  const input = "index.html";

  // 実行
  const result = getMimeType(input);

  // 検証
  expect(result).toStrictEqual("text/html");
});

test("拡張子のない文字列を渡すと、application/octet-stream になる", ({ expect }) => {
  // 準備
  const input = "README";

  // 実行
  const result = getMimeType(input);

  // 検証
  expect(result).toStrictEqual("application/octet-stream");
});

test("未知の拡張子を持つ文字列を渡すと、application/octet-stream になる", ({ expect }) => {
  // 準備
  const input = "document.unknown_extension";

  // 実行
  const result = getMimeType(input);

  // 検証
  expect(result).toStrictEqual("application/octet-stream");
});

test("拡張子が .jpg の文字列を渡すと、image/jpeg になる", ({ expect }) => {
  // 準備
  const input = "photo.jpg";

  // 実行
  const result = getMimeType(input);

  // 検証
  expect(result).toStrictEqual("image/jpeg");
});

test("拡張子が .json の文字列を渡すと、application/json になる", ({ expect }) => {
  // 準備
  const input = "data.json";

  // 実行
  const result = getMimeType(input);

  // 検証
  expect(result).toStrictEqual("application/json");
});

test("拡張子が .txt の文字列を渡すと、text/plain になる", ({ expect }) => {
  // 準備
  const input = "readme.txt";

  // 実行
  const result = getMimeType(input);

  // 検証
  expect(result).toStrictEqual("text/plain");
});

test("拡張子が .js の文字列を渡すと、text/javascript になる", ({ expect }) => {
  // 準備
  const input = "script.js";

  // 実行
  const result = getMimeType(input);

  // 検証
  expect(result).toStrictEqual("text/javascript");
});

test("拡張子が大文字の .HTML を渡すと、text/html になる", ({ expect }) => {
  // 準備
  const input = "index.HTML";

  // 実行
  const result = getMimeType(input);

  // 検証
  expect(result).toStrictEqual("text/html");
});
