import { tryCaptureStackTrace } from "try-capture-stack-trace";
import { type InferOutput, safeParse } from "valibot";

import {
  InvalidInputError,
  InvalidOutputError,
  UnexpectedError,
  type InvalidInputErrorArgs,
  type InvalidOutputErrorArgs,
} from "./errors.js";

export {
  any,
  omit,
  pipe,
  brand,
  regex,
  union,
  bigint,
  finite,
  length,
  number,
  string,
  boolean,
  maxSize,
  minSize,
  unknown,
  endsWith,
  instance,
  maxValue,
  minValue,
  nullable,
  optional,
  picklist,
  maxLength,
  minLength,
  safeInteger,
  toLowerCase,
} from "valibot";
export type { Brand, BaseIssue, BaseSchema, InferInput, InferOutput } from "valibot";

export {
  set,
  utf8,
  array,
  tuple,
  object,
  uuidv7,
  maxBytes,
  transform,
} from "@tai-kun/valibot-extra-lab";

type BaseSchema = typeof safeParse extends (schema: infer S, ...args: any) => any ? S : never;

/**
 * {@link parseInput} で使用するエラーコンストラクターの型定義です。
 */
export interface ParseInputErrorConstructor {
  new (args: InvalidInputErrorArgs): Error;
}

/**
 * 入力値をスキーマで検証し、失敗した場合は入力値検証エラーを投げます。
 *
 * @param schema 検証に使用するスキーマです。
 * @param value 検証対象の値です。
 * @param Error 使用するエラーコンストラクターです。デフォルトは {@link InvalidInputError} です。
 * @returns 検証済みの出力値です。
 *
 * @example
 * ```
 * import { v } from "@z-rack/core";
 *
 * const schema = v.pipe(v.string(), v.minLength(1));
 * v.parseInput(schema, "hello"); // => "hello"
 * v.parseInput(schema, "");      // => InvalidInputError
 * ```
 */
export function parseInput<const TSchema extends BaseSchema>(
  schema: TSchema,
  value: unknown,
  Error: ParseInputErrorConstructor = InvalidInputError,
): InferOutput<TSchema> {
  const result = safeParse(schema, value);
  if (result.success) {
    return result.output;
  }

  const error = new Error({
    value,
    issues: result.issues,
  });
  tryCaptureStackTrace(error, parseInput);
  throw error;
}

/**
 * `parseOutput` で使用するエラーコンストラクターの型定義です。
 */
export interface ParseOutputErrorConstructor {
  new (args: InvalidOutputErrorArgs): Error;
}

/**
 * 出力値をスキーマで検証し、失敗した場合は出力値検証エラーを投げます。
 *
 * @param schema 検証に使用するスキーマです。
 * @param value 検証対象の値です。
 * @param Error 使用するエラーコンストラクターです。デフォルトは {@link InvalidOutputError} です。
 * @returns 検証済みの出力値です。
 *
 * @example
 * ```
 * import { v } from "@z-rack/core";
 *
 * const schema = v.pipe(v.string(), v.minLength(1));
 * v.parseOutput(schema, "hello"); // => "hello"
 * v.parseOutput(schema, "");      // => InvalidOutputError
 * ```
 */
export function parseOutput<const TSchema extends BaseSchema>(
  schema: TSchema,
  value: unknown,
  Error: ParseOutputErrorConstructor = InvalidOutputError,
): InferOutput<TSchema> {
  const result = safeParse(schema, value);
  if (result.success) {
    return result.output;
  }

  const error = new Error({
    value,
    issues: result.issues,
  });
  tryCaptureStackTrace(error, parseInput);
  throw error;
}

/**
 * 値をスキーマで検証し、失敗した場合は予期しないエラーとして扱います。
 *
 * {@link parseInput} とは異なり、値の信頼性を前提とした内部バリデーションに適しています。
 *
 * @param schema 検証に使用するスキーマです。
 * @param input 検証対象の値です。
 * @returns 検証済みの出力値です。
 *
 * @example
 * ```
 * import { v } from "@z-rack/core";
 *
 * const schema = v.pipe(v.string(), v.minLength(1));
 * v.expect(schema, "hello"); // => "hello"
 * ```
 */
export function expect<const TSchema extends BaseSchema>(
  schema: TSchema,
  input: unknown,
): InferOutput<TSchema> {
  const result = safeParse(schema, input);
  if (result.success) {
    return result.output;
  }

  const error = new UnexpectedError({
    value: input,
    issues: result.issues,
  });
  tryCaptureStackTrace(error, expect);
  throw error;
}
