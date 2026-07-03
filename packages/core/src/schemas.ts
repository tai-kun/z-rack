import { uuid58Decode, uuid58Encode } from "@nakanoaas/uuid58";

import _objectKeyInternalUse from "./_object-key-internal-use.js";
import StringObjectKeySchema from "./_string-object-key-schema.js";
import ISO639_PART2_ALPHA3_CODES, {
  type Iso639Part2Alpha3Code,
} from "./iso639-part2-alpha3-codes.js";
import type { StandardMimeType } from "./mime.types.js";
import ObjectKey from "./object-key.js";
import utf8 from "./utf8.js";
import * as v from "./valibot.js";

// -------------------------------------------------------------------------------------------------
//
// 仕様
//
// 参考：
// https://docs.aws.amazon.com/ja_jp/AmazonS3/latest/userguide/qfacts.html
// https://docs.aws.amazon.com/ja_jp/AmazonS3/latest/userguide/UsingObjects.html
//
// -------------------------------------------------------------------------------------------------

const B = 1;
const KiB = 1024 * B;
const MiB = 1024 * KiB;
const GiB = 1024 * MiB;

// const SPEC_MIN_PART_NUMBER = 1;
const SPEC_MAX_PART_NUMBER = 10_000;
// const SPEC_MIN_PART_SIZE = 5 * MiB;
const SPEC_MAX_PART_SIZE = 5 * GiB;
const SPEC_MIN_OBJECT_SIZE = 0;
const SPEC_MAX_OBJECT_SIZE = SPEC_MAX_PART_NUMBER * SPEC_MAX_PART_SIZE;

// -------------------------------------------------------------------------------------------------
//
// 汎用
//
// -------------------------------------------------------------------------------------------------

/**
 * 非負の整数であることを検証するスキーマです。
 *
 * @example
 * ```
 * import { UintSchema } from "@z-rack/core";
 *
 * v.parse(UintSchema, 0);    // => 0
 * v.parse(UintSchema, 42);   // => 42
 * v.parse(UintSchema, -1);   // => 例外
 * v.parse(UintSchema, 1.5);  // => 例外
 * ```
 */
export const UintSchema = v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.brand("Uint"));

export type UintLike = v.InferInput<typeof UintSchema>;

export type Uint = v.InferOutput<typeof UintSchema>;

/**
 * 有効な UTF-8 文字列であり、指定された最大バイト数を超えないことを検証するスキーマを生成します。
 *
 * @param maxBytes 許容する最大バイト数です。
 * @returns 生成されたバリデーションスキーマです。
 *
 * @example
 * ```
 * import { Utf8Schema } from "@z-rack/core";
 *
 * const schema = Utf8Schema(10);
 * v.parse(schema, "hello"); // => "hello"
 * v.parse(schema, "あ");    // => "あ" (3 bytes)
 * v.parse(schema, "a".repeat(11)); // => 例外 (11 > 10)
 * ```
 */
export function Utf8Schema(maxBytes: number) {
  return v.pipe(v.string(), v.utf8(utf8), v.maxBytes(maxBytes, utf8), v.brand("Utf8"));
}

export type Utf8Like = v.InferInput<ReturnType<typeof Utf8Schema>>;

export type Utf8 = v.InferOutput<ReturnType<typeof Utf8Schema>>;

export const BASE58_REGEX = /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]*$/;

export const SHA256_HEX_REGEX = /^[0-9a-f]{64}$/;

/**
 * SHA-256 ハッシュの 16 進数表現であることを検証するスキーマです。
 *
 * @example
 * ```
 * import { Sha256HexSchema } from "@z-rack/core";
 *
 * v.parse(Sha256HexSchema, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
 * // => "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 * ```
 */
export const Sha256HexSchema = v.pipe(
  v.string(),
  v.length(64),
  v.regex(SHA256_HEX_REGEX),
  v.brand("Hex"),
  v.brand("Sha256"),
);

export type Sha256HexLike = v.InferInput<typeof Sha256HexSchema>;

