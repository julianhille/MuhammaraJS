// The direction test matrix on both ends: see tests/matrices/README.md.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { describeEnds, fixture } from "../support/ends.mjs";
import { annotations, textRuns } from "../support/pdf.mjs";

var require = createRequire(import.meta.url);
var textDirection = require("@muhammara/shared/text-direction.js");
var {
  cases,
  summarize,
  brokenProperties,
  checkExpected,
  writeExpected,
  update,
} = require("./direction/matrix.cjs");

// This source copy of the module, used for measuring, needs bidi-js too.
textDirection.useBidi(require("bidi-js"));
var ARIAL = fixture("fonts/arial.ttf");

/**
 * Arial in the end's low-level writer, to measure where a line must end.
 * Loading it is the one thing the ends do differently here: from a path on
 * native, from registered bytes on Wasm. The writer is returned too, since a
 * writer that is collected ends and takes its fonts with it.
 * @param {object} end - The end.
 * @returns {{writer: object, font: object}} The writer and its font.
 */
function measuringFont(end) {
  var { muhammara } = end;
  if (end.name === "native") {
    var writer = muhammara.createWriter(new muhammara.PDFWStreamForBuffer());
    return { writer, font: writer.getFontForFile(ARIAL) };
  }
  muhammara.registerFont("arial", readFileSync(ARIAL));
  var wasmWriter = muhammara.createWriter();
  return { writer: wasmWriter, font: wasmWriter.getFontForBytes("arial") };
}

describeEnds("Recipe text direction matrix", function (end) {
  var summaries = new Map();
  var measuring;

  before(function () {
    measuring = measuringFont(end);
  });

  after(function () {
    if (update) writeExpected(end.name, summaries);
  });

  for (const testCase of cases) {
    it(testCase.title, function () {
      var recipe = end.newRecipe().createPage(400, 400);
      testCase.draw(recipe);
      var bytes = recipe.endPage().endPDF();
      var summary = summarize(
        textRuns(end, bytes),
        annotations(end, bytes).map((annotation) => [
          annotation.Rect[0],
          annotation.Rect[2],
        ]),
      );
      summaries.set(testCase, summary);
      assert.deepEqual(
        brokenProperties(testCase, summary, (text, direction, x) => {
          var { size, charSpace } = testCase.options;
          return (
            x +
            measuring.font.calculateTextDimensions(text, size).xMax +
            charSpace * textDirection.drawnGaps(text, direction)
          );
        }),
        [],
      );
      if (!update) checkExpected(end.name, testCase, summary, assert);
    });
  }
});
