import { describe, test } from "vitest";

import type { ITextSearch } from "../src/text-search.types.js";

describe("ITextSearch", () => {
  test("インターフェースに準拠した最小限の実装が動作する", ({ expect }) => {
    // 準備
    const mockSearch: ITextSearch = {
      format: "simple",
      textConfig: "simple",
      defaultLanguage: "eng",
      supportedLanguages: ["eng"],
      isOpen: true,
      tokenize(args: ITextSearch.TokenizeArgs) {
        return args.text.split(/\s+/);
      },
    };

    // 実行
    const tokens = mockSearch.tokenize!({
      language: "eng",
      text: "hello world",
      signal: new AbortController().signal,
    });

    // 検証
    expect(tokens).toStrictEqual(["hello", "world"]);
  });
});
