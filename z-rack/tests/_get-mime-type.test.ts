import { test } from "vitest";

import getMimeType from "../src/_get-mime-type.js";

test("拡張子が .html の文字列を渡すと、text/html になる", ({ expect }) => {
  // Arrange
  const input = "index.html";

  // Act
  const result = getMimeType(input);

  // Assert
  expect(result).toStrictEqual("text/html");
});

test("拡張子のない文字列を渡すと、application/octet-stream になる", ({ expect }) => {
  // Arrange
  const input = "README";

  // Act
  const result = getMimeType(input);

  // Assert
  expect(result).toStrictEqual("application/octet-stream");
});

test("未知の拡張子を持つ文字列を渡すと、application/octet-stream になる", ({ expect }) => {
  // Arrange
  const input = "document.unknown_extension";

  // Act
  const result = getMimeType(input);

  // Assert
  expect(result).toStrictEqual("application/octet-stream");
});
