var muhammara = require("@muhammara/native-with-source");
var { expect } = require("chai");

describe("StreamCopyingContext failure", function () {
  it("releases the stream proxy when the target is not a parseable PDF", function () {
    var inStreamB = new muhammara.PDFRStreamForFile(
      __dirname + "/TestMaterials/AddedPage.pdf",
    );
    var outStream = new muhammara.PDFWStreamForFile(
      __dirname + "/output/StreamCopyingContextFailure.pdf",
    );

    var pdfWriter = muhammara.createWriterToModify(inStreamB, outStream);

    var notAPdf = new muhammara.PDFRStreamForBuffer(
      Buffer.from("this is not a PDF file"),
    );

    expect(() => {
      pdfWriter.createPDFCopyingContext(notAPdf);
    }).to.throw();

    pdfWriter.end();
    outStream.close();
    inStreamB.close();
  });
});
