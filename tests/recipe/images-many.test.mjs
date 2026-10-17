import assert from "node:assert/strict";
import { describeEnds, writeOutput } from "../support/ends.mjs";
import { imagePlacements } from "../support/images.mjs";

describeEnds("Recipe many images", function (end) {
  it("adds many images to an edited page", function () {
    var myCats = end.image("recipe/myCats.jpg");
    var recipe = end.openRecipe("recipe/test.pdf").editPage(1);
    var repeats = 300;
    for (var i = 0; i < repeats; i++) {
      recipe.image(myCats, "center", "center", {
        // Widths from 10 to 3000, as the random widths this test once used.
        width: 10 + ((i * 997) % 2991),
        opacity: 0.5,
        align: "center center",
      });
    }
    var bytes = recipe.endPage().endPDF();
    writeOutput(end, "images-many", bytes);
    var images = imagePlacements(end, bytes);
    assert.equal(images.length, repeats);
    images.forEach((placement, index) => {
      var width = 10 + ((index * 997) % 2991);
      assert.equal(placement.kind, "image");
      assert.equal(placement.opacity, 0.5);
      // Each image is centered on the page.
      var [[left, bottom], , [right, top]] = placement.corners;
      assert.ok(Math.abs(right - left - width) < 0.02, `${index}`);
      assert.ok(Math.abs((left + right) / 2 - 306) < 0.02, `${index}`);
      assert.ok(Math.abs((bottom + top) / 2 - 396) < 0.02, `${index}`);
    });
  });
});
