var assert = require("assert");
var fs = require("fs");
var path = require("path");
var muhammara = require("@muhammara/native-with-source");

// A page tree with /Count 2 and /Kids [3 0 R null]: page 0 is 200 by 200,
// page 1 is the null entry.
var source = path.join(__dirname, "../TestMaterials/NullKidsPage.pdf");

describe("GHSA-r4mx-qx34-mrx3", function () {
  it("throws for a missing PDF page instead of reading it", function () {
    var writer = muhammara.createWriter(new muhammara.PDFWStreamForBuffer());

    assert.deepStrictEqual(writer.getImageDimensions(source, 0), {
      width: 200,
      height: 200,
    });
    // The null Kids entry, and an index past the last page.
    [1, 5].forEach(function (index) {
      assert.throws(function () {
        writer.getImageDimensions(source, index);
      }, /^Error: Unable to read image dimensions$/);
      assert.throws(function () {
        writer.getImageDimensions(
          new muhammara.PDFRStreamForBuffer(fs.readFileSync(source)),
          index,
        );
      }, /^Error: Unable to read image dimensions$/);
    });
    // A page that cannot be read without the password.
    assert.throws(function () {
      writer.getImageDimensions(
        path.join(__dirname, "../TestMaterials/Protected.pdf"),
        0,
      );
    }, /^Error: Unable to read image dimensions$/);
    // Other unreadable images still measure 0 by 0.
    assert.deepStrictEqual(writer.getImageDimensions(__filename), {
      width: 0,
      height: 0,
    });
    writer.end();
  });
});
