var assert = require("assert");
var path = require("path");
var muhammara = require("@muhammara/native-with-source");

// A PDF protected with the user password "usr" whose page tree root sits in
// an object stream. Modified without the password, the root cannot be
// decrypted, and adding a page read it through a null pointer at end().
var source = path.join(
  __dirname,
  "../TestMaterials/EncryptedObjectStreamPageTree.pdf",
);

describe("GHSA-6rw3-h5pc-hc2x", function () {
  it("fails to add a page to a PDF whose page tree it cannot read", function () {
    var writer = muhammara.createWriterToModify(source, {
      modifiedFilePath: path.join(
        __dirname,
        "../output/GHSA-6rw3-h5pc-hc2x.pdf",
      ),
    });
    writer.writePage(writer.createPage(0, 0, 100, 100));
    assert.throws(function () {
      writer.end();
    }, /Unable to end PDF/);
  });
});
