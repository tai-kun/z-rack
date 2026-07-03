import {
  InvalidInputError,
  InvalidOutputError,
  ITextSearch,
  UnreachableError,
  Utf8,
} from "@z-rack/core";
import { test, describe, vi } from "vitest";

import TextSearch from "../src/_text-search.js";
import { UnsupportedLanguageError } from "../src/errors.js";

describe("コンストラクターの初期化と検証", () => {
  test("最小構成の設定を持つオブジェクトを渡したとき、インスタンスが正常に生成されて各プロパティーに値が正しく格納される", ({
    expect,
  }) => {
    // 準備
    const tsStub: ITextSearch = {
      format: "text",
      textConfig: "simple",
      defaultLanguage: "eng",
      supportedLanguages: ["eng"],
      isOpen: false,
    };

    // 実行
    const ts = new TextSearch(tsStub);

    // 検証
    expect(ts.format).toBe("text");
    expect(ts.textConfig).toBe("simple");
    expect(ts.bm25Params).toStrictEqual({ k1: 1.2, b: 0.75 });
    expect(ts.SupportedLanguageSchema.expects).toBe('"eng"');
  });

  test("BM25 パラメーターの k1 を指定して初期化を試みたとき、それが設定される", ({ expect }) => {
    // 準備
    const tsStub: ITextSearch = {
      format: "text",
      textConfig: "simple",
      defaultLanguage: "eng",
      supportedLanguages: ["eng"],
      bm25Params: {
        k1: 0.9,
      },
      isOpen: false,
    };

    // 実行
    const ts = new TextSearch(tsStub);

    // 検証
    expect(ts.bm25Params).toStrictEqual({ k1: 0.9, b: 0.75 });
  });

  test("BM25 パラメーターの b を指定して初期化を試みたとき、それが設定される", ({ expect }) => {
    // 準備
    const tsStub: ITextSearch = {
      format: "text",
      textConfig: "simple",
      defaultLanguage: "eng",
      supportedLanguages: ["eng"],
      bm25Params: {
        b: 0.8,
      },
      isOpen: false,
    };

    // 実行
    const ts = new TextSearch(tsStub);

    // 検証
    expect(ts.bm25Params).toStrictEqual({ k1: 1.2, b: 0.8 });
  });

  test("BM25 パラメーターを指定して初期化を試みたとき、それらが設定される", ({ expect }) => {
    // 準備
    const tsStub: ITextSearch = {
      format: "text",
      textConfig: "simple",
      defaultLanguage: "eng",
      supportedLanguages: ["eng"],
      bm25Params: {
        k1: 0.9,
        b: 0.8,
      },
      isOpen: false,
    };

    // 実行
    const ts = new TextSearch(tsStub);

    // 検証
    expect(ts.bm25Params).toStrictEqual({ k1: 0.9, b: 0.8 });
  });

  test("Set 形式のサポート言語リストを渡したとき、重複なく正常に読み込まれて検証用スキーマが正しく構築される", ({
    expect,
  }) => {
    // 準備
    const tsStub: ITextSearch = {
      format: "text",
      textConfig: "simple",
      defaultLanguage: "eng",
      supportedLanguages: new Set(["eng", "jpn"]),
      isOpen: false,
    };

    // 実行
    const ts = new TextSearch(tsStub);

    // 検証
    expect(ts.SupportedLanguageSchema.expects).toBe('("eng" | "jpn")');
  });

  test("重複のある配列形式のサポート言語リストを渡したとき、重複が排除されて内部に保持される", ({
    expect,
  }) => {
    // 準備
    const tsStub: ITextSearch = {
      format: "text",
      textConfig: "simple",
      defaultLanguage: "eng",
      supportedLanguages: ["eng", "jpn", "eng"],
      isOpen: false,
    };

    // 実行
    const ts = new TextSearch(tsStub);

    // 検証
    expect(ts.SupportedLanguageSchema.expects).toBe('("eng" | "jpn")');
  });

  test("データの形式を示すプロパティーが欠損しているオブジェクトを渡したとき、入力検証エラーが投げられる", ({
    expect,
  }) => {
    // 準備
    // @ts-expect-error
    const invalidExternalSearch: ITextSearch = {
      textConfig: "simple",
      defaultLanguage: "eng",
      supportedLanguages: ["eng"],
      isOpen: false,
    };

    // 実行と検証
    expect(() => new TextSearch(invalidExternalSearch)).toThrow(InvalidInputError);
  });

  test("サポート対象に含まれていない言語を既定の言語として指定したとき、未サポート言語のエラーが投げられる", ({
    expect,
  }) => {
    // 準備
    const invalidExternalSearch: ITextSearch = {
      format: "text",
      textConfig: "simple",
      defaultLanguage: "jpn",
      supportedLanguages: ["eng"],
      isOpen: false,
    };

    // 実行と検証
    expect(() => new TextSearch(invalidExternalSearch)).toThrow(UnsupportedLanguageError);
  });
});

