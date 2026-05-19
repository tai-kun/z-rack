import { FastUtf8 } from "fast-utf8";

const B = 1;
const KiB = 1024 * B;

/**
 * - 不正なバイトシーケンスが検出された場合にエラーを投げます。
 * - バイトオーダーマークを無視します。
 */
const utf8 = new FastUtf8({
  strict: true,
  ignoreBOM: false,
  allocateSize: 4 * KiB,
});

export default utf8;
