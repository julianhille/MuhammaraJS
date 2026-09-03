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
    var pdfWriter = muhammara.createWriter(outputPath);

    assert.throws(function () {
      pdfWriter.appendPDFPagesFromPDF(
        __dirname + "/TestMaterials/Protected.pdf",
      );
    }, /unable to append page, make sure it's fine/i);
    sourceFiles.forEach(function (sourceFile) {
      pdfWriter.appendPDFPagesFromPDF(
        __dirname + "/TestMaterials/" + sourceFile,
      );
    });
    pdfWriter.end();

    var reader = muhammara.createReader(outputPath);
    assert.equal(reader.getPagesCount(), expectedPages);
    reader.end();
  });
});
