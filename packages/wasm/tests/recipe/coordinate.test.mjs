import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createMuhammaraWasm, createRecipe } from "../../index.js";
import { writeOutput } from "../testOutput.mjs";

function rotationFixture(name) {
  return readFileSync(
    new URL(
      `../../../native-with-source/tests/TestMaterials/recipe/${name}.pdf`,
      import.meta.url,
    ),
  );
}

describe("Recipe coordinates", function () {
  it("uses canonical rotated source geometry and calibrated edit coordinates", async function () {
    var Recipe = await createRecipe();
    var muhammara = await createMuhammaraWasm();
    var source = new Recipe({ compress: false })
      .createPage(200, 300)
      .setPageBox(muhammara.ePDFPageBoxMediaBox, 10, 20, 210, 320)
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

    var bytes = recipe.endPage().endPDF();
    writeOutput("coordinate-rotated-edit", bytes);
    var output = new TextDecoder().decode(bytes);
    assert.match(output, /0 1 -1 0 190 20 cm/);
    assert.match(output, /40 170 20 10 re/);
    assert.match(output, /60 160 m\s+80 140 l/);
    assert.match(output, /\/Rect \[ 50 140 90 170 \]/);
  });

  // Port of tests/recipe/rotation.js, extended with the byte-level
  // assertions this file already applies to a single rotated case.
  [
    ["test-P-0", "portrait", 0],
    ["test-P-90", "portrait", 90],
    ["test-P-180", "portrait", 180],
    ["test-P-270", "portrait", 270],
    ["test-L-0", "landscape", 0],
    ["test-L-90", "landscape", 90],
    ["test-L-180", "landscape", 180],
    ["test-L-270", "landscape", 270],
  ].forEach(function ([name, layout, rotate]) {
    it(`edits an existing ${name} page at its calibrated origin`, async function () {
      var Recipe = await createRecipe();
      var recipe = new Recipe(rotationFixture(name), { compress: false });
      var page = recipe.metadata[1];
      assert.equal(page.rotate, rotate);
      assert.equal(page.layout, layout);
      assert.equal(page.offsetX, 0);
      assert.equal(page.offsetY, 0);

      var halfWidth = page.width / 2;
      var halfHeight = page.height / 2;
      recipe
        .editPage(1)
        .rectangle(0, 0, halfWidth, halfHeight, { fill: "#000000" })
        .moveTo(0, 0)
        .lineTo(page.width, page.height);
      assert.deepEqual(recipe.position, { x: page.width, y: page.height });

      var bytes = recipe.endPage().endPDF();
      var output = new TextDecoder().decode(bytes);
      assert.match(
        output,
        new RegExp(`0 ${halfHeight} ${halfWidth} ${halfHeight} re`),
      );
      assert.match(output, new RegExp(`0 ${page.height} m`));
      assert.match(output, new RegExp(`${page.width} 0 l`));
      if (rotate === 90) {
        assert.match(output, new RegExp(`0 1 -1 0 ${page.height} 0 cm`));
      } else if (rotate === 180) {
        assert.match(
          output,
          new RegExp(`-1 0 0 -1 ${page.width} ${page.height} cm`),
        );
      } else if (rotate === 270) {
        assert.match(output, new RegExp(`0 -1 1 0 0 ${page.width} cm`));
      }

      var reread = new Recipe(bytes, { compress: false });
      assert.equal(reread.metadata[1].rotate, rotate);
      assert.equal(reread.metadata[1].layout, layout);
    });
  });
});
