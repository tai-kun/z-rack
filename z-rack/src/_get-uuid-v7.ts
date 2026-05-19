import { v7 } from "uuid";

const buffer = new Uint8Array(16);

export default function getUUIDv7(): Uint8Array<ArrayBuffer> {
  v7(undefined, buffer);
  return buffer.slice();
}
