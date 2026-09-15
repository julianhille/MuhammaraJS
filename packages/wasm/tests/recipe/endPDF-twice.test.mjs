import assert from "node:assert/strict";
import { createRecipe } from "../../index.js";

describe("Recipe endPDF called twice", function () {
  it("returns the same cached bytes on repeated calls", async function () {
    var Recipe = await createRecipe();
    var recipe = new Recipe();
    recipe.createPage().endPage();

    var first = recipe.endPDF();
    var second = recipe.endPDF();

    assert.equal(second, first);
  });

  it("retires the Recipe and rethrows the original error after a finalization failure", async function () {
    var Recipe = await createRecipe();
    var recipe = new Recipe();
    recipe.createPage().endPage();

    var finalizationError = new Error("injected finalization failure");
    recipe._writeCanonicalInfo = () => {
      throw finalizationError;
    };

    assert.throws(() => recipe.endPDF(), /injected finalization failure/);
    assert.equal(recipe._recipe, 0);
    assert.equal(recipe._endError, finalizationError);
    assert.throws(() => recipe.endPDF(), (error) => error === finalizationError);
  });
});