export type Sha256Hex = v.InferOutput<typeof Sha256HexSchema>;

/**
 * タイムスタンプとして解釈可能な値（文字列、数値、Date）を検証し、ミリ秒単位の数値に変換するスキーマです。
 *
 * @example
 * ```
 * import { TimestampSchema } from "@z-rack/core";
 *
 * v.parse(TimestampSchema, "2024-01-01T00:00:00Z"); // => 1704067200000
 * v.parse(TimestampSchema, 1704067200000);            // => 1704067200000
 * v.parse(TimestampSchema, new Date("2024-01-01"));   // => 1704067200000
 * ```
 */
export const TimestampSchema = v.pipe(
  v.union([v.string(), v.number(), v.instance(Date)]),
  v.transform((x) => new Date(x).getTime()),
  v.finite(),
  v.brand("Timestamp"),
);

export type TimestampLike = v.InferInput<typeof TimestampSchema>;

export type Timestamp = v.InferOutput<typeof TimestampSchema>;

// -------------------------------------------------------------------------------------------------
//
// メタデータ
//
// -------------------------------------------------------------------------------------------------

/**
 * UUIDv7 形式のオブジェクト ID を検証するスキーマです。
 *
 * @example
 * ```
 * import { ObjectIdSchema } from "@z-rack/core";
 *
 * v.parse(ObjectIdSchema, "018f3b6a-9b3a-7b8e-8b0a-9b3a7b8e8b0a");
 * // => "018f3b6a-9b3a-7b8e-8b0a-9b3a7b8e8b0a"
 * ```
 */
export const ObjectIdSchema = v.pipe(
  v.string(),
  v.uuidv7(),
  v.brand("UUID"),
  v.brand("UUIDv7"),
  v.brand("ObjectId"),
);

export type ObjectIdLike = v.InferInput<typeof ObjectIdSchema>;

export type ObjectId = v.InferOutput<typeof ObjectIdSchema>;

/**
 * 作成または更新を示すレコード種別を検証するスキーマです。
 *
 * @example
 * ```
 * import { CreatedRecordTypeSchema } from "@z-rack/core";
 *
 * v.parse(CreatedRecordTypeSchema, "CREATE"); // => "CREATE"
 * ```
 */
export const CreatedRecordTypeSchema = v.pipe(
  v.picklist(["CREATE", "UPDATE_METADATA"]),
  v.brand("RecordType"),
);

export type CreatedRecordTypeLike = v.InferInput<typeof CreatedRecordTypeSchema>;

export type CreatedRecordType = v.InferOutput<typeof CreatedRecordTypeSchema>;

/**
 * 削除を示すレコード種別を検証するスキーマです。
 *
 * @example
 * ```
 * import { DeletedRecordTypeSchema } from "@z-rack/core";
 *
 * v.parse(DeletedRecordTypeSchema, "DELETE"); // => "DELETE"
 * ```
 */
export const DeletedRecordTypeSchema = v.pipe(v.picklist(["DELETE"]), v.brand("RecordType"));

export type DeletedRecordTypeLike = v.InferInput<typeof DeletedRecordTypeSchema>;

export type DeletedRecordType = v.InferOutput<typeof DeletedRecordTypeSchema>;

/**
 * レコードの操作種別を検証するスキーマです。
 *
 * @example
 * ```
 * import { RecordTypeSchema } from "@z-rack/core";
 *
 * v.parse(RecordTypeSchema, "CREATE");          // => "CREATE"
 * v.parse(RecordTypeSchema, "UPDATE_METADATA"); // => "UPDATE_METADATA"
 * v.parse(RecordTypeSchema, "DELETE");          // => "DELETE"
 * ```
 */
export const RecordTypeSchema = v.pipe(
  v.picklist([
    ...CreatedRecordTypeSchema.pipe[0].options,
    ...DeletedRecordTypeSchema.pipe[0].options,
  ]),
  v.brand("RecordType"),
);

