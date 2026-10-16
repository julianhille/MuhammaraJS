import assert from "node:assert/strict";
import { describeEnd } from "../../support/ends.mjs";

describeEnd("native", "Recipe foundation", function (end) {
  it("returns the callback result from endPDF()", function () {
    var recipe = end.newRecipe().createPage().endPage();
    var callbackBytes;
    var result = recipe.endPDF((bytes) => {
      callbackBytes = bytes;
      return "done";
    });
    assert.equal(result, "done");
    assert.ok(Buffer.isBuffer(callbackBytes));
    // A later call hands the same Buffer to a new callback.
    assert.strictEqual(
      recipe.endPDF((bytes) => bytes),
      callbackBytes,
    );
  });
});
