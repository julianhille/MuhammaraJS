var assert = require("assert");
var path = require("path");
var muhammara = require("@muhammara/native-with-source");

// Object 6, the content stream of page 0, is a Flate stream with a PNG
// predictor and one row of "ABCD" tagged with the unknown row type 7. The
// predictor left the decoded bytes unwritten, so a read returned whatever
// the read buffer held.
var source = path.join(
  __dirname,
  "../TestMaterials/PNGPredictorUnknownRowType.pdf",
);

describe("GHSA-7gx7-f7mg-m8w6", function () {
  it("decodes a PNG predictor row of an unknown type as is", function () {
    var reader = muhammara.createReader(source);
    try {
      var stream = reader.startReadingFromStream(reader.parseNewObject(6));
      assert.strictEqual(
        Buffer.from(stream.read(4096)).toString("latin1"),
        "ABCD",
      );
      assert.deepStrictEqual(reader.extractPageText(0), []);
    } finally {
      reader.end();
    }
  });
});
