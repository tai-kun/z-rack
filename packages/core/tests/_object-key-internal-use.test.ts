import { test } from "vitest";

import objectKeyInternalUse from "../src/_object-key-internal-use.js";

test("初期状態で参照したとき、enable は false となっている", ({ expect }) => {
  // Act
  const actual = objectKeyInternalUse.enable;

  // Assert
  expect(actual).toBe(false);
});

test("enable に true を設定したとき、オブジェクトの状態が有効に更新される", ({ expect }) => {
  // Act
  objectKeyInternalUse.enable = true;

  // Assert
  expect(objectKeyInternalUse).toStrictEqual({
    enable: true,
  });
});
