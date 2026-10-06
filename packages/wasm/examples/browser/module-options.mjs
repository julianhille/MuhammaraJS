import {
  createMuhammaraWasm as loadMuhammaraWasm,
  createRecipe as loadRecipe,
  loadBidi as loadBidiFrom,
} from "../../index.js";

var wasmUrl = new URL("../../dist/muhammara-wasm.wasm", import.meta.url);
// bidi-js, by URL, so pages and Workers load it without an import map.
var bidiUrl = new URL(
  "../../../../node_modules/bidi-js/dist/bidi.mjs",
  import.meta.url,
);

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

/**
 * Loads bidi-js for right-to-left text, in pages and Workers alike.
 * @returns {Promise<void>} Resolves once text can be reordered.
 */
export async function loadBidi() {
  await loadBidiFrom(await import(bidiUrl.href));
}
