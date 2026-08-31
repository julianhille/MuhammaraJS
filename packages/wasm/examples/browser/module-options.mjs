import {
  createMuhammaraWasm as loadMuhammaraWasm,
  createRecipe as loadRecipe,
} from "../../index.js";

var wasmUrl = new URL("../../dist/muhammara-wasm.wasm", import.meta.url);

/** Explicitly resolves the package's WebAssembly binary in pages and Workers. */
export function moduleOptions() {
  return {
    locateFile(path) {
      return path.endsWith(".wasm") ? wasmUrl.href : path;
    },
  };
}

export function createMuhammaraWasm() {
  return loadMuhammaraWasm(moduleOptions());
}

export function createRecipe() {
  return loadRecipe(moduleOptions());
}
