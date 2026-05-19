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

export interface ParseInputErrorConstructor {
  new (args: InvalidInputErrorArgs): Error;
}

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

export interface ParseOutputErrorConstructor {
  new (args: InvalidOutputErrorArgs): Error;
}

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
