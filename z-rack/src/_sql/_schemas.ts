import {
  type EntityId,
  type Language,
  type MimeType,
  type ObjectId,
  type CreatedAt,
  type EntityTag,
  type ObjectKey,
  type ObjectSize,
  type ObjectTags,
  type Description,
  type UserMetadata,
  type LastModifiedAt,
  type RecordTimestamp,
  type CreatedRecordType,
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

const NullableDescriptionSchema = v.nullable(DescriptionSchema);
const NullableLanguageSchema = v.nullable(LanguageSchema);
const CoerceObjectSizeSchema = v.pipe(
  v.union([
    v.pipe(v.string(), v.transform(parseInt)),
    v.pipe(v.bigint(), v.transform(Number)),
    v.unknown(),
  ]),
  ObjectSizeSchema,
);
const MetadataSelectResultSchemaEntries: Record<
  keyof MetadataSelect,
  v.BaseSchema<any, any, any>
> = {
  id: ObjectIdSchema,
  key: ObjectKeySchema,
  eTag: EntityTagSchema,
  size: CoerceObjectSizeSchema,
  tags: ObjectTagsSchema,
  entityId: EntityIdSchema,
  language: NullableLanguageSchema,
  mimeType: MimeTypeSchema,
  createdAt: CreatedAtSchema,
  recordType: CreatedRecordTypeSchema,
  description: NullableDescriptionSchema,
  userMetadata: UserMetadataSchema,
  lastModifiedAt: LastModifiedAtSchema,
  recordTimestamp: RecordTimestampSchema,
};
const MetadataSelectResultSchemaEntryKeys = Object.keys(
  MetadataSelectResultSchemaEntries,
) as readonly (keyof MetadataSelect)[];

export type MetadataSelect = {
  readonly id?: boolean;
  readonly key?: boolean;
  readonly eTag?: boolean;
  readonly size?: boolean;
  readonly tags?: boolean;
  readonly entityId?: boolean;
  readonly language?: boolean;
  readonly mimeType?: boolean;
  readonly createdAt?: boolean;
  readonly recordType?: boolean;
  readonly description?: boolean;
  readonly userMetadata?: boolean;
  readonly lastModifiedAt?: boolean;
  readonly recordTimestamp?: boolean;
};

export type Metadata = {
  id: ObjectId;
  key: ObjectKey;
  eTag: EntityTag;
  size: ObjectSize;
  tags: ObjectTags;
  entityId: EntityId;
  language: Language | null;
  mimeType: MimeType;
  createdAt: CreatedAt;
  recordType: CreatedRecordType;
  description: Description | null;
  userMetadata: UserMetadata;
  lastModifiedAt: LastModifiedAt;
  recordTimestamp: RecordTimestamp;
};

export const MetadataSelectResultSchema = (
  select: MetadataSelect,
  entries: Record<string, v.BaseSchema<any, any, any>> = {},
): v.BaseSchema<any, Record<string, any>, any> => {
  entries = { ...entries };
  for (const key of MetadataSelectResultSchemaEntryKeys) {
    if (select[key] === true) {
      entries[key] = MetadataSelectResultSchemaEntries[key];
    }
  }

  return v.object(entries);
};
