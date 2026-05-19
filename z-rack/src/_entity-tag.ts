import { bytesToHex, EntityTag } from "@z-rack/core";
import { sha256 } from "@noble/hashes/sha2.js";

const entityTag = {
  digest(bytes: Uint8Array): EntityTag {
    return bytesToHex(sha256(bytes)) as EntityTag;
  },
  hasher(): {
    update(bytes: Uint8Array): void;
    digest(): EntityTag;
  } {
    const hasher = sha256.create();

    return {
      update(bytes) {
        hasher.update(bytes);
      },
      digest() {
        return bytesToHex(hasher.digest()) as EntityTag;
      },
    };
  },
};

export default entityTag;
