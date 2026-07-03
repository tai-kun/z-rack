import { chunks } from "@unikvs/utils";
import {
  type EntityTag,
  type SearchText,
  type ITextSearch,
  type LanguageLike,
  type MimeTypeLike,
  type IDatabaseClient,
  v,
  nil,
  isError,
  ObjectKey,
  UintSchema,
  IdleTaskQueue,
  LanguageSchema,
  MimeTypeSchema,
  OpenModeSchema,
  ObjectKeySchema,
  TimestampSchema,
  ObjectSizeSchema,
  ObjectTagsSchema,
  DescriptionSchema,
  createAbortPromise,
  UserMetadataSchema,
  OrderDirectionSchema,
  ObjectKeyPrefixSchema,
} from "@z-rack/core";
import { combineSignals } from "abort-signal-utils";
import { Asyncmux, asyncmux } from "asyncmux";
import type { MaybePromise } from "maypromise";
import { KeyNotFoundError, UniKvs, ValueStream, type Value } from "unikvs";

import entityTag from "./_entity-tag.js";
import getMimeType from "./_get-mime-type.js";
import logger from "./_logger.js";
import Metabase from "./_metabase.js";
import TextSearch from "./_text-search.js";
import {
  ZRackIsOpenError,
  ObjectExistsError,
  ZRackIsNotOpenError,
  ObjectNotFoundError,
} from "./errors.js";

// -------------------------------------------------------------------------------------------------
//
// ユーティリティー
//
// -------------------------------------------------------------------------------------------------

/**
 * バイト単位の基準値です。
 */
const B = 1;

/**
 * キロバイト単位のバイト数です。
 */
const KB = 1000 * B;

/**
 * メガバイト単位のバイト数です。
 */
const MB = 1000 * KB;

/**
 * ギガバイト単位のバイト数です。
 */
const GB = 1000 * MB;

/**
 * `@noble/hashes` の制限に基づく、1 回のハッシュ更新処理で扱える最大チャンクサイズです。
 *
 * @see https://github.com/paulmillr/noble-hashes/blob/2.2.0/README.md?plain=1#L97
 */
const MAX_CHUNK_SIZE = 4 * GB;

/**
 * select オブジェクトに基づいて行データからプロパティーを抽出する型です。
 *
 * @template TRow 元の行データの型です。
 * @template TSelect 抽出条件の型です。
 */
export type $Select<
  TRow extends { readonly [_ in string]: unknown },
  TSelect extends { readonly [_ in keyof TRow]?: boolean | undefined },
> = {
  [K in keyof TRow as K extends keyof TSelect
    ? TSelect[K] extends true
      ? K
      : never
    : never]: TRow[K];
};

/**
 * select オプションのカラム名を抽出する型です。
 *
 * @template TSelect select オプションの型です。
 */
type SelectColumn<
  TSelect extends boolean | undefined | { readonly [_ in string]?: boolean | undefined },
> = keyof Exclude<TSelect, boolean | undefined>;

/**
 * select オプションの型を正規化し、全プロパティーに真偽値が確定した型に変換します。
 *
 * @template TSelect 変換前の select 型です。
 * @template TColumn 全カラム名です。
 * @template TNotSet 未設定時のデフォルト真偽値です。
 */
type $NormalizeSelect<
  TSelect extends boolean | undefined | { readonly [_ in string]?: boolean | undefined },
  TColumn extends string,
  TNotSet extends boolean,
> = TSelect extends undefined
  ? Record<TColumn, TNotSet>
  : TSelect extends boolean
    ? Record<TColumn, TSelect>
    : { [P in TColumn]: P extends keyof TSelect ? TSelect[P] : false };

/**
 * 複数のキーに同じ値を割り当てたレコードを作成します。
 */
const record = <const TValue, const TKey extends string>(value: TValue, keys: readonly TKey[]) =>
  Object.fromEntries(keys.map((key) => [key, value])) as Record<TKey, TValue>;

// -------------------------------------------------------------------------------------------------
//
// 入力パラメーター
//
// -------------------------------------------------------------------------------------------------

/**
 * 初期化処理で受け取るパラメーターの検証用スキーマです。
 */
const SetupParamsSchema = v.object({
  textSearch: v.any(),
  storageSystem: v.instance(UniKvs),
  databaseSchema: v.optional(v.string()),
  databaseClient: v.any(),
});

/**
 * データの永続化に使用するストレージシステムの型定義です。
 */
export type StorageSystem = UniKvs<Record<string, Value<Uint8Array<ArrayBuffer>>>>;

/**
 * システムの初期化に必要な設定パラメーターの型定義です。
 */
export type SetupParams = {
  /**
   * データベースに接続するためのクライアントインスタンスです。
   */
  readonly databaseClient: IDatabaseClient;

  /**
   * データを永続化するためのストレージシステムです。
   */
  readonly storageSystem: StorageSystem;

  /**
   * 全文検索機能を提供する検索エンジンです。
   */
  readonly textSearch: ITextSearch;

  /**
   * 使用するデータベースのスキーマ名です。省略した場合は規定値が適用されます。
   */
  readonly databaseSchema?: string | undefined;
};

/**
 * 初期化関数に渡す引数の型定義です。
 */
export type SetupFunctionArgs = {
  /**
   * 処理の中断を検知するためのシグナルです。
   */
  signal: AbortSignal;
};

/**
 * システムの初期化を行う関数が満たすべきインターフェースです。
 */
export interface SetupFunction {
  /**
   * 初期化処理を実行し、設定パラメーターを返します。
   *
   * @param args 初期化に必要なシグナルを含む引数です。
   * @returns 設定パラメーター、またはそれを解決するプロミスを返します。
   */
  (args: SetupFunctionArgs): MaybePromise<SetupParams>;
}

// -------------------------------------------------------------------------------------------------

/**
 * オープンオプションのバリデーションスキーマです。
 */
const OpenOptionsSchema = v.object({
  signal: v.optional(v.instance(AbortSignal)),
});

/**
 * オープン時に指定できるオプションです。
 */
export type OpenOptions = v.InferInput<typeof OpenOptionsSchema>;

/**
 * クローズオプションのバリデーションスキーマです。
 */
const CloseOptionsSchema = v.object({
  signal: v.optional(v.instance(AbortSignal)),
});

/**
 * クローズ時に指定できるオプションです。
 */
export type CloseOptions = v.InferInput<typeof CloseOptionsSchema>;

// -------------------------------------------------------------------------------------------------

/**
 * 保存オプションのバリデーションスキーマです。
 */
const PutObjectOptionsSchema = v.object({
  key: ObjectKeySchema,
  data: v.union([
    v.instance(Uint8Array<ArrayBuffer>),
    v.instance(ReadableStream<Uint8Array<ArrayBuffer>>),
  ]),
  mode: v.optional(OpenModeSchema, "w"),
  tags: v.optional(ObjectTagsSchema, []),
  signal: v.optional(v.instance(AbortSignal)),
  language: v.optional(LanguageSchema),
  mimeType: v.optional(MimeTypeSchema),
  timestamp: v.optional(TimestampSchema),
  description: v.optional(v.nullable(DescriptionSchema), null),
  userMetadata: v.optional(UserMetadataSchema, null),
});

/**
 * 保存関数の引数バリエーションのバリデーションスキーマです。
 *
 * オプションオブジェクト形式と個別引数形式の両方に対応します。
 */
const PutObjectArgsSchema = v.union([
  v.tuple([PutObjectOptionsSchema]),
  v.pipe(
    v.tuple([
      PutObjectOptionsSchema.entries.key,
      PutObjectOptionsSchema.entries.data,
      v.optional(v.omit(PutObjectOptionsSchema, ["key", "data"]), {
        mode: PutObjectOptionsSchema.entries.mode.default,
        tags: PutObjectOptionsSchema.entries.tags.default,
        signal: PutObjectOptionsSchema.entries.signal.default,
        language: PutObjectOptionsSchema.entries.language.default,
        mimeType: PutObjectOptionsSchema.entries.mimeType.default,
        timestamp: PutObjectOptionsSchema.entries.timestamp.default,
        description: PutObjectOptionsSchema.entries.description.default,
        userMetadata: PutObjectOptionsSchema.entries.userMetadata.default,
      }),
    ]),
    v.transform(([key, data, options]) => [{ key, data, ...options }]),
  ),
]);

