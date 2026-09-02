import assert from "node:assert/strict";
import { createRecipe } from "../../index.js";

describe("Recipe coordinates", function () {
  it("uses canonical rotated source geometry and calibrated edit coordinates", async function () {
    var Recipe = await createRecipe();
    var source = new Recipe({ compress: false })
      .createPage(200, 300)
      .setPageBox("media", 10, 20, 210, 320)
      .rotate(90)
      .endPage()
      .endPDF();
    Recipe.registerPdf("rotated-coordinate-source", source);
    assert.deepEqual(Recipe.inspectPdf("rotated-coordinate-source")[1], {
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
    var recipe = new Recipe(source, { compress: false });

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
    assert.deepEqual(recipe.position, { x: 70, y: 80 });

    var output = new TextDecoder().decode(recipe.endPage().endPDF());
    assert.match(output, /0 1 -1 0 190 20 cm/);
    assert.match(output, /40 170 20 10 re/);
    assert.match(output, /60 160 m\s+80 140 l/);
    assert.match(output, /\/Rect \[ 50 140 90 170 \]/);
  });
});
