import { type ErrorMeta, type ErrorOptions, I18nErrorBase, setErrorMessage } from "i18n-error-base";
import { inspect } from "inspect-lite";
import getTypeName from "type-name";
import type { BaseIssue } from "valibot";
import { safeParse, union, null_, string } from "valibot";

export type { ErrorMeta, ErrorOptions };
export { setErrorMessage };

// -------------------------------------------------------------------------------------------------
//
// 一般
//
// -------------------------------------------------------------------------------------------------

/**
 * このパッケージにおけるエラークラスの基底です。
 *
 * @example
 * ```
 * import { ErrorBase } from "@z-rack/core";
 *
 * class MyError extends ErrorBase<{ readonly code: number }> {}
 * ```
 */
export class ErrorBase<
  TMeta extends ErrorMeta | undefined = ErrorMeta | undefined,
> extends I18nErrorBase<TMeta> {}

// -------------------------------------------------------------------------------------------------
//
// 入力値検証
//
// -------------------------------------------------------------------------------------------------

/**
 * 不正な使用方法を示すエラークラスの基底です。
 *
 * @example
 * ```
 * import { InvalidUsageErrorBase } from "@z-rack/core";
 *
 * class MyUsageError extends InvalidUsageErrorBase<{ readonly detail: string }> {}
 * ```
 */
export class InvalidUsageErrorBase<
  TMeta extends ErrorMeta | undefined = ErrorMeta | undefined,
> extends ErrorBase<TMeta> {}

// -------------------------------------------------------------------------------------------------

/**
 * Valibot のバリデーション問題です。
 *
 * この型は `BaseIssue<unknown>` のエイリアスであり、パッケージ内で統一して使用するために定義されています。
 */
export type Issue = BaseIssue<unknown>;

/**
 * `InvalidInputError` のメタデータです。
 */
export type InvalidInputErrorMeta = {
  /** バリデーションに失敗した入力値です。 */
  readonly input: unknown;
  /** 発生したバリデーション問題の一覧です。少なくとも 1 つの問題を含みます。 */
  readonly issues: readonly [Issue, ...Issue[]];
};

/**
 * `InvalidInputError` のコンストラクター引数です。
 */
export type InvalidInputErrorArgs = ErrorOptions & {
  /** バリデーションに失敗した値です。 */
  readonly value: unknown;
  /** 発生したバリデーション問題の一覧です。少なくとも 1 つの問題を含みます。 */
  readonly issues: readonly [Issue, ...Issue[]];
};

/**
 * 入力値がバリデーションに失敗したことを示すエラーです。
 *
 * @example
 * ```
 * import { InvalidInputError } from "@z-rack/core";
 *
 * throw new InvalidInputError({
 *   value: 123,
 *   issues: [{ message: "expected string, received number" }] as any,
 * });
 * ```
 */
export class InvalidInputError extends InvalidUsageErrorBase<InvalidInputErrorMeta> {
  static {
    this.prototype.name = "ZRackInvalidInputError";
  }

  public constructor(args: InvalidInputErrorArgs) {
    const { value: input, issues, ...options } = args;
    const meta = { input, issues };
    super(meta, ({ issues }) => issues.map((i) => i.message).join(": "), options);
  }
}

// -------------------------------------------------------------------------------------------------

/**
 * `InvalidOutputError` のメタデータです。
 */
export type InvalidOutputErrorMeta = {
  /** バリデーションに失敗した出力値です。 */
  readonly output: unknown;
  /** 発生したバリデーション問題の一覧です。少なくとも 1 つの問題を含みます。 */
  readonly issues: readonly [Issue, ...Issue[]];
};

/**
 * `InvalidOutputError` のコンストラクター引数です。
 */
export type InvalidOutputErrorArgs = ErrorOptions & {
  /** バリデーションに失敗した値です。 */
  readonly value: unknown;
  /** 発生したバリデーション問題の一覧です。少なくとも 1 つの問題を含みます。 */
  readonly issues: readonly [Issue, ...Issue[]];
};

/**
 * 出力値がバリデーションに失敗したことを示すエラーです。
 *
 * @example
 * ```
 * import { InvalidOutputError } from "@z-rack/core";
 *
 * throw new InvalidOutputError({
 *   value: "invalid data",
 *   issues: [{ message: "expected valid output" }] as any,
 * });
 * ```
 */
export class InvalidOutputError extends InvalidUsageErrorBase<InvalidOutputErrorMeta> {
  static {
    this.prototype.name = "ZRackInvalidOutputError";
  }

