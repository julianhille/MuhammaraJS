import assert from "node:assert/strict";
import { describeEnds, writeOutput } from "../support/ends.mjs";
import { readAnnotations, textShowCount } from "../support/annotations.mjs";

/**
 * The PDF corner of a rectangle that is the visual top-left corner on a page
 * rotated clockwise by `rotation` degrees.
 * @param {number[]} rect - The /Rect: left, bottom, right, top.
 * @param {number} rotation - The page rotation.
 * @returns {number[]} The corner as [x, y].
 */
function visualTopLeft([left, bottom, right, top], rotation) {
  return {
    0: [left, top],
    90: [left, bottom],
    180: [right, bottom],
    270: [right, top],
  }[rotation];
}

describeEnds("Annotation: Coordinate", function (end) {
  [0, 90, 180, 270].forEach(function (rotation) {
    it(`places an annotation upright on a page rotated ${rotation} degrees`, function () {
      var recipe = end.openRecipe(`recipe/test-L-${rotation}.pdf`);
      // pageInfo() gives the visual size; the media box is turned on its side
      // for a quarter rotation.
      var page = recipe.pageInfo(1);
      var quarter = rotation % 180 !== 0;
      var mediaWidth = quarter ? page.height : page.width;
      var mediaHeight = quarter ? page.width : page.height;
      var bytes = recipe
        .editPage(1)
        .text("Should be printed horizontally", "center", "center", {
          size: 30,
          color: "#ff0000",
        })
        .annot("center", "center", "Square", {
          text: "Should be printed horizontally on the top of the text",
          width: 600,
          height: 100,
          border: 10,
          color: [255, 128, 128],
          followOriginalPageRotation: false, // if set to true, the annotation will follow the original rotation
        })
        .endPage()
        .endPDF();
      writeOutput(end, `annotation-coordinate-rotation-${rotation}`, bytes);
      assert.ok(textShowCount(end, bytes) >= 1, "the text is drawn");
      var [square] = readAnnotations(end, bytes);
      assert.equal(square.Subtype, "Square");
      assert.equal(
        square.Contents,
        "Should be printed horizontally on the top of the text",
      );
      assert.deepEqual(square.Border, [0, 0, 10]);
      var [left, bottom, right, top] = square.Rect;
      // 600 wide and 100 high on the visual page, whatever the rotation.
      assert.deepEqual(
        [right - left, top - bottom],
        quarter ? [100, 600] : [600, 100],
      );
      // Its visual top-left corner sits at the visual center of the page.
      assert.deepEqual(visualTopLeft(square.Rect, rotation), [
        mediaWidth / 2,
        mediaHeight / 2,
      ]);
    });
  });
});
