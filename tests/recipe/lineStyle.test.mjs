import assert from "node:assert/strict";
import { describeEnds, writeOutput } from "../support/ends.mjs";
import { drawnContent } from "../support/pdf.mjs";

/**
 * The operators of the first stroked path's graphics state block, from its
 * `q` to the `S` that strokes it.
 * @param {string} content - Drawn content.
 * @returns {string} The block.
 */
function strokeBlock(content) {
  var match = content.match(/q\b(?:(?!\bQ\b)[\s\S])*?\bS\b/);
  assert.ok(match, "the line is stroked inside a graphics state block");
  return match[0];
}

describeEnds("Recipe lineStyle", function (end) {
  it("throws for a miter limit below 1 before drawing", function () {
    var recipe = end.newRecipe().createPage(100, 100);
    [-1, 0.5, NaN, "wide"].forEach((miterLimit) => {
      var error = {
        name: "RangeError",
        message: "miterLimit must be a number of at least 1",
      };
      assert.throws(
        () =>
          recipe.line(
            [
              [10, 10],
              [90, 90],
            ],
            { miterLimit },
          ),
        error,
      );
      assert.throws(() => recipe.lineStyle({ miterLimit }), error);
    });
    var bytes = recipe
      .lineStyle({ miterLimit: "4" })
      .line([
        [10, 10],
        [90, 90],
      ])
      .endPage()
      .endPDF();
    var content = drawnContent(end, bytes);
    assert.match(content, /\b4 M\b/);
    assert.doesNotMatch(content, /-1 M|0\.5 M/);
  });

  it("writes every line style operator before the stroke", function () {
    var bytes = end
      .newRecipe()
      .createPage(100, 100)
      .lineStyle({
        width: 3,
        cap: 1,
        join: 2,
        miterLimit: 4,
        dash: [6, 3],
        dashPhase: 2,
      })
      .line([
        [10, 10],
        [90, 90],
      ])
      .endPage()
      .endPDF();
    writeOutput(end, "lineStyle-dashed", bytes);
    var block = strokeBlock(drawnContent(end, bytes));
    [/\b3 w\b/, /\b1 J\b/, /\b2 j\b/, /\b4 M\b/, /\[ 6 3 \] 2 d/].forEach(
      (operator) => assert.match(block, operator),
    );
  });

  it("applies lineWidth to subsequent lines", function () {
    var bytes = end
      .newRecipe()
      .createPage(100, 100)
      .lineWidth(5)
      .line([
        [10, 10],
        [90, 90],
      ])
      .endPage()
      .endPDF();
    writeOutput(end, "lineStyle-width", bytes);
    assert.match(strokeBlock(drawnContent(end, bytes)), /\b5 w\b/);
  });
});