describe("検索エンジンの接続状態とライフサイクル管理", () => {
  test("内部の接続状態が有効なとき、状態の取得要求に対して真を返す", ({ expect }) => {
    // 準備
    const tsStub: ITextSearch = {
      format: "text",
      textConfig: "simple",
      defaultLanguage: "eng",
      supportedLanguages: ["eng"],
      isOpen: 1 as any,
    };
    const ts = new TextSearch(tsStub);

    // 実行
    const actualState = ts.isOpen;

    // 検証
    expect(actualState).toBe(true);
  });

  test("内部の接続状態が無効なとき、状態の取得要求に対して偽を返す", ({ expect }) => {
    // 準備
    const tsStub: ITextSearch = {
      format: "text",
      textConfig: "simple",
      defaultLanguage: "eng",
      supportedLanguages: ["eng"],
      isOpen: 0 as any,
    };
    const ts = new TextSearch(tsStub);

    // 実行
    const actualState = ts.isOpen;

    // 検証
    expect(actualState).toBe(false);
  });

  test("open の実装が存在するとき、中断シグナルを伴って処理を開始すると内部関数を呼び出して非同期の返り値を解決する", async ({
    expect,
    signal,
  }) => {
    // 準備
    const openFn = vi.fn<() => void>();
    const tsStub: ITextSearch = {
      format: "text",
      textConfig: "simple",
      defaultLanguage: "eng",
      supportedLanguages: ["eng"],
      isOpen: true,
      open: openFn,
    };
    const ts = new TextSearch(tsStub);

    // 実行
    await ts.open(signal);

    // 検証
    expect(openFn.mock.calls).toStrictEqual([[{ signal }]]);
  });

  test("open の実装が存在しないとき、中断シグナルを渡して処理を開始してもエラーを投げずに即座に非同期の返り値を解決する", async ({
    expect,
    signal,
  }) => {
    // 準備
    const tsStub: ITextSearch = {
      format: "text",
      textConfig: "simple",
      defaultLanguage: "eng",
      supportedLanguages: ["eng"],
      isOpen: true,
    };
    const ts = new TextSearch(tsStub);

    // 実行と検証
    await expect(ts.open(signal)).resolves.toBeUndefined();
  });

  test("close の実装が存在するとき、中断シグナルを伴って処理を開始すると内部関数を呼び出して非同期の返り値を解決する", async ({
    expect,
    signal,
  }) => {
    // 準備
    const closeFn = vi.fn<() => void>();
    const tsStub: ITextSearch = {
      format: "text",
      textConfig: "simple",
      defaultLanguage: "eng",
      supportedLanguages: ["eng"],
      isOpen: true,
      close: closeFn,
    };
    const ts = new TextSearch(tsStub);

    // 実行
    await ts.close(signal);

    // 検証
    expect(closeFn.mock.calls).toStrictEqual([[{ signal }]]);
  });

  test("close の実装が存在しないとき、中断シグナルを渡して処理を開始してもエラーを投げずに即座に非同期の返り値を解決する", async ({
    expect,
    signal,
  }) => {
    // 準備
    const tsStub: ITextSearch = {
      format: "text",
      textConfig: "simple",
      defaultLanguage: "eng",
      supportedLanguages: ["eng"],
      isOpen: true,
    };
    const ts = new TextSearch(tsStub);

    // 実行と検証
    await expect(ts.close(signal)).resolves.toBeUndefined();
  });
});

describe("テキストの単語分割処理", () => {
  test("内部の分割関数が定義されていないとき、文字列を渡すと空白文字で分割して結合された文字列として解決する", async ({
    expect,
    signal,
  }) => {
    // 準備
    const tsStub: ITextSearch = {
      format: "text",
      textConfig: "simple",
      defaultLanguage: "eng",
      supportedLanguages: ["eng"],
      isOpen: true,
    };
    const ts = new TextSearch(tsStub);

    // 実行
    const result = await ts.tokenize(signal, "eng", "hello       world" as Utf8);

    // 検証
    expect(result).toBe("hello world");
  });

  test("内部の分割関数が定義されているとき、文字列を渡すと内部関数を呼び出して返り値を結合した文字列として解決する", async ({
    expect,
    signal,
  }) => {
    // 準備
    const tsStub: ITextSearch = {
      format: "text",
      textConfig: "simple",
      defaultLanguage: "eng",
      supportedLanguages: ["eng"],
      isOpen: true,
      async tokenize() {
        return ["a", "b"];
      },
    };
    const ts = new TextSearch(tsStub);

    // 実行
    const result = await ts.tokenize(signal, "eng", "" as Utf8);

    // 検証
    expect(result).toBe("a b");
  });

  test("simple 以外の構成情報を指定したとき、処理実行時に制御不能として処理が中断される", async ({
    expect,
    signal,
  }) => {
    // 準備
    const tsStub: ITextSearch = {
      format: "text",
      textConfig: "english",
      defaultLanguage: "eng",
      supportedLanguages: ["eng"],
      isOpen: true,
    };
    const ts = new TextSearch(tsStub);

    // 実行と検証
    await expect(ts.tokenize(signal, "eng", "" as Utf8)).rejects.toThrow(UnreachableError);
  });

  test("サポート対象外の言語を指定して処理を実行したとき、制御不能として処理が中断される", async ({
    expect,
    signal,
  }) => {
    // 準備
    const tsStub: ITextSearch = {
      format: "text",
      textConfig: "simple",
      defaultLanguage: "eng",
      supportedLanguages: ["eng"],
      isOpen: true,
    };
    const ts = new TextSearch(tsStub);

    // 実行と検証
    await expect(ts.tokenize(signal, "fra", "" as Utf8)).rejects.toThrow(UnreachableError);
  });

  test("内部の分割関数が不正な型を返却したとき、出力検証エラーが投げられる", async ({
    expect,
    signal,
  }) => {
    // 準備
    const tsStub: ITextSearch = {
      format: "text",
      textConfig: "simple",
      defaultLanguage: "eng",
      supportedLanguages: ["eng"],
      isOpen: true,
      async tokenize() {
        return [123 as unknown as string];
      },
    };
    const ts = new TextSearch(tsStub);

    // 実行と検証
    await expect(ts.tokenize(signal, "eng", "" as Utf8)).rejects.toThrow(InvalidOutputError);
  });
});

