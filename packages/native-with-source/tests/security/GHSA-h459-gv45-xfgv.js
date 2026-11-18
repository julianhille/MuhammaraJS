var assert = require("assert");
var path = require("path");
var muhammara = require("@muhammara/native-with-source");

// Objects 4 and 5, the first the content stream of page 0, are progressive
// grayscale JPEG headers of 15000 x 15000 and 40000 x 40000. Decoding them
// allocated the coefficients of the whole image, 450 MB and 3.2 GB:
// extractPageText() aborted Wasm on the first, and the native process took
// 3.2 GB on the second.
var source = path.join(
  __dirname,
  "../TestMaterials/ProgressiveDCTAllocation.pdf",
);

describe("GHSA-h459-gv45-xfgv", function () {
  it("reads nothing from progressive JPEGs that ask for too much memory", function () {
    var reader = muhammara.createReader(source);
    try {
      for (var id = 4; id <= 5; ++id) {
        var stream = reader.startReadingFromStream(reader.parseNewObject(id));
        assert.strictEqual(stream.read(4096).length, 0);
        assert.strictEqual(stream.notEnded(), false);
      }
      assert.deepStrictEqual(reader.extractPageText(0), []);
    } finally {
      reader.end();
    }
  });
});
