export function endPDF(recipe, module, assertOutputSize) {
  if (recipe._endedBytes) return recipe._endedBytes;
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
      recipe._endedBytes = module.HEAPU8.slice(pdfPointer, pdfPointer + length);
      return recipe._endedBytes;
    } finally {
      module._muhammara_wasm_free(pdfPointer);
    }
  } finally {
    module._free(lengthPointer);
    module._muhammara_wasm_recipe_destroy(recipe._recipe);
    recipe._recipe = 0;
  }
}
