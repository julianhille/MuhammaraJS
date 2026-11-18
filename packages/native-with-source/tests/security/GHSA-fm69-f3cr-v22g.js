var assert = require("assert");
var path = require("path");
var muhammara = require("@muhammara/native-with-source");

// BrushScriptStd with the charstring of "A" starting with `1 roll`, the one of
// "B" with `0 5 1 roll` and the one of "C" being
// `0 1 32767 32767 mul roll endchar`, shifting one item about 2^30 times.
var font = path.join(
  __dirname,
  "../TestMaterials/fonts/Type2RollOutOfRange.otf",
);

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

describe("GHSA-fm69-f3cr-v22g", function () {
  it("fails to embed a Type 2 roll with fewer than two operands", function () {
    assert.throws(() => writeWithFont("A"), /Unable to end PDF/);
  });

  it("fails to embed a Type 2 roll of more items than on the stack", function () {
    assert.throws(() => writeWithFont("B"), /Unable to end PDF/);
  });

  it("embeds a Type 2 roll with a huge shift amount", function () {
    this.timeout(10000);
    var pdf = Buffer.from(writeWithFont("C"));
    var reader = muhammara.createReader(new muhammara.PDFRStreamForBuffer(pdf));
    assert.strictEqual(reader.getPagesCount(), 1);
    assert.ok(pdf.includes("/FontFile3"));
  });
});
