import { uuid58Encode } from "@nakanoaas/uuid58";
import { sha256 } from "@noble/hashes/sha2.js";
import {
  type Uint,
  type EntityId,
  type Language,
  type MimeType,
  type ObjectId,
  type CreatedAt,
  type EntityTag,
  type Timestamp,
  type ObjectSize,
  type ObjectTags,
  type SearchText,
  type Description,
  type UserMetadata,
  type LastModifiedAt,
  type OrderDirection,
  type IDatabaseClient,
  type ObjectKeyPrefix,
  type RecordTimestamp,
  type TextSearchFormat,
  type CreatedRecordType,
  v,
  nil,
  utf8,
  isError,
  ObjectKey,
  IdleTaskQueue,
  EntityIdSchema,
  ObjectIdSchema,
  TimestampSchema,
  UnexpectedError,
} from "@z-rack/core";
import bs58 from "bs58";
import { sql } from "pgsql-template-tag";

import DatabaseClient from "./_database-client.js";
import getUUIDv7 from "./_get-uuid-v7.js";
import logger from "./_logger.js";
import { MetadataSelectResultSchema } from "./_sql/_schemas.js";
import { CreateMetadataSql, CreateMetadataOverwriteSql } from "./_sql/create.js";
import {
  DeleteMetadataSql,
  UpdateMetadataDeletedSql,
  UpdateMetadataDeletedResultSchema,
} from "./_sql/delete.js";
import { ExistsMetadataSql, ExistsMetadataResultSchema } from "./_sql/exists.js";
import {
  FindManyMetadataSelectSql,
  FindManyMetadataPaginationSql,
  FindManyMetadataBasicConditionsSql,
  FindManyMetadataKeyPrefixConditionSql,
  FindManyMetadataPathSegmentConditionSql,
  FindManyMetadataKeyOrderWithCollationSql,
  FindManyMetadataPathSegmentsConditionSql,
  FindManyMetadataKeyOrderWithoutCollationSql,
  FindManyMetadataDistinctOnBasenameAndKindSql,
  FindManyMetadataBasenameOrderWithCollationSql,
  FindManyMetadataBasenameOrderWithoutCollationSql,
} from "./_sql/find-many.js";
import {
  FindOneMetadataSelectSql,
  FindOneMetadataResultSchema,
  FindOneMetadataConditionsSql,
} from "./_sql/find-one.js";
import { RegisterEntityIdSql } from "./_sql/get-entity-id.js";
import { RegisterObjectIdSql } from "./_sql/get-object-id.js";
import migrations_prelude from "./_sql/migrations/000000000000_prelude.js";
import migrations_init from "./_sql/migrations/202605081732_init.js";
import {
  CreateMigrationSql,
  FinishMigrationSql,
  UpdateSearchTextSql,
  FindLatestMigrationSql,
  FindDirtyDescriptionSql,
  FindAllCollationNamesSql,
  CreatePgTextsearchIndexSql,
  DeletePgTextsearchIndexSql,
  CreatePgTextsearchExtensionSql,
  CreateTextSearchFormatConfigSql,
  FindLatestMigrationResultSchema,
  FindDirtyDescriptionResultSchema,
  FindAllCollationNamesResultSchema,
  FindTextSearchFormatHashConfigSql,
  UpdateTextSearchFormatHashConfigSql,
  UpdateTextSearchFormatNameConfigSql,
  FindTextSearchFormatHashConfigResultSchema,
} from "./_sql/open.js";
import {
  IdColumnSql,
  KeyColumnSql,
  ETagColumnSql,
  SizeColumnSql,
  TagsColumnSql,
  EntityIdColumnSql,
  LanguageColumnSql,
  MimeTypeColumnSql,
  CreatedAtColumnSql,
  RecordTypeColumnSql,
  DescriptionColumnSql,
  UserMetadataColumnSql,
  LastModifiedAtColumnSql,
  RecordTimestampColumnSql,
} from "./_sql/private-metadata-columns.js";
import {
  SearchMetadataSelectSql,
  SearchMetadataScoreConditionSql,
  SearchMetadataBasicConditionsSql,
  SearchMetadataKeyPrefixConditionSql,
  SearchMetadataOrderAndPaginationSql,
  SearchMetadataPathSegmentConditionSql,
  SearchMetadataPathSegmentsConditionSql,
} from "./_sql/search.js";
import {
  UpdateTagsColumnSql,
  UpdateMetadataBaseSql,
  UpdateLanguageColumnSql,
  UpdateMimeTypeColumnSql,
  UpdateSearchTextColumnSql,
  UpdateDescriptionColumnSql,
  UpdateMetadataConditionSql,
  UpdateMetadataResultSchema,
  UpdateUserMetadataColumnSql,
  UpdateLastModifiedAtColumnSql,
  UpdateRecordTimestampColumnSql,
} from "./_sql/update.js";
import stringifyUUID from "./_stringify-uuid.js";
import type TextSearch from "./_text-search.js";
import { ObjectExistsError, ObjectNotFoundError } from "./errors.js";

