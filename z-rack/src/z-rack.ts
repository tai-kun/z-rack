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
import { ZRackIsOpenError, ZRackIsNotOpenError, ObjectNotFoundError } from "./errors.js";

// -------------------------------------------------------------------------------------------------
//
// ユーティリティー
//
// -------------------------------------------------------------------------------------------------

const B = 1;
const KB = 1000 * B;
const MB = 1000 * KB;
const GB = 1000 * MB;

/**
 * `@noble/hashes` の制限に基づく、 1 回のハッシュ更新処理で扱える最大チャンクサイズです。
 *
 * @see https://github.com/paulmillr/noble-hashes/blob/2.2.0/README.md?plain=1#L97
 */
const MAX_CHUNK_SIZE = 4 * GB;

type $ValueOf<T> = T[keyof T];

type $Simplify<T> = { [P in keyof T]: T[P] } & {};

type SelectedColumns<S> = $ValueOf<{ [P in keyof S]: S[P] extends true ? P : never }>;

type SelectableColumns<S> = $ValueOf<{ [P in keyof S]: true extends S[P] ? P : never }>;

export type $Select<
  TRow extends { readonly [_ in string]: unknown },
  TSelect extends { readonly [_ in keyof TRow]?: boolean | undefined },
> = $Simplify<
  { [P in SelectedColumns<Pick<TSelect, Extract<keyof TSelect, keyof TRow>>>]-?: TRow[P] } & {
    [P in SelectableColumns<Pick<TSelect, Extract<keyof TSelect, keyof TRow>>>]+?: TRow[P];
  }
>;

type $NormalizeSelect<
  TSelect extends boolean | undefined | { readonly [_ in string]?: boolean | undefined },
  TNotSet extends boolean,
> = TSelect extends undefined
  ? { readonly [_ in keyof Exclude<TSelect, boolean | undefined>]-?: TNotSet }
  : TSelect extends boolean
    ? { readonly [_ in keyof Exclude<TSelect, boolean | undefined>]-?: Extract<TSelect, boolean> }
    : TSelect extends { readonly [_ in string]?: boolean | undefined }
      ? { readonly [P in keyof TSelect]-?: TSelect[P] extends undefined ? false : TSelect[P] }
      : never;

const record = <const TValue, const TKey extends string>(value: TValue, keys: readonly TKey[]) =>
  Object.fromEntries(keys.map((key) => [key, value])) as Record<TKey, TValue>;

// -------------------------------------------------------------------------------------------------
//
// 入力パラメーター
//
// -------------------------------------------------------------------------------------------------

const SetupParamsSchema = v.object({
  textSearch: v.any(),
  storageSystem: v.instance(UniKvs),
  databaseSchema: v.optional(v.string(), "public"),
  databaseClient: v.any(),
});

export type StorageSystem = UniKvs<Record<string, Value<Uint8Array<ArrayBuffer>>>>;

export type SetupParams = {
  readonly databaseClient: IDatabaseClient;

  readonly storageSystem: StorageSystem;

  readonly textSearch: ITextSearch;

  readonly databaseSchema?: string | undefined;
};

export type SetupFunctionArgs = {
  signal: AbortSignal;
};

export interface SetupFunction {
  (args: SetupFunctionArgs): MaybePromise<SetupParams>;
}

// -------------------------------------------------------------------------------------------------

const OpenOptionsSchema = v.object({
  signal: v.optional(v.instance(AbortSignal)),
});

export type OpenOptions = v.InferInput<typeof OpenOptionsSchema>;

const CloseOptionsSchema = v.object({
  signal: v.optional(v.instance(AbortSignal)),
});

export type CloseOptions = v.InferInput<typeof CloseOptionsSchema>;

// -------------------------------------------------------------------------------------------------

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

export type PutObjectOptions = v.InferInput<typeof PutObjectOptionsSchema>;

// -------------------------------------------------------------------------------------------------