export type RecordTypeLike = v.InferInput<typeof RecordTypeSchema>;

export type RecordType = v.InferOutput<typeof RecordTypeSchema>;

export const RecordTimestampSchema = TimestampSchema;

export type RecordTimestampLike = v.InferInput<typeof RecordTimestampSchema>;

export type RecordTimestamp = v.InferOutput<typeof RecordTimestampSchema>;

/**
 * オブジェクトキーを検証し、ObjectKey インスタンスに変換するスキーマです。
 *
 * 文字列または ObjectKey インスタンスを受け付けます。
 *
 * @example
 * ```
 * import { ObjectKeySchema } from "@z-rack/core";
 *
 * v.parse(ObjectKeySchema, "foo/bar");                  // ObjectKey
 * v.parse(ObjectKeySchema, v.parse(ObjectKey, "foo/bar")); // ObjectKey
 * ```
 */
export const ObjectKeySchema = v.union([
  v.pipe(
    StringObjectKeySchema,
    v.transform((objectKey) => {
      try {
        _objectKeyInternalUse.enable = true;
        // 内部利用ではエンコードのオーバーヘッドを減らすために検証済みの値を渡します。
        return new ObjectKey(objectKey);
      } finally {
        _objectKeyInternalUse.enable = false;
      }
    }),
  ),
  v.instance(ObjectKey),
]);

export type ObjectKeyLike = v.InferInput<typeof ObjectKeySchema>;

/**
 * Base58 エンコードされた UUIDv7 のエンティティ ID を検証するスキーマです。
 *
 * @example
 * ```
 * import { EntityIdSchema } from "@z-rack/core";
 *
 * const id = v.parse(EntityIdSchema, "4BHG7qRQgKMxgXHgjyWCXt");
 * console.log(id); // => "4BHG7qRQgKMxgXHgjyWCXt"
 * ```
 */
export const EntityIdSchema = v.pipe(
  v.string(),
  v.length(22),
  v.regex(BASE58_REGEX),
  v.transform(uuid58Decode),
  v.uuidv7(),
  v.transform(uuid58Encode),
  v.brand("UUID"),
  v.brand("UUIDv7"),
  v.brand("Base58"),
  v.brand("EntityId"),
);

export type EntityIdLike = v.InferInput<typeof EntityIdSchema>;

export type EntityId = v.InferOutput<typeof EntityIdSchema>;

/**
 * エンティティタグ（ETag）を検証するスキーマです。
 *
 * @example
 * ```
 * import { EntityTagSchema } from "@z-rack/core";
 *
 * v.parse(EntityTagSchema, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
 * // => "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 * ```
 */
export const EntityTagSchema = v.pipe(Sha256HexSchema, v.brand("EntityTag"));

export type EntityTagLike = v.InferInput<typeof EntityTagSchema>;

export type EntityTag = v.InferOutput<typeof EntityTagSchema>;

/**
 * オブジェクトのサイズを検証するスキーマです。
 *
 * @example
 * ```
 * import { ObjectSizeSchema } from "@z-rack/core";
 *
 * v.parse(ObjectSizeSchema, 1024);   // => 1024
 * v.parse(ObjectSizeSchema, 0);      // => 0
 * v.parse(ObjectSizeSchema, -1);     // => 例外
 * ```
 */
export const ObjectSizeSchema = v.pipe(
  UintSchema,
  v.minValue(SPEC_MIN_OBJECT_SIZE as Uint),
  v.maxValue(SPEC_MAX_OBJECT_SIZE as Uint),
  v.brand("ObjectSize"),
);

export type ObjectSizeLike = v.InferInput<typeof ObjectSizeSchema>;

export type ObjectSize = v.InferOutput<typeof ObjectSizeSchema>;

export const MIN_OBJECT_SIZE = SPEC_MIN_OBJECT_SIZE as ObjectSize;

export const MAX_OBJECT_SIZE = SPEC_MAX_OBJECT_SIZE as ObjectSize;

