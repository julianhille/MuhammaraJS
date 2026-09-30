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
        stream.setPosition(-1);
        expect(stream.getCurrentPosition()).to.equal(0);
        stream.setPosition(bytes.length + 1);
        expect(stream.getCurrentPosition()).to.equal(bytes.length);
        stream.setPositionFromEnd(-1);
        expect(stream.getCurrentPosition()).to.equal(bytes.length);
        stream.setPositionFromEnd(1024);
        expect(stream.getCurrentPosition()).to.equal(0);
        stream.setPosition(0);

        var reader = muhammara.createReader(stream);
        try {
          expect(reader.getPagesCount()).to.equal(1);
        } finally {
          reader.end();
        }
      });
    } finally {
      fileStream.close();
    }
  });

  it("reads a PDF through a custom stream without moveStartPosition()", function () {
    var bytes = fs.readFileSync(
      path.join(__dirname, "TestMaterials/appendbreaks.pdf"),
    );
    var position = 0;
    // The six methods a 6.x custom read stream implemented.
    var stream = {
      read: function (amount) {
        var chunk = bytes.subarray(position, position + amount);
        position += chunk.length;
        return chunk;
      },
      notEnded: function () {
        return position < bytes.length;
      },
      setPosition: function (value) {
        position = Math.max(0, Math.min(bytes.length, value));
      },
      setPositionFromEnd: function (value) {
        position = Math.max(0, Math.min(bytes.length, bytes.length - value));
      },
      skip: function (amount) {
        position = Math.min(bytes.length, position + amount);
      },
      getCurrentPosition: function () {
        return position;
      },
    };
    var reader = muhammara.createReader(stream);
    try {
      expect(reader.getPagesCount()).to.be.above(0);
      expect(reader.parsePage(0).getMediaBox()).to.have.length(4);
    } finally {
      reader.end();
    }
  });

  // DCTDecode is the one filter decoded by the vendored libjpeg.
  [
    ["baseline", "images/soundcloud_logo.jpg", 550, 350, 3],
    ["progressive", "recipe/myCats.jpg", 720, 960, 3],
    ["grayscale", "images/grayscale.jpg", 40, 30, 1],
    ["CMYK", "images/cmyk.jpg", 36, 24, 4],
  ].forEach(function ([kind, file, width, height, components]) {
    it("decodes a " + kind + " JPEG image stream to its samples", function () {
      var jpeg = path.join(__dirname, "TestMaterials", file);
      var buffer = new muhammara.PDFWStreamForBuffer();
      var writer = muhammara.createWriter(buffer);
      var imageId = writer.createImageXObjectFromJPG(jpeg).id;
      // A PDF without pages cannot be parsed back.
      writer.writePage(writer.createPage(0, 0, 100, 100));
      writer.end();

      var reader = muhammara.createReader(
        new muhammara.PDFRStreamForBuffer(buffer.buffer),
      );
      try {
        var stream = reader.parseNewObject(imageId);
        var plain = reader.startReadingFromStreamForPlainCopying(stream);
        var raw = [];
        while (plain.notEnded()) raw.push(Buffer.from(plain.read(65536)));
        expect(Buffer.concat(raw).equals(fs.readFileSync(jpeg))).to.equal(true);

        var decoded = reader.startReadingFromStream(stream);
        var samples = [];
        while (decoded.notEnded()) {
          samples.push(Buffer.from(decoded.read(65536)));
        }
        samples = Buffer.concat(samples);
        expect(samples.length).to.equal(width * height * components);
        if (components === 1) {
          // grayscale.jpg is a white-to-black top-to-bottom gradient.
          expect(samples[0]).to.be.above(250);
          expect(samples[samples.length - 1]).to.be.below(5);
        }
      } finally {
        reader.end();
      }
    });
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
