// Byte-first port of the malformed-font measurement in
// tests/TextMeasurementsTest.js. The other measurement behavior is ported in
// SimpleTextUsageTest.test.mjs.
import assert from "node:assert/strict";
import { createMuhammaraWasm } from "../index.js";
import * as malformed from "../malformedInputs.mjs";

describe("TextMeasurementsTest", function () {
  it("measures text with a glyph that fails to load", async function () {
    var muhammara = await createMuhammaraWasm();
    var broken = malformed.fontWithBrokenGlyph();
    muhammara.registerFont("broken-glyph", broken.font);
    var writer = muhammara.createWriter();
    var font = writer.getFontForBytes("broken-glyph");
    var good = broken.broken === 1 ? 2 : 1;
    // FreeType keeps a failed FT_Get_Glyph's output unset, so the broken glyph
    // used to reuse the glyph freed in the previous iteration.
    var expected = font.calculateTextDimensions([good], 12);
    var dimensions = font.calculateTextDimensions(
      [good, broken.broken, good],
      12,
    );
    assert.equal(dimensions.yMin, expected.yMin);
    assert.equal(dimensions.yMax, expected.yMax);
    assert.ok(Number.isFinite(dimensions.width));
    writer.end();
    muhammara.unregisterFont("broken-glyph");
  });
});
