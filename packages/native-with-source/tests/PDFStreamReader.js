var expect = require("chai").expect;
var fs = require("fs");
var path = require("path");
var muhammara = require("..");

describe("PDFReader stream byte readers", function () {
  it("reads a PDF smaller than the parser trailer window through built-in streams", function () {
    var tinyPath = path.join(__dirname, "output/PDFStreamReaderTiny.pdf");
    var writer = muhammara.createWriter(tinyPath);
    writer.writePage(writer.createPage(0, 0, 100, 100));
    writer.end();

    var bytes = fs.readFileSync(tinyPath);
    expect(bytes.length).to.be.below(1024);

    var fileStream = new muhammara.PDFRStreamForFile(tinyPath);
    var streams = [fileStream, new muhammara.PDFRStreamForBuffer(bytes)];
    try {
      streams.forEach(function (stream) {
        stream.setPositionFromEnd(1024);
        expect(stream.getCurrentPosition()).to.equal(0);
        stream.setPosition(bytes.length + 1);
        expect(stream.getCurrentPosition()).to.equal(bytes.length);
        stream.setPosition(0);

        var reader = muhammara.createReader(stream);
        expect(reader.getPagesCount()).to.equal(1);
        reader.end();
      });
    } finally {
      fileStream.close();
    }
  });

  // appendbreaks.pdf object 19 has an indirect /Length resolving to a dictionary.
  [
    {
      method: "startReadingFromStream",
      read: function (reader, stream) {
        var streamReader = reader.startReadingFromStream(stream);
        while (streamReader.notEnded()) streamReader.read(65536);
      },
      message: "Unable to read PDF stream",
    },
    {
      method: "startReadingFromStreamForPlainCopying",
      read: function (reader, stream) {
        var streamReader = reader.startReadingFromStreamForPlainCopying(stream);
        while (streamReader.notEnded()) streamReader.read(65536);
      },
      message: "Unable to read PDF stream",
    },
    {
      method: "startReadingObjectsFromStream",
      read: function (reader, stream) {
        var parser = reader.startReadingObjectsFromStream(stream);
        while (parser.parseNewObject()) {}
      },
      message: "Unable to read PDF stream objects",
    },
  ].forEach(function (testCase) {
    it(
      testCase.method +
        " throws instead of crashing on a stream whose indirect Length is not a number",
      function () {
        var reader = muhammara.createReader(
          path.join(__dirname, "TestMaterials/appendbreaks.pdf"),
        );
        expect(function () {
          testCase.read(reader, reader.parseNewObject(19));
        })
          .to.throw(Error)
          .with.property("message", testCase.message);
      },
    );
  });
});
