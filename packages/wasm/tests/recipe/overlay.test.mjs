// Ports byte-backed overlay behavior from tests/recipe/overlay.js.
import assert from "node:assert/strict";
import { getRecipe } from "./recipe.mjs";

describe("Recipe overlay", function () {
  it("overlays registered PDF pages with scale and fit options", async function () {
    var Recipe = await getRecipe();
    var source = new Recipe()
      .createPage(595, 842)
      .endPage()
      .createPage(300, 200)
      .endPage()
      .endPDF();
    Recipe.registerPdf("source", source);
    var overlay = new Recipe()
      .createPage(595, 842)
      .overlay("source")
      .overlay("source", 20, 20, {
        page: 2,
        scale: 0.5,
        fitHeight: true,
        keepAspectRatio: false,
      })
      .endPage()
      .endPDF();
    assert.match(new TextDecoder().decode(overlay), /%%EOF/);
  });
});
