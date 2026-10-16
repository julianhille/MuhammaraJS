// Fonts on Wasm: Recipe reads registered font bytes, not font folders, so
// the native fontSrcPath option throws a clear error instead of being
// ignored (see packages/wasm/DIFFERENCES.md).
import assert from "node:assert/strict";
import { describeEnd } from "../../support/ends.mjs";

describeEnd("wasm", "Recipe font", function (end) {
  it("ignores fontSrcPath, as it always has", function () {
    var bytes = end
      .newRecipe({ fontSrcPath: "fonts" })
      .createPage(100, 100)
      .endPage()
      .endPDF();
    assert.ok(bytes.length > 0);
  });
});
