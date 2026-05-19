import utf8 from "./_utf8_object-key.js";
import * as v from "./valibot.js";

/**
 * 文字列表現のオブジェクトキーとしての妥当性を検証し、バイト列へ変換するためのスキーマ定義です。
 */
const StringObjectKeySchema = v.pipe(
  // オブジェクトキーは文字列である必要があります。
  v.string(),
  // エンコードでオーバーヘッドが発生する前に `.length` で高速に検証します。
  v.minLength(1),
  v.maxLength(1024),
  // 最大 1024 バイトの有効な UTF-8 文字列である必要があります。
  v.utf8(utf8),
  v.maxBytes(1024, utf8),
);

export default StringObjectKeySchema;
