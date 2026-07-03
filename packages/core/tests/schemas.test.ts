import { uuid58Encode } from "@nakanoaas/uuid58";
import { safeParse } from "valibot";
import { describe, test } from "vitest";

import {
  UintSchema,
  Sha256HexSchema,
  TimestampSchema,
  ObjectIdSchema,
  EntityIdSchema,
  EntityTagSchema,
  ObjectSizeSchema,
  MimeTypeSchema,
  LanguageSchema,
  DescriptionSchema,
  SearchTextSchema,
  TextSearchFormatSchema,
  ObjectTagSchema,
  ObjectTagsSchema,
  ObjectKeyPrefixSchema,
  OpenModeSchema,
  OrderDirectionSchema,
  RecordTypeSchema,
  CreatedRecordTypeSchema,
  DeletedRecordTypeSchema,
} from "../src/schemas.js";

function assertSuccess<T>(result: {
  success: boolean;
  output?: T;
  issues?: any;
}): asserts result is { success: true; output: T } {
  if (!result.success) {
    throw new Error(`expected success, got failure: ${result.issues?.[0]?.message}`);
  }
}

function assertFailure(result: {
  success: boolean;
}): asserts result is { success: false; issues: readonly any[] } {
  if (result.success) {
    throw new Error("expected failure, got success");
  }
}

describe("UintSchema", () => {
  test("有効な非負整数を渡したとき、検証に成功する", ({ expect }) => {
    // 実行
    const result = safeParse(UintSchema, 0);

    // 検証
    assertSuccess(result);
    expect(result.output).toBe(0);
  });

  test("負の数を渡したとき、検証に失敗する", () => {
    // 実行
    const result = safeParse(UintSchema, -1);

    // 検証
    assertFailure(result);
  });

  test("小数を渡したとき、検証に失敗する", () => {
    // 実行
    const result = safeParse(UintSchema, 1.5);

    // 検証
    assertFailure(result);
  });

  test("文字列を渡したとき、検証に失敗する", () => {
    // 実行
    const result = safeParse(UintSchema, "0");

    // 検証
    assertFailure(result);
  });
});

describe("Sha256HexSchema", () => {
  test("有効な SHA-256 16 進文字列を渡したとき、検証に成功する", ({ expect }) => {
    // 準備
    const input = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

    // 実行
    const result = safeParse(Sha256HexSchema, input);

    // 検証
    assertSuccess(result);
    expect(result.output).toBe(input);
  });

  test("63 文字の 16 進文字列を渡したとき、検証に失敗する", () => {
    // 準備
    const input = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b85";

    // 実行
    const result = safeParse(Sha256HexSchema, input);

    // 検証
    assertFailure(result);
  });

  test("大文字を含む 16 進文字列を渡したとき、検証に失敗する", () => {
    // 準備
    const input = "E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855";

    // 実行
    const result = safeParse(Sha256HexSchema, input);

    // 検証
    assertFailure(result);
  });
});

describe("TimestampSchema", () => {
  test("ISO 8601 文字列を渡したとき、ミリ秒単位の数値に変換される", ({ expect }) => {
    // 実行
    const result = safeParse(TimestampSchema, "2024-01-01T00:00:00Z");

    // 検証
    assertSuccess(result);
    expect(result.output).toBe(1704067200000);
  });

  test("数値を渡したとき、そのまま返る", ({ expect }) => {
    // 実行
    const result = safeParse(TimestampSchema, 1704067200000);

    // 検証
    assertSuccess(result);
    expect(result.output).toBe(1704067200000);
  });

  test("Date インスタンスを渡したとき、ミリ秒単位の数値に変換される", ({ expect }) => {
    // 実行
    const result = safeParse(TimestampSchema, new Date("2024-01-01"));

    // 検証
    assertSuccess(result);
    expect(result.output).toBe(1704067200000);
  });

  test("無効な日付文字列を渡したとき、検証に失敗する", () => {
    // 実行
    const result = safeParse(TimestampSchema, "invalid-date");

    // 検証
    assertFailure(result);
  });
});

describe("ObjectIdSchema", () => {
  test("有効な UUIDv7 文字列を渡したとき、検証に成功する", ({ expect }) => {
    // 準備
    const input = "018f3b6a-9b3a-7b8e-8b0a-9b3a7b8e8b0a";

    // 実行
    const result = safeParse(ObjectIdSchema, input);

    // 検証
    assertSuccess(result);
    expect(result.output).toBe(input);
  });

  test("UUIDv4 文字列を渡したとき、検証に失敗する", () => {
    // 準備
    const input = "550e8400-e29b-41d4-a716-446655440000";

    // 実行
    const result = safeParse(ObjectIdSchema, input);

    // 検証
    assertFailure(result);
  });
});

