import objectKeyInternalUse from "./_object-key-internal-use.js";
import StringObjectKeySchema from "./_string-object-key-schema.js";
import utf8 from "./_utf8_object-key.js";
import * as v from "./valibot.js";

/** "." の UTF-8 コードポイントです。 */
const DOT = 46;

/** "/" の UTF-8 コードポイントです。 */
const SLASH = 47;

/**
 * オブジェクトキーを解析するためのクラスです。
 *
 * @example
 * ```
 * import { ObjectKey } from "@z-rack/core";
 *
 * const key = ObjectKey.parse("foo/bar/baz.txt");
 * key.segments;   // => ["foo", "bar", "baz.txt"]
 * key.basename;   // => "baz.txt"
 * key.filename;   // => "baz"
 * key.extname;    // => ".txt"
 * key.prefix;     // => "foo/bar/"
 * key.toJSON();   // => "foo/bar/baz.txt"
 * ```
 */
export default class ObjectKey {
  /**
   * 指定された文字列が有効なオブジェクトキーであるかを確認します。
   *
   * @param objectKey 検証対象のオブジェクトキー文字列です。
   * @returns 有効なキーであれば true、そうでなければ false を返します。
   *
   * @example
   * ```
   * ObjectKey.check("valid/key");   // => true
   * ObjectKey.check("");           // => false
   * ObjectKey.check(" ".repeat(9999)); // => false
   * ```
   */
  public static check(objectKey: string): boolean {
    try {
      // インスタンス化を試みることで、バリデーションと正規化のチェックを行います。
      // 解析後のフルキーが元の入力と一致するかを確認することで、妥当性を判断します。
      return new ObjectKey(objectKey).key === objectKey;
    } catch {
      return false;
    }
  }

  /**
   * オブジェクトキー文字列を解析し、ObjectKey インスタンスを生成します。
   *
   * @param objectKey 解析対象のオブジェクトキー文字列です。
   * @returns 生成された ObjectKey インスタンスです。
   *
   * @example
   * ```
   * const key = ObjectKey.parse("data/file.json");
   * key.key; // => "data/file.json"
   * ```
   */
  public static parse(objectKey: string): ObjectKey {
    return new ObjectKey(objectKey);
  }

  /**
   * オブジェクトキーの UTF-8 バイト列です。
   */
  readonly #buffer: Uint8Array<ArrayBuffer>;

  /**
   * オブジェクトキーの完全な文字列表現です。
   */
  readonly #string: string;

  /**
   * キーセグメントの配列です。
   */
  #segments: readonly string[] | undefined;

  /**
   * 接頭辞です。
   */
  #prefix: string | undefined;

  /**
   * ベース名の UTF-8 バイト列です。
   */
  #basebuff: Uint8Array<ArrayBuffer> | null | undefined;

  /**
   * ベース名です。
   */
  #basename: string | undefined;

  /**
   * 拡張子なしのオブジェクト名です。
   */
  #filename: string | undefined;

  /**
   * 拡張子です。
   */
  #extname: string | undefined;

  /**
   * ObjectKey クラスの新しいインスタンスを初期化します。
   *
   * @param objectKey オブジェクトキー文字列、または内部利用時の特定パラメーターです。
   */
  public constructor(objectKey: string) {
    if (!objectKeyInternalUse.enable) {
      objectKey = v.parseInput(StringObjectKeySchema, objectKey);
    }

    if (typeof objectKey !== "string") {
      this.#buffer = arguments[0];
      this.#string = arguments[1];
    } else {
      this.#buffer = utf8.encode(objectKey);
      this.#string = objectKey;
    }
  }

  /**
   * オブジェクトキーです。
   */
  public get key(): string {
    return this.#string;
  }

