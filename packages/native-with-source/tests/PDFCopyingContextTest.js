describe("PDFCopyingContextTest", function () {
  it("should complete without error", function () {
    var pdfWriter = require("@muhammara/native-with-source").createWriter(
      __dirname + "/output/PDFCopyingContextTest.PDF",
    );
    var copyingContext = pdfWriter.createPDFCopyingContext(
      __dirname + "/TestMaterials/BasicTIFFImagesTest.PDF",
    );
    copyingContext.appendPDFPageFromPDF(1);
    copyingContext.appendPDFPageFromPDF(18);
    copyingContext.appendPDFPageFromPDF(4);
    copyingContext.end();
    pdfWriter.end();
  });

  it("rejects non-numeric source object IDs", function () {
    var assert = require("chai").assert;
    var pdfWriter = require("@muhammara/native-with-source").createWriter(
      __dirname + "/output/PDFCopyingContextInvalidReplacement.PDF",
    );
    var copyingContext = pdfWriter.createPDFCopyingContext(
      __dirname + "/TestMaterials/BasicTIFFImagesTest.PDF",
    );

    assert.throws(function () {
      copyingContext.replaceSourceObjects({ invalid: 1 });
    }, "source object IDs must be unsigned integer property names");
    assert.throws(function () {
      copyingContext.copyDirectObjectAsIs({});
    }, "PDFObject to copy");
    assert.throws(function () {
      copyingContext.copyDirectObjectWithDeepCopy(pdfWriter.createPage());
    }, "PDFObject to copy");
    copyingContext.end();
    pdfWriter.end();
  });

  it("does not mutate copying or writer output after invalid ID arrays", function () {
    var assert = require("chai").assert;
    var muhammara = require("@muhammara/native-with-source");
    var source = __dirname + "/TestMaterials/BasicTIFFImagesTest.PDF";
    var pdfWriter = muhammara.createWriter(
      __dirname + "/output/PDFCopyingContextInvalidIDs.PDF",
    );
    var copyingContext = pdfWriter.createPDFCopyingContext(source);
    var output = pdfWriter.getOutputFile().getOutputStream();

    try {
      var position = output.getCurrentPosition();
      assert.throws(function () {
        copyingContext.copyNewObjectsForDirectObject([
          1,
          Symbol("invalid object ID"),
        ]);
      }, TypeError);
      assert.equal(output.getCurrentPosition(), position);

      assert.throws(function () {
        copyingContext.replaceSourceObjects({
          1: Symbol("invalid replacement object ID"),
        });
      }, TypeError);
      assert.throws(function () {
        copyingContext.getCopiedObjectID(1);
      }, "Unable to find element");

      position = output.getCurrentPosition();
      assert.throws(function () {
        pdfWriter.createFormXObjectsFromPDF(
          source,
          muhammara.ePDFPageBoxMediaBox,
          {},
          [1, 0, 0, 1, 0, 0],
          [1, Symbol("invalid extra object ID")],
        );
      }, TypeError);
      assert.equal(output.getCurrentPosition(), position);
    } finally {
      copyingContext.end();
      pdfWriter._abort();
    }
  });
});
