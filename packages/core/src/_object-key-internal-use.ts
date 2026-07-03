/**
 * `ObjectKey` クラスの内部的な動作状態を管理するためのオブジェクトです。
 *
 * @example
 * ```
 * import objectKeyInternalUse from "./_object-key-internal-use.js";
 *
 * // 内部利用ではスキップ検証を有効にします。
 * objectKeyInternalUse.enable = true;
 * try {
 *   new ObjectKey(validatedKey);
 * } finally {
 *   objectKeyInternalUse.enable = false;
 * }
 * ```
 */
const objectKeyInternalUse = {
  /**
   * `ObjectKey` クラスの 内部使用モードを制御するフラグです。
   *
   * `true` の場合、コンストラクターは 入力値が 信頼できるものであると判断し、通常実行されるスキップしてパフォーマンスを向上させます。
   *
   * @default false
   */
  enable: false,
};

export default objectKeyInternalUse;
