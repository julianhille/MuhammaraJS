var muhammara = require("@muhammara/native-with-source");
const chai = require("chai");

/**
 * Wraps a stream object in a callable object exposing the same methods, the
 * shape a function-based custom stream has.
 *
 * @param {Object} stream - the stream instance to delegate to.
 * @returns {Function} a callable carrying the stream's bound methods.
 */
function asCallableStream(stream) {
  var callable = function () {};
  for (var name in stream) {
    if (typeof stream[name] === "function")
      callable[name] = stream[name].bind(stream);
  }
  callable.target = stream;
  return callable;
}

describe("BasicModificationWithStreams", function () {
  it("should complete without error", function () {
    var inStream = new muhammara.PDFRStreamForFile(
      __dirname + "/TestMaterials/MultipleChange.pdf",
    );
    var outStream = new muhammara.PDFWStreamForFile(
      __dirname + "/output/BasicModificationWithStreams.pdf",
    );
    var pdfWriter = muhammara.createWriterToModify(inStream, outStream);
    var pageModifier = new muhammara.PDFPageModifier(pdfWriter, 0);

    pageModifier
      .startContext()
      .getContext()
      .writeText("Some added Text", 75, 805, {
        font: pdfWriter.getFontForFile(
          __dirname + "/TestMaterials/fonts/Couri.ttf",
        ),
        size: 14,
        colorspace: "gray",
        color: 0x00,
      });
    pageModifier.endContext().writePage();
    pdfWriter.end();
    outStream.close();
    inStream.close();
  });

  it("should accept callable stream objects", function () {
    var inStream = asCallableStream(
      new muhammara.PDFRStreamForFile(
        __dirname + "/TestMaterials/MultipleChange.pdf",
      ),
    );
    var outStream = asCallableStream(new muhammara.PDFWStreamForBuffer());
    var pdfWriter = muhammara.createWriterToModify(inStream, outStream);
    var pageModifier = new muhammara.PDFPageModifier(pdfWriter, 0);

    pageModifier
      .startContext()
      .getContext()
      .writeText("Some added Text", 75, 805, {
        font: pdfWriter.getFontForFile(
          __dirname + "/TestMaterials/fonts/Couri.ttf",
        ),
        size: 14,
        colorspace: "gray",
        color: 0x00,
      });
    pageModifier.endContext().writePage();
    pdfWriter.end();
    inStream.close();

    var produced = outStream.target.buffer;
    chai.expect(produced).to.be.instanceOf(Buffer);
    chai.expect(produced.subarray(0, 5).toString("latin1")).to.equal("%PDF-");
    var reader = muhammara.createReader(
      new muhammara.PDFRStreamForBuffer(produced),
    );
    chai
      .expect(reader.getPagesCount())
      .to.equal(
        muhammara
          .createReader(__dirname + "/TestMaterials/MultipleChange.pdf")
          .getPagesCount(),
      );
  });

  it("null for stream should throw an error and not crash", function () {
    var res = new muhammara.PDFStreamForResponse(null);
    chai
      .expect(muhammara.createWriter.bind(undefined, res))
      .to.throw(/Cannot read propert.*(write)?.* of null/);
  });
});
