import type { ITextSearch } from "@z-rack/core";

/**
 * 英語テキスト向けの検索エンジン実装です。
 *
 * トークナイズ機能は提供せず、テキストを Unicode NFKC 正規化する `normalize` のみを実装します。
 *
 * 外部リソースや辞書データを必要とせず、常に利用可能です。
 *
 * @example
 * ```
 * import { English } from "@z-rack/eng";
 *
 * const engine = new English();
 *
 * engine.normalize({ text: "Hello, World!" }); // "Hello, World!"
 * ```
 */
export default class English implements ITextSearch {
  /**
   * この検索エンジンの形式を示す文字列です。
   *
   * `@z-rack/eng` パッケージの `English` クラスであることをシリアライズして保持します。
   */
  public readonly format: string;

  /**
   * テキスト処理の基本構成として英語向け処理を指定します。
   */
  public readonly textConfig: "english";

  /**
   * 明示的な言語指定がない場合に使用される標準の言語コード（ISO 639-2 Tコード）です。
   *
   * @default "eng"
   */
  public readonly defaultLanguage: "eng";

  /**
   * この検索エンジンがサポートしている言語コード（ISO 639-2 Tコード）のリストです。
   */
  public readonly supportedLanguages: readonly ["eng"];

  public constructor() {
    const fmt = new URLSearchParams({});
    fmt.append("package", "@z-rack/eng");
    fmt.append("version", "0");
    fmt.append("class", "English");

    this.format = fmt.toString();
    this.textConfig = "english";
    this.defaultLanguage = "eng";
    this.supportedLanguages = ["eng"];
  }

  /**
   * 検索エンジンのリソースが現在利用可能であるかどうかを示します。
   *
   * この実装では常に `true` を返します。
   */
  public get isOpen(): boolean {
    return true;
  }

  /**
   * 指定されたテキストを Unicode NFKC 正規化します。
   *
   * @param args 正規化に必要なテキストデータです。
   * @param args.text 正規化対象となる生の文字列データです。
   * @returns NFKC 正規化されたテキストです。
   */
  public normalize(args: Pick<ITextSearch.NormalizeArgs, "text">): string {
    const { text } = args;
    return text.normalize("NFKC");
  }
}