describe("EntityIdSchema", () => {
  test("有効な Base58 エンコード UUIDv7 文字列を渡したとき、検証に成功する", ({ expect }) => {
    // 準備
    const input = uuid58Encode("018f3b6a-9b3a-7b8e-8b0a-9b3a7b8e8b0a");

    // 実行
    const result = safeParse(EntityIdSchema, input);

    // 検証
    assertSuccess(result);
    expect(result.output).toBe(input);
  });

  test("22 文字以外の Base58 文字列を渡したとき、検証に失敗する", () => {
    // 実行
    const result = safeParse(EntityIdSchema, "123456789ABCDEFGHJKLMN");

    // 検証
    assertFailure(result);
  });
});

describe("EntityTagSchema", () => {
  test("有効な SHA-256 16 進文字列を渡したとき、検証に成功する", ({ expect }) => {
    // 準備
    const input = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

    // 実行
    const result = safeParse(EntityTagSchema, input);

    // 検証
    assertSuccess(result);
    expect(result.output).toBe(input);
  });
});

describe("ObjectSizeSchema", () => {
  test("有効なサイズ値を渡したとき、検証に成功する", ({ expect }) => {
    // 実行
    const result = safeParse(ObjectSizeSchema, 1024);

    // 検証
    assertSuccess(result);
    expect(result.output).toBe(1024);
  });

  test("0 を渡したとき、検証に成功する", ({ expect }) => {
    // 実行
    const result = safeParse(ObjectSizeSchema, 0);

    // 検証
    assertSuccess(result);
    expect(result.output).toBe(0);
  });

  test("負の値を渡したとき、検証に失敗する", () => {
    // 実行
    const result = safeParse(ObjectSizeSchema, -1);

    // 検証
    assertFailure(result);
  });
});

describe("MimeTypeSchema", () => {
  test("小文字の MIME タイプを渡したとき、そのまま返る", ({ expect }) => {
    // 実行
    const result = safeParse(MimeTypeSchema, "application/json");

    // 検証
    assertSuccess(result);
    expect(result.output).toBe("application/json");
  });

  test("大文字を含む MIME タイプを渡したとき、小文字に変換される", ({ expect }) => {
    // 実行
    const result = safeParse(MimeTypeSchema, "Application/Json");

    // 検証
    assertSuccess(result);
    expect(result.output).toBe("application/json");
  });
});

describe("LanguageSchema", () => {
  test("有効な ISO 639-2 T コードを渡したとき、検証に成功する", ({ expect }) => {
    // 実行
    const result = safeParse(LanguageSchema, "jpn");

    // 検証
    assertSuccess(result);
    expect(result.output).toBe("jpn");
  });

  test("無効なコードを渡したとき、検証に失敗する", () => {
    // 実行
    const result = safeParse(LanguageSchema, "xyz");

    // 検証
    assertFailure(result);
  });
});

describe("DescriptionSchema", () => {
  test("有効な文字列を渡したとき、検証に成功する", ({ expect }) => {
    // 実行
    const result = safeParse(DescriptionSchema, "これはサンプルです。");

    // 検証
    assertSuccess(result);
    expect(result.output).toBe("これはサンプルです。");
  });
});

describe("SearchTextSchema", () => {
  test("有効な文字列を渡したとき、検証に成功する", ({ expect }) => {
    // 実行
    const result = safeParse(SearchTextSchema, "検索キーワード");

    // 検証
    assertSuccess(result);
    expect(result.output).toBe("検索キーワード");
  });
});

describe("TextSearchFormatSchema", () => {
  test("44 文字の Base58 文字列を渡したとき、検証に成功する", ({ expect }) => {
    // 準備
    const input = "4BHG7qRQgKMxgXHgjyWCXt4BHG7qRQgKMxgXHgjyWCXt";

    // 実行
    const result = safeParse(TextSearchFormatSchema, input);

    // 検証
    assertSuccess(result);
    expect(result.output).toBe(input);
  });

  test("44 文字以外の文字列を渡したとき、検証に失敗する", () => {
    // 実行
    const result = safeParse(TextSearchFormatSchema, "invalid");

    // 検証
    assertFailure(result);
  });
});

describe("ObjectTagSchema", () => {
  test("128 バイト以内の文字列を渡したとき、検証に成功する", ({ expect }) => {
    // 実行
    const result = safeParse(ObjectTagSchema, "important");

    // 検証
    assertSuccess(result);
    expect(result.output).toBe("important");
  });

  test("128 バイトを超える文字列を渡したとき、検証に失敗する", () => {
    // 準備
    const longTag = "a".repeat(129);

    // 実行
    const result = safeParse(ObjectTagSchema, longTag);

    // 検証
    assertFailure(result);
  });
});