/**
 * データベースのマイグレーション定義です。
 */
const MIGRATIONS = {
  "202605081732_init": migrations_init,
};

/**
 * 文字列のハッシュを計算し、テキスト検索用のフォーマットとして返します。
 *
 * @param s ハッシュ化する文字列です。
 * @returns 計算されたテキスト検索フォーマットのハッシュ値です。
 */
function hash(s: string): TextSearchFormat {
  let h = bs58.encode(sha256(utf8.encode(s)));
  if (h.length < 44) {
    h = h.padStart(44, "0");
  }

  return h as TextSearchFormat;
}

/**
 * 値を JSON 文字列に変換します。
 *
 * @param x 変換する値です。
 * @returns JSON 形式の文字列です。
 */
function json(x: unknown): string {
  return JSON.stringify(x ?? null);
}

/**
 * メタデータのデータベース操作を管理するクラスです。
 */
export default class Metabase {
  /**
   * データベースクライアントのインスタンスです。
   */
  private readonly db: DatabaseClient;

  /**
   * テキスト検索の管理インスタンスです。
   */
  private readonly ts: TextSearch;

  /**
   * 使用するデータベースのテーブル名のマッピングです。
   */
  private readonly tables: Readonly<
    Record<
      | "configTable"
      | "entityIdsTable"
      | "objectIdsTable"
      | "migrationsTable"
      | "publicMetadataTable"
      | "privateMetadataTable",
      sql.Sql<readonly []>
    >
  >;

  /**
   * 削除処理のバックグラウンドタスクキューです。
   */
  private readonly deleteTasks: IdleTaskQueue;

  /**
   * マイグレーション処理のバックグラウンドタスクキューです。
   */
  private readonly migrationTasks: IdleTaskQueue;

  /**
   * テキスト検索フォーマットのハッシュ値です。
   */
  private textSearchFormat!: TextSearchFormat;

  /**
   * 照合順序（コレーション）名のバリデーション用スキーマです。
   */
  public readonly collationNamesSchema!: v.BaseSchema<string, string, v.BaseIssue<string>>;

  /**
   * クラスのインスタンスを初期化します。
   *
   * @param db データベースクライアントのインターフェースです。
   * @param schema 使用するデータベースのスキーマ名です。
   * @param ts テキスト検索の管理インスタンスです。
   */
  public constructor(db: IDatabaseClient, schema: string, ts: TextSearch) {
    schema = sql.ident(schema);
    this.db = new DatabaseClient(db);
    this.ts = ts;
    this.tables = {
      configTable: sql.raw(`${schema}."_z_rack-config"`),
      entityIdsTable: sql.raw(`${schema}."_z_rack-entity_ids"`),
      objectIdsTable: sql.raw(`${schema}."_z_rack-object_ids"`),
      migrationsTable: sql.raw(`${schema}."_z_rack-migrations"`),
      publicMetadataTable: sql.raw(`${schema}."z_rack_metadata"`),
      privateMetadataTable: sql.raw(`${schema}."_z_rack-metadata"`),
    };
    this.deleteTasks = new IdleTaskQueue();
    this.migrationTasks = new IdleTaskQueue();
  }

  // -----------------------------------------------------------------------------------------------
  //
  // isOpen
  //
  // -----------------------------------------------------------------------------------------------

  /**
   * データベースの接続が開いているかどうかを示す真偽値です。
   */
  public get isOpen(): boolean {
    return this.db.isOpen;
  }

  // -----------------------------------------------------------------------------------------------
  //
  // open
  //
  // -----------------------------------------------------------------------------------------------

