import { FastUtf8 } from "fast-utf8";

const B = 1;
const KiB = 1024 * B;

/**
 * アプリケーション全体で使用する UTF-8 エンコーダー/デコーダーです。
 *
 * - 不正なバイトシーケンスが検出された場合にエラーを投げます。
 * - バイトオーダーマークを無視しません。
 */
const utf8 = new FastUtf8({
  strict: true,
  ignoreBOM: false,
  allocateSize: 8 * KiB,
});

export default utf8;
