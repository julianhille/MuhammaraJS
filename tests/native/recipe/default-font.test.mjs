// The native default font, from the native tests/recipe/default-font.js and
// the bundled-font calls of tests/recipe/text.js. It is meant to differ from
// Wasm: native bundles Helvetica Neue LT with its bold and italic faces as the
// default, and Arial, Courier New and Georgia, all usable without
// registration.
import assert from "node:assert/strict";
import { describeEnd, writeOutput } from "../../support/ends.mjs";
import { runFonts } from "../../support/text.mjs";

describeEnd("native", "Recipe default font", function (end) {
  /**
   * A new Recipe with only the fonts native bundles.
   * @returns {object} The Recipe.
   */
  function bundledRecipe() {
    return new end.Recipe(Buffer.from("new"));
  }

  it("writes text in bundled Helvetica Neue LT without registering a font", function () {
    var bytes = bundledRecipe()
      .createPage("letter")
      .text("Hello", 72, 72)
      .endPage()
      .endPDF((output) => output);
    writeOutput(end, "default-font", bytes);
    assert.deepEqual(runFonts(end, bytes), [
      { text: "Hello", font: "HelveticaNeueLT-Roman" },
    ]);
  });

  it("draws bold and italic default text in the bundled faces", function () {
    var bytes = bundledRecipe()
      .createPage("letter")
      .text("Add text", "center", 100, { bold: true })
      .text("Add text", "center", 120, { italic: true })
      .text("Add text", "center", 160, { bold: true, italic: true })
      .endPage()
      .endPDF((output) => output);
    writeOutput(end, "default-font-styles", bytes);
    var fonts = runFonts(end, bytes).map((run) => run.font);
    assert.equal(new Set(fonts).size, 3, JSON.stringify(fonts));
    assert.match(fonts[0], /Bold/);
    assert.match(fonts[1], /Italic|Oblique/);
    assert.doesNotMatch(fonts[1], /Bold/);
    assert.match(fonts[2], /Bold/);
  });

  it("draws in the other fonts native bundles without registration", function () {
    var bytes = bundledRecipe()
      .createPage("letter")
      .text("Add text", "center", 250, { font: "Arial", size: 20 })
      .text("Add text", "center", 270, { font: "Courier New", size: 20 })
      .text("Add text", "center", 290, { font: "Georgia", size: 20 })
      .text("Café", "center", 310, { font: "Roboto", size: 20 })
      .endPage()
      .endPDF((output) => output);
    writeOutput(end, "default-font-bundled", bytes);
    var fonts = runFonts(end, bytes).map((run) => run.font);
    assert.equal(fonts.length, 4);
    assert.match(fonts[0], /Arial/);
    assert.match(fonts[1], /Courier/);
    assert.match(fonts[2], /Georgia/);
    assert.equal(fonts[3], "Roboto-Regular");
  });
});
