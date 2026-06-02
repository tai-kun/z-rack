import {
  v,
  EntityIdSchema,
  LanguageSchema,
  MimeTypeSchema,
  ObjectIdSchema,
  CreatedAtSchema,
  EntityTagSchema,
  ObjectKeySchema,
  ObjectSizeSchema,
  ObjectTagsSchema,
  DescriptionSchema,
  UserMetadataSchema,
  LastModifiedAtSchema,
  RecordTimestampSchema,
  CreatedRecordTypeSchema,
} from "@z-rack/core";

/**
 * メタデータの検索結果における各カラムの検証スキーマを定義したオブジェクトです。
 *
 * データベースから取得した生の値を、アプリケーションに適した型へ変換、検証するための規則を含みます。
 */
const MetadataSelectResultSchemaEntries = {
  /**
   * オブジェクトの識別子です。
   */
  id: ObjectIdSchema,

  /**
   * オブジェクトのキー情報です。
   */
  key: ObjectKeySchema,

  /**
   * エンティティーのタグです。
   */
  eTag: EntityTagSchema,

  /**
   * オブジェクトのデータサイズです。
   */
  size: v.pipe(
    v.union([
      v.pipe(v.string(), v.transform(parseInt)),
      v.pipe(v.bigint(), v.transform(Number)),
      v.number(),
    ]),
    ObjectSizeSchema,
  ),

  /**
   * オブジェクトに付与されたタグの一覧です。
   */
  tags: ObjectTagsSchema,

  /**
   * エンティティーの識別子です。
   */
  entityId: EntityIdSchema,

  /**
   * 言語の設定情報です。設定されていない場合は NULL を許容します。
   */
  language: v.nullable(LanguageSchema),

  /**
   * ファイルの種類を示すマイムタイプです。
   */
  mimeType: MimeTypeSchema,

  /**
   * 作成日時です。
   */
  createdAt: CreatedAtSchema,

  /**
   * 記録されたデータの種類です。
   */
  recordType: CreatedRecordTypeSchema,

  /**
   * 詳細な説明文です。設定されていない場合は NULL を許容します。
   */
  description: v.nullable(DescriptionSchema),

  /**
   * 利用者が任意に設定したメタデータです。
   */
  userMetadata: UserMetadataSchema,

  /**
   * 最終更新日時です。
   */
  lastModifiedAt: LastModifiedAtSchema,

  /**
   * 記録が確定した時点のタイムスタンプです。
   */
  recordTimestamp: RecordTimestampSchema,
};

/**
 * メタデータの検索結果を表す型定義です。
 */
export type Metadata = v.InferOutput<
  ReturnType<typeof v.object<typeof MetadataSelectResultSchemaEntries>>
>;

/**
 * メタデータの情報から特定のカラムを選択するための型定義です。
 */
export type MetadataSelect = {
  readonly [_ in keyof Metadata]?: boolean;
};

/**
 * メタデータの検証スキーマが持つすべてのカラム名を格納した配列です。
 *
 * 動的にスキーマを構築する際の走査処理に使用します。
 */
const MetadataSelectKeys = Object.keys(
  MetadataSelectResultSchemaEntries,
) as readonly (keyof MetadataSelect)[];

/**
 * 指定されたカラムの選択状況に応じて、動的にメタデータの検証スキーマを構築します。
 *
 * @template TBase 外部から追加で注入するスキーマの型定義です。
 * @param select 取得したいカラムを真偽値で指定したオブジェクトです。
 * @param base 追加で検証ルールを組み合わせたい場合に指定するスキーマのオブジェクトです。既定値は空のオブジェクトです。
 * @returns 動的に組み立てられた、検証と型変換を行うためのスキーマオブジェクトを返します。
 */
export function MetadataSelectResultSchema<
  TBase extends {
    readonly [key: string]: v.BaseSchema<any, any, v.BaseIssue<any>>;
  } = {},
>(
  select: MetadataSelect,
  base: TBase = {} as TBase,
): v.BaseSchema<
  unknown,
  Partial<Metadata> & {
    -readonly [P in Exclude<keyof TBase, keyof Metadata>]: v.InferOutput<TBase[P]>;
  },
  v.BaseIssue<any>
> {
  const entries: any = { ...base };
  for (const key of MetadataSelectKeys) {
    if (select[key] === true) {
      entries[key] = MetadataSelectResultSchemaEntries[key];
    }
  }

  // @ts-expect-error
  return v.object(entries);
}
