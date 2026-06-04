import { sql } from "pgsql-template-tag";

const configTable = sql.query("configTable");
const entityIdsTable = sql.query("entityIdsTable");
const objectIdsTable = sql.query("objectIdsTable");
const publicMetadataTable = sql.query("publicMetadataTable");
const privateMetadataTable = sql.query("privateMetadataTable");

// oxfmt-ignore
export default [

// 設定管理テーブルの作成
//
// アプリケーション全体で共有するキー・バリュー形式の設定を保持するためのテーブルです。
// 主キーにはテキスト型のキーを使用し、値は JSON 形式で保存します。
sql`
CREATE TABLE ${configTable} (
  key   TEXT,
  value JSON NOT NULL,

  CONSTRAINT "_z-rack-pk-config-key" PRIMARY KEY (key)
)
`,

// 非公開メタデータテーブルの作成
//
// オブジェクトの物理的な情報やシステム管理用の属性など、すべてのメタデータを統合的に保持する中心的なテーブルです。
//
// カラム構成:
// - object_id           オブジェクトを一意に識別する UUID であり、このテーブルの主キーです。
// - record_type         メタデータに加えた変更の種別です。
//                       - "CREATE"           メタデータを作成しました。
//                       - "UPDATE_METADATA"  メタデータを更新しました。
//                       - "DELETE"           メタデータを削除しました。
// - record_timestamp    メタデータに変更を加えた日時です。
// - key                 オブジェクトキーです。
// - _key                オブジェクトキーです。メタデータが削除された場合は NULL になります。これは、存在するメタデータをオブジェクトキーで高速に検索するときに使用されます。
// - key_segments        オブジェクトキーをスラッシュで区切ったときの階層構造です。
// - entity_id           オブジェクトデータの実体（エンティティー）の識別子です。
// - entity_tag          エンティティーのハッシュ値です。
// - object_size         オブジェクトのファイルサイズ (バイト数) です。
// - mime_type           オブジェクトの MIME タイプです。
// - created_at          オブジェクトの作成日時です。
// - last_modified_at    メタデータの最終更新日時です。
// - language            オブジェクトの説明文の言語です。
// - description         オブジェクトの説明文です。
// - search_text         検索用の文章です。
// - text_search_format  テキスト検索の形式です。language と description から search_text へどのように変換されるかを示しています。
// - object_tags         任意のタグ情報を格納するテキスト配列です。
// - user_metadata       ユーザーが独自に定義可能な属性を格納する JSON 形式のメタデータです。
sql`
CREATE TABLE ${privateMetadataTable} (
  object_id UUID,

  record_type      TEXT      NOT NULL,
  record_timestamp TIMESTAMP NOT NULL,

  key          TEXT   NOT NULL,
  _key         TEXT,
  key_segments TEXT[] NOT NULL,

  entity_id  TEXT NOT NULL,
  entity_tag TEXT,

  object_size BIGINT NOT NULL,
  mime_type   TEXT,

  created_at       TIMESTAMP,
  last_modified_at TIMESTAMP,

  language           TEXT,
  description        TEXT,
  search_text        TEXT,
  text_search_format TEXT,
  object_tags        TEXT[],
  user_metadata      JSONB,

  CONSTRAINT "_z-rack-pk-private_metadata-object_id" PRIMARY KEY (object_id)
)
`,

// 一意性インデックスの作成（_key）
//
// 存在するメタデータをオブジェクトキーで高速に検索するためのインデックスです。
sql`
CREATE UNIQUE INDEX "_z_rack-unq-private_metadata-_key" ON ${privateMetadataTable} (_key)
`,

// 一意性インデックスの作成（entity_id）
//
// エンティティー ID が重複しないように一意性を保証します。
sql`
CREATE UNIQUE INDEX "_z_rack-unq-private_metadata-entity_id" ON ${privateMetadataTable} (entity_id)
`,

// オブジェクト ID 管理テーブルの作成
//
// システム内で使用されるすべての有効なオブジェクト ID を一元管理するための親テーブルです。これは、新しい UUID を生成する際に、予め衝突しないことが保証された UUID であると確定するために使用されます。
sql`
CREATE TABLE ${objectIdsTable} (
  object_id UUID,

  CONSTRAINT "_z-rack-pk-object_ids-object_id" PRIMARY KEY (object_id)
)
`,

// 非公開メタデータテーブルへの外部キー制約の追加（object_id）
sql`
ALTER TABLE ${privateMetadataTable}
ADD CONSTRAINT "_z_rack-fk-object_id"
FOREIGN KEY (object_id)
REFERENCES ${objectIdsTable} (object_id)
ON UPDATE RESTRICT
ON DELETE RESTRICT
`,

// エンティティー ID 管理テーブルの作成
//
// システム内で使用されるすべての有効なエンティティー ID を一元管理するための親テーブルです。これは、新しい ID を生成する際に、予め衝突しないことが保証された ID であると確定するために使用されます。
sql`
CREATE TABLE ${entityIdsTable} (
  entity_id TEXT,

  CONSTRAINT "_z-rack-pk-entity_ids-entity_id" PRIMARY KEY (entity_id)
)
`,

// 公開用メタデータビューの作成
//
// 内部管理用の非公開メタデータテーブルから、外部公開に必要な情報のみを抽出した仮想的なテーブルです。
// - _key が NULL ではないレコードのみを対象とします。
// - 各カラムの別名定義を行い、API や外部利用者が扱いやすい形式に変換します。
sql`
CREATE VIEW ${publicMetadataTable}
AS
SELECT
  object_id         AS id,
  record_type,
  record_timestamp,
  key,
  object_size       AS size,
  mime_type,
  entity_tag        AS e_tag,
  created_at,
  last_modified_at,
  language,
  description,
  object_tags       AS tags,
  user_metadata
FROM
  ${privateMetadataTable}
WHERE
  _key IS NOT NULL
`,

];
