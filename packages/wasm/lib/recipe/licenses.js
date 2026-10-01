var licenseSectionName = "license";
var licensesFileName = "@muhammara/wasm/THIRD_PARTY_LICENSES.md";

/**
 * Creates `Recipe.thirdPartyLicenses()` for the WebAssembly module a Recipe
 * runtime was loaded from.
 * @param {WebAssembly.Module|undefined} wasmModule - The compiled module, or
 * undefined when it was not available to the runtime.
 * @returns {Function} The function.
 */
export function createThirdPartyLicenses(wasmModule) {
  /**
   * Returns the third-party license notices embedded in the loaded
   * `muhammara-wasm.wasm` as its `license` custom section. The text is read
   * from the already compiled module: nothing is fetched, compiled, or
   * instantiated.
   *
   * @name thirdPartyLicenses
   * @function
   * @memberof Recipe
   * @returns {string} The notices, Markdown, identical to
   * `@muhammara/wasm/THIRD_PARTY_LICENSES.md`.
   * @throws {Error} If the WebAssembly module is not loaded, or it has no
   * `license` section (for example after `wasm-strip`).
   */
  return function thirdPartyLicenses() {
    if (!wasmModule) {
      throw new Error(
        `The WebAssembly module is not loaded, so its "${licenseSectionName}" section cannot be read: a custom instantiateWasm hook did not pass the WebAssembly.Module to its callback, or this Node.js version lacks process.getBuiltinModule(). The same notices ship as ${licensesFileName}`,
      );
    }
    var sections = WebAssembly.Module.customSections(
      wasmModule,
      licenseSectionName,
    );
    if (sections.length === 0) {
      throw new Error(
        `The loaded muhammara-wasm.wasm has no "${licenseSectionName}" section; a tool such as wasm-strip may have removed it. The same notices ship as ${licensesFileName}`,
      );
    }
    return new TextDecoder().decode(sections[0]);
  };
}
