// The Wasm default font, from the Wasm tests/recipe/default-font.test.mjs.
// It is meant to differ from native: Wasm bundles Roboto Regular only, and
// createRecipe() takes a custom `defaultFont` or `defaultFont: false`. Each
// test makes its own Recipe class, so registering and disposing fonts does
// not touch the shared end's.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describeEnd, fixture, writeOutput } from "../../support/ends.mjs";
import { BUNDLED_FONTS, placedRuns, runFonts } from "../../support/text.mjs";
import { defaultFontBytes } from "../../../packages/wasm/fonts/Roboto-Regular.js";

var arial = new Uint8Array(readFileSync(fixture("fonts/arial.ttf")));

describeEnd("wasm", "Recipe default font", function (end) {
  var wasm;
  var Recipe;

  before(async function () {
    wasm = await import("@muhammara/wasm");
    Recipe = await wasm.createRecipe({ recryptWorker: false });
  });

  afterEach(function () {
    Recipe.disposeAssets();
  });

  /**
   * Assert the page shows the texts, each in an embedded font.
   * @param {Uint8Array} bytes - The PDF.
   * @param {string[]} expected - The texts.
   * @param {number} [pageIndex=0] - The zero-based page.
   * @returns {Array<{text: string, font: string}>} The runs.
   */
  function checkText(bytes, expected, pageIndex = 0) {
    var runs = runFonts(end, bytes, pageIndex);
    assert.deepEqual(
      runs.map((run) => run.text),
      expected,
    );
    assert.match(Buffer.from(bytes).toString("latin1"), /\/FontFile2\s/);
    return runs;
  }

  it("bundles the same Roboto file as native", function () {
    assert.deepEqual(
      defaultFontBytes(),
      new Uint8Array(readFileSync(path.join(BUNDLED_FONTS, "Roboto.ttf"))),
    );
  });

  it("uses bundled Roboto for new documents", function () {
    var recipe = new Recipe().createPage("letter");
    try {
      var dimensions = recipe.textDimensions("Hello");
      assert.ok(dimensions.width > 0);
      assert.deepEqual(
        dimensions,
        recipe.textDimensions("Hello", { font: "rObOtO" }),
      );
      var bytes = recipe.text("Hello", 72, 72).endPage().endPDF();
      writeOutput(end, "default-font-hello", bytes);
      assert.deepEqual(checkText(bytes, ["Hello"])[0].font, "Roboto-Regular");
    } finally {
      recipe.dispose();
    }
  });

  it("draws every style in Roboto Regular, which has no other faces", function () {
    var recipe = new Recipe().createPage("letter");
    try {
      [{ bold: true }, { italic: true }, { bold: true, italic: true }].forEach(
        (style, index) => {
          assert.deepEqual(
            recipe.textDimensions("Café", style),
            recipe.textDimensions("Café"),
          );
          recipe.text("Café", 72, 72 + index * 30, style);
        },
      );
      var bytes = recipe.endPage().endPDF();
      writeOutput(end, "default-font-cafe-styles", bytes);
      checkText(bytes, ["Café", "Café", "Café"]).forEach((run) =>
        assert.equal(run.font, "Roboto-Regular"),
      );
    } finally {
      recipe.dispose();
    }
  });

  it("uses bundled Roboto on edited and added pages", function () {
    // A document no Recipe wrote, without any font.
    var source = end.muhammara.createBlankPdf(612, 792);
    var recipe = new Recipe(source);
    try {
      assert.ok(recipe.textDimensions("Edited").width > 0);
      var bytes = recipe
        .editPage(1)
        .text("Edited", 72, 72)
        .endPage()
        .createPage("letter")
        .text("Added", 72, 72)
        .endPage()
        .endPDF();
      writeOutput(end, "default-font-edited-and-added", bytes);
      var text = Buffer.from(bytes).toString("latin1");
      assert.match(text, /\/BaseFont \/\w+\+Roboto-Regular/);
      assert.deepEqual(
        placedRuns(end, bytes).map((run) => run.text),
        ["Edited"],
      );
      assert.equal(checkText(bytes, ["Added"], 1)[0].font, "Roboto-Regular");
    } finally {
      recipe.dispose();
    }
  });

  it("draws registered fonts beside the default one", function () {
    Recipe.registerFont("custom", arial);
    var recipe = new Recipe().createPage("letter");
    try {
      assert.throws(
        () => recipe.textDimensions("Hello", { font: "missing" }),
        /Unknown font: missing/,
      );
      var bytes = recipe
        .text("Custom", 72, 72, { font: "custom" })
        .text("Default", 72, 100)
        .endPage()
        .endPDF();
      writeOutput(end, "default-font-custom-and-default", bytes);
      assert.deepEqual(
        checkText(bytes, ["Custom", "Default"]).map((run) => run.font),
        ["ArialMT", "Roboto-Regular"],
      );
    } finally {
      recipe.dispose();
    }
  });

  it("lets a registered Roboto override the bundled one until unregistered", function () {
    // User registration takes precedence, but cleanup restores the bundled face.
    Recipe.registerFont("Roboto", arial);
    var recipe = new Recipe().createPage("letter");
    try {
      var bytes = recipe.text("Override", 72, 72).endPage().endPDF();
      writeOutput(end, "default-font-override", bytes);
      assert.equal(checkText(bytes, ["Override"])[0].font, "ArialMT");
    } finally {
      recipe.dispose();
    }
    assert.equal(Recipe.unregisterFont("Roboto"), true);
    for (var index = 0; index < 2; index++) {
      recipe = new Recipe().createPage("letter");
      try {
        var restored = recipe.text("Restored", 72, 72).endPage().endPDF();
        writeOutput(end, `default-font-restored-${index}`, restored);
        assert.equal(
          checkText(restored, ["Restored"])[0].font,
          "Roboto-Regular",
        );
      } finally {
        recipe.dispose();
        Recipe.disposeAssets();
      }
    }
  });

  it("takes a custom default font as bytes, an ArrayBuffer or a Blob", async function () {
    for (var [sourceIndex, source] of [
      arial,
      arial.slice().buffer,
      new Blob([arial]),
    ].entries()) {
      var CustomRecipe = await wasm.createRecipe({
        defaultFont: source,
        recryptWorker: false,
      });
      for (var index = 0; index < 2; index++) {
        var recipe = new CustomRecipe().createPage("letter");
        try {
          assert.deepEqual(
            recipe.textDimensions("Custom"),
            recipe.textDimensions("Custom", { font: "default" }),
          );
          var bytes = recipe.text("Custom", 72, 72).endPage().endPDF();
          writeOutput(
            end,
            `default-font-custom-default-${sourceIndex}-${index}`,
            bytes,
          );
          assert.equal(checkText(bytes, ["Custom"])[0].font, "ArialMT");
        } finally {
          recipe.dispose();
          CustomRecipe.disposeAssets();
        }
      }
    }
  });

  it("allows disabling the default font", async function () {
    var NamedRecipe = await wasm.createRecipe({
      defaultFont: false,
      recryptWorker: false,
    });
    var recipe = new NamedRecipe().createPage("letter");
    try {
      assert.throws(
        () => recipe.textDimensions("Hello"),
        /Unknown font: \(none\)/,
      );
      assert.throws(
        () => recipe.textDimensions("Hello", { font: "Roboto" }),
        /Unknown font: Roboto/,
      );
      NamedRecipe.registerFont("body", arial);
      var bytes = recipe
        .text("Named", 72, 72, { font: "body" })
        .endPage()
        .endPDF();
      writeOutput(end, "default-font-named", bytes);
      assert.equal(checkText(bytes, ["Named"])[0].font, "ArialMT");
    } finally {
      recipe.dispose();
      NamedRecipe.disposeAssets();
    }
  });

  it("validates a custom default font while creating the Recipe class", async function () {
    await assert.rejects(
      wasm.createRecipe({ defaultFont: true, recryptWorker: false }),
      /Default font bytes must be a Uint8Array or ArrayBuffer/,
    );
    await assert.rejects(
      wasm.createRecipe({
        defaultFont: new Uint8Array(2),
        limits: { maxInputBytes: 1 },
        recryptWorker: false,
      }),
      /Default font bytes exceeds maxInputBytes/,
    );
  });
});
