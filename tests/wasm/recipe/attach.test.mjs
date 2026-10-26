import assert from "node:assert/strict";
import { describeEnd } from "../../support/ends.mjs";

describeEnd("wasm", "Recipe attach", function (end) {
  it("throws for a file path, which Wasm cannot read", function () {
    assert.throws(
      () => end.newRecipe().attach("profile.icc", "icc/sRGB-v2-micro.icc"),
      {
        name: "TypeError",
        message:
          "Wasm reads registered assets or bytes, not paths: icc/sRGB-v2-micro.icc",
      },
    );
  });
});
