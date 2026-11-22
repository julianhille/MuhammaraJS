// Byte-first port of the malformed-font measurement in
// tests/TextMeasurementsTest.js. The other measurement behavior is ported in
// SimpleTextUsageTest.test.mjs.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

  it("measures the same after many interleaved measurements", async function () {
    var muhammara = await createMuhammaraWasm();
    var names = ["arial", "Couri"];
    for (var name of names) {
      muhammara.registerFont(
        name,
        new Uint8Array(
          await readFile("tests/TestMaterials/fonts/" + name + ".ttf"),
        ),
      );
    }
    var writer = muhammara.createWriter();
    try {
      var fonts = names.map(function (name) {
        return writer.getFontForBytes(name);
      });
      var ascii = "";
      for (var code = 32; code < 127; code++) {
        ascii += String.fromCharCode(code);
      }
      var texts = [
        "Hi gy",
        "Quick brown fox",
        "WMwm",
        ascii + "\u00e9\u00fc\u00f1",
      ];
      var sizes = [8, 12.5, 40];
      // Reference: one fresh writer and font per measurement, so the font's
      // buffer is empty and no seek happens before it.
      var expected = {};
      names.forEach(function (name, fontIndex) {
        texts.forEach(function (text) {
          sizes.forEach(function (size) {
            var fresh = muhammara.createWriter();
            try {
              expected[fontIndex + "|" + text + "|" + size] = fresh
                .getFontForBytes(name)
                .calculateTextDimensions(text, size);
            } finally {
              fresh.end();
            }
          });
        });
      });
      for (var round = 0; round < 3; round++) {
        fonts.forEach(function (font, fontIndex) {
          texts.forEach(function (text) {
            sizes.forEach(function (size) {
              assert.deepEqual(
                font.calculateTextDimensions(text, size),
                expected[fontIndex + "|" + text + "|" + size],
              );
            });
          });
        });
        texts.reverse();
      }
    } finally {
      writer.end();
      names.forEach(function (name) {
        muhammara.unregisterFont(name);
      });
    }
  });
});
