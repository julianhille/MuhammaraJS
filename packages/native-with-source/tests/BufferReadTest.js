var muhammara = require("@muhammara/native-with-source");
var fs = require("fs");
var assert = require("chai").assert;

describe("BufferRead", function () {
  it("should read buffer correctly", function () {
    var originalString = "hello world";
    var buffer = Buffer.from(originalString);
    var stream = new muhammara.PDFRStreamForBuffer(buffer);
    assert.equal(
      stream.read(originalString.length * 10).length,
      originalString.length,
    );
  });

  it("should be able to use buffer reader correctly to modify files", function () {
    var data = fs.readFileSync(
      __dirname + "/TestMaterials/BasicJPGImagesTest.PDF",
    );
    var source = new muhammara.PDFRStreamForBuffer(data);
    var target = new muhammara.PDFWStreamForFile(
      __dirname + "/output/ModifiedFromBufferSource.pdf",
    );

    var pdfWriter = muhammara.createWriterToModify(source, target);
    var pageModifier = new muhammara.PDFPageModifier(pdfWriter, 0);
    pageModifier
      .startContext()
      .getContext()
      .writeText("Test Text", 75, 805, {
        font: pdfWriter.getFontForFile(
          __dirname + "/TestMaterials/fonts/Couri.ttf",
        ),
        size: 14,
        colorspace: "gray",
        color: 0x00,
      });

    pageModifier.endContext().writePage();
    pdfWriter.end();
    target.close();
  });

  it("rejects ending a reader from its own read stream", function () {
    var source = new muhammara.PDFRStreamForBuffer(
      fs.readFileSync(__dirname + "/TestMaterials/Original.pdf"),
    );
    var read = source.read.bind(source);
    var errors = [];
    var reader;
    source.read = function (length) {
      if (reader) {
        try {
          reader.end();
        } catch (error) {
          errors.push(error.message);
        }
      }
      return read(length);
    };
    reader = muhammara.createReader(source);
    reader.parsePage(0);
    reader.end();

    assert.include(
      errors,
      "A PDF reader cannot end from a stream or event callback that is using it",
    );
  });
  describe("a reader of a PDFRStreamForBuffer", function () {
    var data = fs.readFileSync(__dirname + "/TestMaterials/Original.pdf");

    /**
     * Counts the calls a stream gets to each of its methods.
     * @param {object} stream - The stream to spy on.
     * @returns {Object<string, number>} The counts, updated as calls come.
     */
    function countCalls(stream) {
      var counts = {};
      [
        "read",
        "notEnded",
        "setPosition",
        "setPositionFromEnd",
        "skip",
        "getCurrentPosition",
      ].forEach(function (name) {
        var method = stream[name];
        counts[name] = 0;
        stream[name] = function () {
          ++counts[name];
          return method.apply(this, arguments);
        };
      });
      return counts;
    }

    it("reads the same objects as a reader of a file", function () {
      var fromBuffer = muhammara.createReader(
        new muhammara.PDFRStreamForBuffer(data),
      );
      var fromFile = muhammara.createReader(
        __dirname + "/TestMaterials/Original.pdf",
      );
      assert.equal(fromBuffer.getPagesCount(), fromFile.getPagesCount());
      for (var id = 1; id < fromFile.getXrefSize(); ++id) {
        var expected = fromFile.parseNewObject(id);
        var actual = fromBuffer.parseNewObject(id);
        assert.equal(
          actual && actual.getType(),
          expected && expected.getType(),
          "object " + id,
        );
      }
      fromBuffer.end();
      fromFile.end();
    });

    it("leaves the stream where the reader stopped when a call returns", function () {
      var stream = new muhammara.PDFRStreamForBuffer(data);
      var reader = muhammara.createReader(stream);
      // The reader read the trailer and xref from the end and the catalog;
      // the object's position says so between calls, as with read() calls.
      assert.isAbove(stream.getCurrentPosition(), 0);
      assert.isAtMost(stream.getCurrentPosition(), data.length);
      reader.parseNewObject(1);
      var afterObject = stream.getCurrentPosition();
      stream.setPosition(0);
      reader.parseNewObject(1);
      assert.equal(stream.getCurrentPosition(), afterObject);
      reader.end();
    });

    it("calls a subclass's methods", function () {
      /**
       * A buffer stream with nothing changed but its class.
       * @param {Buffer} buffer - The bytes to read.
       */
      function Subclass(buffer) {
        muhammara.PDFRStreamForBuffer.call(this, buffer);
      }
      Subclass.prototype = Object.create(
        muhammara.PDFRStreamForBuffer.prototype,
      );
      var stream = new Subclass(data);
      var counts = countCalls(Subclass.prototype);
      muhammara.createReader(stream).end();
      assert.isAbove(counts.read, 0);
    });

    it("calls methods replaced on the stream", function () {
      var stream = new muhammara.PDFRStreamForBuffer(data);
      var counts = countCalls(stream);
      muhammara.createReader(stream).end();
      assert.isAbove(counts.read, 0);
      assert.isAbove(counts.notEnded, 0);
    });

    it("reads a detached buffer as empty instead of freed memory", function () {
      var copy = new Uint8Array(data);
      var stream = new muhammara.PDFRStreamForBuffer(copy);
      var reader = muhammara.createReader(stream);
      structuredClone(copy.buffer, { transfer: [copy.buffer] });
      assert.equal(copy.length, 0);
      // The xref is read; objects now come from an empty buffer, so reading
      // one fails cleanly.
      assert.throws(function () {
        reader.parseNewObject(1);
      }, /Unable to read object/);
      reader.end();
    });
  });
});
