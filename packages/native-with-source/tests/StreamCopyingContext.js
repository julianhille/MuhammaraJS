var muhammara = require("@muhammara/native-with-source");
var fs = require("fs");

describe("StreamCopyingContext", function () {
  it("should complete without error", function () {
    var inStreamA = new muhammara.PDFRStreamForFile(
      __dirname + "/TestMaterials/BasicJPGImagesTest.PDF",
    );
    var inStreamB = new muhammara.PDFRStreamForFile(
      __dirname + "/TestMaterials/AddedPage.pdf",
    );
    var outStream = new muhammara.PDFWStreamForFile(
      __dirname + "/output/StreamCopyingContext.pdf",
    );

    var pdfWriter = muhammara.createWriterToModify(inStreamB, outStream);

    var copyCtx = pdfWriter.createPDFCopyingContext(
      __dirname + "/TestMaterials/BasicJPGImagesTest.PDF",
    );
    copyCtx.appendPDFPageFromPDF(0);
    copyCtx.end();

    var copyCtx = pdfWriter.createPDFCopyingContext(inStreamA);
    copyCtx.appendPDFPageFromPDF(0);
    copyCtx.end();

    pdfWriter.end();
    outStream.close();
    inStreamA.close();
    inStreamB.close();
  });

  it("rejects ending a copy source or context while it is copying", function () {
    var assert = require("chai").assert;
    var source = new muhammara.PDFRStreamForBuffer(
      fs.readFileSync(__dirname + "/TestMaterials/Original.pdf"),
    );
    var read = source.read.bind(source);
    var errors = [];
    var armed = false;
    var copyingContext;
    var reader;
    source.read = function (length) {
      if (armed) {
        [reader, copyingContext].forEach(function (target) {
          try {
            target.end();
          } catch (error) {
            errors.push(error.message);
          }
        });
      }
      return read(length);
    };
    reader = muhammara.createReader(source);
    var pdfWriter = muhammara.createWriter(new muhammara.PDFWStreamForBuffer());
    copyingContext = pdfWriter.createPDFCopyingContext(reader);
    armed = true;
    copyingContext.appendPDFPageFromPDF(0);
    armed = false;
    copyingContext.end();
    pdfWriter.end();
    reader.end();

    assert.deepEqual(Array.from(new Set(errors)), [
      "A PDF reader cannot end from a stream or event callback that is using it",
      "A PDF copying context cannot end from a stream or event callback",
    ]);
  });
});