export type ObjectMetadata = {
  id: string;
  recordType: "CREATE" | "UPDATE_METADATA";
  recordTimestamp: number;
  key: ObjectKey;
  size: number;
  mimeType: MimeTypeLike;
  eTag: string;
  createdAt: number;
  lastModifiedAt: number;
  language: LanguageLike;
  description: string | null;
  tags: string[];
  userMetadata: unknown;
};

// -------------------------------------------------------------------------------------------------

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
    GetObjectSelectRecord(false),
  ),
  signal: v.optional(v.instance(AbortSignal)),
});

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

export type GetObjectSelect = v.InferInput<typeof GetObjectOptionsSchema>["select"];

export type GetObjectOptions<TSelect extends GetObjectSelect = GetObjectSelect> = Omit<
  v.InferInput<typeof GetObjectOptionsSchema>,
  "select"
> & {
  readonly select?: TSelect;
};

export type ObjectFile<TSelect extends GetObjectSelect = GetObjectSelect> = File &
  $Select<
    Pick<ObjectMetadata, keyof Exclude<GetObjectSelect, boolean | undefined>>,
    $NormalizeSelect<TSelect, false>
  > &
  Pick<ObjectMetadata, "key" | "mimeType" | "lastModifiedAt">;

// -------------------------------------------------------------------------------------------------

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
    GetObjectStreamSelectRecord(false),
  ),
  signal: v.optional(v.instance(AbortSignal)),
});

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

export type GetObjectStreamSelect = v.InferInput<typeof GetObjectStreamOptionsSchema>["select"];

export type GetObjectStreamOptions<TSelect extends GetObjectStreamSelect = GetObjectStreamSelect> =
  Omit<v.InferInput<typeof GetObjectStreamOptionsSchema>, "select"> & {
    readonly select?: TSelect;
  };

export type ObjectStream<TSelect extends GetObjectStreamSelect = GetObjectStreamSelect> =
  ValueStream<Uint8Array<ArrayBuffer>> &
    $Select<
      Pick<ObjectMetadata, keyof Exclude<GetObjectStreamSelect, boolean | undefined>>,
      $NormalizeSelect<TSelect, false>
    > &
    Pick<ObjectMetadata, "key">;

// -------------------------------------------------------------------------------------------------

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
    ListObjectsSelectRecord(true),
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

export type ListObjectsSelect = v.InferInput<typeof ListObjectsOptionsSchema>["select"];

export type ListObjectsOptions<TSelect extends ListObjectsSelect = ListObjectsSelect> = Omit<
  v.InferInput<typeof ListObjectsOptionsSchema>,
  "select"
> & {
  readonly select?: TSelect;
};

export type ObjectMetadataListItem<TSelect extends ListObjectsSelect = ListObjectsSelect> =
  ValueStream<Uint8Array<ArrayBuffer>> &
    $Select<
      Pick<ObjectMetadata, keyof Exclude<ListObjectsSelect, boolean | undefined>>,
      $NormalizeSelect<TSelect, true>
    >;

// -------------------------------------------------------------------------------------------------

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
    SearchObjectsSelectRecord(true),
  ),
  signal: v.optional(v.instance(AbortSignal)),
  scoreGreaterThan: v.optional(v.pipe(v.number(), v.finite()), 0),
});

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

export type SearchObjectsSelect = v.InferInput<typeof SearchObjectsOptionsSchema>["select"];

export type SearchObjectsOptions<TSelect extends SearchObjectsSelect = SearchObjectsSelect> = Omit<
  v.InferInput<typeof SearchObjectsOptionsSchema>,
  "select"
> & {
  readonly select?: TSelect;
};

export type ObjectMetadataSearchItem<TSelect extends SearchObjectsSelect = SearchObjectsSelect> =
  ValueStream<Uint8Array<ArrayBuffer>> &
    $Select<
      Pick<ObjectMetadata, keyof Exclude<SearchObjectsSelect, boolean | undefined>>,
      $NormalizeSelect<TSelect, true>
    >;

