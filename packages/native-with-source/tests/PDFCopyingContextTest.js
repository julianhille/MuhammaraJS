var assert = require("assert");
var path = require("path");
var muhammara = require("@muhammara/native-with-source");
var malformed = require("./helpers/malformedInputs");

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

  it("keeps the writer usable after a page fails to copy into a form", function () {
    var source = malformed.pdfWith([
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R >>",
      "<< /Length 5 /Filter /NoSuchFilter >>\nstream\nhello\nendstream",
    ]);
    var stream = new muhammara.PDFWStreamForBuffer();
    var writer = muhammara.createWriter(stream);
    var copying = writer.createPDFCopyingContext(
      new muhammara.PDFRStreamForBuffer(source),
    );
    // The failed form used to delete the writer's own output stream.
    assert.throws(function () {
      copying.createFormXObjectFromPDFPage(0, muhammara.ePDFPageBoxMediaBox);
    }, /Unable to create form xobject/);
    var page = writer.createPage(0, 0, 200, 200);
    writer.startPageContentContext(page).q().Q();
    writer.writePage(page);
    writer.end();

    var reader = muhammara.createReader(
      new muhammara.PDFRStreamForBuffer(stream.buffer),
    );
    assert.equal(reader.getPagesCount(), 1);
    reader.end();
  });

  // Array items and dictionary values are borrowed. Casting them with
  // PDFObjectCastPtr released the item when its type didn't match.
  describe("a page whose /Contents array holds a non-reference", function () {
    var source = malformed.pdfWith([
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents [5] >>",
    ]);

    /**
     * Runs `action` on a copying context of the source and expects a throw.
     * @param {Function} action - Receives the writer and copying context.
     */
    function copy(action) {
      var writer = muhammara.createWriter(new muhammara.PDFWStreamForBuffer());
      var copying = writer.createPDFCopyingContext(
        new muhammara.PDFRStreamForBuffer(source),
      );
      assert.throws(function () {
        action(writer, copying);
      });
    }

    it("fails to become a form", function () {
      copy(function (writer, copying) {
        copying.createFormXObjectFromPDFPage(0, muhammara.ePDFPageBoxMediaBox);
      });
    });

    it("fails to merge into a page", function () {
      copy(function (writer, copying) {
        copying.mergePDFPageToPage(writer.createPage(0, 0, 200, 200), 0);
      });
    });

    it("fails to be appended", function () {
      copy(function (writer, copying) {
        copying.appendPDFPageFromPDF(0);
      });
    });
  });

  it("aborts a copy whose stream dictionary cannot be copied", function () {
    var writer = muhammara.createWriter(new muhammara.PDFWStreamForBuffer());
    var copying = writer.createPDFCopyingContext(
      path.join(malformed.fuzzInputs, "copy-stream-dictionary-fails.bin"),
    );
    // The stream's dictionary used to stay open and leak with the writer.
    assert.throws(function () {
      copying.copyObject(2);
    }, /unable to copy the object/);
    // The half-written object cannot be finished, so the document cannot end.
    assert.throws(function () {
      writer.end();
    }, /Unable to end PDF/);
  });
});