/**
 * MIME タイプを検証し、小文字に正規化するスキーマです。
 *
 * @example
 * ```
 * import { MimeTypeSchema } from "@z-rack/core";
 *
 * v.parse(MimeTypeSchema, "Application/Json"); // => "application/json"
 * ```
 */
export const MimeTypeSchema = v.pipe(v.string(), v.toLowerCase()) as unknown as v.BaseSchema<
  StandardMimeType | (string & {}),
  (StandardMimeType | (string & {})) & v.Brand<"MimeType">,
  v.BaseIssue<unknown>
>;

export type MimeTypeLike = v.InferInput<typeof MimeTypeSchema>;

export type MimeType = v.InferOutput<typeof MimeTypeSchema>;

export const CreatedAtSchema = TimestampSchema;

export type CreatedAtLike = v.InferInput<typeof CreatedAtSchema>;

export type CreatedAt = v.InferOutput<typeof CreatedAtSchema>;

export const LastModifiedAtSchema = TimestampSchema;

export type LastModifiedAtLike = v.InferInput<typeof LastModifiedAtSchema>;

export type LastModifiedAt = v.InferOutput<typeof LastModifiedAtSchema>;

/**
 * ISO 639-2 T コード形式の言語コードを検証するスキーマです。
 *
 * @example
 * ```
 * import { LanguageSchema } from "@z-rack/core";
 *
 * v.parse(LanguageSchema, "jpn"); // => "jpn"
 * v.parse(LanguageSchema, "eng"); // => "eng"
 * v.parse(LanguageSchema, "xyz"); // => 例外
 * ```
 */
export const LanguageSchema = v.pipe(v.picklist(ISO639_PART2_ALPHA3_CODES), v.brand("Language"));

export type LanguageLike = Iso639Part2Alpha3Code;

export type Language = Iso639Part2Alpha3Code;

/**
 * オブジェクトの説明文を検証するスキーマです。
 *
 * @example
 * ```
 * import { DescriptionSchema } from "@z-rack/core";
 *
 * v.parse(DescriptionSchema, "これはサンプルです。");
 * // => "これはサンプルです。"
 * ```
 */
export const DescriptionSchema = v.pipe(v.string(), v.utf8(utf8), v.brand("Utf8"));

export type DescriptionLike = v.InferInput<typeof DescriptionSchema>;

export type Description = v.InferOutput<typeof DescriptionSchema>;

/**
 * 検索クエリのテキストを検証するスキーマです。
 *
 * @example
 * ```
 * import { SearchTextSchema } from "@z-rack/core";
 *
 * v.parse(SearchTextSchema, "検索キーワード");
 * // => "検索キーワード"
 * ```
 */
export const SearchTextSchema = v.pipe(v.string(), v.utf8(utf8), v.brand("Utf8"));

export type SearchTextLike = v.InferInput<typeof SearchTextSchema>;

export type SearchText = v.InferOutput<typeof SearchTextSchema>;

/**
 * テキスト検索エンジンのフォーマット識別子を検証するスキーマです。
 *
 * @example
 * ```
 * import { TextSearchFormatSchema } from "@z-rack/core";
 *
 * v.parse(TextSearchFormatSchema, "4BHG7qRQgKMxgXHgjyWCXt4BHG7qRQgKMxgXHgjyWCXt");
 * // => "4BHG7qRQgKMxgXHgjyWCXt4BHG7qRQgKMxgXHgjyWCXt"
 * ```
 */
export const TextSearchFormatSchema = v.pipe(
  v.string(),
  v.length(44),
  v.regex(BASE58_REGEX),
  v.brand("Sha256"),
  v.brand("Base58"),
);

export type TextSearchFormatLike = v.InferInput<typeof TextSearchFormatSchema>;

export type TextSearchFormat = v.InferOutput<typeof TextSearchFormatSchema>;

export const MIN_OBJECT_TAG_BYTES = 0 as Uint;

