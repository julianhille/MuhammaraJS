var assert = require("assert");
var muhammara = require("@muhammara/native-with-source");

// An object stream whose /N is 2^62 + 2^28. Allocating its header overflows
// natively, and truncates to 2^28 entries on wasm32, which is why the same
// fixture also covers the Wasm build.
var source = __dirname + "/../TestMaterials/ObjectStreamHugeCount.pdf";

describe("GH-917", function () {
  it("rejects an object stream count larger than the xref table in createReader", function () {
    assert.throws(function () {
      muhammara.createReader(source);
    }, /Unable to start parsing PDF file/);
  });

  it("rejects an object stream count larger than the xref table in recrypt", function () {
    assert.throws(function () {
      muhammara.recrypt(source, __dirname + "/../output/GH-917-recrypt.pdf");
    }, /Unable to recrypt files/);
  });

  it("rejects an object stream count larger than the xref table in recryptAsync", async function () {
    await assert.rejects(
      muhammara.recryptAsync(
        source,
        __dirname + "/../output/GH-917-recrypt-async.pdf",
      ),
      /Unable to recrypt files/,
    );
  });

  it("rejects an object stream count larger than the xref table in createWriterToModify", function () {
    assert.throws(function () {
      muhammara.createWriterToModify(source, {
        modifiedFilePath: __dirname + "/../output/GH-917-modify.pdf",
      });
    }, /Unable to modify PDF file/);
  });
});
