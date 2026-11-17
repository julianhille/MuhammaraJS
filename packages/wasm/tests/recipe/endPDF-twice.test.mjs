import assert from "node:assert/strict";
import { createRecipe } from "../../index.js";
import { recipeFixture } from "./recipe.mjs";
import { writeOutput } from "../testOutput.mjs";

describe("Recipe endPDF called twice", function () {
  it("returns the same cached bytes on repeated calls", async function () {
    var Recipe = await createRecipe();
    var recipe = new Recipe();
    recipe.createPage().endPage();

    var first = recipe.endPDF();
    writeOutput("endPDF-twice-cached", first);
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
    assert.throws(
      () => recipe.endPDF(),
      (error) => error === finalizationError,
    );
  });

  it("retires a Recipe of PDF bytes and rethrows the original error after a failed write", async function () {
    var Recipe = await createRecipe({ limits: { maxOutputBytes: 1000 } });
    var recipe = new Recipe(recipeFixture("AcroFormPdfLib"));

    var writeError;
    assert.throws(
      () => recipe.endPDF(),
      (error) => {
        writeError = error;
        return error.message === "PDF output exceeds maxOutputBytes";
      },
    );
    // the original error, not that the writer has ended
    assert.throws(
      () => recipe.endPDF(),
      (error) => error === writeError,
    );
  });
});
