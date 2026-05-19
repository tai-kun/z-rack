/**
 * 一意な数値を順番に発行するクラスです。
 */
export default class IncrementalId {
  /**
   * 現在保持している ID 値です。
   */
  private id: number;

  /**
   * `IncrementalId` の新しいインスタンスを初期化します。
   */
  public constructor() {
    this.id = 0;
  }

  /**
   * 新しい ID を取得します。
   *
   * JavaScript における安全な整数の最大値（Number.MAX_SAFE_INTEGER）に達した場合は、1 にリセットされます。
   *
   * @returns 生成 された 新しい ID 値 です。
   */
  public get(): number {
    this.id = this.id >= Number.MAX_SAFE_INTEGER ? 1 : this.id + 1;
    return this.id;
  }
}
