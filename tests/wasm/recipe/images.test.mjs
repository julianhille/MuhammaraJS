import assert from "node:assert/strict";
import { describeEnd } from "../../support/ends.mjs";
import { imagePlacements } from "../../support/images.mjs";

describeEnd("wasm", "Recipe images", function (end) {
  var base;
  var placed;

  before(function () {
    base = end.newRecipe().createPage(400, 500).endPage().endPDF();
    placed = end.newRecipe().createPage(200, 100).endPage().endPDF();
  });

  after(function () {
    end.Recipe.unregisterPdf("images-replaced");
  });

  it("keeps what a page drew when the registered PDF is replaced or removed", function () {
    var Recipe = end.Recipe;
    // An edited page keeps its own copy of what it drew, so the asset can be
    // replaced or removed before the page ends.
    Recipe.registerPdf("images-replaced", placed);
    var edited = end
      .openRecipe(base)
      .editPage(1)
      .image("images-replaced", 10, 10, { width: 50 });
    Recipe.registerPdf("images-replaced", placed);
    edited.image("images-replaced", 10, 100, { width: 50 });
    Recipe.unregisterPdf("images-replaced");
    var editedBytes = edited.endPage().endPDF();

    // So does a new page.
    Recipe.registerPdf("images-replaced", placed);
    var created = end
      .newRecipe()
      .createPage(400, 500)
      .image("images-replaced", 10, 10, { width: 50 });
    Recipe.registerPdf("images-replaced", placed);
    created.image("images-replaced", 10, 100, { width: 50 });
    Recipe.unregisterPdf("images-replaced");
    var createdBytes = created.endPage().endPDF();

    [editedBytes, createdBytes].forEach((bytes) =>
      assert.deepEqual(
        imagePlacements(end, bytes, { pageBoxes: [[0, 0, 200, 100]] }).map(
          (placement) => [placement.kind, placement.corners[0]],
        ),
        [
          ["page", [10, 465]],
          ["page", [10, 375]],
        ],
      ),
    );
  });

  it("explains that image() takes a registered name, not bytes", function () {
    var recipe = end.newRecipe().createPage(400, 500);
    assert.throws(() => recipe.image(new Uint8Array([255, 216]), 0, 0), {
      name: "TypeError",
      message: "Unknown image: expected a registered name, received Uint8Array",
    });
    recipe.endPage().endPDF();
  });
});
