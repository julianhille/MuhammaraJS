import assert from "node:assert/strict";
import { describeEnds, writeOutput } from "../support/ends.mjs";
import { paths, rounded } from "../support/geometry.mjs";

// The distance helper decides whether polygon() closes a path back to its
// first point; the drawn polygon is its outcome.
describeEnds("Vector helpers", function (end) {
  it("closes a polygon whose last point is a vertical or diagonal distance away", function () {
    var bytes = end
      .newRecipe()
      .createPage(100, 100)
      .polygon(
        [
          [10, 10],
          [10, 13],
        ],
        { fill: "#000000" },
      )
      .polygon(
        [
          [20, 10],
          [24, 13],
        ],
        { fill: "#000000" },
      )
      .endPage()
      .endPDF();
    writeOutput(end, "vector-helper-close", bytes);
    var [vertical, diagonal] = paths(end, bytes);
    assert.deepEqual(rounded(vertical.anchors), [
      [10, 90],
      [10, 87],
      [10, 90],
    ]);
    assert.deepEqual(rounded(diagonal.anchors), [
      [20, 90],
      [24, 87],
      [20, 90],
    ]);
  });

  it("does not close a polygon that already ends on its first point again", function () {
    var bytes = end
      .newRecipe()
      .createPage(100, 100)
      .polygon(
        [
          [10, 10],
          [10, 13],
          [14, 13],
          [10, 10],
        ],
        { fill: "#000000" },
      )
      .endPage()
      .endPDF();
    var [closed] = paths(end, bytes);
    assert.deepEqual(rounded(closed.anchors), [
      [10, 90],
      [10, 87],
      [14, 87],
      [10, 90],
    ]);
  });
});
