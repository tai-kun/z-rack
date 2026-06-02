import { type Language, type ErrorOptions, ErrorBase, setErrorMessage } from "@z-rack/core";

export type UnsupportedLanguageErrorMeta = {
  readonly lang: Language;
};

export type UnsupportedLanguageErrorArgs = UnsupportedLanguageErrorMeta;

export class UnsupportedLanguageError extends ErrorBase<UnsupportedLanguageErrorMeta> {
  static {
    this.prototype.name = "ZRackUnsupportedLanguageError";
  }

  public constructor(args: UnsupportedLanguageErrorArgs, options?: ErrorOptions) {
    super(args, ({ lang }) => `Unsupported language: ${JSON.stringify(lang)}`, options);
  }
}

setErrorMessage(
  UnsupportedLanguageError,
  ({ lang }) => `サポートされていない言語: ${JSON.stringify(lang)}`,
  "ja",
);

export class ZRackIsOpenError extends ErrorBase<undefined> {
  static {
    this.prototype.name = "ZRackIsOpenError";
  }

  public constructor(options?: ErrorOptions) {
    super("ZRack is open", options);
  }
}

setErrorMessage(ZRackIsOpenError, "ZRack は開いています", "ja");

export class ZRackIsNotOpenError extends ErrorBase<undefined> {
  static {
    this.prototype.name = "ZRackIsNotOpenError";
  }

  public constructor(options?: ErrorOptions) {
    super("ZRack is not open", options);
  }
}

setErrorMessage(ZRackIsNotOpenError, "ZRack は開いていません", "ja");

export type ObjectExistsErrorMeta = {
  readonly key: string;
};

export type ObjectExistsErrorArgs = ObjectExistsErrorMeta;

export class ObjectExistsError extends ErrorBase<ObjectExistsErrorMeta> {
  static {
    this.prototype.name = "ZRackObjectExistsError";
  }

  public constructor(args: ObjectExistsErrorArgs, options?: ErrorOptions) {
    super(args, ({ key }) => `Object exists: ${JSON.stringify(key)}`, options);
  }
}

setErrorMessage(
  ObjectExistsError,
  ({ key }) => `オブジェクトが存在します: ${JSON.stringify(key)}`,
  "ja",
);

export type ObjectNotFoundErrorMeta = {
  readonly key: string;
};

export type ObjectNotFoundErrorArgs = ObjectNotFoundErrorMeta;

export class ObjectNotFoundError extends ErrorBase<ObjectNotFoundErrorMeta> {
  static {
    this.prototype.name = "ZRackObjectNotFoundError";
  }

  public constructor(args: ObjectNotFoundErrorArgs, options?: ErrorOptions) {
    super(args, ({ key }) => `Object not found: ${JSON.stringify(key)}`, options);
  }
}

setErrorMessage(
  ObjectNotFoundError,
  ({ key }) => `オブジェクトが見つかりません: ${JSON.stringify(key)}`,
  "ja",
);
