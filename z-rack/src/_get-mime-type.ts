import type { MimeType } from "@z-rack/core";
import mime from "mime";

/**
 * 与えられたファイルのパスから、対応する MIME タイプを取得します。
 *
 * 拡張子から MIME タイプを判別できない場合は、デフォルト値として一般的なバイナリデータを表す `application/octet-stream` を返します。
 *
 * @param path MIME タイプを判定する対象となるファイルのパスです。拡張子を含んでいる必要があります。
 * @returns 判別された MIME タイプを返します。未知の拡張子の場合は `application/octet-stream` を返します。
 */
export default function getMimeType(path: string): MimeType {
  return (mime.getType(path) ?? "application/octet-stream") as MimeType;
}
