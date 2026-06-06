import * as fs from "node:fs";

fs.renameSync("./build/vibrato_wasm.js", "./build/_vibrato_wasm.js");
fs.renameSync("./build/vibrato_wasm.d.ts", "./build/_vibrato_wasm.d.ts");

fs.renameSync("./build/vibrato_wasm_bg.wasm", "./build/vibrato_wasm.wasm");
fs.renameSync("./build/vibrato_wasm_bg.wasm.d.ts", "./build/vibrato_wasm.wasm.d.ts");

fs.renameSync("./build/vibrato_wasm_bg.js", "./build/vibrato_wasm.js");
fs.writeFileSync(
  "./build/vibrato_wasm.d.ts",
  `
export { VibratoWasm } from "./_vibrato_wasm.js";

export function __wbg_set_wasm(wasm: any): void;
  `.trim(),
);

fs.unlinkSync("./build/package.json");

fs.mkdirSync("./dist", { recursive: true });
fs.cpSync("./build", "./dist/build", { recursive: true });

fs.unlinkSync("./dist/build/.gitignore");
