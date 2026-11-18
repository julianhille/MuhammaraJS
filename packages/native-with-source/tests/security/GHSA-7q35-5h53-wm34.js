var assert = require("assert");
var path = require("path");
var muhammara = require("@muhammara/native-with-source");

// Object 4, the content stream of page 0, is an LZW stream with /Length -1,
// followed by a comment of 64 A's. The negative limit asked the file for an
// unbounded read, which copied the rest of the file into the one-byte stack
// buffer of the LZW decoder and crashed native and Wasm.
var source = path.join(__dirname, "../TestMaterials/NegativeLengthLZW.pdf");

describe("GHSA-7q35-5h53-wm34", function () {
  it("reads nothing from a stream with a negative /Length", function () {
    var reader = muhammara.createReader(source);
    try {
      var stream = reader.startReadingFromStream(reader.parseNewObject(4));
      assert.deepStrictEqual(stream.read(4096), Buffer.alloc(0));
      assert.strictEqual(stream.notEnded(), false);
      assert.deepStrictEqual(reader.extractPageText(0), []);
    } finally {
      reader.end();
    }
  });
});
