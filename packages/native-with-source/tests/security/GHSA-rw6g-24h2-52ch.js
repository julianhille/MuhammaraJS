var assert = require("assert");
var path = require("path");
var muhammara = require("@muhammara/native-with-source");

var materials = path.join(__dirname, "../TestMaterials");

describe("GHSA-rw6g-24h2-52ch", function () {
  // Object 6 is a Flate stream of two TIFF predictor rows of one 4-bit
  // color, 0x12 0x12, each half a byte padded to a byte. The predictor read
  // no byte per row, so the stream never ended, and took two colors per
  // decoded byte from an array of one. Each row decodes to 0x13, as the
  // predictor runs over the padding nibble too and adds its 2 to the color
  // 1 before it; readers ignore padding bits. Read a byte at a time, as a
  // read that reaches the end of the Flate data drops what it decoded.
  it("decodes TIFF predictor rows shorter than a byte", function () {
    var reader = muhammara.createReader(
      path.join(materials, "TIFFPredictorRowUnderOneByte.pdf"),
    );
    try {
      var stream = reader.startReadingFromStream(reader.parseNewObject(6));
      var bytes = [];
      for (var reads = 0; stream.notEnded() && reads < 100; ++reads) {
        bytes.push(...stream.read(1));
      }
      assert.deepStrictEqual(bytes, [0x13, 0x13]);
      assert.strictEqual(stream.notEnded(), false);
    } finally {
      reader.end();
    }
  });

  // The content stream of page 0 runs rows of two 1-bit colors through
  // ASCII85Decode, which read the endless predictor output in one read.
  it("extracts the text of a page with TIFF predictor rows shorter than a byte", function () {
    var reader = muhammara.createReader(
      path.join(materials, "TIFFPredictorEndlessHang.pdf"),
    );
    try {
      assert.deepStrictEqual(reader.extractPageText(0), []);
    } finally {
      reader.end();
    }
  });
});
