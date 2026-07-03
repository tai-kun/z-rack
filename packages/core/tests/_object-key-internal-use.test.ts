import { test } from "vitest";

import objectKeyInternalUse from "../src/_object-key-internal-use.js";

test("初期状態で参照したとき、enable は false となっている", ({ expect }) => {
  // 実行
  const actual = objectKeyInternalUse.enable;

  // 検証
  expect(actual).toBe(false);
});

test("enable に true を設定したとき、オブジェクトの状態が有効に更新される", ({ expect }) => {
  // 実行
  objectKeyInternalUse.enable = true;

  // 検証
  expect(objectKeyInternalUse).toStrictEqual({
    enable: true,
  });
});