  /**
   * データベース接続を開き、初期化処理やマイグレーションを実行します。
   *
   * @param signal 処理を中断するための中断シグナルです。
   * @returns 処理の完了を表す Promise です。
   */
  public async open(signal: AbortSignal): Promise<void> {
    /** 途中でエラーが発生したときにクリーンアップ処理を行うスタックです。 */
    const ds = new AsyncDisposableStack();
    const defer = ds.defer.bind(ds);
    const dispose = ds.disposeAsync.bind(ds);
    try {
      let err: unknown = nil;

      // データベースクライアントを開きます。
      await this.db.open(signal);

      // エラー発生時に確実にデータベースを閉じるための処理を登録します。
      defer(async () => {
        if (err === nil) {
          return;
        }

        try {
          await this.db.close(signal, err);
        } catch (ex) {
          logger.error`Metabase.open: Failed to close database client: ${ex}`;
        }
      });

      try {
        // トランザクション内で初期化およびマイグレーションを実行します。
        await this.db.transaction(signal, async (tx) => {
          // マイグレーションの前提となる SQL を実行します。
          for (const sql of migrations_prelude) {
            await tx.query(sql.fillAll(this.tables));
          }

          // マイグレーションを名前の昇順でソートします。
          const migrations = Object.entries(MIGRATIONS).sort(([a], [b]) =>
            a.localeCompare(b, "en"),
          );

          // 最後に実行されたマイグレーションの履歴を取得します。
          const lastMigration = await tx
            .query(FindLatestMigrationSql.fillAll(this.tables))
            .collect()
            .then((rows) => v.expect(FindLatestMigrationResultSchema, rows));

          // 各マイグレーションを順に適用します。
          for (let i = 0; i < migrations.length; i++) {
            const [name, sqls] = migrations[i]!;
            if (
              lastMigration?.finishedAt != null &&
              lastMigration.name.localeCompare(name, "en") <= 0
            ) {
              // 既に適用済みのマイグレーションはスキップします。
              continue;
            }

            // 未適用のマイグレーションを実行します。
            for (; i < migrations.length; i++) {
              await tx.query(CreateMigrationSql.fillAll({ ...this.tables, name }));

              for (const sql of sqls) {
                // @ts-expect-error
                const query = sql.fillAll(this.tables);
                await tx.query(query);
              }

              await tx.query(FinishMigrationSql.fillAll({ ...this.tables, name }));
            }
          }

          // PostgreSQL のテキスト検索拡張機能を作成します。
          await tx.query(CreatePgTextsearchExtensionSql);

          // テキスト検索フォーマットのハッシュ値を計算して既存の設定と比較し、異なっていればインデックスを作り直しtます。
          const textSearchFormat = hash(this.ts.format);
          const textSearchFormatHash = await tx
            .query(FindTextSearchFormatHashConfigSql.fillAll(this.tables))
            .collect()
            .then((rows) => v.expect(FindTextSearchFormatHashConfigResultSchema, rows));
          let shouldCreateIndex: boolean;
          if (textSearchFormatHash === undefined) {
            await tx.query(
              CreateTextSearchFormatConfigSql.fillAll({
                ...this.tables,
                textSearchFormatName: json(this.ts.format),
                textSearchFormatHash: json(textSearchFormat),
              }),
            );

            shouldCreateIndex = true;
          } else if (textSearchFormatHash !== textSearchFormat) {
            await tx.query(
              UpdateTextSearchFormatNameConfigSql.fillAll({
                ...this.tables,
                textSearchFormatName: json(this.ts.format),
              }),
            );
            await tx.query(
              UpdateTextSearchFormatHashConfigSql.fillAll({
                ...this.tables,
                textSearchFormatHash: json(textSearchFormat),
              }),
            );

            shouldCreateIndex = true;
          } else {
            shouldCreateIndex = false;
          }

          this.textSearchFormat = textSearchFormat;

          if (shouldCreateIndex) {
            await tx.query(DeletePgTextsearchIndexSql);
            await tx.query(
              CreatePgTextsearchIndexSql.fillAll({
                ...this.tables,
                bm25B: sql.raw(this.ts.bm25Params.b.toString(10)),
                bm25K1: sql.raw(this.ts.bm25Params.k1.toString(10)),
                textConfig: sql.raw(sql.literal(this.ts.textConfig)),
                textSearchFormat: sql.raw(sql.literal(this.textSearchFormat)),
              }),
            );
          }
        });

        this.db.requestFlush();

        // 検索テキストのマイグレーション用バックグラウンドタスクを登録します。
        this.migrationTasks.add(async (signal) => {
          const { textSearchFormat } = this;
          const migrationTarget = await this.db
            .query(
              signal,
              FindDirtyDescriptionSql.fillAll({
                ...this.tables,
                textSearchFormat,
              }),
            )
            .collect()
            .then((rows) => v.expect(FindDirtyDescriptionResultSchema, rows));
          if (migrationTarget === undefined) {
            // 対象が存在しない場合はタスクを終了します。
            return;
          }

          const { objectId, language, description } = migrationTarget;
          let searchText = await this.ts.normalize(signal, language, description);
          if (this.ts.textConfig === "simple") {
            // 設定が "simple" の場合はトークナイズを行います。
            searchText = await this.ts.tokenize(signal, language, searchText);
          }

          await this.db.query(
            signal,
            UpdateSearchTextSql.fillAll({
              ...this.tables,
              objectId,
              searchText,
              textSearchFormat,
            }),
          );

          // マイグレーション対象が残っている可能性があるので、タスクを継続します。
          return IdleTaskQueue.CONTINUE;
        });

        // データベースから利用可能な照合順序名を取得してスキーマを構築します。
        const collationNames = await this.db
          .query(signal, FindAllCollationNamesSql)
          .collect()
          .then((rows) => v.expect(FindAllCollationNamesResultSchema, rows));
        // @ts-expect-error
        this.collationNamesSchema = v.picklist(collationNames);
      } catch (ex) {
        throw (err = ex);
      }
    } finally {
      await dispose();
    }
  }

  // -----------------------------------------------------------------------------------------------
  //
  // close
  //
  // -----------------------------------------------------------------------------------------------