/**
 * 保存時に指定できるオプションです。
 */
export type PutObjectOptions = v.InferInput<typeof PutObjectOptionsSchema>;

// -------------------------------------------------------------------------------------------------

/**
 * オブジェクトのメタデータを表す型です。
 */
export type ObjectMetadata = {
  /**
   * オブジェクトを一意に識別する ID です。
   */
  id: string;

  /**
   * レコードの処理種別です（新規作成またはメタデータ更新）。
   */
  recordType: "CREATE" | "UPDATE_METADATA";

  /**
   * レコードが記録されたタイムスタンプです。
   */
  recordTimestamp: number;

  /**
   * オブジェクトのキー（パス）です。
   */
  key: ObjectKey;

  /**
   * データサイズ（バイト）です。
   */
  size: number;

  /**
   * MIME タイプです。
   */
  mimeType: MimeTypeLike;

  /**
   * エンティティータグです。
   */
  eTag: string;

  /**
   * 作成日時です。
   */
  createdAt: number;

  /**
   * 最終更新日時です。
   */
  lastModifiedAt: number;

  /**
   * 説明文の言語です。
   */
  language: LanguageLike;

  /**
   * 説明文です（未設定時は null）。
   */
  description: string | null;

  /**
   * タグ一覧です。
   */
  tags: string[];

  /**
   * ユーザー定義のメタデータです。
   */
  userMetadata: unknown;
};

// -------------------------------------------------------------------------------------------------

const GET_OBJECT_SELECT_NOT_SET = false as const;

const GetObjectSelectRecord = <const TValue>(value: TValue) =>
  record(value, [
    "id",
    "eTag",
    "tags",
    "language",
    "createdAt",
    "recordType",
    "description",
    "userMetadata",
    "recordTimestamp",
  ]);

/**
 * 取得オプションのバリデーションスキーマです。
 */
const GetObjectOptionsSchema = v.object({
  key: ObjectKeySchema,
  select: v.optional(
    v.union([
      v.pipe(
        v.boolean(),
        v.transform((bool) => GetObjectSelectRecord(bool)),
      ),
      v.object(GetObjectSelectRecord(v.optional(v.boolean(), false))),
    ]),
    GetObjectSelectRecord(GET_OBJECT_SELECT_NOT_SET),
  ),
  signal: v.optional(v.instance(AbortSignal)),
});

/**
 * 取得関数の引数バリエーションのバリデーションスキーマです。
 */
const GetObjectArgsSchema = v.union([
  v.tuple([GetObjectOptionsSchema]),
  v.pipe(
    v.tuple([
      GetObjectOptionsSchema.entries.key,
      v.optional(v.omit(GetObjectOptionsSchema, ["key"]), {
        select: GetObjectOptionsSchema.entries.select.default,
        signal: GetObjectOptionsSchema.entries.signal.default,
      }),
    ]),
    v.transform(([key, options]) => [{ key, ...options }]),
  ),
]);

/**
 * 取得時の select オプションの型です。
 */
export type GetObjectSelect = v.InferInput<typeof GetObjectOptionsSchema>["select"];

/**
 * 取得時に指定できるオプションです。
 *
 * @template TSelect 抽出するメタデータ項目の型です。
 */
export type GetObjectOptions<TSelect extends GetObjectSelect = GetObjectSelect> = Omit<
  v.InferInput<typeof GetObjectOptionsSchema>,
  "select"
> & {
  readonly select?: TSelect;
};

type GetObjectSelectColumn = SelectColumn<GetObjectSelect>;

type GetObjectSelectNotSet = typeof GET_OBJECT_SELECT_NOT_SET;

/**
 * オブジェクトのファイルデータと選択されたメタデータを統合した型です。
 *
 * @template TSelect 抽出するメタデータ項目の型です。
 */
export type ObjectFile<TSelect extends GetObjectSelect = GetObjectSelect> = File &
  $Select<ObjectMetadata, $NormalizeSelect<TSelect, GetObjectSelectColumn, GetObjectSelectNotSet>> &
  Pick<ObjectMetadata, "key" | "mimeType" | "lastModifiedAt">;

// -------------------------------------------------------------------------------------------------

const GET_OBJECT_STREAM_SELECT_NOT_SET = false as const;

const GetObjectStreamSelectRecord = <const TValue>(value: TValue) =>
  record(value, [
    "id",
    "eTag",
    "size",
    "tags",
    "language",
    "mimeType",
    "createdAt",
    "recordType",
    "description",
    "userMetadata",
    "lastModifiedAt",
    "recordTimestamp",
  ]);

/**
 * オブジェクトストリーム取得オプションのバリデーションスキーマです。
 */
const GetObjectStreamOptionsSchema = v.object({
  key: ObjectKeySchema,
  select: v.optional(
    v.union([
      v.pipe(
        v.boolean(),
        v.transform((bool) => GetObjectStreamSelectRecord(bool)),
      ),
      v.object(GetObjectStreamSelectRecord(v.optional(v.boolean(), false))),
    ]),
    GetObjectStreamSelectRecord(GET_OBJECT_STREAM_SELECT_NOT_SET),
  ),
  signal: v.optional(v.instance(AbortSignal)),
});

/**
 * ストリーム取得関数の引数バリエーションのバリデーションスキーマです。
 */
const GetObjectStreamArgsSchema = v.union([
  v.tuple([GetObjectOptionsSchema]),
  v.pipe(
    v.tuple([
      GetObjectOptionsSchema.entries.key,
      v.optional(v.omit(GetObjectOptionsSchema, ["key"]), {
        select: GetObjectStreamOptionsSchema.entries.select.default,
        signal: GetObjectStreamOptionsSchema.entries.signal.default,
      }),
    ]),
    v.transform(([key, options]) => [{ key, ...options }]),
  ),
]);

/**
 * ストリーム取得時の select オプションの型です。
 */
export type GetObjectStreamSelect = v.InferInput<typeof GetObjectStreamOptionsSchema>["select"];

/**
 * ストリーム取得時に指定できるオプションです。
 *
 * @template TSelect 抽出するメタデータ項目の型です。
 */
export type GetObjectStreamOptions<TSelect extends GetObjectStreamSelect = GetObjectStreamSelect> =
  Omit<v.InferInput<typeof GetObjectStreamOptionsSchema>, "select"> & {
    readonly select?: TSelect;
  };

type GetObjectStreamSelectColumn = SelectColumn<GetObjectSelect>;

type GetObjectStreamSelectNotSet = typeof GET_OBJECT_STREAM_SELECT_NOT_SET;

/**
 * オブジェクトのデータストリームと選択されたメタデータを統合した型です。
 *
 * @template TSelect 抽出するメタデータ項目の型です。
 */
export type ObjectStream<TSelect extends GetObjectStreamSelect = GetObjectStreamSelect> =
  ValueStream<Uint8Array<ArrayBuffer>> &
    $Select<
      ObjectMetadata,
      $NormalizeSelect<TSelect, GetObjectStreamSelectColumn, GetObjectStreamSelectNotSet>
    > &
    Pick<ObjectMetadata, "key">;

// -------------------------------------------------------------------------------------------------

/**
 * `select` オプションが無い場合に選択するかどうかです。
 */
const LIST_OBJECTS_SELECT_NOT_SET = true as const;

const ListObjectsSelectRecord = <const TValue>(value: TValue) =>
  record(value, [
    "id",
    "key",
    "eTag",
    "size",
    "tags",
    "language",
    "mimeType",
    "createdAt",
    "recordType",
    "description",
    "userMetadata",
    "lastModifiedAt",
    "recordTimestamp",
  ]);

/**
 * 一覧取得オプションのバリデーションスキーマです。
 */