  public constructor(args: InvalidOutputErrorArgs) {
    const { value: output, issues, ...options } = args;
    const meta = { output, issues };
    super(meta, ({ issues }) => issues.map((i) => i.message).join(": "), options);
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

/**
 * `InvalidInputTypeError` のメタデータです。
 */
export type InvalidInputTypeErrorMeta = {
  /** 型検証に失敗した入力値です。 */
  readonly input: unknown;
  /** 入力値の実際の型名です。 */
  readonly inputType: string;
  /** 期待されていた型名です。 */
  readonly expectedType: string;
};

/**
 * `InvalidInputTypeError` のコンストラクター引数です。
 */
export type InvalidInputTypeErrorArgs = ErrorOptions & {
  /** 型検証に失敗した値です。 */
  readonly input: unknown;
  /** 入力値の実際の型名です。省略時は自動判定されます。 */
  readonly inputType?: string | undefined;
  /** 期待されていた型名です。 */
  readonly expectedType: string;
};

/**
 * 入力値の型が期待される型と異なることを示すエラーです。
 *
 * @example
 * ```
 * import { InvalidInputTypeError } from "@z-rack/core";
 *
 * throw new InvalidInputTypeError({
 *   input: 42,
 *   expectedType: "string",
 * });
 * ```
 */
export class InvalidInputTypeError extends InvalidUsageErrorBase<InvalidInputTypeErrorMeta> {
  static {
    this.prototype.name = "ZRackInvalidInputTypeError";
  }

  public constructor(args: InvalidInputTypeErrorArgs) {
    const { input, inputType = getTypeName(input), expectedType, ...options } = args;
    const meta = { input, inputType, expectedType };
    super(
      meta,
      ({ inputType, expectedType }) => getTypeErrorMessageText(expectedType, inputType),
      options,
    );
  }
}

/**
 * `HttpResponseError` のコンストラクター引数です。
 */
export type HttpResponseErrorArgs = ErrorOptions & {
  /** 異常終了した HTTP レスポンスです。 */
  readonly response: Response;
};

/**
 * HTTP レスポンスが異常終了したことを示すエラーです。
 *
 * @example
 * ```
 * import { HttpResponseError } from "@z-rack/core";
 *
 * const response = new Response(null, { status: 404, statusText: "Not Found" });
 * throw new HttpResponseError(response);
 * // => ZRackHttpResponseError:  [404] Not Found
 * ```
 */
export class HttpResponseError extends ErrorBase<undefined> {
  static {
    this.prototype.name = "ZRackHttpResponseError";
  }

  public constructor(args: HttpResponseErrorArgs) {
    const { response, ...options } = args;
    super(`${response.url} [${response.status}] ${response.statusText}`, options);
  }
}

// -------------------------------------------------------------------------------------------------

/**
 * 予期しないエラーを示すエラークラスの基底です。
 *
 * @example
 * ```
 * import { UnexpectedErrorBase } from "@z-rack/core";
 *
 * class MyUnexpectedError extends UnexpectedErrorBase<{ readonly detail: string }> {}
 * ```
 */
export class UnexpectedErrorBase<
  TMeta extends ErrorMeta | undefined = ErrorMeta | undefined,
> extends ErrorBase<TMeta> {}

// -------------------------------------------------------------------------------------------------

/**
 * `UnreachableError` のメタデータです。
 */
export type UnreachableErrorMeta = {
  /** 到達不可能なコードパスに渡された値です。デバッグのために使用されます。 */
  readonly value?: unknown;
};

/**
 * `UnreachableError` のコンストラクター引数です。
 */
export type UnreachableErrorArgs = ErrorOptions & UnreachableErrorMeta;

/**
 * 到達不可能なコードパスに到達したことを示すエラーです。
 *
 * @example
 * ```
 * import { UnreachableError } from "@z-rack/core";
 *
 * function assertNever(x: never): never {
 *   throw new UnreachableError({ value: x });
 * }
 * ```
 */
export class UnreachableError extends UnexpectedErrorBase<UnreachableErrorMeta> {
  static {
    this.prototype.name = "ZRackUnreachableError";
  }

  public constructor(args: UnreachableErrorArgs = {}) {
    const { value, ...options } = args;
    const meta = "value" in args ? { value } : {};
    super(
      meta,
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

/**
 * `UnexpectedError` のメタデータです。
 */
export type UnexpectedErrorMeta = {
  /** 予期しない出力値です。 */
  readonly output: unknown;
  /** 発生したバリデーション問題の一覧です。少なくとも 1 つの問題を含みます。 */
  readonly issues: readonly [Issue, ...Issue[]];
};

/**
 * `UnexpectedError` のコンストラクター引数です。
 */
export type UnexpectedErrorArgs = ErrorOptions & {
  /** 予期しない値です。 */
  readonly value: unknown;
  /** 発生したバリデーション問題の一覧です。少なくとも 1 つの問題を含みます。 */
  readonly issues: readonly [Issue, ...Issue[]];
};

/**
 * 予期しない出力値が発生したことを示すエラーです。
 */
export class UnexpectedError extends UnexpectedErrorBase<UnexpectedErrorMeta> {
  static {
    this.prototype.name = "ZRackUnexpectedError";
  }

  public constructor(args: UnexpectedErrorArgs) {
    const { value: output, issues, ...options } = args;
    const meta = { output, issues };
    super(meta, ({ issues }) => issues.map((i) => i.message).join(": "), options);
  }
}

// -------------------------------------------------------------------------------------------------