  /**
   * バックグラウンドタスクを終了し、データベース接続を閉じます。
   *
   * @param signal 処理を中断するための中断シグナルです。
   * @param reason 接続を閉じる理由です。
   * @returns 処理の完了を表す Promise です。
   */
  public async close(signal: AbortSignal, reason: unknown): Promise<void> {
    // マイグレーションタスクを中止して完了を待ちます。
    this.migrationTasks.abort();
    await this.migrationTasks.wait();

    // 削除タスクを中止して完了を待ちます。
    this.deleteTasks.abort();
    await this.deleteTasks.wait();

    // データベース接続を閉じます。
    await this.db.close(signal, reason);
  }

  // -----------------------------------------------------------------------------------------------
  //
  // ready
  //
  // -----------------------------------------------------------------------------------------------

  /**
   * バックグラウンドのマイグレーション処理が完了するのを待ちます。
   *
   * @returns 処理の完了を表す Promise です。
   */
  public async ready(): Promise<void> {
    await this.migrationTasks.wait();
  }

  // -----------------------------------------------------------------------------------------------
  //
  // getXxxId
  //
  // -----------------------------------------------------------------------------------------------

  /**
   * 新しいオブジェクト ID とタイムスタンプを生成して登録します。
   *
   * @param signal 処理を中断するための中断シグナルです。
   * @returns 生成されたオブジェクト ID とタイムスタンプを含むオブジェクトです。
   */
  private async getObjectId(signal: AbortSignal): Promise<{
    /**
     * オブジェクト ID です。
     */
    readonly objectId: ObjectId;

    /**
     * オブジェクト ID (UUID v7) に記録されているタイムスタンプです。
     */
    readonly timestamp: Timestamp;
  }> {
    while (true) {
      try {
        const buffer = getUUIDv7();
        const objectId = v.expect(ObjectIdSchema, stringifyUUID(buffer));

        let ts = 0n;
        ts = (ts << 8n) | BigInt(buffer[0]!);
        ts = (ts << 8n) | BigInt(buffer[1]!);
        ts = (ts << 8n) | BigInt(buffer[2]!);
        ts = (ts << 8n) | BigInt(buffer[3]!);
        ts = (ts << 8n) | BigInt(buffer[4]!);
        ts = (ts << 8n) | BigInt(buffer[5]!);
        const timestamp = v.expect(TimestampSchema, Number(ts));

        await this.db.query(signal, RegisterObjectIdSql.fillAll({ ...this.tables, objectId }));

        return {
          objectId,
          timestamp,
        };
      } catch (ex) {
        if (ex instanceof UnexpectedError || signal.aborted) {
          throw ex;
        }
      }
    }
  }

  public async getEntityId(signal: AbortSignal): Promise<EntityId> {
    while (true) {
      try {
        const entityId = v.expect(EntityIdSchema, uuid58Encode(stringifyUUID(getUUIDv7())));
        await this.db.query(signal, RegisterEntityIdSql.fillAll({ ...this.tables, entityId }));

        return entityId;
      } catch (ex) {
        if (isError(ex) && ex.message.startsWith(`Constraint Error: Duplicate key "entity_id: `)) {
          // UUID が衝突した場合は再作成を試みます。
          continue;
        }

        throw ex;
      }
    }
  }

  // -----------------------------------------------------------------------------------------------
  //
  // create
  //
  // -----------------------------------------------------------------------------------------------

  /**
   * 新しいメタデータレコードを作成します。
   *
   * @param input 作成するメタデータのプロパティーを含む入力オブジェクトです。
   * @returns 処理の完了を表す Promise です。
   * @throws 既に同じキーのオブジェクトが存在する場合はエラーを投げます。
   */
  public async create(
    input: Readonly<{
      key: ObjectKey;
      eTag: EntityTag;
      size: ObjectSize;
      tags: ObjectTags;
      entityId: EntityId;
      language: Language | null;
      mimeType: MimeType;
      timestamp: Timestamp | undefined;
      searchText: SearchText | null;
      description: Description | null;
      userMetadata: UserMetadata;
      overwriteMode: boolean;
      signal: AbortSignal;
    }>,
  ): Promise<void> {
    const {
      key,
      eTag,
      size,
      tags,
      signal,
      entityId,
      language,
      mimeType,
      timestamp: timestampOption,
      searchText,
      description,
      userMetadata,
      overwriteMode,
    } = input;
    const { objectId, timestamp } = await this.getObjectId(signal);

    const sqlParts = function* () {
      yield CreateMetadataSql;

      if (overwriteMode) {
        // 上書きモードが有効な場合は ON CONFLICT 句を追加します。
        yield CreateMetadataOverwriteSql;
      }
    };
    const builtSql = sql.join(sqlParts, "").fillAll({
      ...this.tables,
      entityId,
      language,
      mimeType,
      objectId,
      createdAt: timestampOption ?? timestamp,
      entityTag: eTag,
      objectKey: String(key),
      objectSize: size,
      objectTags: sql.join(tags),
      searchText,
      description,
      keySegments: sql.join(key.segments),
      userMetadata: json(userMetadata),
      lastModifiedAt: timestampOption ?? timestamp,
      recordTimestamp: timestampOption ?? timestamp,
      textSearchFormat: this.textSearchFormat,
    });

    try {
      await this.db.query(signal, builtSql).collect();
      this.db.requestFlush();
    } catch (ex) {
      if (isError(ex) && ex.message.startsWith(`Constraint Error: Duplicate key "_key: `)) {
        throw new ObjectExistsError({ key: String(key) }, { cause: ex });
      }

      throw ex;
    }
  }

