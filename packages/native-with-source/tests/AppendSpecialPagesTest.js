var assert = require("assert");
var muhammara = require("@muhammara/native-with-source");

describe("AppendSpecialPagesTest", function () {
  it("should complete without error", function () {
    var outputPath = __dirname + "/output/AppendSpecialPagesTest.pdf";
    var sourceFiles = [
      "ObjectStreamsModified.pdf",
      "ObjectStreams.pdf",
      "AddedItem.pdf",
      "AddedPage.pdf",
      "MultipleChange.pdf",
      "RemovedItem.pdf",
      "Linearized.pdf",
    ];
    var expectedPages = sourceFiles.reduce(function (total, sourceFile) {
      var reader = muhammara.createReader(
        __dirname + "/TestMaterials/" + sourceFile,
      );
      var pageCount = reader.getPagesCount();
      reader.end();
      return total + pageCount;
    }, 0);
    var failedWriter = muhammara.createWriter(outputPath);

    assert.throws(function () {
      failedWriter.appendPDFPagesFromPDF(
        __dirname + "/TestMaterials/Protected.pdf",
      );
    }, /unable to append page, make sure it's fine/i);
    assert.throws(function () {
      failedWriter.createPage(0, 0, 100, 100);
    }, /PDF writer has ended/);

    var pdfWriter = muhammara.createWriter(outputPath);
    sourceFiles.forEach(function (sourceFile) {
      pdfWriter.appendPDFPagesFromPDF(
        __dirname + "/TestMaterials/" + sourceFile,
      );
    });
    pdfWriter.end();

    var reader = muhammara.createReader(outputPath);
    try {
      assert.equal(reader.getPagesCount(), expectedPages);
    } finally {
      reader.end();
    }
  });
});
