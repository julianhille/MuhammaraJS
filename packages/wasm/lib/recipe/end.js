/**
 * Finalizes a Recipe and returns its cached PDF bytes on subsequent calls.
 * A failed finalization retires the Recipe; later calls rethrow the original
 * error instead of re-entering finalization against a destroyed handle,
 * matching native Recipe#endPDF().
 *
 * @param {object} recipe - Recipe whose native handle is finished and released.
 * @param {object} module - Emscripten module.
 * @param {function(number): void} assertOutputSize - Throws when the output is too large.
 * @returns {Uint8Array} The PDF bytes.
 * @throws {Error} If the PDF cannot be written or exceeds the output limit.
 */
export function endPDF(recipe, module, assertOutputSize) {
  if (recipe._endedBytes) return recipe._endedBytes;
  try {
    recipe._writeCanonicalInfo();
    var lengthPointer = module._malloc(4);
    try {
      var pdfPointer = module._muhammara_wasm_recipe_end_pdf(
        recipe._recipe,
        lengthPointer,
      );
      var length = module.HEAPU32[lengthPointer >>> 2];
      if (!pdfPointer || !length) throw new Error("Unable to finish PDF");
      try {
        assertOutputSize(length);
        recipe._endedBytes = module.HEAPU8.slice(
          pdfPointer,
          pdfPointer + length,
        );
        return recipe._endedBytes;
      } finally {
        module._muhammara_wasm_free(pdfPointer);
      }
    } finally {
      module._free(lengthPointer);
    }
  } catch (error) {
    recipe._endError = error;
    throw error;
  } finally {
    module._muhammara_wasm_recipe_destroy(recipe._recipe);
    recipe._recipe = 0;
  }
}
