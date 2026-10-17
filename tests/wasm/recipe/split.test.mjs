import assert from "node:assert/strict";
import { describeEnd, writeOutput } from "../../support/ends.mjs";
import { pageWidths, numberedPdf } from "../../support/composition.mjs";

describeEnd("wasm", "Recipe split", function (end) {
  after(function () {
    end.Recipe.unregisterPdf("split-registered");
  });

  it("returns the pages as named bytes and finishes the Recipe", function () {
    var recipe = end.openRecipe(numberedPdf(end, 2));
    var parts = recipe.split();
    // The default prefix is "page".
    assert.deepEqual(
      parts.map((part) => part.name),
      ["page-1.pdf", "page-2.pdf"],
    );
    parts.forEach((part) => assert.ok(part.bytes instanceof Uint8Array));
    // split() ended the Recipe, so endPDF() returns the PDF it split.
    assert.deepEqual(pageWidths(end, recipe.endPDF()), [101, 102]);
  });

  it("splits a registered PDF without a Recipe", function () {
    end.Recipe.registerPdf("split-registered", numberedPdf(end, 3));
    var parts = end.Recipe.splitPdf("split-registered", "split");
    assert.deepEqual(
      parts.map((part) => part.name),
      ["split-1.pdf", "split-2.pdf", "split-3.pdf"],
    );
    parts.forEach((part, index) => {
      writeOutput(end, `split-registered-${index + 1}`, part.bytes);
      assert.deepEqual(pageWidths(end, part.bytes), [101 + index]);
    });
    assert.deepEqual(
      end.Recipe.splitPdf("split-registered").map((part) => part.name),
      ["page-1.pdf", "page-2.pdf", "page-3.pdf"],
    );
  });
});
