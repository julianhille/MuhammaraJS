import assert from "node:assert/strict";
import { describeEnds, writeOutput } from "../support/ends.mjs";
import { annotations } from "../support/pdf.mjs";
import {
  displayed,
  imagePlacements,
  pageGeometry,
} from "../support/images.mjs";

/**
 * The bounding box of points.
 * @param {number[][]} points - [x, y] points.
 * @returns {number[]} [minX, minY, maxX, maxY].
 */
function bounds(points) {
  var xs = points.map(([x]) => x);
  var ys = points.map(([, y]) => y);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

describeEnds("Recipe rotation", function (end) {
  [
    ["Portrait 0", "test-P-0", "portrait", 0],
    ["Portrait 90", "test-P-90", "portrait", 90],
    ["Portrait 180", "test-P-180", "portrait", 180],
    ["Portrait 270", "test-P-270", "portrait", 270],
    ["Landscape 0", "test-L-0", "landscape", 0],
    ["Landscape 90", "test-L-90", "landscape", 90],
    ["Landscape 180", "test-L-180", "landscape", 180],
    ["Landscape 270", "test-L-270", "landscape", 270],
  ].forEach(([title, name, layout, rotate]) => {
    it(`edits a ${title} page from its displayed top-left corner`, function () {
      var recipe = end.openRecipe(`recipe/${name}.pdf`);
      var page = recipe.metadata[1];
      assert.equal(page.rotate, rotate);
      assert.equal(page.layout, layout);
      assert.equal(page.offsetX, 0);
      assert.equal(page.offsetY, 0);
      var { width, height } = recipe.pageInfo(1);
      assert.equal(width, page.width);
      assert.equal(height, page.height);

      recipe
        .editPage(1)
        .text("[0,0] is Here.", 0, 0, {
          color: "066099",
          fontSize: 100,
          bold: true,
          font: "arial",
        })
        .comment("add comment", 0, 0)
        .rectangle(0, 0, width / 2, height / 2, {
          stroke: "#ff0000",
          fill: "#000000",
          opacity: 0.2,
        })
        .circle(300, 300, 300, {
          color: "#0000ff",
          opacity: 0.1,
        })
        .moveTo(0, 0)
        .lineTo(width, height);
      assert.deepEqual(recipe.position, { x: width, y: height });
      recipe
        .comment("2", "center", 100)
        .comment("3", "center", 300)
        .comment("3", 300, 400)
        .comment("3", 400, 500)
        .comment("3", 500, 600);
      var bytes = recipe.endPage().endPDF();
      writeOutput(end, `rotation-${name}`, bytes);

      var geometry = pageGeometry(end, bytes);
      assert.equal(geometry.rotate, rotate);
      // The rectangle covers the displayed top-left quarter.
      var fill = imagePlacements(end, bytes).find(
        (placement) => placement.kind === "fill",
      );
      assert.deepEqual(
        bounds(displayed(fill.corners, geometry.media, rotate)),
        [0, 0, width / 2, height / 2],
      );
      // Comments mark the displayed points they were given.
      assert.deepEqual(
        annotations(end, bytes).map(
          (annot) =>
            displayed([annot.Rect.slice(0, 2)], geometry.media, rotate)[0],
        ),
        [
          [0, 0],
          [width / 2, 100],
          [width / 2, 300],
          [300, 400],
          [400, 500],
          [500, 600],
        ],
      );

      var reread = end.openRecipe(bytes);
      assert.equal(reread.metadata[1].rotate, rotate);
      assert.equal(reread.metadata[1].layout, layout);
      reread.endPDF();
    });
  });
});