// -------------------------------------------------------------------------------------------------

const DeleteObjectOptionsSchema = v.object({
  key: ObjectKeySchema,
  signal: v.optional(v.instance(AbortSignal)),
  timestamp: v.optional(TimestampSchema),
});

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

export type DeleteObjectOptions = v.InferInput<typeof DeleteObjectOptionsSchema>;

// -------------------------------------------------------------------------------------------------

const ExistsMetadataOptionsSchema = v.object({
  key: ObjectKeySchema,
  signal: v.optional(v.instance(AbortSignal)),
});

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

export type ExistsMetadataOptions = v.InferInput<typeof ExistsMetadataOptionsSchema>;

// -------------------------------------------------------------------------------------------------

const GetObjectMetadataSelectRecord = <const TValue>(value: TValue) =>
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
    GetObjectMetadataSelectRecord(false),
  ),
  signal: v.optional(v.instance(AbortSignal)),
});

const GetObjectMetadataArgsSchema = v.union([
  v.tuple([GetObjectOptionsSchema]),
  v.pipe(
    v.tuple([
      GetObjectOptionsSchema.entries.key,
      v.optional(v.omit(GetObjectOptionsSchema, ["key"]), {
        select: GetObjectMetadataOptionsSchema.entries.select.default,
        signal: GetObjectMetadataOptionsSchema.entries.signal.default,
      }),
    ]),
    v.transform(([key, options]) => [{ key, ...options }]),
  ),
]);

export type GetObjectMetadataSelect = v.InferInput<typeof GetObjectMetadataOptionsSchema>["select"];

export type GetObjectMetadataOptions<
  TSelect extends GetObjectMetadataSelect = GetObjectMetadataSelect,
> = Omit<v.InferInput<typeof GetObjectMetadataOptionsSchema>, "select"> & {
  readonly select?: TSelect;
};

export type SelectedObjectMetadata<
  TSelect extends GetObjectMetadataSelect = GetObjectMetadataSelect,
> = $Select<
  Pick<ObjectMetadata, keyof Exclude<GetObjectMetadataSelect, boolean | undefined>>,
  $NormalizeSelect<TSelect, false>
> &
  Pick<ObjectMetadata, "key">;

// -------------------------------------------------------------------------------------------------

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

export type UpdateObjectMetadataOptions = v.InferInput<typeof UpdateObjectMetadataOptionsSchema>;

// -------------------------------------------------------------------------------------------------
//
// ZRack クラス
//
// -------------------------------------------------------------------------------------------------

function parseSetupParams(params: SetupParams) {
  const { textSearch, storageSystem, databaseClient, databaseSchema } = v.parseInput(
    SetupParamsSchema,
    params,
  );

  const ts = new TextSearch(textSearch);
  const db = new Metabase(databaseClient, databaseSchema, ts);
  const io = storageSystem;

  return { db, io, ts };
}

