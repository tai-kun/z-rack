# @z-rack/pglite

z-rack のデータベースバックエンドとして [PGlite](https://github.com/electric-sql/pglite)（WASM 版 PostgreSQL）を利用するためのパッケージです。`IDatabaseClient` インターフェースを実装した `Pglite` クラスを提供します。

## インストール

```sh
pnpm add @z-rack/pglite
```

## 使い方

```ts
import { Pglite } from "@z-rack/pglite";
import pgliteWorkerUri from "@z-rack/pglite/worker?url";

const worker = new Worker(new URL(pgliteWorkerUri, import.meta.url), {
  type: "module",
});

const pglite = new Pglite(worker, {
  dataDir: "opfs-ahp://.tmp/meta",
});

await pglite.open();

const rows = await pglite.query({
  queryText: "SELECT 1 AS result",
  bindings: [],
  signal: AbortSignal.timeout(5000),
});

await pglite.close();
```

## 設計

### ワーカー分離

PGlite は専用の Worker スレッド（ブラウザーでは Web Worker、Node.js では Worker Thread）上で動作します。
メインスレッドとの通信には [Comlink](https://github.com/nicedoc/comlink) を使用し、透過的な RPC を実現します。

### 環境別エントリーポイント

`package.json` の `exports` フィールドにより、ブラウザーと Node.js で適切なワーカーモジュールが自動的に選択されます。

| エクスポートパス     | ブラウザー           | Node.js           |
| -------------------- | -------------------- | ----------------- |
| `"./worker"`         | `workers/browser.js` | `workers/node.js` |
| `"./worker.browser"` | `workers/browser.js` | なし              |
| `"./worker.node"`    | なし                 | `workers/node.js` |

### 全文検索拡張

ワーカー内で `@electric-sql/pglite/pg_textsearch` 拡張を自動的に読み込み、PostgreSQL の BM25 全文検索が利用可能になります。

## API

| メソッド      | 説明                                                    |
| ------------- | ------------------------------------------------------- |
| `open`        | PGlite インスタンスを初期化し、準備完了を待機           |
| `close`       | PGlite を停止                                           |
| `flush`       | メモリー上の変更をファイルシステムに同期（OPFS 利用時） |
| `query`       | SQL クエリーを実行し、結果行を返却                      |
| `transaction` | トランザクション内でコールバックを実行                  |

すべてのメソッドは `AbortSignal` によるキャンセルに対応しています。