  // -----------------------------------------------------------------------------------------------
  //
  // findOne
  //
  // -----------------------------------------------------------------------------------------------

  /**
   * 単一のメタデータを検索して取得します。
   *
   * @param input 検索条件と取得するプロパティーを含む入力オブジェクトです。
   * @returns 見つかったメタデータのオブジェクトです。
   * @throws 指定されたキーのオブジェクトが見つからない場合にエラーを投げます。
   */
  public async findOne(
    input: Readonly<{
      select: Readonly<{
        id?: boolean;
        key?: boolean;
        eTag?: boolean;
        size?: boolean;
        tags?: boolean;
        entityId?: boolean;
        language?: boolean;
        mimeType?: boolean;
        createdAt?: boolean;
        recordType?: boolean;
        description?: boolean;
        userMetadata?: boolean;
        lastModifiedAt?: boolean;
        recordTimestamp?: boolean;
      }>;
      where: Readonly<{
        key: ObjectKey;
      }>;
      signal: AbortSignal;
    }>,
  ): Promise<{
    id?: ObjectId;
    key?: ObjectKey;
    eTag?: EntityTag;
    size?: ObjectSize;
    tags?: ObjectTags;
    entityId?: EntityId;
    language?: Language | null;
    mimeType?: MimeType;
    createdAt?: CreatedAt;
    recordType?: CreatedRecordType;
    description?: Description | null;
    userMetadata?: UserMetadata;
    lastModifiedAt?: LastModifiedAt;
    recordTimestamp?: RecordTimestamp;
  }> {
    const { where, select, signal } = input;

    const sqlParts = function* () {
      const SelectSql = FindOneMetadataSelectSql;
      const ConditionsSql = FindOneMetadataConditionsSql;

      yield SelectSql;

      yield sql.join(function* cols() {
        if (select.id) yield IdColumnSql;
        if (select.key) yield KeyColumnSql;
        if (select.eTag) yield ETagColumnSql;
        if (select.size) yield SizeColumnSql;
        if (select.tags) yield TagsColumnSql;
        if (select.entityId) yield EntityIdColumnSql;
        if (select.language) yield LanguageColumnSql;
        if (select.mimeType) yield MimeTypeColumnSql;
        if (select.createdAt) yield CreatedAtColumnSql;
        if (select.recordType) yield RecordTypeColumnSql;
        if (select.description) yield DescriptionColumnSql;
        if (select.userMetadata) yield UserMetadataColumnSql;
        if (select.lastModifiedAt) yield LastModifiedAtColumnSql;
        if (select.recordTimestamp) yield RecordTimestampColumnSql;
      });

      yield ConditionsSql;
    };
    const builtSql = sql.join(sqlParts, "").fillAll({
      ...this.tables,
      objectKey: String(where.key),
    });

    const rows = await this.db.query(signal, builtSql).collect();
    const output = v.expect(FindOneMetadataResultSchema(select), rows);
    if (output === undefined) {
      throw new ObjectNotFoundError({ key: String(where.key) });
    }

    return output;
  }

  // -----------------------------------------------------------------------------------------------
  //
  // findMany
  //
  // -----------------------------------------------------------------------------------------------

