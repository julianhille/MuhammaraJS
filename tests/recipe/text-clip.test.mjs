// Merges packages/native-with-source/tests/recipe/text-clip.js and the
// text-box clipping cases of the Wasm text-layout-table.test.mjs.
import assert from "node:assert/strict";
import { describeEnds, writeOutput } from "../support/ends.mjs";
import { textRuns } from "../support/pdf.mjs";

describeEnds("Recipe text box clipping", function (end) {
  it("clips complete lines and reports the remainder", function () {
    var recipe = end.newRecipe().createPage(220, 120);
    var callbackRecipe;
    var clipResult;
    recipe.text("first\nsecond", 10, 20, {
      font: "arial",
      size: 12,
      textBox: {
        width: 100,
        height: 12,
        lineHeight: 12,
        clipIfExceedsBox: true,
        onClip(currentRecipe, result) {
          callbackRecipe = currentRecipe;
          clipResult = result;
        },
      },
    });
    assert.equal(callbackRecipe, recipe);
    assert.deepEqual(clipResult, {
      remainder: "second",
      linesWritten: 1,
      clipped: true,
      bounds: { x: 10, y: 20, width: 100, height: 12 },
    });
    var bytes = recipe.endPage().endPDF();
    writeOutput(end, "text-clip-remainder", bytes);
    assert.deepEqual(
      textRuns(end, bytes).map((run) => run.text),
      ["first"],
    );
  });

  it("clips wrapped lines and reports the remainder", function () {
    var recipe = end.newRecipe().createPage("letter");
    var callbackRecipe;
    var clipResult;
    recipe.text(
      "First line of text that fits. Second line of text that must be clipped.",
      50,
      50,
      {
        size: 12,
        textBox: {
          width: 200,
          height: 15,
          clipIfExceedsBox: true,
          onClip: (currentRecipe, result) => {
            callbackRecipe = currentRecipe;
            clipResult = result;
          },
        },
      },
    );
    var bytes = recipe.endPage().endPDF();
    writeOutput(end, "text-clip-wrapped", bytes);
    assert.strictEqual(callbackRecipe, recipe);
    assert.strictEqual(clipResult.clipped, true);
    assert.strictEqual(clipResult.linesWritten, 1);
    assert.ok(clipResult.remainder.length > 0);
    assert.deepStrictEqual(clipResult.bounds, {
      x: 50,
      y: 50,
      width: 200,
      height: 15,
    });
    var runs = textRuns(end, bytes);
    assert.equal(runs.length, 1);
    // The written line and the remainder make up the whole text.
    assert.equal(
      `${runs[0].text.trim()} ${clipResult.remainder.trim()}`,
      "First line of text that fits. Second line of text that must be clipped.",
    );
  });

  it("warns when onClip is configured without clipping", function () {
    var recipe = end.newRecipe().createPage("letter");
    var originalWarn = console.warn;
    var warning;
    console.warn = (message) => {
      warning = message;
    };
    try {
      recipe.text("Text", 50, 50, {
        textBox: { width: 100, height: 20, onClip: () => {} },
      });
    } finally {
      console.warn = originalWarn;
    }
    writeOutput(end, "text-clip-warning", recipe.endPage().endPDF());
    assert.strictEqual(
      warning,
      "textBox.onClip will not be called unless textBox.clipIfExceedsBox is true.",
    );
  });
});
