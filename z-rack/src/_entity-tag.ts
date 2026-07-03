import { sha256 } from "@noble/hashes/sha2.js";
import { type EntityTag, bytesToHex } from "@z-rack/core";

/**
 * SHA-256 を用いてバイナリデータからエンティティータグを生成するオブジェクトです。
 *
 * 一括計算と逐次計算の 2 方式をサポートします。
 */
const entityTag = {
  /**
   * バイト配列全体のハッシュ値を一括計算し、16 進数文字列のエンティティータグとして返します。
   *
   * @param bytes ハッシュ計算対象のバイト配列です。
   * @returns エンティティータグです。
   */
  digest(bytes: Uint8Array): EntityTag {
    return bytesToHex(sha256(bytes)) as EntityTag;
  },

  /**
   * データを段階的に投入してハッシュ値を計算するためのハッシュオブジェクトを生成します。
   *
   * 大きなファイルなど、メモリに一括展開できないデータを順次処理する場合に適します。
   *
   * @returns `update` と `digest` メソッドを持つオブジェクトです。
   */
  hasher(): {
    /**
     * ハッシュ計算にバイト配列を追加します。
     *
     * @param bytes 追加するバイト配列です。
     */
    update(bytes: Uint8Array): void;

    /**
     * 累積データから最終的なハッシュ値を計算し、エンティティータグとして返します。
     *
     * @returns エンティティータグです。
     */
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