export const MAX_OBJECT_TAG_BYTES = (128 * B) as Uint;

/**
 * オブジェクトのタグを検証するスキーマです。
 *
 * @example
 * ```
 * import { ObjectTagSchema } from "@z-rack/core";
 *
 * v.parse(ObjectTagSchema, "important"); // => "important"
 * ```
 */
export const ObjectTagSchema = v.pipe(Utf8Schema(MAX_OBJECT_TAG_BYTES), v.brand("ObjectTag"));

export type ObjectTagLike = v.InferInput<typeof ObjectTagSchema>;

export type ObjectTag = v.InferOutput<typeof ObjectTagSchema>;

/**
 * オブジェクトのタグ集合を検証するスキーマです。
 *
 * 配列で渡された場合は Set に変換されます。最大 20 個まで保持できます。
 *
 * @example
 * ```
 * import { ObjectTagsSchema } from "@z-rack/core";
 *
 * v.parse(ObjectTagsSchema, new Set(["a", "b"])); // => Set { "a", "b" }
 * v.parse(ObjectTagsSchema, ["a", "b"]);          // => Set { "a", "b" }
 * ```
 */
export const ObjectTagsSchema = v.pipe(
  v.union([
    v.set(ObjectTagSchema),
    v.pipe(
      v.array(ObjectTagSchema),
      v.transform((x) => new Set(x)),
    ),
  ]),
  v.maxSize(20),
  v.brand("ObjectTags"),
);

export type ObjectTagsLike = v.InferInput<typeof ObjectTagsSchema>;

export type ObjectTags = v.InferOutput<typeof ObjectTagsSchema>;

export const UserMetadataSchema = v.unknown();

export type UserMetadataLike = v.InferInput<typeof UserMetadataSchema>;

export type UserMetadata = v.InferOutput<typeof UserMetadataSchema>;

// -------------------------------------------------------------------------------------------------
//
// その他
//
// -------------------------------------------------------------------------------------------------

/**
 * オブジェクトキーの接頭辞を検証するスキーマです。
 *
 * @example
 * ```
 * import { ObjectKeyPrefixSchema } from "@z-rack/core";
 *
 * v.parse(ObjectKeyPrefixSchema, "foo/bar/");
 * // => "foo/bar/"
 * ```
 */
export const ObjectKeyPrefixSchema = v.pipe(StringObjectKeySchema, v.brand("ObjectKeyPrefix"));

export type ObjectKeyPrefixLike = v.InferInput<typeof ObjectKeyPrefixSchema>;

export type ObjectKeyPrefix = v.InferOutput<typeof ObjectKeyPrefixSchema>;

/**
 * データベースのオープンモードを検証するスキーマです。
 *
 * - `"w"`: 既存のデータがあれば上書きします。
 * - `"wx"`: 既存のデータがあればエラーにします。
 *
 * @example
 * ```
 * import { OpenModeSchema } from "@z-rack/core";
 *
 * v.parse(OpenModeSchema, "w");  // => "w"
 * v.parse(OpenModeSchema, "wx"); // => "wx"
 * ```
 */
export const OpenModeSchema = v.pipe(v.picklist(["w", "wx"]), v.brand("OpenMode"));

export type OpenModeLike = v.InferInput<typeof OpenModeSchema>;

export type OpenMode = v.InferOutput<typeof OpenModeSchema>;

/**
 * 並び順の方向を検証するスキーマです。
 *
 * @example
 * ```
 * import { OrderDirectionSchema } from "@z-rack/core";
 *
 * v.parse(OrderDirectionSchema, "ASC");  // => "ASC"
 * v.parse(OrderDirectionSchema, "DESC"); // => "DESC"
 * ```
 */
export const OrderDirectionSchema = v.pipe(v.picklist(["ASC", "DESC"]), v.brand("OrderDirection"));

export type OrderDirectionLike = v.InferInput<typeof OrderDirectionSchema>;

export type OrderDirection = v.InferOutput<typeof OrderDirectionSchema>;
