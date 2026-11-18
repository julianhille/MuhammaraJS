var assert = require("assert");
var path = require("path");
var muhammara = require("@muhammara/native-with-source");

// BrushScriptStd with the charstring of "A" starting with `1 0 div` and the one
// of "B" dividing LONG_MIN by -1 on 32-bit `long` first and on 64-bit second.
var font = path.join(__dirname, "../TestMaterials/fonts/Type2UndefinedDiv.otf");

/**
 * Writes `text` in the crafted font and ends the document.
 * @param {string} text - Text to write.
 * @returns {Buffer} The produced PDF.
 */
function writeWithFont(text) {
  var output = new muhammara.PDFWStreamForBuffer();
  var writer = muhammara.createWriter(output);
  var page = writer.createPage(0, 0, 595, 842);
  writer.startPageContentContext(page).writeText(text, 10, 400, {
    font: writer.getFontForFile(font),
    size: 20,
  });
  writer.writePage(page);
  writer.end();
  return output.buffer;
}

describe("GHSA-32r6-f4hm-ccc4", function () {
  it("fails to embed a Type 2 charstring that divides by zero", function () {
    assert.throws(() => writeWithFont("A"), /Unable to end PDF/);
  });

  it("fails to embed a Type 2 charstring that divides LONG_MIN by -1", function () {
    assert.throws(() => writeWithFont("B"), /Unable to end PDF/);
  });

  it("still embeds the glyphs of that font without a division", function () {
    var pdf = Buffer.from(writeWithFont("C"));
    var reader = muhammara.createReader(new muhammara.PDFRStreamForBuffer(pdf));
    assert.strictEqual(reader.getPagesCount(), 1);
    assert.ok(pdf.includes("/FontFile3"));
  });
});
