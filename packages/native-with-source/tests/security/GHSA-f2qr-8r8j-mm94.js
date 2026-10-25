var assert = require("assert");
var path = require("path");
var muhammara = require("@muhammara/native-with-source");

var source = path.join(__dirname, "../TestMaterials/BOMOnlyTextString.pdf");

describe("GHSA-f2qr-8r8j-mm94", function () {
  it("decodes a text string that is only a UTF-16BE byte order mark to an empty string", function () {
    assert.strictEqual(
      new muhammara.PDFTextString([0xfe, 0xff]).toString(),
      "",
    );
  });

  it("decodes BOM-only hex and literal strings to empty text", function () {
    var reader = muhammara.createReader(source);
    try {
      var info = reader.parseNewObject(4).toJSObject();
      assert.strictEqual(info.Title.toText(), "");
      assert.strictEqual(info.Subject.toText(), "");
    } finally {
      reader.end();
    }
  });

  it("returns empty Recipe info values for BOM-only strings", function () {
    var info = new muhammara.Recipe(source).info();
    assert.strictEqual(info.title, "");
    assert.strictEqual(info.subject, "");
  });
});
