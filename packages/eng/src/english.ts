import type { ITextSearch } from "@z-rack/core";

export default class English implements ITextSearch {
  public readonly format: string;

  public readonly textConfig: "english";

  public readonly defaultLanguage: "eng";

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

  public get isOpen(): boolean {
    return true;
  }

  public normalize(args: Pick<ITextSearch.NormalizeArgs, "text">): string {
    const { text } = args;
    return text.normalize("NFKC");
  }
}
