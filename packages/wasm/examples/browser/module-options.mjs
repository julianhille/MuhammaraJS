import {
  createMuhammaraWasm as loadMuhammaraWasm,
  createRecipe as loadRecipe,
} from "../../index.js";

var wasmUrl = new URL("../../dist/muhammara-wasm.wasm", import.meta.url);

/**
 * Explicitly resolves the package's WebAssembly binary in pages and Workers.
 * @returns {import("../../index.js").MuhammaraWasmOptions} Emscripten options with `locateFile`.
 */
export function moduleOptions() {
  return {
    /**
     * Maps the Wasm binary to its URL next to this package.
     * @param {string} path - File Emscripten wants to load.
     * @returns {string} Its URL.
     */
    locateFile(path) {
      return path.endsWith(".wasm") ? wasmUrl.href : path;
    },
  };
}

/**
 * Loads the low-level API with the example module options.
 * @returns {Promise<import("../../index.js").MuhammaraWasm>} The API.
 */
export function createMuhammaraWasm() {
  return loadMuhammaraWasm(moduleOptions());
}

/**
 * Loads Recipe with the example module options.
 * @param {import("../../index.js").CreateRecipeOptions} [options={}] - Recipe options, such as `defaultFont`.
 * @returns {Promise<import("../../index.js").RecipeConstructor>} The Recipe class.
 */
export function createRecipe(options = {}) {
  return loadRecipe({ ...moduleOptions(), ...options });
}
