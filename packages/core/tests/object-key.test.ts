import { afterEach, describe, test } from "vitest";

import objectKeyInternalUse from "../src/_object-key-internal-use.js";
import ObjectKey from "../src/object-key.js";

afterEach(() => {
  objectKeyInternalUse.enable = false;
});

describe("基本解析機能", () => {
  test("シンプルなファイル名が与えられたとき、ベース名と拡張子が正しく抽出される", ({ expect }) => {
    // 準備
    const input = "file.txt";

    // 実行
    const target = ObjectKey.parse(input);

    // 検証
    expect(target.basename).toBe("file.txt");
    expect(target.filename).toBe("file");
    expect(target.extname).toBe(".txt");
    expect(target.segments).toStrictEqual(["file.txt"]);
  });

  test("深い階層のパスが与えられたとき、ディレクトリ部分とファイル部分が分離される", ({
    expect,
  }) => {
    // 準備
    const input = "a/b/c.jpg";

    // 実行
    const target = ObjectKey.parse(input);

    // 検証
    expect(target.prefix).toBe("a/b/");
    expect(target.basename).toBe("c.jpg");
    expect(target.segments).toStrictEqual(["a", "b", "c.jpg"]);
  });

  test("拡張子のないファイル名が与えられたとき、拡張子が空文字になる", ({ expect }) => {
    // 準備
    const input = "README";

    // 実行
    const target = ObjectKey.parse(input);

    // 検証
    expect(target.filename).toBe("README");
    expect(target.extname).toBe("");
  });

  test("隠しファイルが与えられたとき、先頭のドットは拡張子とみなされない", ({ expect }) => {
    // 準備
    const input = ".gitignore";

    // 実行
    const target = ObjectKey.parse(input);

    // 検証
    expect(target.filename).toBe(".gitignore");
    expect(target.extname).toBe("");
  });

  test("複数のドットを含むファイル名が与えられたとき、最後のドットで拡張子が分割される", ({
    expect,
  }) => {
    // 準備
    const input = "archive.tar.gz";

    // 実行
    const target = ObjectKey.parse(input);

    // 検証
    expect(target.filename).toBe("archive.tar");
    expect(target.extname).toBe(".gz");
  });

  test("末尾がスラッシュのディレクトリ形式が与えられたとき、空のベース名が返る", ({ expect }) => {
    // 準備
    const input = "images/";

    // 実行
    const target = ObjectKey.parse(input);

    // 検証
    expect(target.basename).toBe("");
    expect(target.segments).toStrictEqual(["images", ""]);
  });
});

describe("静的メソッド", () => {
  test("有効な形式のパスを check したとき、true が返る", ({ expect }) => {
    // 準備
    const input = "valid/key.txt";

    // 実行
    const result = ObjectKey.check(input);

    // 検証
    expect(result).toBe(true);
  });

  test("バリデーションに失敗する形式を check したとき、false が返る", ({ expect }) => {
    // 準備
    const input = "";

    // 実行
    const result = ObjectKey.check(input);

    // 検証
    expect(result).toBe(false);
  });

  test("parse メソッドで生成したとき、入力したパスと保持するキーが一致する", ({ expect }) => {
    // 準備
    const input = "test/path";

    // 実行
    const target = ObjectKey.parse(input);

    // 検証
    expect(target instanceof ObjectKey).toBe(true);
    expect(target.key).toBe(input);
  });
});

describe("特殊な条件の処理", () => {
  test("スラッシュのみのパスが与えられたとき、空セグメントのペアとして解析される", ({ expect }) => {
    // 準備
    const input = "/";

    // 実行
    const target = ObjectKey.parse(input);

    // 検証
    expect(target.segments).toStrictEqual(["", ""]);
    expect(target.prefix).toBe("/");
  });

  test("連続するスラッシュを含むパスが与えられたとき、空のセグメントが維持される", ({ expect }) => {
    // 準備
    const input = "a//b";

    // 実行
    const target = ObjectKey.parse(input);

    // 検証
    expect(target.segments).toStrictEqual(["a", "", "b"]);
  });

  test("末尾がドットで終わるファイル名が与えられたとき、ドットが拡張子として扱われる", ({
    expect,
  }) => {
    // 準備
    const input = "file.";

    // 実行
    const target = ObjectKey.parse(input);

    // 検証
    expect(target.filename).toBe("file");
    expect(target.extname).toBe(".");
  });
});

describe("内部仕様と最適化", () => {
  test("内部利用フラグが有効なとき、バリデーションをスキップしてインスタンスが生成される", ({
    expect,
  }) => {
    // 準備
    const key = ""; // 無効なオブジェクトキー
    objectKeyInternalUse.enable = true;

    // 実行
    const target = new ObjectKey(key);

    // 検証
    expect(target.key).toBe(key);
  });

  test("segments プロパティを複数回呼び出したとき、キャッシュされた配列のコピーが返り、元のインスタンスに影響を与えない", ({
    expect,
  }) => {
    // 準備
    const target = ObjectKey.parse("a/b/c");
    const result1 = target.segments;

    // 実行
    result1[0] = "modified";
    const result2 = target.segments;

    // 検証
    expect(result2).toStrictEqual(["a", "b", "c"]);
    expect(result2[0]).not.toBe("modified");
    expect(result1).not.toBe(result2);
  });

  test("JSON シリアライズをしたとき、フルパス文字列が返る", ({ expect }) => {
    // 準備
    const path = "path/to/resource.json";
    const target = ObjectKey.parse(path);

    // 実行
    const json = JSON.stringify(target);

    // 検証
    expect(json).toBe(`"${path}"`);
  });
});

describe("エラーハンドリング", () => {
  test("不正な入力が与えられたとき、バリデーションエラーが適切にスローされる", ({ expect }) => {
    // 準備
    const invalidInput = null as any;

    // 実行と検証
    expect(() => ObjectKey.parse(invalidInput)).toThrow();
  });
});
