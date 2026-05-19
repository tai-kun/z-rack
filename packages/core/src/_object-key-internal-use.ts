/**
 * `ObjectKey` クラスの内部的な動作状態を管理するためのオブジェクトです。
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
