# z-rack モノレポの指針

z-rack は TypeScript と Rust で実装されたオブジェクトストレージです。

オブジェクトに説明文やタグ、任意のメタデータを紐付けることができ、説明文に対して全文検索することができます。

z-rack はデータを永続化するために [unikvs](https://github.com/tai-kun/unikvs) に依存しているため、ブラウザーでもサーバーサイドでも動作可能です。

## 使用感

```sh
pnpm add unikvs @unikvs/compression @unikvs/opfs
pnpm add z-rack @z-rack/jpn @z-rack/pglite
```

```ts
// データ永続化用の KVS クライアントを作成します。

import { Compression } from "@unikvs/compression";
import { Opfs } from "@unikvs/opfs";
import { UniKvs } from "unikvs";

const kvs = UniKvs.config()
  .appendTransformer(new Compression("gzip")) // バイト配列を透過的に gzip 圧縮/展開します。
  .appendStorage(new Opfs(".tmp/data"))
  .create();

// 日本語でテキスト検索できるように形態素解析器を準備します。

import { Vibrato } from "@z-rack/jpn";
import vibratoWasmUri from "@z-rack/jpn/vibrato.wasm?url";

Vibrato.setWasmSource(vibratoWasmUri);

const vibrato = new Vibrato(
  {
    url: vibratoDictUri,
    checksum: "82a6da70bb4a17be70f20ff44f650f9ad1d2b0b4fcb2f39c17fc797f92d0ab75",
  },
  { omitPos: ["助詞"] },
);

// オブジェクトの各種情報を記録するためのデータベースクライアントを準備します。

import { Pglite } from "@z-rack/pglite";
import pgliteWorkerUri from "@z-rack/pglite/worker?url";

const pgliteWorker = new Worker(new URL(pgliteWorkerUri, import.meta.url), {
  type: "module",
});
const pglite = new Pglite(pgliteWorker, {
  dataDir: "opfs-ahp://.tmp/meta",
});

// z-rack を使います。

import { ZRack } from "z-rack";

const rack = new ZRack({
  textSearch: vibrato,
  storageSystem: kvs,
  databaseClient: pglite,
});

await rack.open();

await rack.ready;

await rack.set("dummy.mp4", Uint8Array.from([0, 1, 2]), {
  description: "ダミーの BGM 音源です。",
});
const bgm = await rack.get("dummy.mp4");

await rack.close();
```

## プロジェクトの構成

- メインパッケージは `z-rack/` にあります。
- プラグインを含む全パッケージで共有して使用されるコアパッケージは `packages/core` にあります。
- 英祖による全文検索に対応するためのパッケージは `packages/eng` にあります。
- 日本語と英語による全文検索に対応するためのパッケージは `packages/jpn` にあります。形態素解析には [vibrato](https://github.com/daac-tools/vibrato) を使用しており、WASM として使うために一部を Rust で実装しています。
- スタンドアロンで動作する PostgreSQL は `packages/pglite` にあります。
- モノレポルートの設定ファイル (oxfmt, mise) は `.config/` にあります。
- 各パッケージのほとんどの設定ファイル (tsconfig, vitest, oxlint, oxfmt, mise) は、パッケージディレクトリーから見て `.config/` にあります。

## コマンド

```sh
# 完全なテスト (順番: server vitest → client vitest → format → lint → typecheck)
mise run test

# 個々のステップ
mise run test:server      # npx vitest --config ./.config/vitest.server.ts
mise run test:client      # npx vitest --config ./.config/vitest.client.ts
mise run test:format      # npx oxfmt --check
mise run test:lint        # npx oxlint
mise run test:typecheck   # npx tsc --noEmit

# フォーマット
mise run format

# ビルド
npm run build

# 依存関係の更新 (npm-check-upates → pnpm install → playwright install)
mise run update
```

## コード規約

- 高品質な TSDoc と必要最低限の実装コメントの付与を心がけます。`@param <パラメーター名>` の直後にハイフン（-）を付けません。
- 必要に応じて、読み手がコードの背景、意図、ロジックを即座に理解できる、簡潔かつ丁寧な技術解説を提供します。
- エディター上の視認性を理由に、文章の途中や句読点で改行しません。

## リンティング、型チェック、フォーマット

- 型エラーがない場合は、ランダムにキャストしないでください（たとえば、`as any`)。 型を検証するには `mise run test:typecheck` を実行します。
- 変更内容がリンティングに合格していることを確認します。検証するには `mise run lint` を実行します。

## テスト

- テストフレームワークに Vitest を使用します。
- テストファイルのパターンは、`*.test.ts` (ブラウザー/サーバー共通)、`*.client.test.ts` (ブラウザー専用)、`*.server.test.ts` (サーバー専用) のいずれか 1 つです。
- クライアントテストは、Vitest の Browser Mode を利用して実際の Playwright ブラウザー上で実行します。
- CI がデバッグモードであれば コンパイル時定数 `__DEBUG__` は true になります。手動でデバッグモードにするには環境変数 `DEBUG` を `1` に設定します。
- コンパイル時定数 `__CLIENT__` と `__SERVER__` はそれぞれ真偽値でテストのランタイムを示します。

## ビルドおよび型チェックに関する注意点

- すべての tsconfig で `erasableSyntaxOnly: true` を有効化 (`enum` や 型定義以外の宣言を含む `namespace` の使用、パラメータープロパティーなどの、実行時にコードが生成される構文は使用不可) されています。

## エラー

これらの指針は、公開パッケージによってスローされるエラーにのみ適用されます。

すべてのエラーメッセージは次のものでなければなりません:

1. **何が起こったのかを話す** - 問題を明確に説明します。
2. **なぜそれが問題なのかを述べてください** - 結果を説明してください。
3. **解決方法を示す** - 実用的なガイダンスを提供します。
