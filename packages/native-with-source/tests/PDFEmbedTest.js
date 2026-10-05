var muhammara = require("@muhammara/native-with-source");
var assert = require("assert");
var path = require("path");
var malformed = require("./helpers/malformedInputs");

describe("PDFEmbedTest", function () {
  it("should complete without error", function () {
    var pdfWriter = muhammara.createWriter(
      __dirname + "/output/PDFEmbedTest.pdf",
    );
    var formIDs = pdfWriter.createFormXObjectsFromPDF(
      __dirname + "/TestMaterials/XObjectContent.PDF",
      muhammara.ePDFPageBoxMediaBox,
    );
    var page = pdfWriter.createPage(0, 0, 595, 842);

    pdfWriter
      .startPageContentContext(page)
      .q()
      .cm(0.5, 0, 0, 0.5, 0, 421)
      .doXObject(
        page.getResourcesDictionary().addFormXObjectMapping(formIDs[0]),
      )
      .Q()
      .G(0)
      .w(1)
      .re(0, 421, 297.5, 421)
      .S()
      .q()
      .cm(0.5, 0, 0, 0.5, 297.5, 0)
      .doXObject(
        page.getResourcesDictionary().addFormXObjectMapping(formIDs[1]),
      )
      .Q()
      .G(0)
      .w(1)
      .re(297.5, 0, 297.5, 421)
      .S();

    pdfWriter.writePage(page).end();
  });

  it("keeps the writer's output stream when forms from a PDF fail", function () {
    var writer = muhammara.createWriter(
      path.join(__dirname, "output", "FuzzFormFromPDF.pdf"),
    );
    assert.throws(function () {
      writer.createFormXObjectsFromPDF(
        path.join(
          malformed.fuzzInputs,
          "copy-form-from-unreadable-page-content.bin",
        ),
      );
    });
    // The failed form used to delete the writer's output stream and leave its
    // object open; the writer now stays usable.
    writer.end();
  });
});
