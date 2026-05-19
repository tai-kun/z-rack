import { ErrorBase, setErrorMessage, type ErrorOptions } from "@z-rack/core";

/**
 * 辞書データのチェックサムエラーに関するメタ情報の型定義です。
 */
export type VibratoChecksumErrorMeta = {
  /**
   * 期待されていたチェックサムの文字列です。
   */
  readonly expected: string;

  /**
   * 実際に算出されたチェックサムの文字列です。
   */
  readonly actual: string;
};

/**
 * VibratoChecksumError を初期化する際に渡す引数の型定義です。
 */
export type VibratoChecksumErrorArgs = VibratoChecksumErrorMeta;

/**
 * 辞書データのチェックサムが一致しない場合に投げられるエラーです。
 */
export class VibratoChecksumError extends ErrorBase<VibratoChecksumErrorMeta> {
  static {
    this.prototype.name = "ZRackJpnVibratoChecksumError";
  }

  public constructor(args: VibratoChecksumErrorArgs, options?: ErrorOptions) {
    super(
      args,
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
 * Vibrato インスタンスが初期化される前に操作が行われた場合に投げられるエラーです。
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
 * Vibrato WASM ソースを設定していない場合に投げられるエラーです。
 */
export class VibratoWasmSourceNotSetError extends ErrorBase<undefined> {
  static {
    this.prototype.name = "ZRackJpnVibratoWasmSourceNotSetError";
  }

  public constructor() {
    super("Vivrato WASM source not set");
  }
}

/*#__PURE__*/ setErrorMessage(
  VibratoWasmSourceNotSetError,
  "Vivrato WASM ソースがありません",
  "ja",
);
