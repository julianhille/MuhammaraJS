var assert = require("assert");
var path = require("path");
var muhammara = require("@muhammara/native-with-source");

// A page tree with /Count 40 but /Kids [3 0 R]: one page, 39 missing. The
// xref table lists 40 objects, 4 to 39 free, so /Count fits it.
var source = path.join(__dirname, "../TestMaterials/KidsUnderCount.pdf");

describe("GHSA-7pgh-4m9g-9wrj", function () {
  it("reads pages missing from Kids as null pages", function () {
    var reader = muhammara.createReader(source);
    var writer = muhammara.createWriter(new muhammara.PDFWStreamForBuffer());

    try {
      assert.strictEqual(reader.getPagesCount(), 40);
      assert.strictEqual(reader.getPageObjectID(0), 3);
      assert.strictEqual(
        reader.parsePageDictionary(0).toJSObject().Type.value,
        "Page",
      );
      for (var index = 1; index < 40; ++index) {
        assert.strictEqual(reader.getPageObjectID(index), 0);
        assert.throws(function () {
          reader.parsePageDictionary(index);
        }, /Unable to read page/);
      }
      assert.throws(function () {
        writer.getImageDimensions(source, 1);
      }, /Unable to read image dimensions/);
      writer.end();
    } finally {
      reader.end();
    }
  });
});
