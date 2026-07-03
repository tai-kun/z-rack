use ruzstd::decoding::StreamingDecoder;
use std::io::Read;
use vibrato::{Dictionary, Tokenizer};
use wasm_bindgen::prelude::*;

/// vibrato 形態素解析器の WASM バインディング。
///
/// zstd 圧縮された辞書データから `Tokenizer` を構築し、テキストを形態素解析する。
#[wasm_bindgen]
pub struct VibratoWasm {
    tokenizer: Tokenizer,
}

#[wasm_bindgen]
impl VibratoWasm {
    /// 展開済みの辞書バイナリから `VibratoWasm` を初期化する。
    ///
    /// `from_zstd` からのみ呼ばれる内部メソッド。
    fn new(
        dict_data: &[u8],
        ignore_space: Option<bool>,
        max_grouping_len: Option<usize>,
    ) -> Result<VibratoWasm, JsError> {
        let dict = Dictionary::read(dict_data)?;
        let tokenizer = Tokenizer::new(dict)
            .ignore_space(ignore_space.unwrap_or_default())?
            .max_grouping_len(max_grouping_len.unwrap_or_default());

        Ok(VibratoWasm { tokenizer })
    }

    /// zstd 圧縮された辞書データから `VibratoWasm` を構築する。
    ///
    /// 内部的に `StreamingDecoder` で伸長してから `Dictionary::read` に渡す。
    ///
    /// - `dict_data`: zstd 圧縮された辞書のバイナリ
    /// - `ignore_space`: `true` で空白トークンを無視する
    /// - `max_grouping_len`: 未知語の最大グルーピング長。`0` でグルーピングしない
    #[wasm_bindgen]
    pub fn from_zstd(
        dict_data: &[u8],
        ignore_space: Option<bool>,
        max_grouping_len: Option<usize>,
    ) -> Result<VibratoWasm, JsError> {
        let mut decoder = StreamingDecoder::new(dict_data)?;

        let mut decompressed = Vec::new();
        decoder.read_to_end(&mut decompressed)?;

        Self::new(&decompressed, ignore_space, max_grouping_len)
    }

    /// テキストを形態素解析し、指定された品詞を除外した表層形の配列を返す。
    ///
    /// 各トークンの `feature()` をカンマで分割し、最初の要素を品詞として `omit_pos` と照合する。
    /// 一致する品詞のトークンは結果から除外される。
    ///
    /// - `text`: 解析対象の文字列
    /// - `omit_pos`: 除外する品詞のリスト（例: `["助詞", "助動詞"]`）
    #[wasm_bindgen]
    pub fn tokenize(&self, text: &str, omit_pos: Vec<String>) -> Result<JsValue, JsError> {
        let mut worker = self.tokenizer.new_worker();
        worker.reset_sentence(text);
        worker.tokenize();

        let tokens: Vec<String> = worker
            .token_iter()
            .filter(|t| {
                // feature() をカンマで区切り、最初の要素（品詞）を取得します。
                let pos = t.feature().split(',').next().unwrap_or("");
                // omit_pos リストに含まれていないものだけを残します。
                !omit_pos.iter().any(|i| i == pos)
            })
            .map(|t| t.surface().to_string())
            .collect();

        Ok(serde_wasm_bindgen::to_value(&tokens)?)
    }

    /// テキストを形態素解析し、すべてのトークンの表層形を返す。
    ///
    /// 品詞によるフィルタリングは行わず、解析結果のすべてのトークンを取得する。
    ///
    /// - `text`: 解析対象の文字列
    #[wasm_bindgen]
    pub fn tokenize_all(&self, text: &str) -> Result<JsValue, JsError> {
        let mut worker = self.tokenizer.new_worker();
        worker.reset_sentence(text);
        worker.tokenize();

        let tokens: Vec<String> = worker
            .token_iter()
            .map(|t| t.surface().to_string())
            .collect();

        Ok(serde_wasm_bindgen::to_value(&tokens)?)
    }
}