const ListObjectsOptionsSchema = v.object({
  prefix: v.optional(ObjectKeyPrefixSchema),
  select: v.optional(
    v.union([
      v.pipe(
        v.boolean(),
        v.transform((bool) => ListObjectsSelectRecord(bool)),
      ),
      v.object(ListObjectsSelectRecord(v.optional(v.boolean(), false))),
    ]),
    ListObjectsSelectRecord(LIST_OBJECTS_SELECT_NOT_SET),
  ),
  order: v.optional(
    v.object({
      collate: v.optional(v.string()),
      direction: v.optional(OrderDirectionSchema, "ASC"),
    }),
    {
      collate: undefined,
      direction: "ASC",
    },
  ),
  skip: v.optional(UintSchema, 0),
  take: v.optional(UintSchema, 100),
  signal: v.optional(v.instance(AbortSignal)),
});

/**
 * 一覧取得関数の引数バリエーションのバリデーションスキーマです。
 */
const ListObjectsArgsSchema = v.union([
  v.tuple([
    v.optional(ListObjectsOptionsSchema, {
      skip: ListObjectsOptionsSchema.entries.skip.default,
      take: ListObjectsOptionsSchema.entries.take.default,
      order: ListObjectsOptionsSchema.entries.order.default,
      prefix: ListObjectsOptionsSchema.entries.prefix.default,
      select: ListObjectsOptionsSchema.entries.select.default,
      signal: ListObjectsOptionsSchema.entries.signal.default,
    }),
  ]),
  v.pipe(
    v.tuple([
      ListObjectsOptionsSchema.entries.prefix.wrapped,
      v.optional(v.omit(ListObjectsOptionsSchema, ["prefix"]), {
        skip: ListObjectsOptionsSchema.entries.skip.default,
        take: ListObjectsOptionsSchema.entries.take.default,
        order: ListObjectsOptionsSchema.entries.order.default,
        select: ListObjectsOptionsSchema.entries.select.default,
        signal: ListObjectsOptionsSchema.entries.signal.default,
      }),
    ]),
    v.transform(([prefix, options]) => [{ prefix, ...options }]),
  ),
]);

/**
 * 一覧取得時の select オプションの型です。
 */
export type ListObjectsSelect = v.InferInput<typeof ListObjectsOptionsSchema>["select"];

/**
 * 一覧取得時に指定できるオプションです。
 *
 * @template TSelect 抽出するメタデータ項目の型です。
 */
export type ListObjectsOptions<TSelect extends ListObjectsSelect = ListObjectsSelect> = Omit<
  v.InferInput<typeof ListObjectsOptionsSchema>,
  "select"
> & {
  readonly select?: TSelect;
};

type ListObjectsSelectColumn = SelectColumn<ListObjectsSelect>;

type ListObjectsSelectNotSet = typeof LIST_OBJECTS_SELECT_NOT_SET;

/**
 * 一覧の各要素の型です。
 *
 * @template TSelect 抽出するメタデータ項目の型です。
 */
export type ObjectMetadataListItem<TSelect extends ListObjectsSelect = ListObjectsSelect> = $Select<
  ObjectMetadata,
  $NormalizeSelect<TSelect, ListObjectsSelectColumn, ListObjectsSelectNotSet>
>;

// -------------------------------------------------------------------------------------------------

const SEARCH_OBJECTS_SELECT_NOT_SET = true as const;

const SearchObjectsSelectRecord = <const TValue>(value: TValue) =>
  record(value, [
    "id",
    "key",
    "eTag",
    "size",
    "tags",
    "language",
    "mimeType",
    "createdAt",
    "recordType",
    "description",
    "userMetadata",
    "lastModifiedAt",
    "recordTimestamp",
  ]);

/**
 * 検索オプションのバリデーションスキーマです。
 */
const SearchObjectsOptionsSchema = v.object({
  skip: v.optional(UintSchema, 0),
  take: v.optional(UintSchema, 100),
  query: v.string(),
  prefix: v.optional(ObjectKeyPrefixSchema),
  select: v.optional(
    v.union([
      v.pipe(
        v.boolean(),
        v.transform((bool) => SearchObjectsSelectRecord(bool)),
      ),
      v.object(SearchObjectsSelectRecord(v.optional(v.boolean(), false))),
    ]),
    SearchObjectsSelectRecord(SEARCH_OBJECTS_SELECT_NOT_SET),
  ),
  signal: v.optional(v.instance(AbortSignal)),
  scoreGreaterThan: v.optional(v.pipe(v.number(), v.finite()), 0),
});

/**
 * 検索関数の引数バリエーションのバリデーションスキーマです。
 */
const SearchObjectsArgsSchema = v.union([
  v.tuple([SearchObjectsOptionsSchema]),
  v.pipe(
    v.tuple([
      SearchObjectsOptionsSchema.entries.query,
      v.optional(v.omit(SearchObjectsOptionsSchema, ["query"]), {
        skip: SearchObjectsOptionsSchema.entries.skip.default,
        take: SearchObjectsOptionsSchema.entries.take.default,
        prefix: SearchObjectsOptionsSchema.entries.prefix.default,
        select: SearchObjectsOptionsSchema.entries.select.default,
        signal: SearchObjectsOptionsSchema.entries.signal.default,
        scoreGreaterThan: SearchObjectsOptionsSchema.entries.scoreGreaterThan.default,
      }),
    ]),
    v.transform(([query, options]) => [{ query, ...options }]),
  ),
]);

/**
 * 検索時の select オプションの型です。
 */
export type SearchObjectsSelect = v.InferInput<typeof SearchObjectsOptionsSchema>["select"];

/**
 * 検索時に指定できるオプションです。
 *
 * @template TSelect 抽出するメタデータ項目の型です。
 */
export type SearchObjectsOptions<TSelect extends SearchObjectsSelect = SearchObjectsSelect> = Omit<
  v.InferInput<typeof SearchObjectsOptionsSchema>,
  "select"
> & {
  readonly select?: TSelect;
};

type SearchObjectsSelectColumn = SelectColumn<SearchObjectsSelect>;

type SearchObjectsSelectNotSet = typeof SEARCH_OBJECTS_SELECT_NOT_SET;

/**
 * 検索結果の各要素の型です。
 *
 * @template TSelect 抽出するメタデータ項目の型です。
 */
export type ObjectMetadataSearchItem<TSelect extends SearchObjectsSelect = SearchObjectsSelect> = {
  score: number;
} & $Select<
  ObjectMetadata,
  $NormalizeSelect<TSelect, SearchObjectsSelectColumn, SearchObjectsSelectNotSet>
>;

// -------------------------------------------------------------------------------------------------

/**
 * 削除オプションのバリデーションスキーマです。
 */
const DeleteObjectOptionsSchema = v.object({
  key: ObjectKeySchema,
  signal: v.optional(v.instance(AbortSignal)),
  timestamp: v.optional(TimestampSchema),
});

/**
 * 削除関数の引数バリエーションのバリデーションスキーマです。
 */
const DeleteObjectArgsSchema = v.union([
  v.tuple([DeleteObjectOptionsSchema]),
  v.pipe(
    v.tuple([
      DeleteObjectOptionsSchema.entries.key,
      v.optional(v.omit(DeleteObjectOptionsSchema, ["key"]), {
        signal: DeleteObjectOptionsSchema.entries.signal.default,
        timestamp: DeleteObjectOptionsSchema.entries.timestamp.default,
      }),
    ]),
    v.transform(([key, options]) => [{ key, ...options }]),
  ),
]);

/**
 * 削除時に指定できるオプションです。
 */
export type DeleteObjectOptions = v.InferInput<typeof DeleteObjectOptionsSchema>;

// -------------------------------------------------------------------------------------------------

/**
 * 存在確認オプションのバリデーションスキーマです。
 */
const ExistsMetadataOptionsSchema = v.object({
  key: ObjectKeySchema,
  signal: v.optional(v.instance(AbortSignal)),
});

/**
 * 存在確認関数の引数バリエーションのバリデーションスキーマです。
 */
