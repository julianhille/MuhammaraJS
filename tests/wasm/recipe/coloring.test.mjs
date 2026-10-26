import assert from "node:assert/strict";
import { describeEnd, writeOutput } from "../../support/ends.mjs";

// Wasm has no file system to load a color file from: chroma("!load") takes
// bytes (tests/recipe/coloring.test.mjs) and rejects a path, where native
// reads it (tests/native/recipe/coloring.test.mjs).
describeEnd("wasm", "Coloring", function (end) {
  it("rejects the chroma loader with a file path", function () {
    var recipe = end.newRecipe().createPage();
    assert.throws(() => recipe.chroma("!load", "colors.json"), /!load/);
    writeOutput(end, "coloring-chroma-loader", recipe.endPage().endPDF());
  });
});
