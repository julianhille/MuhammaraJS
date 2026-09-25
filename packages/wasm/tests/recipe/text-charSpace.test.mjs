import assert from "node:assert/strict";
import { charSpacing } from "../../lib/recipe/text.helper.js";

describe("Recipe character spacing", function () {
  it("counts spacing between retained Unicode characters", function () {
    assert.equal(charSpacing(" ab", 2), 4);
    assert.equal(charSpacing("ab ", 2), 4);
    assert.equal(charSpacing("a b", 2), 4);
    assert.equal(charSpacing(" ab ", 2), 6);
    assert.equal(charSpacing("\u00a0ab\u00a0", 2), 6);
    assert.equal(charSpacing("\u{1f600}", 2), 0);
    assert.equal(charSpacing("A\u{1f600}B", 2), 4);
  });
});
