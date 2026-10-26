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

describeEnds("Recipe coordinates", function (end) {
  it("reads a rotated source with a moved media box and edits it from its displayed top-left corner", function () {
    var M = end.muhammara;
    var source = end
      .newRecipe({ compress: false })
      .createPage(200, 300)
      .setPageBox(M.ePDFPageBoxMediaBox, 10, 20, 210, 320)
      .rotate(90)
      .endPage()
      .endPDF();
    writeOutput(end, "coordinate-rotated-source", source);
    var recipe = end.openRecipe(source, { compress: false });
    // Width and height are the displayed sides; size and offsets come from
    // the media box.
    assert.deepEqual(recipe.metadata[1], {
      pageNumber: 1,
      mediaBox: [10, 20, 210, 320],
      rotate: 90,
      width: 300,
      height: 200,
      layout: "landscape",
      size: [200, 300],
      offsetX: 10,
      offsetY: 20,
    });

    recipe
      .editPage(1)
      .rectangle(30, 40, 20, 10, { fill: "#000000" })
      .moveTo(50, 60)
      .lineTo(70, 80)
      .annot(110, 120, "Square", { width: 30, height: 40 });
    var position = recipe.position;
    var bytes = recipe.endPage().endPDF();
    writeOutput(end, "coordinate-rotated-edit", bytes);

    var geometry = pageGeometry(end, bytes);
    var [fill] = imagePlacements(end, bytes);
    assert.deepEqual(
      bounds(displayed(fill.corners, geometry.media, geometry.rotate)),
      [30, 40, 50, 50],
    );
    // annot() takes the top-left corner: the 40-point height runs down the
    // displayed page.
    var [square] = annotations(end, bytes);
    var [left, bottom, right, top] = square.Rect;
    assert.deepEqual(
      bounds(
        displayed(
          [
            [left, bottom],
            [right, top],
          ],
          geometry.media,
          geometry.rotate,
        ),
      ),
      [110, 120, 140, 160],
    );
    assert.deepEqual(position, { x: 70, y: 80 });
  });

  it("reports a position without an active page", function () {
    var recipe = end.newRecipe();
    assert.deepEqual(recipe.position, { x: 0, y: 0 });
    recipe.createPage(200, 200).moveTo(30, 40).endPage();
    // The last position of the previous page.
    assert.deepEqual(recipe.position, { x: 30, y: 40 });
    recipe.endPDF();
  });
});