  /**
   * オブジェクトキーをスラッシュで区切ったセグメントの配列を取得します。
   *
   * 配列は少なくとも 1 つの要素を含んでいます。
   *
   * @example
   * ```
   * ObjectKey.parse("a/b/c").segments; // => ["a", "b", "c"]
   * ```
   */
  public get segments(): [...string[], string] {
    if (this.#segments === undefined) {
      const segments: string[] = [];
      let segment = this.#buffer;
      for (let i = 0, j = 0; j < this.#buffer.length; j++, i++) {
        if (this.#buffer[j] === SLASH) {
          segments.push(utf8.decode(segment.subarray(0, i)));
          segment = segment.subarray(i + 1);
          i = -1; // インデックスをリセットして次のセグメントに備えます。
        }
      }

      segments.push(utf8.decode(segment));
      this.#basebuff = segment;
      this.#segments = segments;
    }

    // 破壊的に変更されないように、常にコピーを返します。
    return this.#segments.slice() as [...string[], string];
  }

  /**
   * オブジェクトキーの接頭辞です。
   *
   * 接頭辞は、セグメント（{@link segments}）をスラッシュで結合した文字列です。
   *
   * @example
   * ```
   * ObjectKey.parse("a/b/c").prefix; // => "a/b/"
   * ObjectKey.parse("root").prefix;  // => ""
   * ```
   */
  public get prefix(): string {
    return (this.#prefix ??= this.segments.slice(0, -1).join("/") + "/");
  }

  /**
   * オブジェクトキーをスラッシュで区切ったときの末尾部分です。
   *
   * @example
   * ```
   * ObjectKey.parse("a/b/file.txt").basename; // => "file.txt"
   * ```
   */
  public get basename(): string {
    if (this.#basename === undefined) {
      const segments = this.segments;
      this.#basename = segments[segments.length - 1]!;
    }

    return this.#basename;
  }

  /**
   * オブジェクトキーをファイルパスとみなしたときの、拡張子を除いたファイル名を取得します。
   *
   * ファイル名はベース名（{@link basename}）から拡張子を取り除いた文字列です。
   *
   * @example
   * ```
   * ObjectKey.parse("archive.tar.gz").filename; // => "archive.tar"
   * ObjectKey.parse(".hidden").filename;        // => ".hidden"
   * ObjectKey.parse("Makefile").filename;       // => "Makefile"
   * ```
   */
  public get filename(): string {
    if (this.#filename === undefined) {
      // ゲッターを呼び出して、this.#basebuff を計算します。
      this.segments;

      const basebuff = this.#basebuff!;
      const lastDotIndex = basebuff.lastIndexOf(DOT);
      if (lastDotIndex === -1 || lastDotIndex === 0) {
        // 例えば拡張子なしの Makefile や隠しファイルの .bashrc などです。
        this.#filename = utf8.decode(basebuff);
        this.#extname = "";
      } else {
        // ドットの前後でファイル名と拡張子を分割してデコードします。
        this.#filename = utf8.decode(basebuff.subarray(0, lastDotIndex));
        this.#extname = utf8.decode(basebuff.subarray(lastDotIndex));
      }

      this.#basebuff = null; // 使い終わったので破棄します。
    }

    return this.#filename!;
  }

  /**
   * ファイル名の拡張子（ドットを含む）を取得します。
   *
   * @example
   * ```
   * ObjectKey.parse("archive.tar.gz").extname; // => ".gz"
   * ObjectKey.parse(".hidden").extname;        // => ""
   * ```
   */
  public get extname(): string {
    if (this.#extname === undefined) {
      // filename ゲッターを呼び出すことで、同時に拡張子の解析も行われます。
      this.filename;
    }

    return this.#extname!;
  }

  // public clone(): ObjectKey {
  //   try {
  //     objectKeyInternalUse.enable = true;
  //     // @ts-expect-error
  //     return new ObjectKey(this.#buffer, this.#string);
  //   } finally {
  //     objectKeyInternalUse.enable = false;
  //   }
  // }

  /**
   * JSON シリアライズ時に呼び出され、オブジェクトキーを返します。
   *
   * @returns オブジェクトキーです。
   *
   * @example
   * ```
   * JSON.stringify(ObjectKey.parse("foo/bar"));
   * // => '"foo/bar"'
   * ```
   */
  public toJSON(): string {
    return this.#string;
  }

  /**
   * オブジェクトを文字列に変換する際に呼び出され、オブジェクトキーを返します。
   *
   * @returns オブジェクトキーです。
   *
   * @example
   * ```
   * String(ObjectKey.parse("foo/bar")); // => "foo/bar"
   * ```
   */
  public toString(): string {
    return this.#string;
  }
}
