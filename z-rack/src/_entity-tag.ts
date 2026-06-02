import { sha256 } from "@noble/hashes/sha2.js";
import { type EntityTag, bytesToHex } from "@z-rack/core";

/**
 * データの同一性を検証するためのエンティティータグを生成するオブジェクトです。
 *
 * このオブジェクトは、暗号学的ハッシュ関数である SHA-256 を用いて、与えられたバイナリーデータから一意の識別子を計算する機能を提供します。
 *
 * 一括で計算する方式と、ストリームのように逐次データを追加して計算する方式の 2 つをサポートします。
 */
const entityTag = {
  /**
   * 与えられたバイト配列全体のハッシュ値を一括で計算し、エンティティータグとして返します。
   *
   * @param bytes ハッシュ計算の対象となる 8 ビット符号なし整数型のバイト配列です。
   * @returns 計算されたハッシュ値を 16 進数の文字列に変換したエンティティータグです。
   */
  digest(bytes: Uint8Array): EntityTag {
    return bytesToHex(sha256(bytes)) as EntityTag;
  },

  /**
   * データを段階的に投入してハッシュ値を計算するための、ハッシュ計算機構を生成します。
   *
   * 大きなファイルや分割されて届くデータなど、メモリーに一括で展開できないデータを順次処理して最終的なエンティティータグを得る場合に適しています。
   *
   * @returns データの更新と最終的なエンティティータグの取得を行うためのメソッドを持つオブジェクトです。
   */
  hasher(): {
    /**
     * ハッシュ計算機構に新しいバイト配列を追加します。
     *
     * @param bytes 追加する 8 ビット符号なし整数型のバイト配列です。
     */
    update(bytes: Uint8Array): void;

    /**
     * これまでに生成されたすべてのデータから最終的なハッシュ値を計算し、エンティティータグとして返します。
     *
     * @returns 累積されたデータから計算されたエンティティータグです。
     */
    digest(): EntityTag;
  } {
    const hasher = sha256.create();

    return {
      /**
       * 外部から渡されたバイト配列を、内部で保持しているハッシュ計算の状態に統合します。
       */
      update(bytes) {
        hasher.update(bytes);
      },

      /**
       * 現在までの累積データに基づきハッシュ計算を完了させ、16 進数の文字列に変換したエンティティータグを返します。
       */
      digest() {
        return bytesToHex(hasher.digest()) as EntityTag;
      },
    };
  },
};

export default entityTag;
