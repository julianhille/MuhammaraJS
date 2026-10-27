var assert = require("assert");
var path = require("path");
var muhammara = require("@muhammara/native-with-source");

// Object 3 is a Flate stream with a TIFF predictor whose /Columns times
// /Colors overflows the row size on 32- and 64-bit builds alike.
var source = path.join(__dirname, "../TestMaterials/TIFFPredictorOverflow.pdf");

describe("GHSA-5pp7-hx79-5mm2", function () {
  it("ends a TIFF predictor stream whose row size overflows", function () {
    var reader = muhammara.createReader(source);
    var stream = reader.startReadingFromStream(reader.parseNewObject(3));

    assert.strictEqual(stream.read(65536).length, 0);
    assert.strictEqual(stream.notEnded(), false);
  });
});
