// 参考: https://github.com/uuidjs/uuid/blob/main/src/stringify.ts
const byteToHex = Array.from({ length: 256 }).map((_, i) => i.toString(16).padStart(2, "0"));

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
