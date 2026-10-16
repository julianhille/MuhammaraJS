// Merges packages/native-with-source/tests/recipe/font.js and the parts of
// both default-font tests that are the same on both ends. Which font is the
// default, and fontSrcPath, differ by end: see tests/native/recipe and
// tests/wasm/recipe.
import assert from "node:assert/strict";
import { describeEnds, writeOutput } from "../support/ends.mjs";
import { registerFont, runFonts } from "../support/text.mjs";

describeEnds("Recipe font", function (end) {
  it("draws text in registered OpenType and font-collection fonts", function () {
    var recipe = end.newRecipe();
    registerFont(end, recipe, "KozGoPro-Regular", "fonts/KozGoPro-Regular.otf");
    registerFont(end, recipe, "LucidaGrande", "fonts/LucidaGrande.ttc");
    var bytes = recipe
      .createPage("letter")
      .text("世界你好 日本語", "center", 80, {
        font: "KozGoPro-Regular",
        textBox: { style: { fill: "%0,28,100,6" } },
      })
      .text("Lucida Grande from a font collection", "center", 120, {
        font: "LucidaGrande",
      })
      .endPage()
      .endPDF();
    writeOutput(end, "font-custom", bytes);
    var runs = runFonts(end, bytes);
    var cjk = runs.filter((run) => run.font === "KozGoPro-Regular");
    assert.equal(cjk.map((run) => run.text).join(""), "世界你好 日本語");
    assert.deepEqual(
      runs.filter((run) => run.font === "LucidaGrande").map((run) => run.text),
      ["Lucida Grande from a font collection"],
    );
  });

  // Meant to differ until a major release: Wasm throws for a font name that
  // is not registered, native draws in its default family, as each always has.
  it("handles a font name that is not registered as each end always has", function () {
    var recipe = end.newRecipe().createPage("letter");
    if (end.name === "wasm") {
      assert.throws(
        () => recipe.text("x", 20, 20, { font: "PMingLiU" }),
        /Unknown font: PMingLiU/,
      );
      assert.throws(
        () => recipe.textDimensions("Hello", { font: "missing" }),
        /Unknown font: missing/,
      );
    } else {
      assert.strictEqual(
        recipe.text("x", 20, 20, { font: "PMingLiU" }),
        recipe,
      );
      assert.ok(recipe.textDimensions("Hello", { font: "missing" }).width > 0);
    }
  });

  it("writes text without registering a font", function () {
    var bytes = end
      .newRecipe()
      .createPage("letter")
      .text("Hello", 72, 72)
      .endPage()
      .endPDF();
    writeOutput(end, "font-default", bytes);
    assert.deepEqual(
      runFonts(end, bytes).map((run) => run.text),
      ["Hello"],
    );
  });

  it("offers the bundled Roboto family without registration", function () {
    var recipe = end.newRecipe().createPage("letter");
    // Family names match case-insensitively.
    assert.deepEqual(
      recipe.textDimensions("Café", { font: "Roboto" }),
      recipe.textDimensions("Café", { font: "rObOtO" }),
    );
    var bytes = recipe
      .text("Café", 72, 72, { font: "Roboto" })
      .endPage()
      .endPDF();
    writeOutput(end, "font-roboto", bytes);
    assert.deepEqual(runFonts(end, bytes), [
      { text: "Café", font: "Roboto-Regular" },
    ]);
  });

  it("uses a family's regular face for a style it lacks", function () {
    var recipe = end.newRecipe().createPage("letter");
    var regular = recipe.textDimensions("Café", { font: "arial" });
    [{ bold: true }, { italic: true }, { bold: true, italic: true }].forEach(
      (style, index) => {
        assert.deepEqual(
          recipe.textDimensions("Café", { font: "arial", ...style }),
          regular,
          JSON.stringify(style),
        );
        recipe.text("Café", 72, 72 + index * 30, { font: "arial", ...style });
      },
    );
    var bytes = recipe.endPage().endPDF();
    writeOutput(end, "font-missing-style", bytes);
    assert.deepEqual(
      runFonts(end, bytes).map((run) => run.font),
      ["ArialMT", "ArialMT", "ArialMT"],
    );
  });
});
