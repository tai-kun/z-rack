import { type ErrorOptions, ErrorBase, setErrorMessage } from "@z-rack/core";

/**
 * 辞書データのチェックサム不一致エラーのメタ情報です。
 */
export type VibratoChecksumErrorMeta = {
  /**
   * 期待される SHA-256 チェックサム（16 進数）です。
   */
  readonly expected: string;

  /**
   * 実際に算出された SHA-256 チェックサム（16 進数）です。
   */
  readonly actual: string;
};

/**
 * `VibratoChecksumError` のコンストラクター引数です。
 */
export type VibratoChecksumErrorArgs = ErrorOptions & VibratoChecksumErrorMeta;

/**
 * ダウンロードした辞書データの SHA-256 チェックサムが期待値と一致しない場合に投げられます。
 */
export class VibratoChecksumError extends ErrorBase<VibratoChecksumErrorMeta> {
  static {
    this.prototype.name = "ZRackJpnVibratoChecksumError";
  }

  public constructor(args: VibratoChecksumErrorArgs) {
    const { actual, expected, ...options } = args;
    const meta = { actual, expected };
    super(
      meta,
      ({ actual, expected }) =>
        `Dictionary data checksum mismatch (expected: ${expected}, actual: ${actual})`,
      options,
    );
  }
}

/*#__PURE__*/ setErrorMessage(
  VibratoChecksumError,
  ({ actual, expected }) => `辞書データのチェックサムの不一致 (期待: ${expected}, 実際: ${actual})`,
  "ja",
);

/**
 * `Vibrato` インスタンスが開かれる前に `tokenize` が呼ばれた場合に投げられます。
 */
export class VibratoNotOpenError extends ErrorBase<undefined> {
  static {
    this.prototype.name = "ZRackJpnVibratoNotOpenError";
  }

  public constructor() {
    super("Vibrato instance is not open");
  }
}

/*#__PURE__*/ setErrorMessage(VibratoNotOpenError, "Vibrato インスタンスが開いていません", "ja");

/**
 * `Vibrato.setWasmSource` が呼ばれずに `open` が実行された場合に投げられます。
 */
export class VibratoWasmSourceNotSetError extends ErrorBase<undefined> {
  static {
    this.prototype.name = "ZRackJpnVibratoWasmSourceNotSetError";
  }

  public constructor(options?: ErrorOptions) {
    super("Vivrato WASM source not set", options);
  }
}

/*#__PURE__*/ setErrorMessage(
  VibratoWasmSourceNotSetError,
  "Vivrato WASM ソースがありません",
  "ja",
);
