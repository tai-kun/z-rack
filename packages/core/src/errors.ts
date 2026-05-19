import { type ErrorMeta, I18nErrorBase, setErrorMessage, type ErrorOptions } from "i18n-error-base";
import getTypeName from "type-name";
import type { BaseIssue } from "valibot";
import { safeParse, union, null_, string } from "valibot";

import inspect from "./inspect.js";

export type { ErrorMeta, ErrorOptions };
export { setErrorMessage };

// -------------------------------------------------------------------------------------------------
//
// 一般
//
// -------------------------------------------------------------------------------------------------

export class ErrorBase<
  TMeta extends ErrorMeta | undefined = ErrorMeta | undefined,
> extends I18nErrorBase<TMeta> {}

// -------------------------------------------------------------------------------------------------
//
// 入力値検証
//
// -------------------------------------------------------------------------------------------------

export class InvalidUsageErrorBase<
  TMeta extends ErrorMeta | undefined = ErrorMeta | undefined,
> extends ErrorBase<TMeta> {}

// -------------------------------------------------------------------------------------------------

export type Issue = BaseIssue<unknown>;

export type InvalidInputErrorMeta = {
  readonly input: unknown;
  readonly issues: readonly [Issue, ...Issue[]];
};

export type InvalidInputErrorArgs = {
  readonly value: unknown;
  readonly issues: readonly [Issue, ...Issue[]];
};

export class InvalidInputError extends InvalidUsageErrorBase<InvalidInputErrorMeta> {
  static {
    this.prototype.name = "ZRackInvalidInputError";
  }

  public constructor(args: InvalidInputErrorArgs, options?: ErrorOptions) {
    const { value: input, issues } = args;
    super({ input, issues }, ({ issues }) => issues.map((i) => i.message).join(": "), options);
  }
}

// -------------------------------------------------------------------------------------------------

export type InvalidOutputErrorMeta = {
  readonly output: unknown;
  readonly issues: readonly [Issue, ...Issue[]];
};

export type InvalidOutputErrorArgs = {
  readonly value: unknown;
  readonly issues: readonly [Issue, ...Issue[]];
};

export class InvalidOutputError extends InvalidUsageErrorBase<InvalidOutputErrorMeta> {
  static {
    this.prototype.name = "ZRackInvalidOutputError";
  }

  public constructor(args: InvalidOutputErrorArgs, options?: ErrorOptions) {
    const { value: output, issues } = args;
    super({ output, issues }, ({ issues }) => issues.map((i) => i.message).join(": "), options);
  }
}

// -------------------------------------------------------------------------------------------------

const EXPECTED_TOKEN = "(null | string)";
const RECEIVED_TOKEN = "11298";

function getTypeErrorMessageTemplate() {
  const result = safeParse(
    union([null_(), string()]), // EXPECTED_TOKEN
    11298, // RECEIVED_TOKEN
  );
  if (!result.success) {
    return result.issues[0].message;
  }

  throw new UnreachableError({ value: result });
}

function getTypeErrorMessageText(expected: string, received: string): string {
  const template = getTypeErrorMessageTemplate();
  return template.replace(EXPECTED_TOKEN, expected).replace(RECEIVED_TOKEN, received);
}

export type InvalidInputTypeErrorMeta = {
  readonly input: unknown;
  readonly inputType: string;
  readonly expectedType: string;
};

export type InvalidInputTypeErrorArgs = {
  readonly input: unknown;
  readonly inputType?: string | undefined;
  readonly expectedType: string;
};

export class InvalidInputTypeError extends InvalidUsageErrorBase<InvalidInputTypeErrorMeta> {
  static {
    this.prototype.name = "ZRackInvalidInputTypeError";
  }

  public constructor(args: InvalidInputTypeErrorArgs, options?: ErrorOptions) {
    const { input, inputType = getTypeName(input), expectedType } = args;
    super(
      {
        input,
        inputType,
        expectedType,
      },
      ({ inputType, expectedType }) => getTypeErrorMessageText(expectedType, inputType),
      options,
    );
  }
}

export class HttpResponseError extends ErrorBase<undefined> {
  static {
    this.prototype.name = "ZRackHttpResponseError";
  }

  public constructor(response: Response, options?: ErrorOptions) {
    super(`${response.url} [${response.status}] ${response.statusText}`, options);
  }
}

// -------------------------------------------------------------------------------------------------

export class UnexpectedErrorBase<
  TMeta extends ErrorMeta | undefined = ErrorMeta | undefined,
> extends ErrorBase<TMeta> {}

// -------------------------------------------------------------------------------------------------

export type UnreachableErrorMeta = {
  readonly value?: unknown;
};

export type UnreachableErrorArgs = UnreachableErrorMeta;

export class UnreachableError extends UnexpectedErrorBase<UnreachableErrorMeta> {
  static {
    this.prototype.name = "ZRackUnreachableError";
  }

  public constructor(args: UnreachableErrorArgs, options?: ErrorOptions) {
    super(
      args,
      (meta) =>
        "value" in meta
          ? "Encountered impossible value: " + inspect(meta.value)
          : "Unreachable code reached",
      options,
    );
  }
}

setErrorMessage(
  UnreachableError,
  (meta) =>
    "value" in meta
      ? "不可能な値に遭遇しました: " + inspect(meta.value)
      : "到達できないコードに到達しました",
  "ja",
);

// -------------------------------------------------------------------------------------------------

export type UnexpectedErrorMeta = {
  readonly output: unknown;
  readonly issues: readonly [Issue, ...Issue[]];
};

export type UnexpectedErrorArgs = {
  readonly value: unknown;
  readonly issues: readonly [Issue, ...Issue[]];
};

export class UnexpectedError extends UnexpectedErrorBase<UnexpectedErrorMeta> {
  static {
    this.prototype.name = "ZRackUnexpectedError";
  }

  public constructor(args: UnexpectedErrorArgs, options?: ErrorOptions) {
    const { value: output, issues } = args;
    super({ output, issues }, ({ issues }) => issues.map((i) => i.message).join(": "), options);
  }
}

// -------------------------------------------------------------------------------------------------
