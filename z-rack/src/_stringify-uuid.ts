// 参考: https://github.com/uuidjs/uuid/blob/main/src/stringify.ts

/**
 * 0 から 255 までの数値を、2 桁の 16 進数文字列に変換するためのマッピング用配列です。
 *
 * 事前に計算しておくことで、変換処理のたびに文字列を生成する負荷を減らしています。
 */
const byteToHex = Array.from({ length: 256 }).map((_, i) => i.toString(16).padStart(2, "0"));

/**
 * 符号なし 8 ビット整数で構成される配列データを、標準的なハイフン区切りの文字列形式の UUID に変換します。
 *
 * @param bytes 16 バイトのバイナリデータです。
 * @returns 小文字のハイフン区切りで表現された 36 文字の UUID 文字列を返します。
 */
export default function stringifyUUID(bytes: Uint8Array): string {
  return (
    byteToHex[bytes[0]!]! +
    byteToHex[bytes[1]!]! +
    byteToHex[bytes[2]!]! +
    byteToHex[bytes[3]!]! +
    "-" +
    byteToHex[bytes[4]!]! +
    byteToHex[bytes[5]!]! +
    "-" +
    byteToHex[bytes[6]!]! +
    byteToHex[bytes[7]!]! +
    "-" +
    byteToHex[bytes[8]!]! +
    byteToHex[bytes[9]!]! +
    "-" +
    byteToHex[bytes[10!]!] +
    byteToHex[bytes[11!]!] +
    byteToHex[bytes[12!]!] +
    byteToHex[bytes[13!]!] +
    byteToHex[bytes[14!]!] +
    byteToHex[bytes[15!]!]
  ).toLowerCase();
}