  public async findMany(
    input: Readonly<{
      select: Readonly<{
        id?: boolean;
        key?: boolean;
        eTag?: boolean;
        size?: boolean;
        tags?: boolean;
        language?: boolean;
        mimeType?: boolean;
        createdAt?: boolean;
        recordType?: boolean;
        description?: boolean;
        userMetadata?: boolean;
        lastModifiedAt?: boolean;
        recordTimestamp?: boolean;
      }>;
      where: Readonly<{
        prefix: ObjectKeyPrefix | undefined;
      }>;
      skip: Uint;
      take: Uint;
      order: Readonly<{
        collate: string | undefined;
        direction: OrderDirection;
      }>;
      signal: AbortSignal;
    }>,
  ): Promise<
    AsyncGenerator<
      {
        id?: ObjectId;
        key?: ObjectKey;
        eTag?: EntityTag;
        size?: ObjectSize;
        tags?: ObjectTags;
        language?: Language | null;
        mimeType?: MimeType;
        createdAt?: CreatedAt;
        recordType?: CreatedRecordType;
        description?: Description | null;
        userMetadata?: UserMetadata;
        lastModifiedAt?: LastModifiedAt;
        recordTimestamp?: RecordTimestamp;
      },
      void,
      unknown
    >
  > {
    const { skip, take, order, where, select, signal } = input;

    // 末尾がスラッシュの場合はディレクトリー配下を検索する予定であると判定し、より効率的なクエリーを適用するために条件分岐を行って SQL を構築します。
    const isDirectoryPrefix = where.prefix?.endsWith("/") === true;

    // ディレクトリー指定の場合はパスのセグメントを分解します。
    const prefixSegments = isDirectoryPrefix
      ? ObjectKey.parse(where.prefix.slice(0, -1)).segments
      : [];

    const sqlParts = function* () {
      const SelectSql = FindManyMetadataSelectSql;
      const PaginationSql = FindManyMetadataPaginationSql;
      const BasicConditionsSql = FindManyMetadataBasicConditionsSql;
      const KeyPrefixConditionSql = FindManyMetadataKeyPrefixConditionSql;
      const PathSegmentConditionSql = FindManyMetadataPathSegmentConditionSql;
      const KeyOrderWithCollationSql = FindManyMetadataKeyOrderWithCollationSql;
      const PathSegmentsConditionSql = FindManyMetadataPathSegmentsConditionSql;
      const KeyOrderWithoutCollationSql = FindManyMetadataKeyOrderWithoutCollationSql;
      const DistinctOnBasenameAndKindSql = FindManyMetadataDistinctOnBasenameAndKindSql;
      const BasenameOrderWithCollationSql = FindManyMetadataBasenameOrderWithCollationSql;
      const BasenameOrderWithoutCollationSql = FindManyMetadataBasenameOrderWithoutCollationSql;

      yield SelectSql;

      if (isDirectoryPrefix) {
        // ディレクトリープレフィックスの場合は、重複するベースネームをまとめるための DISTINCT ON を追加します。
        yield DistinctOnBasenameAndKindSql;
      }

      yield sql.join(function* cols() {
        if (select.id) yield IdColumnSql;
        if (select.key) yield KeyColumnSql;
        if (select.eTag) yield ETagColumnSql;
        if (select.size) yield SizeColumnSql;
        if (select.tags) yield TagsColumnSql;
        if (select.language) yield LanguageColumnSql;
        if (select.mimeType) yield MimeTypeColumnSql;
        if (select.createdAt) yield CreatedAtColumnSql;
        if (select.recordType) yield RecordTypeColumnSql;
        if (select.description) yield DescriptionColumnSql;
        if (select.userMetadata) yield UserMetadataColumnSql;
        if (select.lastModifiedAt) yield LastModifiedAtColumnSql;
        if (select.recordTimestamp) yield RecordTimestampColumnSql;
      });

      yield BasicConditionsSql;

      if (!isDirectoryPrefix) {
        if (where.prefix !== undefined) {
          // ディレクトリーを特定しない部分一致検索用のプレフィックス条件を追加します。
          yield KeyPrefixConditionSql.fillAll({
            objectKeyPrefix: sql.raw(sql.escapeLiteral(where.prefix)),
          });
        }
      } else {
        // ディレクトリー検索用のセグメント条件を追加します。

        yield PathSegmentsConditionSql;

        for (let i = 0; i < prefixSegments.length; i++) {
          yield PathSegmentConditionSql.fillAll({
            index: sql.raw((i + 1).toString(10)),
            objectKeySegment: prefixSegments[i]!,
          });
        }
      }

      // 並び替え条件を追加します。
      if (!isDirectoryPrefix) {
        if (order.collate === undefined) {
          yield KeyOrderWithoutCollationSql;
        } else {
          yield KeyOrderWithCollationSql.fill({
            collationName: sql.raw(sql.ident(order.collate)),
          });
        }
      } else {
        if (order.collate === undefined) {
          yield BasenameOrderWithoutCollationSql;
        } else {
          yield BasenameOrderWithCollationSql.fill({
            collationName: sql.raw(sql.ident(order.collate)),
          });
        }
      }

      // ページネーション条件を追加します。
      yield PaginationSql;
    };
    const builtSql = sql.join(sqlParts, "").fillAll({
      ...this.tables,
      skip: sql.raw(skip.toString(10)),
      take: sql.raw(take.toString(10)),
      minLength: prefixSegments.length,
      basenameIndex: sql.raw(prefixSegments.length.toString(10)),
      orderDirection: sql.raw(order.direction),
      objectKeySegmentCount: prefixSegments.length,
    });

    const RowSchema = MetadataSelectResultSchema(select);
    const rows = await this.db.query(signal, builtSql).iter();

    return (async function* () {
      for await (const row of rows) {
        yield v.expect(RowSchema, row);
      }
    })();
  }

  // -----------------------------------------------------------------------------------------------
  //
  // search
  //
  // -----------------------------------------------------------------------------------------------

