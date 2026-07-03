# @z-rack/core

z-rack エコシステムの基盤パッケージです。すべての z-rack パッケージが依存する共有の型定義、バリデーションスキーマ、エラークラス、インターフェース、ユーティリティーを提供します。

## インストール

```sh
pnpm add @z-rack/core
```

## 主な機能

### 型とバリデーションスキーマ

Valibot を用いて定義されたブランデッド型のスキーマ郡です。
`ObjectId`、`EntityId`、`ObjectKey`、`EntityTag`、`ObjectSize`、`MimeType`、`Language` などのドメイン固有の型を提供します。

```ts
import { v, ObjectKeySchema } from "@z-rack/core";

const key = v.parseInput(ObjectKeySchema, "foo/bar.txt");
key.basename; // "bar.txt"
key.prefix; // "foo"
```

### エラークラス

階層化されたエラークラスを提供します。
すべてのエラーは `ErrorBase` を継承し、国際化に対応しています。

- `InvalidInputError` / `InvalidOutputError` / `InvalidInputTypeError` — 入力値のバリデーション失敗
- `UnreachableError` / `UnexpectedError` — 内部ロジックの不整合
- `HttpResponseError` — HTTP レスポンスのエラー

### プラグインインターフェース

z-rack の拡張ポイントとなるインターフェースを定義します。

- `ITextSearch` — テキスト検索エンジンの契約
- `IDatabaseClient` / `ITransaction` — データベースクライアントの契約

### ユーティリティー

- `loadWasm` — WebAssembly モジュールの読み込み（ブラウザー / Node.js 対応）
- `ObjectKey` — パス形式のキーのパースと操作
- `IdleTaskQueue` — アイドル時間を利用したタスクスケジューリング
- `bytesToHex` / `utf8` / `isError` / `unreachable` — 汎用ユーティリティー
