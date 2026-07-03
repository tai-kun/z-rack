import { type Language, type ErrorOptions, ErrorBase, setErrorMessage } from "@z-rack/core";

/**
 * サポートされていない言語が指定されたことを示すエラーのメタデータ型です。
 */
export type UnsupportedLanguageErrorMeta = {
  readonly lang: Language;
};

/**
 * `UnsupportedLanguageError` のコンストラクター引数型です。
 */
export type UnsupportedLanguageErrorArgs = ErrorOptions & UnsupportedLanguageErrorMeta;

/**
 * サポートされていない言語が指定されたときに投げられるエラーです。
 */
export class UnsupportedLanguageError extends ErrorBase<UnsupportedLanguageErrorMeta> {
  static {
    this.prototype.name = "ZRackUnsupportedLanguageError";
  }

  public constructor(args: UnsupportedLanguageErrorArgs) {
    const { lang, ...options } = args;
    const meta = { lang };
    super(meta, ({ lang }) => `Unsupported language: ${JSON.stringify(lang)}`, options);
  }
}

setErrorMessage(
  UnsupportedLanguageError,
  ({ lang }) => `サポートされていない言語: ${JSON.stringify(lang)}`,
  "ja",
);

/**
 * ZRack インスタンスが既に開かれている状態で開こうとしたときに投げられるエラーです。
 */
export class ZRackIsOpenError extends ErrorBase<undefined> {
  static {
    this.prototype.name = "ZRackIsOpenError";
  }

  public constructor(options?: ErrorOptions) {
    super("ZRack is open", options);
  }
}

setErrorMessage(ZRackIsOpenError, "ZRack は開いています", "ja");

/**
 * ZRack インスタンスが閉じられている状態で操作しようとしたときに投げられるエラーです。
 */
export class ZRackIsNotOpenError extends ErrorBase<undefined> {
  static {
    this.prototype.name = "ZRackIsNotOpenError";
  }

  public constructor(options?: ErrorOptions) {
    super("ZRack is not open", options);
  }
}

setErrorMessage(ZRackIsNotOpenError, "ZRack は開いていません", "ja");

/**
 * 既に存在するキーでオブジェクトを作成しようとしたことを示すエラーのメタデータ型です。
 */
export type ObjectExistsErrorMeta = {
  readonly key: string;
};

/**
 * `ObjectExistsError` のコンストラクター引数型です。
 */
export type ObjectExistsErrorArgs = ErrorOptions & ObjectExistsErrorMeta;

/**
 * 既に存在するキーでオブジェクトを作成しようとしたときに投げられるエラーです。
 */
export class ObjectExistsError extends ErrorBase<ObjectExistsErrorMeta> {
  static {
    this.prototype.name = "ZRackObjectExistsError";
  }

  public constructor(args: ObjectExistsErrorArgs) {
    const { key, ...options } = args;
    const meta = { key };
    super(meta, ({ key }) => `Object exists: ${JSON.stringify(key)}`, options);
  }
}

setErrorMessage(
  ObjectExistsError,
  ({ key }) => `オブジェクトが存在します: ${JSON.stringify(key)}`,
  "ja",
);

/**
 * 存在しないキーでオブジェクトを参照しようとしたことを示すエラーのメタデータ型です。
 */
export type ObjectNotFoundErrorMeta = {
  readonly key: string;
};

/**
 * `ObjectNotFoundError` のコンストラクター引数型です。
 */
export type ObjectNotFoundErrorArgs = ErrorOptions & ObjectNotFoundErrorMeta;

/**
 * 存在しないキーでオブジェクトを参照しようとしたときに投げられるエラーです。
 */
export class ObjectNotFoundError extends ErrorBase<ObjectNotFoundErrorMeta> {
  static {
    this.prototype.name = "ZRackObjectNotFoundError";
  }

  public constructor(args: ObjectNotFoundErrorArgs) {
    const { key, ...options } = args;
    const meta = { key };
    super(meta, ({ key }) => `Object not found: ${JSON.stringify(key)}`, options);
  }
}

setErrorMessage(
  ObjectNotFoundError,
  ({ key }) => `オブジェクトが見つかりません: ${JSON.stringify(key)}`,
  "ja",
);
