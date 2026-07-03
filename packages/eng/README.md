# @z-rack/eng

z-rack に英語の全文検索機能を追加するプラグインパッケージです。`ITextSearch` インターフェースを実装した `English` クラスを提供します。

## インストール

```sh
pnpm add @z-rack/eng
```

## 使い方

```ts
import { English } from "@z-rack/eng";

const eng = new English();
eng.isOpen; // true（起動待機不要）
eng.normalize({ text: "Ｈｅｌｌｏ" }); // "Hello"（NFKC 正規化）
```

## 設計

このパッケージは意図的にトークナイズ処理を持ちません。Unicode NFKC 正規化のみを実行し、単語分割は自動分割に委ねます。これにより辞書や WASM バイナリーが不要で、軽量かつ即座に利用可能です。

- `format` — `package=%40z-rack%2Feng&version=0&class=English`
- `textConfig` — `"english"`
- `defaultLanguage` — `"eng"`
- `supportedLanguages` — `["eng"]`
