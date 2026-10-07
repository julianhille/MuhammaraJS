// The direction test matrix on Wasm: see
// packages/native-with-source/tests/helpers/direction-matrix.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createMuhammaraWasm, createRecipe } from "../../index.js";
import { drawnGaps } from "../../lib/text-direction.js";

var require = createRequire(import.meta.url);
var {
  cases,
  summarize,
  brokenProperties,
  readExpected,
  writeExpected,
  knownDifference,
  update,
} = require("../../../native-with-source/tests/helpers/direction-matrix/matrix.cjs");

describe("Recipe text direction matrix", function () {
  var muhammara;
  var Recipe;
  var font;
  var expected = readExpected();
  var summaries = {};

  before(async function () {
    var arial = new Uint8Array(
      await readFile(
        new URL(
          "../../../native-with-source/tests/TestMaterials/fonts/arial.ttf",
          import.meta.url,
        ),
      ),
    );
    muhammara = await createMuhammaraWasm({ recryptWorker: false });
    Recipe = await createRecipe({ recryptWorker: false });
    Recipe.registerFont("arial", arial);
    muhammara.registerFont("arial", arial);
    font = muhammara.createWriter().getFontForBytes("arial");
  });

  after(function () {
    if (update) writeExpected("wasm", summaries);
    muhammara?.disposeAssets();
    Recipe?.disposeAssets();
  });

  /**
   * Draw a case and read back its runs and annotations.
   *
   * @param {object} testCase The case.
   * @returns {{runs: object[], annotations: number[][]}} The page.
   */
  function draw(testCase) {
    var recipe = new Recipe().createPage(400, 400);
    var bytes;
    try {
      testCase.draw(recipe);
      bytes = recipe.endPage().endPDF();
    } finally {
      recipe.dispose();
    }
    var reader = muhammara.createReader(bytes);
    try {
      var runs = reader.extractPageText(0).map((run) => ({
        text: run.text,
        x: run.textMatrix[4],
        y: run.textMatrix[5],
      }));
      var annots = reader.parsePage(0).getDictionary().toJSObject().Annots;
      var annotations = annots
        ? annots.toJSArray().map((reference) => {
            var rect = reader
              .parseNewObject(reference.getObjectID())
              .toJSObject()
              .Rect.toJSArray()
              .map((value) => value.value);
            return [rect[0], rect[2]];
          })
        : [];
      return { runs, annotations };
    } finally {
      reader.end();
    }
  }

  for (const testCase of cases) {
    it(testCase.name, function () {
      var { runs, annotations } = draw(testCase);
      var summary = summarize(runs, annotations);
      summaries[testCase.name] = summary;
      assert.deepEqual(
        brokenProperties(testCase, summary, (text, direction, x) => {
          var { size, charSpace } = testCase.options;
          return (
            x +
            font.calculateTextDimensions(text, size).xMax +
            charSpace * drawnGaps(text, direction)
          );
        }),
        [],
      );
      if (update) return;
      var known = expected[testCase.name];
      assert.ok(known?.wasm, "missing from expected.json");
      assert.deepEqual(summary, known.wasm);
      if (known.native && !knownDifference(testCase.name)) {
        assert.deepEqual(known.native, known.wasm, "native and Wasm differ");
      }
    });
  }
});
