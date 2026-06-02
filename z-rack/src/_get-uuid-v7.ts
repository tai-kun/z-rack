import { v7 } from "uuid";

/**
 * UUID v7 を生成するための共有バッファーです。
 *
 * メモリー効率の向上とガベージコレクションの負荷軽減のために、16 バイトの固定長領域をあらかじめ確保して再利用します。
 */
const buffer = new Uint8Array(16);

/**
 * 時系列でソート可能な UUID v7 を新規に生成し、バイト配列として取得します。
 *
 * @returns 生成された 16 バイトの UUID v7 データを含む新しいバイト配列です。
 */
export default function getUUIDv7(): Uint8Array<ArrayBuffer> {
  v7(undefined, buffer);
  return buffer.slice();
}
