import type { MimeType } from "@z-rack/core";
import mime from "mime";

export default function getMimeType(path: string): MimeType {
  return (mime.getType(path) ?? "application/octet-stream") as MimeType;
}
