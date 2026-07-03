import { describe, test } from "vitest";

import type { StandardMimeType } from "../src/mime.types.js";

describe("StandardMimeType", () => {
  test("型レベルで有効な MIME タイプが代入可能である", ({ expect }) => {
    // 準備
    const valid: StandardMimeType = "application/json,json,map";

    // 実行と検証
    expect(valid).toBe("application/json,json,map");
  });
});
