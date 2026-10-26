// Merges packages/native-with-source/tests/recipe/text-charSpace.js, the Wasm
// tests/recipe/text-charSpace.test.mjs and the character-spacing case of the
// Wasm text-layout-table.test.mjs.
import assert from "node:assert/strict";
import { describeEnds, writeOutput } from "../support/ends.mjs";
import { textRuns } from "../support/pdf.mjs";
import { placedRuns } from "../support/text.mjs";

var lorem =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. " +
  "Etiam in suscipit purus. Vestibulum ante ipsum primis in faucibus orci luctus " +
  "et ultrices posuere cubilia Curae; Vivamus nec hendrerit felis. Morbi aliquam " +
  "facilisis risus eu lacinia. Sed eu leo in turpis fringilla hendrerit.";

/**
 * Draw one row of three lorem boxes with charSpace 0, 1 and 2.
 * @param {object} recipe - The Recipe with an open page.
 * @param {number} x - The left edge of the row.
 * @param {number} y - The top edge of the row.
 * @param {number} w - The box width.
 * @param {string} textAlign - The box text alignment.
 * @returns {void}
 */
function spacingRow(recipe, x, y, w, textAlign) {
  ["red", "blue", "green"].forEach(function (color, charSpace) {
    recipe.text(lorem, x + (w + 5) * charSpace, y, {
      charSpace,
      textBox: { width: w, textAlign, style: { width: 0.5, color } },
    });
  });
}

describeEnds("Recipe text charSpace", function (end) {
  it("counts spacing between retained Unicode characters", function () {
    // Measured with textDimensions(); the native test asserted the internal
    // Word and charSpacing helpers with the same expectations.
    var recipe = end.newRecipe().createPage(300, 300);
    [
      [" ab", 4],
      ["ab ", 4],
      ["a b", 4],
      [" ab ", 6],
      [" ab ", 6],
      ["\u{1f600}", 0],
      ["A\u{1f600}B", 4],
    ].forEach(([text, spacing]) => {
      var plain = recipe.textDimensions(text, { font: "arial" });
      var spaced = recipe.textDimensions(text, { font: "arial", charSpace: 2 });
      assert.ok(
        Math.abs(spaced.xMax - plain.xMax - spacing) < 1e-9,
        JSON.stringify(text),
      );
    });
  });

  it("widens measured text by the character spacing", function () {
    var recipe = end.newRecipe().createPage(300, 300);
    [
      ["abc", 4],
      [" ab ", 6],
      ["A\u{1f600}B", 4],
    ].forEach(([text, spacing]) => {
      var plain = recipe.textDimensions(text, { font: "arial", size: 12 });
      var spaced = recipe.textDimensions(text, {
        font: "arial",
        size: 12,
        charSpace: 2,
      });
      assert.equal(spaced.xMax, plain.xMax + spacing, `${text} xMax`);
      assert.equal(spaced.width, plain.width + spacing, `${text} width`);
    });
  });

  it("lays out text boxes with character spacing", function () {
    var recipe = end.newRecipe().createPage("letter");
    var x = 20;
    var w = 180;
    var boundaryPlain = recipe.textDimensions(" ab ");
    var boundarySpaced = recipe.textDimensions(" ab ", { charSpace: 2 });
    var unicodePlain = recipe.textDimensions("A\u{1f600}B");
    var unicodeSpaced = recipe.textDimensions("A\u{1f600}B", {
      charSpace: 2,
    });
    assert.equal(boundarySpaced.xMax, boundaryPlain.xMax + 6);
    assert.equal(unicodeSpaced.xMax, unicodePlain.xMax + 4);

    recipe
      .text("charSpace: 0", x + 40, 20, { color: "red" })
      .text("charSpace: 1", x + 45 + w, 20, { color: "blue" })
      .text("charSpace: 2", x + 50 + w * 2, 20, { color: "green" });
    spacingRow(recipe, x, 40, w, "left");
    recipe.text('textAlign: "justify"', x, 260, { color: "#00" });
    spacingRow(recipe, x, 280, w, "justify");
    recipe.text('textAlign: "center"', x, 500, { color: "#00" });
    spacingRow(recipe, x, 520, w, "center");
    var bytes = recipe.endPage().endPDF();
    writeOutput(end, "text-charSpace", bytes);

    // Each column shows its spacing, and wider spacing wraps into more lines.
    var runs = placedRuns(end, bytes);
    var lines = [0, 1, 2].map(
      (charSpace) =>
        runs.filter(
          (run) =>
            run.charSpace === charSpace &&
            run.y > 792 - 260 &&
            run.text.trim() !== "" &&
            !run.text.startsWith("charSpace"),
        ).length,
    );
    assert.ok(lines[0] > 0, JSON.stringify(lines));
    assert.ok(
      lines[0] <= lines[1] && lines[1] < lines[2],
      JSON.stringify(lines),
    );
  });

  // Issue #893: measure() already includes the spacing, so wrapping must not
  // add it again.
  it("wraps character-spaced text at the spaced width", function () {
    var bytes = end
      .newRecipe()
      .createPage(400, 400)
      .text(
        "Spaced letters wrap the same way in a flow as in one call.",
        20,
        20,
        { font: "arial", charSpace: 3, textBox: { width: 150 } },
      )
      .endPage()
      .endPDF();
    writeOutput(end, "text-charSpace-wrap", bytes);
    assert.deepEqual(
      textRuns(end, bytes).map((run) => run.text),
      ["Spaced letters", "wrap the same", "way in a flow as", "in one call."],
    );
  });

  it("contains character spacing and rejects non-finite values", function () {
    var recipe = end.newRecipe().createPage(200, 200);
    for (var charSpace of [Infinity, -Infinity, NaN]) {
      assert.throws(
        () => recipe.text("Invalid", 20, 20, { charSpace }),
        { name: "TypeError", message: "charSpace must be a finite number" },
        String(charSpace),
      );
    }
    var bytes = recipe
      .text("Spaced", 20, 40, { charSpace: 5 })
      .text("Plain", 20, 80)
      .endPage()
      .endPDF();
    writeOutput(end, "text-charSpace-restored", bytes);
    var runs = placedRuns(end, bytes);
    assert.deepEqual(
      runs.map((run) => run.text),
      ["Spaced", "Plain"],
      "rejected text is not drawn",
    );
    assert.equal(runs[0].charSpace, 5);
    assert.equal(
      runs[1].charSpace,
      0,
      "Recipe character spacing ends with its text operation",
    );
  });

  it("measures spacing and writes wrapped, centered, transformed text", function () {
    var recipe = end.newRecipe().createPage(300, 300);
    recipe.text("centered text wraps here", 20, 20, {
      font: "arial",
      size: 14,
      charSpace: 1,
      rotation: 12,
      skewX: 3,
      textBox: {
        width: 120,
        padding: 4,
        textAlign: "center center",
        style: { fill: "#eeeeee", stroke: "#222222" },
      },
    });
    assert.ok(recipe.movedown(0, true)[1] > 20);
    var bytes = recipe.endPage().endPDF();
    writeOutput(end, "text-charSpace-transformed", bytes);
    var runs = placedRuns(end, bytes).filter((run) => run.text.trim());
    assert.ok(runs.length > 1, "the text wraps");
    runs.forEach((run) => assert.equal(run.charSpace, 1));
  });
});
