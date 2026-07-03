# z-rack

z-rack は TypeScript で実装されたオブジェクトストレージです。オブジェクトに説明文やタグ、任意のメタデータを紐付けることができ、説明文に対して全文検索することができます。

## インストール

```sh
pnpm add unikvs @unikvs/compression @unikvs/opfs
pnpm add z-rack @z-rack/jpn @z-rack/pglite
```

## 使い方

```ts
import { Compression } from "@unikvs/compression";
import { Opfs } from "@unikvs/opfs";
import { UniKvs } from "unikvs";
import { ZRack } from "z-rack";
import { Pglite } from "@z-rack/pglite";
import { Vibrato } from "@z-rack/jpn";

import pgliteWorkerUri from "@z-rack/pglite/worker?url";
import vibratoWasmUri from "@z-rack/jpn/vibrato.wasm?url";

// KVS の準備
const kvs = UniKvs.config()
  .appendTransformer(new Compression("gzip"))
  .appendStorage(new Opfs(".tmp/data"))
  .create();

// データベースの準備
const pglite = new Pglite(
  new Worker(new URL(pgliteWorkerUri, import.meta.url), {
    type: "module",
  }),
  { dataDir: "opfs-ahp://.tmp/meta" },
);

// テキスト検索の準備
Vibrato.setWasmSource(vibratoWasmUri);
const vibrato = new Vibrato(
  {
    url: vibratoDictUri,
    checksum: "82a6da70bb4a17be70f20ff44f650f9ad1d2b0b4fcb2f39c17fc797f92d0ab75",
  },
  { omitPos: ["助詞"] },
);

// ZRack の初期化
const rack = new ZRack({
  textSearch: vibrato,
  storageSystem: kvs,
  databaseClient: pglite,
});

await rack.open();
await rack.ready;

// オブジェクトの保存
await rack.putObject({
  key: "dummy.mp4",
  data: Uint8Array.from([0, 1, 2]),
  description: "ダミーの BGM 音源です。",
});

// オブジェクトの取得
const file = await rack.getObject({ key: "dummy.mp4" });
file.description; // "ダミーの BGM 音源です。"

// 全文検索
for await (const item of rack.searchObjects({ query: "BGM" })) {
  console.log(item.key, item.score);
}

await rack.close();
```

## アーキテクチャー

ZRack は以下のコンポーネントで構成されます。

- **StorageSystem** — バイナリーデータの永続化。
  [unikvs](https://github.com/tai-kun/unikvs) を利用し、OPFS、IndexedDB、メモリーなど多様なバックエンドを選択できます。
- **DatabaseClient** — メタデータ（説明文、タグ、ユーザーメタデータなど）の管理。
  `IDatabaseClient` インターフェースを実装した任意のクライアントが利用可能です。
- **TextSearch** — 説明文のトークナイズと言語検出。
  `ITextSearch` インターフェースを実装したエンジンをプラグインとして差し替えられます。

## API

### ライフサイクル

| メソッド                | 説明                           |
| ----------------------- | ------------------------------ |
| `open`                  | すべてのコンポーネントを初期化 |
| `close`                 | すべてのコンポーネントを解放   |
| `[Symbol.asyncDispose]` | `await using` に対応           |

`ready` プロパティーでデータベースマイグレーションの完了を待機できます。

### オブジェクト操作

| メソッド               | 説明                                |
| ---------------------- | ----------------------------------- |
| `putObject`            | オブジェクトの保存（新規 / 上書き） |
| `getObject`            | オブジェクトの取得（`File`）        |
| `getObjectStream`      | オブジェクトの取得（`ValueStream`） |
| `deleteObject`         | オブジェクトの削除（論理削除）      |
| `getObjectMetadata`    | メタデータのみの取得                |
| `updateObjectMetadata` | メタデータの部分更新                |
| `existsMetadata`       | キーの存在確認                      |

`key`、`prefix`、`data`、`description`、`tags`、`userMetadata`、`mimeType`、`language`、`mode`（`"w"` / `"wx"`）などのオプションをサポートします。

### 一覧・検索

| メソッド        | 説明                               |
| --------------- | ---------------------------------- |
| `listObjects`   | 条件を指定してメタデータを一覧取得 |
| `searchObjects` | 全文検索を実行（BM25 スコア付き）  |

プレフィックスフィルター、ページネーション（`skip` / `take`）、ソート順の指定が可能です。
キーが `/` で終わるプレフィックスを指定すると、ディレクトリーモード（セグメント単位の集約）で動作します。

### エラー

すべてのエラーは `ErrorBase` を継承したクラスとして送出されます。

- `ZRackIsOpenError` — 既に open 済み
- `ZRackIsNotOpenError` — open されていない
- `ObjectExistsError` — キーが既に存在する（`wx` モード）
- `ObjectNotFoundError` — キーが見つからない
- `UnsupportedLanguageError` — 未対応の言語
