// The direction test matrix on native: see helpers/direction-matrix.
const assert = require("node:assert/strict");
const path = require("path");
const muhammara = require("@muhammara/native-with-source");
const { drawnGaps } = require("@muhammara/native-core/lib/text-direction");
const {
  cases,
  summarize,
  brokenProperties,
  readExpected,
  writeExpected,
  knownDifference,
  update,
} = require("../helpers/direction-matrix/matrix.cjs");

const { Recipe } = muhammara;
const ARIAL = path.join(__dirname, "../TestMaterials/fonts/arial.ttf");
const OUTPUT = path.join(__dirname, "../output/text-direction-matrix.pdf");

/**
 * Draw a case and read back its runs and annotations.
 *
 * @param {object} testCase The case.
 * @returns {Promise<{runs: object[], annotations: number[][]}>} The page.
 */
async function draw(testCase) {
  const recipe = new Recipe("new", OUTPUT);
  recipe.registerFont("arial", ARIAL);
  recipe.createPage(400, 400);
  testCase.draw(recipe);
  await new Promise((resolve) => recipe.endPage().endPDF(resolve));
  const reader = muhammara.createReader(OUTPUT);
  try {
    const runs = reader.extractPageText(0).map((run) => ({
      text: run.text,
      x: run.textMatrix[4],
      y: run.textMatrix[5],
    }));
    const annots = reader.parsePage(0).getDictionary().toJSObject().Annots;
    const annotations = annots
      ? annots.toJSArray().map((reference) => {
          const rect = reader
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

describe("Recipe text direction matrix", function () {
  const expected = readExpected();
  const summaries = {};

  after(function () {
    if (update) writeExpected("native", summaries);
  });

  for (const testCase of cases) {
    it(testCase.name, async function () {
      const { runs, annotations } = await draw(testCase);
      const summary = summarize(runs, annotations);
      summaries[testCase.name] = summary;
      assert.deepEqual(
        brokenProperties(testCase, summary, (text, direction, x) => {
          const { size, charSpace } = testCase.options;
          const font = muhammara
            .createWriter(new muhammara.PDFWStreamForBuffer())
            .getFontForFile(ARIAL);
          return (
            x +
            font.calculateTextDimensions(text, size).xMax +
            charSpace * drawnGaps(text, direction)
          );
        }),
        [],
      );
      if (update) return;
      const known = expected[testCase.name];
      assert.ok(known?.native, "missing from expected.json");
      assert.deepEqual(summary, known.native);
      if (known.wasm && !knownDifference(testCase.name)) {
        assert.deepEqual(known.native, known.wasm, "native and Wasm differ");
      }
    });
  }
});
