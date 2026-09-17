import assert from "node:assert/strict";
import { charSpacing } from "../../lib/recipe/text.helper.js";

describe("Recipe character spacing", function () {
  it("counts non-breaking spaces at text boundaries", function () {
    assert.equal(charSpacing(" ab ", 2), 2);
    assert.equal(charSpacing("\u00a0ab\u00a0", 2), 6);
  });
});