type Connection = {
  readonly ac: AbortController;
  readonly db: Metabase;
  readonly io: StorageSystem;
  readonly ts: TextSearch;
  readonly mux: Asyncmux;
  readonly close: {
    readonly db: boolean;
    readonly io: boolean;
    readonly ts: boolean;
  };
};

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

  public get isOpen(): boolean {
    return this.#con !== null;
  }

  // -----------------------------------------------------------------------------------------------
  //
  // open
  //
  // -----------------------------------------------------------------------------------------------

  public async open(options: OpenOptions = {}): Promise<AsyncDisposable> {
    if (this.#con !== null) {
      throw new ZRackIsOpenError();
    }

    const { signal: signalOption } = v.parseInput(OpenOptionsSchema, options);

    const ac = new AbortController();
    const signal = combineSignals([ac.signal, signalOption]);

    signal.throwIfAborted();

    this.#acSet.add(ac);

    const lock = await asyncmux(this, signal);
    const ds = new AsyncDisposableStack();
    try {
      if (this.#con !== null) {
        throw new ZRackIsOpenError();
      }

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

      if (!ts.isOpen) {
        close.ts = true;

        await ts.open(signal);

        ds.defer(async () => {
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

      if (!db.isOpen) {
        close.db = true;

        try {
          await db.open(signal);
        } catch (ex) {
          throw (err = ex);
        }

        ds.defer(async () => {
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

      if (!io.isOpen) {
        close.io = true;

        const context = { "z-rack:action": "open" };
        try {
          await io.open({ signal, context });
        } catch (ex) {
          throw (err = ex);
        }

        ds.defer(async () => {
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
      await ds.disposeAsync();
      this.#acSet.delete(ac);
      lock.release();
    }
  }

  // -----------------------------------------------------------------------------------------------
  //
  // close
  //
  // -----------------------------------------------------------------------------------------------

  async #close(signal: AbortSignal, con: Connection): Promise<void> {
    const lock = await asyncmux(this, signal);
    try {
      if (this.#con !== con) {
        throw new ZRackIsNotOpenError();
      }

      const { db, io, ts, close } = this.#con;

      try {
        const abortPromise = createAbortPromise(signal);
        await Promise.race([this.#tasks.wait(), abortPromise]);
      } catch (ex) {
        logger.error`ZRack.close: Failed to finalize tasks: ${ex}`;
      }

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

  public get ready(): Promise<void> {
    return Promise.try(async () => {
      if (this.#con === null) {
        throw new ZRackIsNotOpenError();
      }

      const { ac } = this.#con;
      const abortPromise = createAbortPromise(ac.signal);
      await Promise.race([abortPromise, this.#con.db.ready()]);
    });
  }

  // -----------------------------------------------------------------------------------------------
  //
  // putObject
  //
  // -----------------------------------------------------------------------------------------------

  public putObject(options: PutObjectOptions): Promise<void>;

  public putObject(
    key: PutObjectOptions["key"],
    data: PutObjectOptions["data"],
    options?: Omit<PutObjectOptions, "key" | "data">,
  ): Promise<void>;

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

    const lock = await asyncmux.readonly(this, signal);
    try {
      if (this.#con === null) {
        throw new ZRackIsNotOpenError();
      }

      const ds = new DisposableStack();
      const lock = await mux.lock({ key: String(key), signal });
      try {
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
        if (value instanceof Uint8Array) {
          eTag = entityTag.digest(value);
          size = value.byteLength;
        } else {
          const hasher = entityTag.hasher();
          value = value.pipeThrough(
            new TransformStream({
              transform(chunk, controller) {
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
        await io.set({
          key: entityId,
          value,
          signal,
        });

        let err: unknown = nil;

        ds.defer(() => {
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

        try {
          await db.create({
            eTag,
            key,
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
          throw (err = ex);
        }
      } finally {
        lock.release();
        ds.dispose();
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

  public getObject<const TSelect extends GetObjectSelect = undefined>(
    options: GetObjectOptions<TSelect>,
  ): Promise<ObjectFile<TSelect>>;

  public getObject<const TSelect extends GetObjectSelect = undefined>(
    key: GetObjectOptions["key"],
    options?: Omit<GetObjectOptions<TSelect>, "key">,
  ): Promise<ObjectFile<TSelect>>;

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

        const data = await io.get({ key: entityId!, signal });
        const file = new File([data], key.basename, {
          type: metadata.mimeType!,
          lastModified: metadata.lastModifiedAt!,
        });

        // @ts-expect-error
        return Object.assign(file, { key, ...metadata });
      } catch (ex) {
        if (ex instanceof KeyNotFoundError) {
          throw new ObjectNotFoundError({ key: String(key) }, { cause: ex });
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

  public getObjectStream<const TSelect extends GetObjectStreamSelect = undefined>(
    options: GetObjectStreamOptions<TSelect>,
  ): Promise<ObjectStream<TSelect>>;

  public getObjectStream<const TSelect extends GetObjectStreamSelect = undefined>(
    key: GetObjectStreamOptions["key"],
    options?: Omit<GetObjectStreamOptions<TSelect>, "key">,
  ): Promise<ObjectStream<TSelect>>;

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

        const stream = await io.stream({ key: entityId!, signal });

        // @ts-expect-error
        return Object.assign(stream, { key, ...metadata });
      } catch (ex) {
        if (ex instanceof KeyNotFoundError) {
          throw new ObjectNotFoundError({ key: String(key) }, { cause: ex });
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

  public listObjects<const TSelect extends ListObjectsSelect = undefined>(
    options?: ListObjectsOptions<TSelect>,
  ): Promise<AsyncGenerator<ObjectMetadataListItem<TSelect>, void, unknown>>;

  public listObjects<const TSelect extends ListObjectsSelect = undefined>(
    prefix: NonNullable<ListObjectsOptions["prefix"]>,
    options?: Omit<ListObjectsOptions<TSelect>, "prefix">,
  ): Promise<AsyncGenerator<ObjectMetadataListItem<TSelect>, void, unknown>>;

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

        // @ts-expect-error
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

  public searchObjects<const TSelect extends SearchObjectsSelect = undefined>(
    options?: SearchObjectsOptions<TSelect>,
  ): Promise<AsyncGenerator<ObjectMetadataSearchItem<TSelect>, void, unknown>>;

  public searchObjects<const TSelect extends SearchObjectsSelect = undefined>(
    prefix: NonNullable<SearchObjectsOptions["prefix"]>,
    options?: Omit<SearchObjectsOptions<TSelect>, "prefix">,
  ): Promise<AsyncGenerator<ObjectMetadataSearchItem<TSelect>, void, unknown>>;

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

        // @ts-expect-error
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

  public async renameObject(): Promise<void> {
    throw new Error("実装されていません");
  }

  // -----------------------------------------------------------------------------------------------
  //
  // deleteObject
  //
  // -----------------------------------------------------------------------------------------------

  public deleteObject(options: DeleteObjectOptions): Promise<void>;

  public deleteObject(
    key: DeleteObjectOptions["key"],
    options?: Omit<DeleteObjectOptions, "key">,
  ): Promise<void>;

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

      const lock = await mux.lock({ key: String(key), signal });
      try {
        const object = await db.delete({
          where: { key },
          signal,
          timestamp,
        });

        await io.delete({ key: object.entityId, signal });
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

  public getObjectMetadata<const TSelect extends GetObjectMetadataSelect = undefined>(
    options: GetObjectMetadataOptions<TSelect>,
  ): Promise<SelectedObjectMetadata<TSelect>>;

  public getObjectMetadata<const TSelect extends GetObjectMetadataSelect = undefined>(
    key: GetObjectMetadataOptions["key"],
    options?: Omit<GetObjectMetadataOptions<TSelect>, "key">,
  ): Promise<SelectedObjectMetadata<TSelect>>;

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

        // @ts-expect-error
        return { key, ...metadata };
      } catch (ex) {
        if (ex instanceof KeyNotFoundError) {
          throw new ObjectNotFoundError({ key: String(key) }, { cause: ex });
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

  public updateObjectMetadata(options: UpdateObjectMetadataOptions): Promise<void>;

  public updateObjectMetadata(
    key: UpdateObjectMetadataOptions["key"],
    options: Omit<UpdateObjectMetadataOptions, "key">,
  ): Promise<void>;

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

  public existsMetadata(options: ExistsMetadataOptions): Promise<boolean>;

  public existsMetadata(
    key: ExistsMetadataOptions["key"],
    options?: Omit<ExistsMetadataOptions, "key">,
  ): Promise<boolean>;

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
