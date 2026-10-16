import assert from "node:assert/strict";
import { describeEnd } from "../../support/ends.mjs";
import { drawRuns } from "../../support/flow.mjs";

// The default font differs by end: native's Helvetica Neue has bold and
// italic faces, the Wasm default font has one face for every style.
describeEnd("native", "Text - Continued", function (end) {
  it("lays out bold and italic HTML runs in the default font's own faces", function () {
    // Bold and italic faces differ in width, so " next" starts apart.
    var bold = drawRuns(end, "text-continued-html-bold-w", (recipe) =>
      recipe.text("<b>wwww</b> next", 20, 20, { html: true }),
    );
    var italic = drawRuns(end, "text-continued-html-italic-w", (recipe) =>
      recipe.text("<i>wwww</i> next", 20, 20, { html: true }),
    );
    assert.ok(Math.abs(bold[1].x - 63.36) < 0.01, String(bold[1].x));
    assert.ok(Math.abs(italic[1].x - 62.55) < 0.01, String(italic[1].x));
  });
});
