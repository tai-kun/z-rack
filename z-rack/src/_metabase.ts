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
import { ExistsMetadataResultSchema, ExistsMetadataSql } from "./_sql/exists.js";
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

const MIGRATIONS = {
  "202605081732_init": migrations_init,
};

function hash(s: string): TextSearchFormat {
  let h = bs58.encode(sha256(utf8.encode(s)));
  if (h.length < 44) {
    h = h.padStart(44, "0");
  }

  return h as TextSearchFormat;
}

function json(x: unknown): string {
  return JSON.stringify(x ?? null);
}

export default class Metabase {
  private readonly db: DatabaseClient;

  private readonly ts: TextSearch;

  private readonly tables: Readonly<
    Record<
      | "configTable"
      | "entityIdsTable"
      | "objectIdsTable"
      | "migrationsTable"
      | "publicMetadataTable"
      | "privateMetadataTable",
      sql.Sql<[]>
    >
  >;

  private readonly deleteTasks: IdleTaskQueue;

  private readonly migrationTasks: IdleTaskQueue;

  private textSearchFormat!: TextSearchFormat;

  public readonly collationNamesSchema!: v.BaseSchema<string, string, v.BaseIssue<string>>;

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

  public get isOpen(): boolean {
    return this.db.isOpen;
  }

  // -----------------------------------------------------------------------------------------------
  //
  // open
  //
  // -----------------------------------------------------------------------------------------------

  public async open(signal: AbortSignal): Promise<void> {
    const ds = new AsyncDisposableStack();
    try {
      let err: unknown = nil;

      await this.db.open(signal);

      ds.defer(async () => {
        if (err === nil) {
          return;
        }

        try {
          await this.db.close(signal);
        } catch (ex) {
          logger.error`Metabase.open: Failed to close database client: ${ex}`;
        }
      });

      try {
        await this.db.transaction(signal, async (tx) => {
          for (const sql of migrations_prelude) {
            await tx.query(sql.fillAll(this.tables));
          }

          const migrations = Object.entries(MIGRATIONS).sort(([a], [b]) =>
            a.localeCompare(b, "en"),
          );
          const lastMigration = await tx
            .query(FindLatestMigrationSql.fillAll(this.tables))
            .collect()
            .then((rows) => v.expect(FindLatestMigrationResultSchema, rows));
          for (let i = 0; i < migrations.length; i++) {
            const [name, sqls] = migrations[i]!;
            if (
              lastMigration?.finishedAt != null &&
              lastMigration.name.localeCompare(name, "en") <= 0
            ) {
              continue;
            }

            for (; i < migrations.length; i++) {
              await tx.query(CreateMigrationSql.fillAll({ ...this.tables, name }));

              for (const sql of sqls) {
                // @ts-expect-error
                await tx.query(sql.fillAll(this.tables));
              }

              await tx.query(FinishMigrationSql.fillAll({ ...this.tables, name }));
            }
          }

          await tx.query(CreatePgTextsearchExtensionSql);

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
            return;
          }

          const { objectId, language, description } = migrationTarget;
          let searchText = await this.ts.normalize(signal, language, description);
          if (this.ts.textConfig === "simple") {
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

          return IdleTaskQueue.CONTINUE;
        });

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
      await ds.disposeAsync();
    }
  }

  // -----------------------------------------------------------------------------------------------
  //
  // close
  //
  // -----------------------------------------------------------------------------------------------

  public async close(signal: AbortSignal): Promise<void> {
    this.migrationTasks.abort();
    await this.migrationTasks.wait();

    this.deleteTasks.abort();
    await this.deleteTasks.wait();

    await this.db.close(signal);
  }

  // -----------------------------------------------------------------------------------------------
  //
  // ready
  //
  // -----------------------------------------------------------------------------------------------

  public async ready(): Promise<void> {
    await this.migrationTasks.wait();
  }

  // -----------------------------------------------------------------------------------------------
  //
  // getXxxId
  //
  // -----------------------------------------------------------------------------------------------

  private async getObjectId(signal: AbortSignal): Promise<{
    readonly objectId: ObjectId;
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
        if (ex instanceof UnexpectedError || signal.aborted) {
          throw ex;
        }
      }
    }
  }

  // -----------------------------------------------------------------------------------------------
  //
  // create
  //
  // -----------------------------------------------------------------------------------------------

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
        yield CreateMetadataOverwriteSql;
      }
    };
    const builtSql = sql.join([...sqlParts()], "").fillAll({
      ...this.tables,
      entityId,
      language,
      mimeType,
      objectId,
      createdAt: timestampOption ?? timestamp,
      entityTag: eTag,
      objectKey: String(key),
      objectSize: size,
      objectTags: sql.join([...tags]),
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

      const cols = function* () {
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
      };
      yield sql.join([...cols()]);

      yield ConditionsSql;
    };
    const builtSql = sql.join([...sqlParts()], "").fillAll({
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

    const isDirectoryPrefix = where.prefix?.endsWith("/") === true;
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
        yield DistinctOnBasenameAndKindSql;
      }

      const cols = function* () {
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
      };
      yield sql.join([...cols()]);

      yield BasicConditionsSql;

      if (!isDirectoryPrefix) {
        if (where.prefix !== undefined) {
          yield KeyPrefixConditionSql.fillAll({
            objectKeyPrefix: sql.raw(sql.escapeLiteral(where.prefix)),
          });
        }
      } else {
        yield PathSegmentsConditionSql;

        for (let i = 0; i < prefixSegments.length; i++) {
          yield PathSegmentConditionSql.fillAll({
            index: sql.raw((i + 1).toString(10)),
            objectKeySegment: prefixSegments[i]!,
          });
        }
      }

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

      yield PaginationSql;
    };
    const builtSql = sql.join([...sqlParts()], "").fillAll({
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

    const isDirectoryPrefix = where.prefix?.endsWith("/") === true;
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

      const cols = function* () {
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
      };
      yield sql.join([...cols()]);

      yield BasicConditionsSql;

      if (where.scoreGreaterThan !== undefined) {
        yield ScoreConditionSql.fill({
          score: where.scoreGreaterThan,
        });
      }

      if (!isDirectoryPrefix) {
        if (where.prefix !== undefined) {
          yield KeyPrefixConditionSql.fillAll({
            objectKeyPrefix: sql.raw(sql.escapeLiteral(where.prefix)),
          });
        }
      } else {
        yield PathSegmentsConditionSql;

        for (let i = 0; i < prefixSegments.length; i++) {
          yield PathSegmentConditionSql.fillAll({
            index: sql.raw((i + 1).toString(10)),
            objectKeySegment: prefixSegments[i]!,
          });
        }
      }

      yield OrderAndPaginationSql;
    };
    const builtSql = sql.join([...sqlParts()], "").fillAll({
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

    // @ts-expect-error
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
    const builtSql = sql.join([...sqlParts()], "").fillAll({
      ...this.tables,
      ...(metadata as any),
      objectKey: String(where.key),
    });

    const rows = await this.db.query(signal, builtSql).collect();
    const found = v.expect(UpdateMetadataResultSchema, rows);
    if (!found) {
      throw new ObjectNotFoundError({ key: String(where.key) });
    }
  }

  // -----------------------------------------------------------------------------------------------
  //
  // delete
  //
  // -----------------------------------------------------------------------------------------------

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