const ExistsMetadataArgsSchema = v.union([
  v.tuple([ExistsMetadataOptionsSchema]),
  v.pipe(
    v.tuple([
      ExistsMetadataOptionsSchema.entries.key,
      v.optional(v.omit(ExistsMetadataOptionsSchema, ["key"]), {
        signal: ExistsMetadataOptionsSchema.entries.signal.default,
      }),
    ]),
    v.transform(([key, options]) => [{ key, ...options }]),
  ),
]);

/**
 * 存在確認時に指定できるオプションです。
 */
export type ExistsMetadataOptions = v.InferInput<typeof ExistsMetadataOptionsSchema>;

// -------------------------------------------------------------------------------------------------

const GET_OBJECT_METADATA_SELECT_NOT_SET = true as const;

const GetObjectMetadataSelectRecord = <const TValue>(value: TValue) =>
  record(value, [
    "id",
    "key",
    "eTag",
    "size",
    "tags",
    "language",
    "mimeType",
    "createdAt",
    "recordType",
    "description",
    "userMetadata",
    "lastModifiedAt",
    "recordTimestamp",
  ]);

/**
 * メタデータ取得オプションのバリデーションスキーマです。
 */
const GetObjectMetadataOptionsSchema = v.object({
  key: ObjectKeySchema,
  select: v.optional(
    v.union([
      v.pipe(
        v.boolean(),
        v.transform((bool) => GetObjectMetadataSelectRecord(bool)),
      ),
      v.object(GetObjectMetadataSelectRecord(v.optional(v.boolean(), false))),
    ]),
    GetObjectMetadataSelectRecord(GET_OBJECT_METADATA_SELECT_NOT_SET),
  ),
  signal: v.optional(v.instance(AbortSignal)),
});

/**
 * メタデータ取得関数の引数バリエーションのバリデーションスキーマです。
 */
const GetObjectMetadataArgsSchema = v.union([
  v.tuple([GetObjectMetadataOptionsSchema]),
  v.pipe(
    v.tuple([
      GetObjectMetadataOptionsSchema.entries.key,
      v.optional(v.omit(GetObjectMetadataOptionsSchema, ["key"]), {
        select: GetObjectMetadataOptionsSchema.entries.select.default,
        signal: GetObjectMetadataOptionsSchema.entries.signal.default,
      }),
    ]),
    v.transform(([key, options]) => [{ key, ...options }]),
  ),
]);

/**
 * メタデータ取得時の select オプションの型です。
 */
export type GetObjectMetadataSelect = v.InferInput<typeof GetObjectMetadataOptionsSchema>["select"];

/**
 * メタデータ取得時に指定できるオプションです。
 *
 * @template TSelect 抽出するメタデータ項目の型です。
 */
export type GetObjectMetadataOptions<
  TSelect extends GetObjectMetadataSelect = GetObjectMetadataSelect,
> = Omit<v.InferInput<typeof GetObjectMetadataOptionsSchema>, "select"> & {
  readonly select?: TSelect;
};

type GetObjectMetadataSelectColumn = SelectColumn<GetObjectMetadataSelect>;

type GetObjectMetadataSelectNotSet = typeof GET_OBJECT_METADATA_SELECT_NOT_SET;

/**
 * 選択されたメタデータのみを含む型です。
 *
 * @template TSelect 抽出するメタデータ項目の型です。
 */
export type SelectedObjectMetadata<
  TSelect extends GetObjectMetadataSelect = GetObjectMetadataSelect,
> = $Select<
  ObjectMetadata,
  $NormalizeSelect<TSelect, GetObjectMetadataSelectColumn, GetObjectMetadataSelectNotSet>
>;

// -------------------------------------------------------------------------------------------------

/**
 * メタデータ更新オプションのバリデーションスキーマです。
 */
const UpdateObjectMetadataOptionsSchema = v.object({
  key: ObjectKeySchema,
  tags: v.optional(ObjectTagsSchema),
  signal: v.optional(v.instance(AbortSignal)),
  language: v.optional(LanguageSchema),
  mimeType: v.optional(MimeTypeSchema),
  timestamp: v.optional(TimestampSchema),
  description: v.optional(v.nullable(DescriptionSchema)),
  userMetadata: v.optional(UserMetadataSchema),
});

/**
 * メタデータ更新関数の引数バリエーションのバリデーションスキーマです。
 */
const UpdateObjectMetadataArgsSchema = v.union([
  v.tuple([UpdateObjectMetadataOptionsSchema]),
  v.pipe(
    v.tuple([
      UpdateObjectMetadataOptionsSchema.entries.key,
      v.omit(UpdateObjectMetadataOptionsSchema, ["key"]),
    ]),
    v.transform(([key, options]) => [{ key, ...options }]),
  ),
]);

/**
 * メタデータ更新時に指定できるオプションです。
 */
export type UpdateObjectMetadataOptions = v.InferInput<typeof UpdateObjectMetadataOptionsSchema>;

// -------------------------------------------------------------------------------------------------
//
// ZRack クラス
//
// -------------------------------------------------------------------------------------------------

/**
 * 初期化パラメーターの検証を行い、各コンポーネントのインスタンスを作成して返します。
 *
 * @param params 初期化に必要な設定パラメーターオブジェクトです。
 * @returns データベース、ストレージ、検索エンジンの各インスタンスを含むオブジェクトを返します。
 */
function parseSetupParams(params: SetupParams) {
  // バリデーションライブラリーを用いて、入力された初期化パラメーターの整合性を検証します。
  const { textSearch, storageSystem, databaseClient, databaseSchema } = v.parseInput(
    SetupParamsSchema,
    params,
  );

  const ts = new TextSearch(textSearch);
  const db = new Metabase(databaseSchema, databaseClient, ts);
  const io = storageSystem;

  return { db, io, ts };
}

/**
 * 有効な接続が確立されている際の、各種コンポーネントや排他制御の管理状態を表す型定義です。
 */
type Connection = {
  /**
   * 接続全体を一括して中断するためのコントローラーです。
   */
  readonly ac: AbortController;
  /**
   * メタデータを管理するデータベースのインスタンスです。
   */
  readonly db: Metabase;
  /**
   * 実データを永続化するストレージシステムのインスタンスです。
   */
  readonly io: StorageSystem;
  /**
   * テキスト検索や言語判定を担う検索エンジンのインスタンスです。
   */
  readonly ts: TextSearch;
  /**
   * キーごとの個別排他制御を管理するミューテックスインスタンスです。
   */
  readonly mux: Asyncmux;
  /**
   * 各コンポーネントをクローズ処理の対象とするかどうかの制御フラグです。
   */
  readonly close: {
    readonly db: boolean;
    readonly io: boolean;
    readonly ts: boolean;
  };
};

/**
 * オブジェクトストレージとメタデータ管理を統合し、一貫したオブジェクト操作を提供するクラスです。
 */
export default class ZRack implements AsyncDisposable {
  #con: Connection | null;

  readonly #acSet: Set<AbortController>;

  readonly #setup: SetupFunction | ReturnType<typeof parseSetupParams>;

  readonly #tasks: IdleTaskQueue;

  public constructor(setup: SetupParams | SetupFunction) {
    this.#con = null;
    this.#acSet = new Set();
    this.#setup = typeof setup === "function" ? setup : parseSetupParams(setup);
    this.#tasks = new IdleTaskQueue();
  }

  // -----------------------------------------------------------------------------------------------
  //
  // isOpen
  //
  // -----------------------------------------------------------------------------------------------

  /**
   * 現在、接続が確立されて利用可能な状態であるかどうかを取得します。
   */
  public get isOpen(): boolean {
    return this.#con !== null;
  }

  // -----------------------------------------------------------------------------------------------
  //
  // open
  //
  // -----------------------------------------------------------------------------------------------

