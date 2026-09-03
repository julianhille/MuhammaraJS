var assert = require("assert");
var fs = require("fs");
var muhammara = require("@muhammara/native-with-source");

describe("Truncated PDF input", function () {
  it("either parses or rejects every sampled truncation cleanly", function () {
    var source = fs.readFileSync(__dirname + "/../TestMaterials/Original.pdf");
    var offsets = new Set([1, source.length - 1]);
    var originalReader = muhammara.createReader(
      new muhammara.PDFRStreamForBuffer(source),
    );
    var originalPageCount;

    try {
      originalPageCount = originalReader.getPagesCount();
    } finally {
      originalReader.end();
    }

    for (var offset = 1024; offset < source.length; offset += 1024)
      offsets.add(offset);

    offsets.forEach(function (offset) {
      var reader;
      try {
        reader = muhammara.createReader(
          new muhammara.PDFRStreamForBuffer(source.subarray(0, offset)),
        );
      } catch (error) {
        assert.match(
          error.message,
          /Unable to start parsing PDF file/,
          `Unexpected error at truncation offset ${offset}`,
        );
        return;
      }

      try {
        assert.equal(
          reader.getPagesCount(),
          originalPageCount,
          `Unexpected page count at truncation offset ${offset}`,
        );
      } finally {
        reader.end();
      }
    });
  });
});