  /**
   * 全文検索を利用してメタデータを検索し、非同期ジェネレーターとして取得します。
   *
   * @param input 検索クエリー、スコアのしきい値、ページネーションを含む入力オブジェクトです。
   * @returns 検索結果のメタデータとスコアを順次返す非同期ジェネレーターです。
   */
  public async search(
    input: Readonly<{
      select: Readonly<{
        id?: boolean;
        key?: boolean;
        eTag?: boolean;
        size?: boolean;
        tags?: boolean;
        language?: boolean;
        mimeType?: boolean;
        createdAt?: boolean;
        recordType?: boolean;
        description?: boolean;
        userMetadata?: boolean;
        lastModifiedAt?: boolean;
        recordTimestamp?: boolean;
      }>;
      where: Readonly<{
        prefix: ObjectKeyPrefix | undefined;
        scoreGreaterThan: number;
      }>;
      query: string;
      skip: Uint;
      take: Uint;
      signal: AbortSignal;
    }>,
  ): Promise<
    AsyncGenerator<
      {
        score: number;
        id?: ObjectId;
        key?: ObjectKey;
        eTag?: EntityTag;
        size?: ObjectSize;
        tags?: ObjectTags;
        language?: Language | null;
        mimeType?: MimeType;
        createdAt?: CreatedAt;
        recordType?: CreatedRecordType;
        description?: Description | null;
        userMetadata?: UserMetadata;
        lastModifiedAt?: LastModifiedAt;
        recordTimestamp?: RecordTimestamp;
      },
      void,
      unknown
    >
  > {
    const { skip, take, query, where, select, signal } = input;

    // 末尾がスラッシュの場合はディレクトリー配下を検索する予定であると判定し、より効率的なクエリーを適用するために条件分岐を行って SQL を構築します。
    const isDirectoryPrefix = where.prefix?.endsWith("/") === true;

    // ディレクトリー指定の場合はパスのセグメントを分解します。
    const prefixSegments = isDirectoryPrefix
      ? ObjectKey.parse(where.prefix.slice(0, -1)).segments
      : [];

    const sqlParts = function* () {
      const SelectSql = SearchMetadataSelectSql;
      const ScoreConditionSql = SearchMetadataScoreConditionSql;
      const BasicConditionsSql = SearchMetadataBasicConditionsSql;
      const KeyPrefixConditionSql = SearchMetadataKeyPrefixConditionSql;
      const OrderAndPaginationSql = SearchMetadataOrderAndPaginationSql;
      const PathSegmentConditionSql = SearchMetadataPathSegmentConditionSql;
      const PathSegmentsConditionSql = SearchMetadataPathSegmentsConditionSql;

      yield SelectSql;

      yield sql.join(function* cols() {
        if (select.id) yield IdColumnSql;
        if (select.key) yield KeyColumnSql;
        if (select.eTag) yield ETagColumnSql;
        if (select.size) yield SizeColumnSql;
        if (select.tags) yield TagsColumnSql;
        if (select.language) yield LanguageColumnSql;
        if (select.mimeType) yield MimeTypeColumnSql;
        if (select.createdAt) yield CreatedAtColumnSql;
        if (select.recordType) yield RecordTypeColumnSql;
        if (select.description) yield DescriptionColumnSql;
        if (select.userMetadata) yield UserMetadataColumnSql;
        if (select.lastModifiedAt) yield LastModifiedAtColumnSql;
        if (select.recordTimestamp) yield RecordTimestampColumnSql;
      });

      yield BasicConditionsSql;

      // 検索スコアのしきい値条件を追加します。
      if (where.scoreGreaterThan !== undefined) {
        yield ScoreConditionSql.fill({
          score: where.scoreGreaterThan,
        });
      }

      if (!isDirectoryPrefix) {
        if (where.prefix !== undefined) {
          // ディレクトリーを特定しない部分一致検索用のプレフィックス条件を追加します。
          yield KeyPrefixConditionSql.fillAll({
            objectKeyPrefix: sql.raw(sql.escapeLiteral(where.prefix)),
          });
        }
      } else {
        // ディレクトリー検索用のセグメント条件を追加します。

        yield PathSegmentsConditionSql;

        for (let i = 0; i < prefixSegments.length; i++) {
          yield PathSegmentConditionSql.fillAll({
            index: sql.raw((i + 1).toString(10)),
            objectKeySegment: prefixSegments[i]!,
          });
        }
      }

      // スコア順のソートとページネーション条件を追加します。
      yield OrderAndPaginationSql;
    };
    const builtSql = sql.join(sqlParts, "").fillAll({
      ...this.tables,
      skip: sql.raw(skip.toString(10)),
      take: sql.raw(take.toString(10)),
      query,
      minLength: prefixSegments.length,
      textSearchFormat: this.textSearchFormat,
    });

    const RowSchema = MetadataSelectResultSchema(select, {
      score: v.pipe(v.number(), v.finite()),
    });
    const rows = await this.db.query(signal, builtSql).iter();

    return (async function* () {
      for await (const row of rows) {
        yield v.expect(RowSchema, row);
      }
    })();
  }

  // -----------------------------------------------------------------------------------------------
  //
  // exists
  //
  // -----------------------------------------------------------------------------------------------