describe("テキストの標準化処理", () => {
  test("内部の標準化関数が定義されていないとき、文字列を渡すと入力された文字列がそのまま返却される", async ({
    expect,
    signal,
  }) => {
    // 準備
    const tsStub: ITextSearch = {
      format: "text",
      textConfig: "simple",
      defaultLanguage: "eng",
      supportedLanguages: ["eng"],
      isOpen: true,
    };
    const ts = new TextSearch(tsStub);

    // 実行
    const result = await ts.normalize(signal, "eng", "Raw Text" as Utf8);

    // 検証
    expect(result).toBe("Raw Text");
  });

  test("内部の標準化関数が定義されているとき、大文字の文字列を渡すと内部関数を経由して検証された小文字の標準化文字列が返却される", async ({
    expect,
    signal,
  }) => {
    // 準備
    const tsStub: ITextSearch = {
      format: "text",
      textConfig: "simple",
      defaultLanguage: "eng",
      supportedLanguages: ["eng"],
      isOpen: true,
      normalize(args) {
        return args.text.toLowerCase();
      },
    };
    const ts = new TextSearch(tsStub);

    // 実行
    const result = await ts.normalize(signal, "eng", "ABC" as Utf8);

    // 検証
    expect(result).toBe("abc");
  });

  test("サポート対象外の言語を指定して標準化処理を実行したとき、制御不能として処理が中断される", async ({
    expect,
    signal,
  }) => {
    // 準備
    const tsStub: ITextSearch = {
      format: "text",
      textConfig: "simple",
      defaultLanguage: "eng",
      supportedLanguages: ["eng"],
      isOpen: true,
      async normalize() {
        return "";
      },
    };
    const ts = new TextSearch(tsStub);

    // 実行と検証
    await expect(ts.normalize(signal, "fur", "" as Utf8)).rejects.toThrow(UnreachableError);
  });
});

describe("言語の自動判別処理", () => {
  test("内部の判別関数が定義されていないとき、文字列を渡すとインスタンスが保持する既定の言語が返却される", async ({
    expect,
    signal,
  }) => {
    // 準備
    const tsStub: ITextSearch = {
      format: "text",
      textConfig: "simple",
      defaultLanguage: "eng",
      supportedLanguages: ["eng"],
      isOpen: true,
    };
    const ts = new TextSearch(tsStub);

    // 実行
    const result = await ts.detectLanguage(signal, "text" as Utf8);

    // 検証
    expect(result).toBe("eng");
  });

  test("内部の判別関数が定義されておりサポート対象の言語コードを返すとき、判別された正しい言語コードが返却される", async ({
    expect,
    signal,
  }) => {
    // 準備
    const tsStub: ITextSearch = {
      format: "text",
      textConfig: "simple",
      defaultLanguage: "jpn",
      supportedLanguages: ["jpn"],
      isOpen: true,
      async detectLanguage() {
        return "jpn" as const;
      },
    };
    const ts = new TextSearch(tsStub);

    // 実行
    const result = await ts.detectLanguage(signal, "日本語" as Utf8);

    // 検証
    expect(result).toBe("jpn");
  });

  test("内部の判別関数がサポート対象外の言語コードを返すとき、検証スキーマによるエラーが投げられる", async ({
    expect,
    signal,
  }) => {
    // 準備
    const tsStub: ITextSearch = {
      format: "text",
      textConfig: "simple",
      defaultLanguage: "eng",
      supportedLanguages: ["eng"],
      isOpen: true,
      async detectLanguage() {
        return "fur" as const;
      },
    };
    const ts = new TextSearch(tsStub);

    // 実行と検証
    await expect(ts.detectLanguage(signal, "texte" as Utf8)).rejects.toThrow(InvalidOutputError);
  });
});
