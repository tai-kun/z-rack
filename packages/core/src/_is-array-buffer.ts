/**
 * `Object.prototype.toString` メソッドを定数として保持しています。
 *
 * このメソッドは、オブジェクトのクラス名を文字列として取得するために使用されます。
 */
// oxlint-disable-next-line typescript/unbound-method
const toString = Object.prototype.toString;

/**
 * 引数に与えられた値が `ArrayBuffer` オブジェクトかどうかを判定します。
 *
 * @param value `ArrayBuffer` オブジェクトであるか検証する値です。
 * @returns `value` が `ArrayBuffer` オブジェクトであれば `true`、そうでなければ `false` です。
 *
 * @example
 * ```
 * import isArrayBuffer from "./_is-array-buffer.js";
 *
 * isArrayBuffer(new ArrayBuffer(8)); // => true
 * isArrayBuffer(new Uint8Array(8));  // => false
 * ```
 */
export default function isArrayBuffer(value: unknown): value is ArrayBuffer {
  return (
    value instanceof ArrayBuffer ||
    // Firefox では fetch のレスポンスボディーを ArrayBuffer にしたときにそれを instanceof で判定できないようなので、タグ名で判定します。
    toString.call(value) === "[object ArrayBuffer]"
  );
}