  /**
   * 指定したキーのメタデータが存在するかどうかを確認します。
   *
   * @param input 検索条件を含む入力オブジェクトです。
   * @returns オブジェクトが存在する場合は true を返します。
   */
  public async exists(
    input: Readonly<{
      where: Readonly<{
        key: ObjectKey;
      }>;
      signal: AbortSignal;
    }>,
  ): Promise<boolean> {
    const { where, signal } = input;
    const rows = await this.db
      .query(
        signal,
        ExistsMetadataSql.fillAll({
          ...this.tables,
          objectKey: String(where.key),
        }),
      )
      .collect();
    const exists = v.expect(ExistsMetadataResultSchema, rows);

    return exists;
  }

  // -----------------------------------------------------------------------------------------------
  //
  // update
  //
  // -----------------------------------------------------------------------------------------------

  /**
   * 既存のメタデータを更新します。
   *
   * @param input 更新するプロパティーと対象の条件を含む入力オブジェクトです。
   * @returns 処理の完了を表す Promise です。
   * @throws 対象のオブジェクトが存在しない場合にエラーを投げます。
   */
  public async update(
    input: Readonly<{
      tags: ObjectTags | undefined;
      language: Language | undefined;
      mimeType: MimeType | undefined;
      timestamp: Timestamp | undefined;
      searchText: SearchText | null | undefined;
      description: Description | null | undefined;
      userMetadata: UserMetadata;
      where: Readonly<{
        key: ObjectKey;
      }>;
      signal: AbortSignal;
    }>,
  ): Promise<void> {
    const { where, signal, ...metadata } = input;
    if (Object.values(metadata).every((value) => value === undefined)) {
      // 更新するプロパティーが一つも指定されていない場合は、存在確認のみ行います。

      if (await this.exists({ where, signal })) {
        return;
      }

      throw new ObjectNotFoundError({ key: String(where.key) });
    }

    const sqlParts = function* () {
      const BaseSql = UpdateMetadataBaseSql;
      const ConditionSql = UpdateMetadataConditionSql;
      const TagsColumnSql = UpdateTagsColumnSql;
      const LanguageColumnSql = UpdateLanguageColumnSql;
      const MimeTypeColumnSql = UpdateMimeTypeColumnSql;
      const SearchTextColumnSql = UpdateSearchTextColumnSql;
      const DescriptionColumnSql = UpdateDescriptionColumnSql;
      const UserMetadataColumnSql = UpdateUserMetadataColumnSql;
      const LastModifiedAtColumnSql = UpdateLastModifiedAtColumnSql;
      const RecordTimestampColumnSql = UpdateRecordTimestampColumnSql;

      yield BaseSql;

      if (metadata.tags !== undefined) yield TagsColumnSql;
      if (metadata.language !== undefined) yield LanguageColumnSql;
      if (metadata.mimeType !== undefined) yield MimeTypeColumnSql;
      if (metadata.timestamp !== undefined) {
        yield LastModifiedAtColumnSql;
        yield RecordTimestampColumnSql;
      }
      if (metadata.searchText !== undefined) yield SearchTextColumnSql;
      if (metadata.description !== undefined) yield DescriptionColumnSql;
      if (metadata.userMetadata !== undefined) yield UserMetadataColumnSql;

      yield ConditionSql;
    };
    const builtSql = sql.join(sqlParts, "").fillAll({
      ...this.tables,
      ...(metadata as any),
      objectKey: String(where.key),
    });

    const rows = await this.db.query(signal, builtSql).collect();
    const found = v.expect(UpdateMetadataResultSchema, rows);
    if (found) {
      return;
    }

    throw new ObjectNotFoundError({ key: String(where.key) });
  }

  // -----------------------------------------------------------------------------------------------
  //
  // delete
  //
  // -----------------------------------------------------------------------------------------------

  /**
   * メタデータを削除済みとしてマークし、バックグラウンドでの物理削除を要求します。
   *
   * @param input 削除対象の条件を含む入力オブジェクトです。
   * @returns 削除されたエンティティー ID と、物理削除を要求する関数を含むオブジェクトです。
   * @throws 対象のオブジェクトが存在しない場合にエラーを投げます。
   */
  public async delete(
    input: Readonly<{
      timestamp: Timestamp | undefined;
      where: Readonly<{
        key: ObjectKey;
      }>;
      signal: AbortSignal;
    }>,
  ): Promise<{
    entityId: EntityId;
    requestDeletingMetadata(): void;
  }> {
    const { where, signal, timestamp } = input;

    const builtSql = UpdateMetadataDeletedSql.fillAll({
      ...this.tables,
      objectKey: String(where.key),
      recordTimestamp: timestamp ?? (Date.now() as Timestamp),
    });

    const rows = await this.db.query(signal, builtSql).collect();
    const output = v.expect(UpdateMetadataDeletedResultSchema, rows);
    if (output === undefined) {
      throw new ObjectNotFoundError({ key: String(where.key) });
    }

    const { entityId, objectId } = output;

    return {
      entityId,
      requestDeletingMetadata: () => {
        this.deleteTasks.add(async (signal) => {
          await this.db.query(signal, DeleteMetadataSql.fillAll({ ...this.tables, objectId }));
        });
      },
    };
  }
}
