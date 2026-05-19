use ruzstd::decoding::StreamingDecoder;
use std::io::Read;
use vibrato::{Dictionary, Tokenizer};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct VibratoWasm {
    tokenizer: Tokenizer,
}

#[wasm_bindgen]
impl VibratoWasm {
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
