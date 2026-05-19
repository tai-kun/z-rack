/**
 * 与えられた値が `Error` インスタンス、またはそれに準ずるオブジェクトであるかを確認する型ガード関数です。
 *
 * @param error 判定対象となる未知の値です。
 * @returns 値が `Error` または `DOMException` である場合に `true` を返します。
 */
let isError: (error: unknown) => error is Error;

if ("isError" in Error) {
  isError = Error.isError.bind(Error);
} else {
  isError = function isError(e) {
    return e instanceof Error || e instanceof DOMException;
  };
}

export default isError;