describe("ObjectTagsSchema", () => {
  test("有効な Set を渡したとき、そのまま返る", ({ expect }) => {
    // 実行
    const result = safeParse(ObjectTagsSchema, new Set(["a", "b"]));

    // 検証
    assertSuccess(result);
    expect(result.output).toBeInstanceOf(Set);
    expect(result.output.size).toBe(2);
  });

  test("配列を渡したとき、 Set に変換される", ({ expect }) => {
    // 実行
    const result = safeParse(ObjectTagsSchema, ["a", "b"]);

    // 検証
    assertSuccess(result);
    expect(result.output).toBeInstanceOf(Set);
    expect(result.output.size).toBe(2);
  });

  test("21 個以上の要素を渡したとき、検証に失敗する", () => {
    // 実行
    const result = safeParse(
      ObjectTagsSchema,
      Array.from({ length: 21 }, (_, i) => String(i)),
    );

    // 検証
    assertFailure(result);
  });
});

describe("ObjectKeyPrefixSchema", () => {
  test("末尾がスラッシュの文字列を渡したとき、検証に成功する", () => {
    // 実行
    const result = safeParse(ObjectKeyPrefixSchema, "foo/bar/");

    // 検証
    assertSuccess(result);
  });

  test("空文字列を渡したとき、検証に失敗する", () => {
    // 実行
    const result = safeParse(ObjectKeyPrefixSchema, "");

    // 検証
    assertFailure(result);
  });
});

describe("OpenModeSchema", () => {
  test("有効なモード w を渡したとき、検証に成功する", ({ expect }) => {
    // 実行
    const result = safeParse(OpenModeSchema, "w");

    // 検証
    assertSuccess(result);
    expect(result.output).toBe("w");
  });

  test("有効なモード wx を渡したとき、検証に成功する", ({ expect }) => {
    // 実行
    const result = safeParse(OpenModeSchema, "wx");

    // 検証
    assertSuccess(result);
    expect(result.output).toBe("wx");
  });

  test("無効なモードを渡したとき、検証に失敗する", () => {
    // 実行
    const result = safeParse(OpenModeSchema, "r");

    // 検証
    assertFailure(result);
  });
});

describe("OrderDirectionSchema", () => {
  test("ASC を渡したとき、検証に成功する", ({ expect }) => {
    // 実行
    const result = safeParse(OrderDirectionSchema, "ASC");

    // 検証
    assertSuccess(result);
    expect(result.output).toBe("ASC");
  });

  test("DESC を渡したとき、検証に成功する", ({ expect }) => {
    // 実行
    const result = safeParse(OrderDirectionSchema, "DESC");

    // 検証
    assertSuccess(result);
    expect(result.output).toBe("DESC");
  });

  test("小文字の asc を渡したとき、検証に失敗する", () => {
    // 実行
    const result = safeParse(OrderDirectionSchema, "asc");

    // 検証
    assertFailure(result);
  });
});

describe("RecordTypeSchema", () => {
  test("CREATE を渡したとき、検証に成功する", ({ expect }) => {
    // 実行
    const result = safeParse(RecordTypeSchema, "CREATE");

    // 検証
    assertSuccess(result);
    expect(result.output).toBe("CREATE");
  });

  test("UPDATE_METADATA を渡したとき、検証に成功する", ({ expect }) => {
    // 実行
    const result = safeParse(RecordTypeSchema, "UPDATE_METADATA");

    // 検証
    assertSuccess(result);
    expect(result.output).toBe("UPDATE_METADATA");
  });

  test("DELETE を渡したとき、検証に成功する", ({ expect }) => {
    // 実行
    const result = safeParse(RecordTypeSchema, "DELETE");

    // 検証
    assertSuccess(result);
    expect(result.output).toBe("DELETE");
  });

  test("無効な種別を渡したとき、検証に失敗する", () => {
    // 実行
    const result = safeParse(RecordTypeSchema, "INVALID");

    // 検証
    assertFailure(result);
  });
});

describe("CreatedRecordTypeSchema", () => {
  test("CREATE を渡したとき、検証に成功する", () => {
    // 実行
    const result = safeParse(CreatedRecordTypeSchema, "CREATE");

    // 検証
    assertSuccess(result);
  });

  test("DELETE を渡したとき、検証に失敗する", () => {
    // 実行
    const result = safeParse(CreatedRecordTypeSchema, "DELETE");

    // 検証
    assertFailure(result);
  });
});

describe("DeletedRecordTypeSchema", () => {
  test("DELETE を渡したとき、検証に成功する", () => {
    // 実行
    const result = safeParse(DeletedRecordTypeSchema, "DELETE");

    // 検証
    assertSuccess(result);
  });

  test("CREATE を渡したとき、検証に失敗する", () => {
    // 実行
    const result = safeParse(DeletedRecordTypeSchema, "CREATE");

    // 検証
    assertFailure(result);
  });
});
