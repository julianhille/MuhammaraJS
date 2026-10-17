import assert from "node:assert/strict";
import { describeEnds, writeOutput } from "../support/ends.mjs";
import { bounds, clockwise, paths } from "../support/geometry.mjs";

describeEnds("Recipe graphics state", function (end) {
  it("rotates subsequent content around a Recipe coordinate", function () {
    var bytes = end
      .newRecipe({ compress: false })
      .createPage(200, 300)
      .rotateContent(90, 30, 40)
      .rectangle(0, 0, 10, 10, { fill: "#000000" })
      .endPage()
      .endPDF();
    writeOutput(end, "graphics-state-rotate", bytes);
    // rotateContent() turns counter-clockwise (#916), around Recipe (30, 40),
    // which is PDF (30, 260) on a 300 pt page. The rectangle covers PDF
    // (0, 290)-(10, 300) before the turn.
    var pivot = [30, 260];
    var expected = [
      [0, 290],
      [10, 290],
      [10, 300],
      [0, 300],
    ].map((point) => clockwise(point, pivot, -90));
    var [square] = paths(end, bytes);
    assert.deepEqual(bounds(square.points), bounds(expected));
    assert.deepEqual(bounds(square.points), {
      left: -10,
      bottom: 230,
      right: 0,
      top: 240,
    });
  });
});
