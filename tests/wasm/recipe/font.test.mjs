// Fonts on Wasm: Recipe reads registered font bytes, not font folders, so
// the native fontSrcPath option throws a clear error instead of being
// ignored (see packages/wasm/DIFFERENCES.md).
import assert from "node:assert/strict";
import { describeEnd } from "../../support/ends.mjs";

describeEnd("wasm", "Recipe font", function (end) {
  it("rejects fontSrcPath and points to registerFont()", function () {
    assert.throws(() => end.newRecipe({ fontSrcPath: "fonts" }), {
      name: "TypeError",
      message:
        "fontSrcPath is unavailable in Wasm; register fonts with Recipe.registerFont()",
    });
  });
});
