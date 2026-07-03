import { tryCaptureStackTrace } from "try-capture-stack-trace";

import { UnreachableError } from "./errors.js";

/**
 * 実行時には到達しないはずのコード・パスであることを明示するための関数です。
 *
 * 網羅性チェックを強化するために使用されます。
 *
 * @returns 戻り値はありません。この関数は常にエラーを投げます。
 *
 * @example
 * ```
 * import { unreachable } from "@z-rack/core";
 *
 * function assertNever(x: never): never {
 *   unreachable(x);
 * }
 * ```
 */
function unreachable(): never;

/**
 * 到達不能な値を検証し、実行時には到達しないはずのコード・パスであることを明示します。
 *
 * 主に switch 文や if-else 文の default ケースで、すべての列挙型や共用体型が網羅されていることを保証するために使用されます。
 *
 * @param value 到達してはならない値です。TypeScript の `never` 型として扱われます。
 * @returns 戻り値はありません。この関数は常にエラーを投げます。
 *
 * @example
 * ```
 * import { unreachable } from "@z-rack/core";
 *
 * type Shape = "circle" | "square";
 *
 * function area(shape: Shape, size: number): number {
 *   switch (shape) {
 *     case "circle": return Math.PI * size * size;
 *     case "square": return size * size;
 *     default: unreachable(shape);
 *   }
 * }
 * ```
 */
function unreachable(value: never): never;

function unreachable(...args: [never?]): never {
  const error = new UnreachableError(args.length ? { value: args[0] } : {});
  tryCaptureStackTrace(error, unreachable);
  throw error;
}

export default unreachable;