  /**
   * 各種コンポーネントへの接続を開始し、システムを利用可能な状態にします。
   *
   * すでに接続が開いている場合はエラーを投げます。
   *
   * @param options 接続処理に指定する追加オプションです。
   * @returns 接続が完了した、自身のリソースインスタンスを返します。
   */
  public async open(options: OpenOptions = {}): Promise<AsyncDisposable> {
    if (this.#con !== null) {
      throw new ZRackIsOpenError();
    }

    const { signal: signalOption } = v.parseInput(OpenOptionsSchema, options);

    const ac = new AbortController();
    const signal = combineSignals([ac.signal, signalOption]);

    signal.throwIfAborted();

    this.#acSet.add(ac);

    // インスタンス全体に対する排他ロックを取得して初期化処理の競合を防ぎます。
    const lock = await asyncmux(this, signal);
    const ds = new AsyncDisposableStack();
    const defer = ds.defer.bind(ds);
    const dispose = ds.disposeAsync.bind(ds);
    try {
      if (this.#con !== null) {
        throw new ZRackIsOpenError();
      }

      // セットアップ情報が関数の場合は実行して評価し、確定した設定から各コンポーネントを準備します。
      const { db, io, ts } =
        typeof this.#setup !== "function"
          ? this.#setup
          : parseSetupParams(await this.#setup({ signal }));
      const close = {
        db: false,
        io: false,
        ts: false,
      };

      let err: unknown = nil;

      // 検索エンジンが未接続であれば接続を開始し、失敗時はクリーンアップするように登録します。
      if (!ts.isOpen) {
        close.ts = true;

        await ts.open(signal);

        defer(async () => {
          if (err === nil) {
            return;
          }

          try {
            await ts.close(signal);
          } catch (ex) {
            logger.error`ZRack.open: Failed to close text search: ${ex}`;
          }
        });
      }

      // データベースが未接続であれば接続を開始します。
      if (!db.isOpen) {
        close.db = true;

        try {
          await db.open(signal);
        } catch (ex) {
          throw (err = ex);
        }

        defer(async () => {
          if (err === nil) {
            return;
          }

          try {
            await db.close(signal, err);
          } catch (ex) {
            logger.error`ZRack.open: Failed to close database client: ${ex}`;
          }
        });
      }

      // ストレージシステムが未接続であれば接続を開始します。
      if (!io.isOpen) {
        close.io = true;

        const context = { "z-rack:action": "open" };
        try {
          await io.open({ signal, context });
        } catch (ex) {
          throw (err = ex);
        }

        defer(async () => {
          if (err === nil) {
            return;
          }

          try {
            await io.close({ signal, context });
          } catch (ex) {
            logger.error`ZRack.open: Failed to close storage system: ${ex}`;
          }
        });
      }

      // すべての初期化が正常に完了したため、現在の接続状態をオブジェクトに確定させます。
      this.#con = {
        ac,
        db,
        io,
        ts,
        mux: new Asyncmux(),
        close,
      };

      return this;
    } finally {
      await dispose();
      this.#acSet.delete(ac);
      lock.release();
    }
  }

  // -----------------------------------------------------------------------------------------------
  //
  // close
  //
  // -----------------------------------------------------------------------------------------------

