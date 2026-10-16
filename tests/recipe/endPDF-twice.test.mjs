import assert from "node:assert/strict";
import { describeEnds, writeOutput } from "../support/ends.mjs";
import { pageCount } from "../support/pdf.mjs";

describeEnds("Recipe endPDF called twice", function (end) {
  it("returns the same bytes on repeated calls", function () {
    var recipe = end.newRecipe();
    recipe.createPage("letter").endPage();

    var first = recipe.endPDF();
    writeOutput(end, "endPDF-twice", first);
    assert.equal(pageCount(end, first), 1);
    assert.equal(recipe.endPDF(), first);
  });

  it("invokes repeated callbacks with the completed bytes", function () {
    var recipe = end.newRecipe();
    var firstOutput;
    var firstResult = recipe
      .createPage("letter")
      .endPage()
      .endPDF((output) => {
        firstOutput = output;
        return "first";
      });
    var secondOutput;
    var secondResult = recipe.endPDF((output) => {
      secondOutput = output;
      return "second";
    });
    writeOutput(end, "endPDF-twice-callback", firstOutput);

    // What endPDF(callback) returns is meant to differ (the callback's result
    // on native, the bytes on Wasm); each end's own suite asserts it.
    void firstResult;
    void secondResult;
    assert.equal(pageCount(end, firstOutput), 1);
    assert.deepEqual(secondOutput, firstOutput);
  });

  it("retires the Recipe and rethrows the original error after a finalization failure", function () {
    var recipe = end.openRecipe("recipe/createWithBuffer.pdf");
    var finalizationError = new Error("injected finalization failure");
    // Fail a step of finalization through the shared Recipe's info writer.
    recipe._writeInfo = () => {
      throw finalizationError;
    };

    assert.throws(
      () => recipe.endPDF(),
      (error) => error === finalizationError,
    );
    assert.throws(
      () => recipe.endPDF(),
      (error) => error === finalizationError,
    );
    assert.throws(
      () => recipe.endPDF(() => assert.fail("no callback after a failure")),
      (error) => error === finalizationError,
    );
  });
});
