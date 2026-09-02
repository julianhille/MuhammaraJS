var assert = require("assert");

describe("AppendSpecialPagesTest", function () {
  it("should complete without error", function () {
    var pdfWriter = require("@muhammara/native-with-source").createWriter(
      __dirname + "/output/AppendSpecialPagesTest.pdf",
    );

    assert.throws(function () {
      pdfWriter.appendPDFPagesFromPDF(
        __dirname + "/TestMaterials/Protected.pdf",
      );
    });
    pdfWriter.appendPDFPagesFromPDF(
      __dirname + "/TestMaterials/ObjectStreamsModified.pdf",
    );
    pdfWriter.appendPDFPagesFromPDF(
      __dirname + "/TestMaterials/ObjectStreams.pdf",
    );
    pdfWriter.appendPDFPagesFromPDF(__dirname + "/TestMaterials/AddedItem.pdf");
    pdfWriter.appendPDFPagesFromPDF(__dirname + "/TestMaterials/AddedPage.pdf");
    pdfWriter.appendPDFPagesFromPDF(
      __dirname + "/TestMaterials/MultipleChange.pdf",
    );
    pdfWriter.appendPDFPagesFromPDF(
      __dirname + "/TestMaterials/RemovedItem.pdf",
    );
    pdfWriter.appendPDFPagesFromPDF(
      __dirname + "/TestMaterials/Linearized.pdf",
    );
    pdfWriter.end();
  });
});