  /**
   * 内部接続を安全に終了します。
   *
   * バックグラウンドタスクの完了を待機し、オープンされたコンポーネントを順次切断します。
   *
   * @param signal 中断シグナルです。
   * @param con 切断対象の接続管理オブジェクトです。
   */
  async #close(signal: AbortSignal, con: Connection): Promise<void> {
    const lock = await asyncmux(this, signal);
    try {
      if (this.#con !== con) {
        throw new ZRackIsNotOpenError();
      }

      const { db, io, ts, close } = this.#con;

      // 未完了のバックグラウンドタスクの完了を待機します。
      try {
        const abortPromise = createAbortPromise(signal);
        await Promise.race([this.#tasks.wait(), abortPromise]);
      } catch (ex) {
        logger.error`ZRack.close: Failed to finalize tasks: ${ex}`;
      }

      // 自身で接続を開始したコンポーネントのみをクローズします。
      if (close.ts) {
        try {
          await ts.close(signal);
        } catch (ex) {
          logger.error`ZRack.close: Failed to close text search: ${ex}`;
        }
      }

      if (close.io) {
        try {
          const context = { "z-rack:action": "close" };
          await io.close({ signal, context });
        } catch (ex) {
          logger.error`ZRack.close: Failed to close storage system: ${ex}`;
        }
      }

      if (close.db) {
        try {
          await db.close(signal, new ZRackIsNotOpenError());
        } catch (ex) {
          logger.error`ZRack.close: Failed to close database client: ${ex}`;
        }
      }

      this.#con = null;
    } finally {
      lock.release();
    }
  }

  /**
   * システムの接続を閉じ、リソースを解放します。
   *
   * @param options クローズオプションです（デフォルトタイムアウト 10 秒）。
   */
  public async close(options: CloseOptions = {}): Promise<void> {
    try {
      const { signal = AbortSignal.timeout(10e3) } = v.parseInput(CloseOptionsSchema, options);

      if (this.#con === null) {
        const acArr = [...this.#acSet];
        this.#acSet.clear();
        for (const ac of acArr) {
          if (!ac.signal.aborted) {
            ac.abort(new ZRackIsNotOpenError());
          }
        }

        throw new ZRackIsNotOpenError();
      }

      this.#tasks.abort(new ZRackIsNotOpenError());

      const { ac } = this.#con;
      const acArr = [ac, ...this.#acSet];
      this.#acSet.clear();
      for (const ac of acArr) {
        if (!ac.signal.aborted) {
          ac.abort(new ZRackIsNotOpenError());
        }
      }

      return this.#close(signal, this.#con);
    } catch (ex) {
      return Promise.reject(ex);
    }
  }

  /**
   * `AsyncDisposable` インターフェースに準拠したクリーンアップです。
   *
   * `using` ブロックの終了時に自動的に呼び出されます。
   */
  public async [Symbol.asyncDispose](): Promise<void> {
    try {
      await this.close();
    } catch (ex) {
      if (ex instanceof ZRackIsNotOpenError) {
        return;
      }

      throw ex;
    }
  }

  // -----------------------------------------------------------------------------------------------
  //
  // ready
  //
  // -----------------------------------------------------------------------------------------------

  /**
   * 内部コンポーネントの準備が整うまで待機します。
   *
   * データベースのバックグラウンドマイグレーション完了を待ちます。
   */
  public get ready(): Promise<void> {
    return Promise.try(async () => {
      if (this.#con === null) {
        throw new ZRackIsNotOpenError();
      }

      const { ac, db } = this.#con;
      const abortPromise = createAbortPromise(ac.signal);
      await Promise.race([abortPromise, db.ready()]);
    });
  }

  // -----------------------------------------------------------------------------------------------
  //
  // putObject
  //
  // -----------------------------------------------------------------------------------------------

  /**
   * 指定されたオプションに基づいて、オブジェクトのデータとメタデータをシステムへ保存します。
   *
   * @param options 保存するオブジェクトの情報をまとめたオプションです。
   */
  public putObject(options: PutObjectOptions): Promise<void>;

  /**
   * キーとデータを個別の引数として指定し、オブジェクトをシステムへ保存します。
   *
   * @param key オブジェクトを識別する一意のキーです。
   * @param data 保存する実データです。
   * @param options 割り当てるメタデータなどの追加項目を含むオプションです。
   */
  public putObject(
    key: PutObjectOptions["key"],
    data: PutObjectOptions["data"],
    options?: Omit<PutObjectOptions, "key" | "data">,
  ): Promise<void>;

  /**
   * オブジェクトの保存・上書きを実行します。
   */
  public async putObject(...args: any): Promise<void> {
    if (this.#con === null) {
      throw new ZRackIsNotOpenError();
    }

    const [options] = v.parseInput(PutObjectArgsSchema, args);
    const {
      key,
      data,
      mode,
      tags,
      signal: signalOption,
      language: langOption,
      mimeType = getMimeType(key.basename),
      timestamp,
      description,
      userMetadata,
    } = options;

    const { ac, db, io, ts, mux } = this.#con;
    const signal = combineSignals([ac.signal, signalOption]);

    // 全体状態の参照ロックを取得します。
    const lock = await asyncmux.readonly(this, signal);
    try {
      if (this.#con === null) {
        throw new ZRackIsNotOpenError();
      }

      const ds = new DisposableStack();
      const defer = ds.defer.bind(ds);
      const dispose = ds.dispose.bind(ds);
      // 操作対象のキーに対して排他ロックをかけることで、同一キーへの並行書き込みを制御します。
      const lock = await mux.lock({ key: String(key), signal });
      try {
        // 詳細説明が入力されている場合、必要に応じて言語を自動検知し、検索用のトークンを抽出します。
        const language =
          description == null
            ? null
            : (langOption ?? (await ts.detectLanguage(signal, description)));
        let searchText: SearchText | null;
        if (description == null || ts.textConfig !== "simple") {
          searchText = description;
        } else {
          const normalized = await ts.normalize(signal, language!, description);
          searchText = await ts.tokenize(signal, language!, normalized);
        }

        let eTag!: EntityTag;
        let size = 0;
        let value = data;
        // データの種類（一括のバイト配列かストリームか）に応じて、データサイズ算出とハッシュ作成の処理を切り替えます。
        if (value instanceof Uint8Array) {
          eTag = entityTag.digest(value);
          size = value.byteLength;
        } else {
          const hasher = entityTag.hasher();
          value = value.pipeThrough(
            new TransformStream({
              transform(chunk, controller) {
                // ライブラリーの制限を超えないように適正なサイズに分割してハッシュ値を集計します。
                for (const subChunk of chunks(chunk, MAX_CHUNK_SIZE)) {
                  hasher.update(subChunk);
                  size += subChunk.byteLength;
                  controller.enqueue(subChunk);
                }
              },
              flush() {
                eTag = hasher.digest();
              },
            }),
          );
        }

        const objectSize = v.parseInput(ObjectSizeSchema, size);
        const entityId = await db.getEntityId(signal);
        // 実データを先に永続化ストレージへ書き込みます。
        await io.set({
          key: entityId,
          value,
          signal,
        });

        let err: unknown = nil;

        // メタデータ登録で異常が起きた場合は、書き込み済みの実データを非同期キュー経由で自動削除します。
        defer(() => {
          if (err === nil) {
            return;
          }

          this.#tasks.add(async (signal) => {
            try {
              await io.delete({
                key: entityId,
                signal,
              });
            } catch (ex) {
              logger.error`ZRack.putObject: Failed to delete entity: ${entityId}: ${ex}`;
            }
          });
        });

        // 最後にデータベースへ管理用のレコード（メタデータ）を記録して一連の処理を確定させます。
        try {
          await db.create({
            key,
            eTag,
            size: objectSize,
            tags,
            signal,
            entityId,
            language,
            mimeType,
            timestamp,
            searchText,
            description,
            userMetadata,
            overwriteMode: mode === "w",
          });
        } catch (ex) {
          if (
            mode === "wx" &&
            isError(ex) &&
            ex.message.toLowerCase().includes("unique") &&
            ex.message.toLowerCase().includes("_z_rack-unq-private_metadata-_key")
          ) {
            err = new ObjectExistsError({ key: String(key), cause: ex });
          } else {
            err = ex;
          }

          throw err;
        }
      } finally {
        lock.release();
        dispose();
      }
    } finally {
      lock.release();
    }
  }

  // -----------------------------------------------------------------------------------------------
  //
  // getObject
  //
  // -----------------------------------------------------------------------------------------------

  /**
   * 指定されたオプションに基づいてオブジェクトを検索し、ファイルデータとして取得します。
   *
   * @template TSelect レスポンスに含まれるメタデータの選択状態を表す型です。
   * @param options 取得条件や抽出するメタデータの項目を指定するオプションです。
   * @returns 該当するオブジェクトのファイルデータを返します。
   */
  public getObject<const TSelect extends GetObjectSelect = undefined>(
    options: GetObjectOptions<TSelect>,
  ): Promise<ObjectFile<TSelect>>;

  /**
   * 対象のキーを指定してオブジェクトを検索し、ファイルデータとして取得します。
   *
   * @template TSelect レスポンスに含まれるメタデータの選択状態を表す型です。
   * @param key 取得対象となるオブジェクトのキーです。
   * @param options 追加の抽出項目などを指定するオプションです。
   * @returns 該当するオブジェクトのファイルデータを返します。
   */
  public getObject<const TSelect extends GetObjectSelect = undefined>(
    key: GetObjectOptions["key"],
    options?: Omit<GetObjectOptions<TSelect>, "key">,
  ): Promise<ObjectFile<TSelect>>;

  /**
   * オブジェクトをファイルとして取得します。
   */
  public async getObject(...args: any): Promise<ObjectFile> {
    if (this.#con === null) {
      throw new ZRackIsNotOpenError();
    }

    const [options] = v.parseInput(GetObjectArgsSchema, args);
    const { key, select, signal: signalOption } = options;

    const { ac, db, io, mux } = this.#con;
    const signal = combineSignals([ac.signal, signalOption]);

    const lock = await asyncmux.readonly(this, signal);
    try {
      if (this.#con === null) {
        throw new ZRackIsNotOpenError();
      }

      // 対象キーの共有参照（読み取り）ロックを確保してデータの一貫性を守ります。
      const lock = await mux.rLock({ key: String(key), signal });
      try {
        const { entityId, ...metadata } = await db.findOne({
          where: { key },
          select: {
            ...select,
            entityId: true,
            mimeType: true,
            lastModifiedAt: true,
          },
          signal,
        });

        // メタデータから取得した実体識別子を用いて、ストレージからバイナリーデータをロードします。
        const data = await io.get({ key: entityId!, signal });
        const file = new File([data], key.basename, {
          type: metadata.mimeType!,
          lastModified: metadata.lastModifiedAt!,
        });

        // 取得したファイルオブジェクトに対し、指定された各種メタデータプロパティーを合成して返却します。
        // @ts-expect-error
        return Object.assign(file, { key, ...metadata });
      } catch (ex) {
        if (ex instanceof KeyNotFoundError) {
          throw new ObjectNotFoundError({ key: String(key), cause: ex });
        }

        throw ex;
      } finally {
        lock.release();
      }
    } finally {
      lock.release();
    }
  }

  // -----------------------------------------------------------------------------------------------
  //
  // getObjectStream
  //
  // -----------------------------------------------------------------------------------------------

  /**
   * 指定されたオプションに基づいてオブジェクトを検索し、読み込み用のデータストリームとして取得します。
   *
   * @template TSelect レスポンスに含まれるメタデータの選択状態を表す型です。
   * @param options 取得条件やストリームに付随させるメタデータの項目を指定するオプションです。
   * @returns 該当するオブジェクトのデータストリームを返します。
   */
  public getObjectStream<const TSelect extends GetObjectStreamSelect = undefined>(
    options: GetObjectStreamOptions<TSelect>,
  ): Promise<ObjectStream<TSelect>>;

  /**
   * 対象のキーを指定してオブジェクトを検索し、読み込み用のデータストリームとして取得します。
   *
   * @template TSelect レスポンスに含まれるメタデータの選択状態を表す型です。
   * @param key 取得対象となるオブジェクトのキーです。
   * @param options 追加の抽出項目などを指定するオプションです。
   * @returns 該当するオブジェクトのデータストリームを返します。
   */
  public getObjectStream<const TSelect extends GetObjectStreamSelect = undefined>(
    key: GetObjectStreamOptions["key"],
    options?: Omit<GetObjectStreamOptions<TSelect>, "key">,
  ): Promise<ObjectStream<TSelect>>;

  /**
   * オブジェクトのデータストリームを取得します。
   */
  public async getObjectStream(...args: any): Promise<ObjectStream> {
    if (this.#con === null) {
      throw new ZRackIsNotOpenError();
    }

    const [options] = v.parseInput(GetObjectStreamArgsSchema, args);
    const { key, select, signal: signalOption } = options;

    const { ac, db, io, mux } = this.#con;
    const signal = combineSignals([ac.signal, signalOption]);

    const lock = await asyncmux.readonly(this, signal);
    try {
      if (this.#con === null) {
        throw new ZRackIsNotOpenError();
      }

      const lock = await mux.rLock({ key: String(key), signal });
      try {
        const { entityId, ...metadata } = await db.findOne({
          where: { key },
          select: {
            ...select,
            entityId: true,
          },
          signal,
        });

        // ストレージシステムから該当データの読み取り用ストリームを開きます。
        const stream = await io.stream({ key: entityId!, signal });

        // 開いたストリームオブジェクトにメタデータ情報を付与して返却します。
        return Object.assign(stream, { key, ...metadata });
      } catch (ex) {
        if (ex instanceof KeyNotFoundError) {
          throw new ObjectNotFoundError({ key: String(key), cause: ex });
        }

        throw ex;
      } finally {
        lock.release();
      }
    } finally {
      lock.release();
    }
  }

  // -----------------------------------------------------------------------------------------------
  //
  // listObjects
  //
  // -----------------------------------------------------------------------------------------------

  /**
   * 指定されたオプションに基づいて条件に合致するオブジェクトの一覧を検索し、非同期ジェネレーターとして取得します。
   *
   * @template TSelect 各取得要素に含まれるメタデータの選択状態を表す型です。
   * @param options ページネーション設定や並び順、メタデータの抽出項目を指定するオプションです。
   * @returns オブジェクトのメタデータ要素を順次走査できる非同期ジェネレーターを返します。
   */
  public listObjects<const TSelect extends ListObjectsSelect = undefined>(
    options?: ListObjectsOptions<TSelect>,
  ): Promise<AsyncGenerator<ObjectMetadataListItem<TSelect>, void, unknown>>;

  /**
   * 特定の接頭辞を明示的に指定してオブジェクトの一覧を検索し、非同期ジェネレーターとして取得します。
   *
   * @template TSelect 各取得要素に含まれるメタデータの選択状態を表す型です。
   * @param prefix 検索対象とするオブジェクトキーの接頭辞です。
   * @param options ページネーション設定やメタデータの抽出項目を指定するオプションです。
   * @returns オブジェクトのメタデータ要素を順次走査できる非同期ジェネレーターを返します。
   */
  public listObjects<const TSelect extends ListObjectsSelect = undefined>(
    prefix: NonNullable<ListObjectsOptions["prefix"]>,
    options?: Omit<ListObjectsOptions<TSelect>, "prefix">,
  ): Promise<AsyncGenerator<ObjectMetadataListItem<TSelect>, void, unknown>>;

  /**
   * 条件に合致するオブジェクト一覧をページング付きで取得します。
   */
  public async listObjects(
    ...args: any
  ): Promise<AsyncGenerator<ObjectMetadataListItem, void, unknown>> {
    if (this.#con === null) {
      throw new ZRackIsNotOpenError();
    }

    const [options] = v.parseInput(ListObjectsArgsSchema, args);
    const { take, skip, order, prefix, select, signal: signalOption } = options;

    const { ac, db, mux } = this.#con;
    const signal = combineSignals([ac.signal, signalOption]);

    const lock = await asyncmux.readonly(this, signal);
    try {
      if (this.#con === null) {
        throw new ZRackIsNotOpenError();
      }

      // 複数件参照のため、キーを特定しない共有参照ロックを取得します。
      const lock = await mux.rLock({ signal });
      try {
        const iter = await db.findMany({
          take,
          skip,
          order: {
            collate: order.collate,
            direction: order.direction,
          },
          where: { prefix },
          select,
          signal,
        });

        return iter;
      } finally {
        lock.release();
      }
    } finally {
      lock.release();
    }
  }

  // -----------------------------------------------------------------------------------------------
  //
  // listDeletedObjects
  //
  // -----------------------------------------------------------------------------------------------

  // public async listDeletedObjects(): Promise<AsyncGenerator<void>> {
  //   throw new Error("実装されていません");
  // }

  // -----------------------------------------------------------------------------------------------
  //
  // search
  //
  // -----------------------------------------------------------------------------------------------

  /**
   * 指定された検索クエリーやオプションに基づいて条件に合致するオブジェクトを全文検索し、非同期ジェネレーターとして取得します。
   *
   * @template TSelect 各合致要素に含まれるメタデータの選択状態を表す型です。
   * @param options 全文検索クエリー文字列、スコアのしきい値、抽出項目などを指定するオプションです。
   * @returns 検索条件に合致したメタデータ要素を順次走査できる非同期ジェネレーターを返します。
   */
  public searchObjects<const TSelect extends SearchObjectsSelect = undefined>(
    options?: SearchObjectsOptions<TSelect>,
  ): Promise<AsyncGenerator<ObjectMetadataSearchItem<TSelect>, void, unknown>>;

  /**
   * 特定の接頭辞の範囲に限定し、検索クエリーに基づいてオブジェクトを全文検索して非同期ジェネレーターとして取得します。
   *
   * @template TSelect 各合致要素に含まれるメタデータの選択状態を表す型です。
   * @param query 全文検索クエリー文字列です。
   * @param options スコアのしきい値を指定するオプションです。
   * @returns 検索条件に合致したメタデータ要素を順次走査できる非同期ジェネレーターを返します。
   */
  public searchObjects<const TSelect extends SearchObjectsSelect = undefined>(
    query: NonNullable<SearchObjectsOptions["query"]>,
    options?: Omit<SearchObjectsOptions<TSelect>, "query">,
  ): Promise<AsyncGenerator<ObjectMetadataSearchItem<TSelect>, void, unknown>>;

  /**
   * 全文検索を実行します。
   */
  public async searchObjects(
    ...args: any
  ): Promise<AsyncGenerator<ObjectMetadataSearchItem, void, unknown>> {
    if (this.#con === null) {
      throw new ZRackIsNotOpenError();
    }

    const [options] = v.parseInput(SearchObjectsArgsSchema, args);
    const { take, skip, query, prefix, select, signal: signalOption, scoreGreaterThan } = options;

    const { ac, db, mux } = this.#con;
    const signal = combineSignals([ac.signal, signalOption]);

    const lock = await asyncmux.readonly(this, signal);
    try {
      if (this.#con === null) {
        throw new ZRackIsNotOpenError();
      }

      const lock = await mux.rLock({ signal });
      try {
        // メタデータ管理に登録されているトークン情報を元に、全文検索処理をデータベース側へ委譲します。
        const iter = await db.search({
          take,
          skip,
          query,
          where: {
            prefix,
            scoreGreaterThan,
          },
          select,
          signal,
        });

        return iter;
      } finally {
        lock.release();
      }
    } finally {
      lock.release();
    }
  }

  // -----------------------------------------------------------------------------------------------
  //
  // copyObject
  //
  // -----------------------------------------------------------------------------------------------

  // public async copyObject(): Promise<void> {
  //   throw new Error("実装されていません");
  // }

  // -----------------------------------------------------------------------------------------------
  //
  // renameObject
  //
  // -----------------------------------------------------------------------------------------------

  // public async renameObject(): Promise<void> {
  //   throw new Error("実装されていません");
  // }

  // -----------------------------------------------------------------------------------------------
  //
  // deleteObject
  //
  // -----------------------------------------------------------------------------------------------

  /**
   * オプションに指定された内容に基づいて、該当するオブジェクトをシステムから削除します。
   *
   * @param options 削除対象のオブジェクトキーやタイムスタンプを指定するオプションです。
   */
  public deleteObject(options: DeleteObjectOptions): Promise<void>;

  /**
   * キーを個別の引数として明示的に指定し、該当するオブジェクトをシステムから削除します。
   *
   * @param key 削除するオブジェクトを特定するための一意のキーです。
   * @param options 中断通知などを指定するオプションです。
   */
  public deleteObject(
    key: DeleteObjectOptions["key"],
    options?: Omit<DeleteObjectOptions, "key">,
  ): Promise<void>;

  /**
   * オブジェクトを削除します。
   */
  public async deleteObject(...args: any): Promise<void> {
    if (this.#con === null) {
      throw new ZRackIsNotOpenError();
    }

    const [options] = v.parseInput(DeleteObjectArgsSchema, args);
    const { key, signal: signalOption, timestamp } = options;

    const { ac, db, io, mux } = this.#con;
    const signal = combineSignals([ac.signal, signalOption]);

    const lock = await asyncmux.readonly(this, signal);
    try {
      if (this.#con === null) {
        throw new ZRackIsNotOpenError();
      }

      // 対象オブジェクトへの書き込み、変更を防ぐため排他ロックを取得します。
      const lock = await mux.lock({ key: String(key), signal });
      try {
        // 先にデータベース内のメタデータレコードを削除（論理的、または物理的にフラグ変更）します。
        const object = await db.delete({
          where: { key },
          signal,
          timestamp,
        });

        // メタデータに紐づいていた永続ストレージの実データを完全消去します。
        await io.delete({ key: object.entityId, signal });
        // 必要に応じて検索インデックスの同期や破棄の要求イベントをトリガーします。
        object.requestDeletingMetadata();
      } finally {
        lock.release();
      }
    } finally {
      lock.release();
    }
  }

  // -----------------------------------------------------------------------------------------------
  //
  // deleteObjects
  //
  // -----------------------------------------------------------------------------------------------

  // public async deleteObjects(): Promise<void> {
  //   throw new Error("実装されていません");
  // }

  // -----------------------------------------------------------------------------------------------
  //
  // getObjectMetadata
  //
  // -----------------------------------------------------------------------------------------------

  /**
   * 指定されたオプションに基づいてオブジェクトのメタデータ情報のみを抽出し、返却します。
   *
   * @template TSelect レスポンスに含めるメタデータの選択状態を表す型です。
   * @param options 対象のキーおよび抽出するプロパティー項目を指定するオプションです。
   * @returns 抽出されたメタデータオブジェクトを返します。
   */
  public getObjectMetadata<const TSelect extends GetObjectMetadataSelect = undefined>(
    options: GetObjectMetadataOptions<TSelect>,
  ): Promise<SelectedObjectMetadata<TSelect>>;

  /**
   * 対象のキーを指定して、オブジェクトのメタデータ情報のみを抽出して返却します。
   *
   * @template TSelect レスポンスに含めるメタデータの選択状態を表す型です。
   * @param key メタデータを取得したいオブジェクトのキーです。
   * @param options 追加の抽出項目などを指定するオプションです。
   * @returns 抽出されたメタデータオブジェクトを返します。
   */
  public getObjectMetadata<const TSelect extends GetObjectMetadataSelect = undefined>(
    key: GetObjectMetadataOptions["key"],
    options?: Omit<GetObjectMetadataOptions<TSelect>, "key">,
  ): Promise<SelectedObjectMetadata<TSelect>>;

  /**
   * 実データにアクセスせずメタデータのみを取得します。
   */
  public async getObjectMetadata(...args: any): Promise<SelectedObjectMetadata> {
    if (this.#con === null) {
      throw new ZRackIsNotOpenError();
    }

    const [options] = v.parseInput(GetObjectMetadataArgsSchema, args);
    const { key, select, signal: signalOption } = options;

    const { ac, db, mux } = this.#con;
    const signal = combineSignals([ac.signal, signalOption]);

    const lock = await asyncmux.readonly(this, signal);
    try {
      if (this.#con === null) {
        throw new ZRackIsNotOpenError();
      }

      const lock = await mux.rLock({ key: String(key), signal });
      try {
        const metadata = await db.findOne({
          where: { key },
          select,
          signal,
        });

        // 呼び出し元が扱いやすいよう、元のキーと抽出結果を平坦に結合します。
        return metadata;
      } catch (ex) {
        if (ex instanceof KeyNotFoundError) {
          throw new ObjectNotFoundError({ key: String(key), cause: ex });
        }

        throw ex;
      } finally {
        lock.release();
      }
    } finally {
      lock.release();
    }
  }

  // -----------------------------------------------------------------------------------------------
  //
  // updateObjectMetadata
  //
  // -----------------------------------------------------------------------------------------------

  /**
   * 指定されたオプション情報を用いて、既存オブジェクトの各種メタデータを書き換えます。
   *
   * @param options 更新対象のキーや、書き換える内容（説明、言語、タグなど）を含むオプションです。
   */
  public updateObjectMetadata(options: UpdateObjectMetadataOptions): Promise<void>;

  /**
   * キーを指定したうえで、該当するオブジェクトのメタデータを任意の内容に書き換えます。
   *
   * @param key 更新を適用するオブジェクトの一意のキーです。
   * @param options 書き換える内容（説明、言語、タグなど）を含むオプションです。
   */
  public updateObjectMetadata(
    key: UpdateObjectMetadataOptions["key"],
    options: Omit<UpdateObjectMetadataOptions, "key">,
  ): Promise<void>;

  /**
   * 既存メタデータを更新します。
   */
  public async updateObjectMetadata(...args: any): Promise<void> {
    if (this.#con === null) {
      throw new ZRackIsNotOpenError();
    }

    const [options] = v.parseInput(UpdateObjectMetadataArgsSchema, args);
    const {
      key,
      tags,
      signal: signalOption,
      language: langOption,
      mimeType,
      timestamp,
      description,
      userMetadata,
    } = options;

    const { ac, db, ts, mux } = this.#con;
    const signal = combineSignals([ac.signal, signalOption]);

    const lock = await asyncmux.readonly(this, signal);
    try {
      if (this.#con === null) {
        throw new ZRackIsNotOpenError();
      }

      // 詳細説明文の変更が含まれる場合、新たな説明文に基づいて言語判定およびトークン抽出を再構成します。
      const language =
        description == null
          ? langOption
          : (langOption ?? (await ts.detectLanguage(signal, description)));
      let searchText: SearchText | null | undefined;
      if (description == null || ts.textConfig !== "simple") {
        searchText = description;
      } else {
        const normalized = await ts.normalize(signal, language!, description);
        searchText = await ts.tokenize(signal, language!, normalized);
      }

      // 対象キーへの変更を制限するために排他ロックをかけて更新を適用します。
      const lock = await mux.lock({ key: String(key), signal });
      try {
        await db.update({
          tags,
          where: { key },
          signal,
          language,
          mimeType,
          timestamp,
          searchText,
          description,
          userMetadata,
        });
      } finally {
        lock.release();
      }
    } finally {
      lock.release();
    }
  }

  // -----------------------------------------------------------------------------------------------
  //
  // stat
  //
  // -----------------------------------------------------------------------------------------------

  // public async stat(): Promise<void> {
  //   throw new Error("実装されていません");
  // }

  // -----------------------------------------------------------------------------------------------
  //
  // exists
  //
  // -----------------------------------------------------------------------------------------------

  /**
   * 指定されたオプションに基づいて、特定のオブジェクトメタデータが存在するかを調べます。
   *
   * @param options 対象のキー情報を格納したオプションです。
   * @returns 存在すれば真 true、存在しなければ false を返します。
   */
  public existsMetadata(options: ExistsMetadataOptions): Promise<boolean>;

  /**
   * 特定のキーを直接指定して、該当するオブジェクトメタデータが存在するかを調べます。
   *
   * @param key 存在を確認したいオブジェクトのキーです。
   * @param options 中断検知用のシグナルなどを含むオプションです。
   * @returns 存在すれば true、存在しなければ偽 false を返します。
   */
  public existsMetadata(
    key: ExistsMetadataOptions["key"],
    options?: Omit<ExistsMetadataOptions, "key">,
  ): Promise<boolean>;

  /**
   * メタデータの存在確認を実行します。
   */
  public async existsMetadata(...args: any): Promise<boolean> {
    if (this.#con === null) {
      throw new ZRackIsNotOpenError();
    }

    const [options] = v.parseInput(ExistsMetadataArgsSchema, args);
    const { key, signal: signalOption } = options;

    const { ac, db, mux } = this.#con;
    const signal = combineSignals([ac.signal, signalOption]);

    const lock = await asyncmux.readonly(this, signal);
    try {
      if (this.#con === null) {
        throw new ZRackIsNotOpenError();
      }

      const lock = await mux.rLock({ key: String(key), signal });
      try {
        const exists = await db.exists({
          where: { key },
          signal,
        });

        return exists;
      } finally {
        lock.release();
      }
    } finally {
      lock.release();
    }
  }
}
