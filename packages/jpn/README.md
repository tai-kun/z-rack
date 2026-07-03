# @z-rack/jpn

z-rack に日本語の全文検索機能を追加するプラグインパッケージです。[Vibrato](https://github.com/daac-tools/vibrato) 形態素解析器を WebAssembly 経由で利用し、`ITextSearch` インターフェースを実装した `Vibrato` クラスを提供します。

## インストール

```sh
pnpm add @z-rack/jpn
```

## 使い方

```ts
import { Vibrato } from "@z-rack/jpn";
import vibratoWasmUri from "@z-rack/jpn/vibrato.wasm?url";
import vibratoDictUri from "./dict.zstd?url";

Vibrato.setWasmSource(vibratoWasmUri);

const vibrato = new Vibrato(
  {
    url: vibratoDictUri,
    checksum: "82a6da70bb4a17be70f20ff44f650f9ad1d2b0b4fcb2f39c17fc797f92d0ab75",
  },
  {
    omitPos: ["助詞"],
  },
);

await vibrato.open();

vibrato.tokenize({
  language: "jpn",
  text: "私はラーメンが好きです",
});
// ["私", "は", "ラーメン", "が", "好き", "です"]
```

## 設計

### 日本語・英語の両対応

日本語は Vibrato による形態素解析、英語は空白分割によるトークナイズを行います。
`supportedLanguages` は `["jpn", "eng"]`、`defaultLanguage` は `"jpn"` です。

### WASM と辞書の管理

`Vibrato.setWasmSource()` で WASM バイナリーの位置をグローバルに設定します。
辞書データは URL または `Uint8Array` で渡し、zstd 圧縮された状態から Rust 側で展開します。
URL 指定時は SHA-256 チェックサムを検証し、一致しない場合は `VibratoChecksumError` を投げます。

### 品詞フィルタリング

`omitPos` オプションで除外する品詞を指定できます。
指定がない場合は全トークンを返します。

## API

| プロパティー         | 値                                               |
| -------------------- | ------------------------------------------------ |
| `format`             | インスタンスの設定を一意に識別するクエリー文字列 |
| `textConfig`         | `"simple"`                                       |
| `defaultLanguage`    | `"jpn"`                                          |
| `supportedLanguages` | `["jpn", "eng"]`                                 |

## エラー

- `VibratoChecksumError` — 辞書のチェックサム不一致
- `VibratoNotOpenError` — 未 open 時の tokenize 呼び出し
- `VibratoWasmSourceNotSetError` — WASM ソース未設定

## ビルド

Rust ソースは `src/lib.rs` にあり、`wasm-pack` と `wasm-opt` で WASM バイナリーにコンパイルされます。

```sh
cargo install wasm-pack wasm-opt
npm run build
```
