import { FastUtf8 } from "fast-utf8";

const B = 1;
const KiB = 1024 * B;

const utf8 = new FastUtf8({
  strict: true,
  ignoreBOM: true,
  allocateSize: 1 * KiB,
});

export default utf8;
