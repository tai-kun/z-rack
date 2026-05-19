import { type WasmSource, loadWasm } from "@z-rack/core";

import * as vibrato from "../build/vibrato_wasm.js";
import type * as WasmExports from "../build/vibrato_wasm.wasm.js";
import logger from "./_logger.js";
import once from "./_once.js";
import { VibratoNotOpenError } from "./errors.js";

declare global {
  /**
   * グローバルスコープで保持される Vibrato WASM ソースの情報です。
   */
  var _z_rack_jpn__vibrato_wasm_source: WasmSource | undefined;
}

/**
 * WASM モジュールを一度だけ読み込むための非同期関数です。
 *
 * @param signal 中断を制御するための AbortSignal です。
 * @returns 読み込みが完了すると解決される Promise です。
 */
export default async function loadVibratoWasmOnce(signal: AbortSignal): Promise<void> {
  const wasmSource = globalThis._z_rack_jpn__vibrato_wasm_source;
  if (wasmSource === undefined) {
    throw new VibratoNotOpenError();
  }

  // 重複した読み込みを防ぎつつ、WASM を初期化します。
  await once(wasmSource, signal, async (signal) => {
    const wasm = await loadWasm<typeof WasmExports>(wasmSource, {
      signal,
      imports: {
        "./vibrato_wasm_bg.js": vibrato,
      },
    });

    vibrato.__wbg_set_wasm(wasm);
    wasm.__wbindgen_start();

    logger.debug`Successfully finished loadWasmOnce`;
  });
}
