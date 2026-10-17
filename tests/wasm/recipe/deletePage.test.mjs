import assert from "node:assert/strict";
import { describeEnd } from "../../support/ends.mjs";
import { numberedPdf } from "../../support/composition.mjs";

describeEnd("wasm", "Recipe deletePage", function (end) {
  it("rejects deletion after disposal", function () {
    var recipe = end.openRecipe(numberedPdf(end, 2));
    recipe.dispose();
    assert.throws(() => recipe.deletePage(1), /after disposal/);
  });
});
