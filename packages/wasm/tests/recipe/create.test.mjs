// Ports creation behavior from tests/recipe/create.js and createWithBuffer.js.
import assert from "node:assert/strict";
import { getRecipe } from "./recipe.mjs";

describe("Recipe create", function () {
  var Recipe;

  before(async function () {
    Recipe = await getRecipe();
  });

  it("provides text dimensions and registered extensions", function () {
    var dimensionsRecipe = new Recipe();
    var textDimensions = dimensionsRecipe.textDimensions("Browser Recipe", {
      font: "arial",
      fontSize: 24,
    });
    assert.ok(textDimensions.width > 0);
    dimensionsRecipe.endPDF();

    var extensionRecipe = new Recipe();
    extensionRecipe.register("drawDot", function (x, y) {
      return this.circle(x, y, 2, { fill: "#000000" });
    });
    assert.equal(typeof extensionRecipe.drawDot, "function");
    extensionRecipe.createPage(100, 100).drawDot(50, 50).endPage().endPDF();

    var namedExtensionRecipe = new Recipe();
    namedExtensionRecipe.register(function drawSquare(x, y) {
      return this.rectangle(x, y, 2, 2, { fill: "#000000" });
    });
    assert.throws(
      () => namedExtensionRecipe.register("drawSquare", () => {}),
      /already exists/,
    );
    namedExtensionRecipe
      .createPage(100, 100)
      .drawSquare(50, 50)
      .endPage()
      .endPDF();
  });

  it("tracks named-page metadata, margins, and rotation", function () {
    var recipe = new Recipe().createPage("letter", 90, {
      left: 40,
      right: 20,
      top: 50,
      bottom: 30,
    });
    assert.equal(recipe.pageInfo(1).width, 792);
    assert.equal(recipe.pageInfo(1).height, 612);
    assert.deepEqual(recipe.position, { x: 0, y: 0 });
    recipe.text("margin layout", { font: "arial" });
    assert.equal(recipe.position.x, 40);
    assert.ok(recipe.position.y > 50);
    recipe.rotate(90).endPage().endPDF();
    assert.equal(recipe.getCurrentPageInfo().rotate, 90);
  });
});
