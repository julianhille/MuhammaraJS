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

/**
 * Wraps a stream object so `getCurrentPosition` reports a projection of the
 * real position, the shape a stream returning non-number positions has.
 *
 * @param {Object} stream - the stream instance to delegate to.
 * @param {Function} project - maps the real position to the reported value.
 * @returns {Object} a stream delegating to the original instance.
 */
function withReportedPosition(stream, project) {
  var wrapper = {};
  for (var name in stream) {
    if (typeof stream[name] === "function")
      wrapper[name] = stream[name].bind(stream);
  }
  wrapper.getCurrentPosition = function () {
    return project(stream.getCurrentPosition());
  };
  wrapper.target = stream;
  return wrapper;
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

  it("should coerce stream positions that are not numbers", function () {
    var inStream = withReportedPosition(
      new muhammara.PDFRStreamForFile(
        __dirname + "/TestMaterials/MultipleChange.pdf",
      ),
      function (position) {
        return String(position);
      },
    );
    var outStream = withReportedPosition(
      new muhammara.PDFWStreamForBuffer(),
      function (position) {
        return String(position);
      },
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
    inStream.target.close();

    var produced = outStream.target.buffer;
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

  it("should reject write stream positions that are not finite", function () {
    var outStream = withReportedPosition(
      new muhammara.PDFWStreamForBuffer(),
      function () {
        return undefined;
      },
    );

    var pdfWriter;
    try {
      chai
        .expect(function () {
          pdfWriter = muhammara.createWriter(outStream);
          pdfWriter.writePage(pdfWriter.createPage(0, 0, 595, 842));
          pdfWriter.end();
        })
        .to.throw(TypeError, /getCurrentPosition must return a finite number/);
    } finally {
      if (pdfWriter) pdfWriter._abort();
    }
  });

  it("should reject read stream positions that are not finite", function () {
    var inStream = withReportedPosition(
      new muhammara.PDFRStreamForFile(
        __dirname + "/TestMaterials/MultipleChange.pdf",
      ),
      function () {
        return NaN;
      },
    );

    chai
      .expect(muhammara.createReader.bind(undefined, inStream))
      .to.throw(TypeError, /getCurrentPosition must return a finite number/);
    inStream.target.close();
  });

  it("should accept boxed and valueOf positions on both stream directions", function () {
    /** Returns a boxed position to exercise JavaScript numeric coercion. */
    function boxed(position) {
      return new Number(position);
    }
    /** Returns a position object with a numeric conversion hook. */
    function convertible(position) {
      return {
        /** Supplies the underlying byte position. */
        valueOf: function () {
          return position;
        },
      };
    }
    for (var project of [boxed, convertible]) {
      var output = withReportedPosition(
        new muhammara.PDFWStreamForBuffer(),
        project,
      );
      var writer = muhammara.createWriter(output);
      writer.writePage(writer.createPage(0, 0, 100, 100)).end();
      var input = withReportedPosition(
        new muhammara.PDFRStreamForBuffer(output.target.buffer),
        project,
      );
      var reader = muhammara.createReader(input);
      chai.expect(reader.getPagesCount()).to.equal(1);
      reader.end();
    }
  });

  it("should reject non-finite and out-of-range positions on both stream directions", function () {
    var source = new muhammara.PDFWStreamForBuffer();
    var original = muhammara.createWriter(source);
    original.writePage(original.createPage(0, 0, 100, 100)).end();
    // Adjacent doubles outside the signed 64-bit interval catch both bounds.
    for (var position of [Infinity, -Infinity, 2 ** 63, -(2 ** 63) - 2048]) {
      /** Reports the invalid position under test. */
      var project = function () {
        return position;
      };
      var input = withReportedPosition(
        new muhammara.PDFRStreamForBuffer(source.buffer),
        project,
      );
      chai
        .expect(muhammara.createReader.bind(undefined, input))
        .to.throw(TypeError, /getCurrentPosition must return a finite number/);
      var output = withReportedPosition(
        new muhammara.PDFWStreamForBuffer(),
        project,
      );
      var writer;
      try {
        chai
          .expect(function () {
            writer = muhammara.createWriter(output);
            writer.writePage(writer.createPage(0, 0, 100, 100));
            writer.end();
          })
          .to.throw(
            TypeError,
            /getCurrentPosition must return a finite number/,
          );
      } finally {
        if (writer) writer._abort();
      }
    }
  });

  it("should preserve position coercion exceptions on both stream directions", function () {
    var sentinel = new Error("position conversion failed");
    /** Returns an object whose numeric conversion throws the original error. */
    function project() {
      return {
        /** Throws the sentinel instead of reporting a position. */
        valueOf: function () {
          throw sentinel;
        },
      };
    }
    var source = new muhammara.PDFWStreamForBuffer();
    var original = muhammara.createWriter(source);
    original.writePage(original.createPage(0, 0, 100, 100)).end();
    var input = withReportedPosition(
      new muhammara.PDFRStreamForBuffer(source.buffer),
      project,
    );
    chai
      .expect(muhammara.createReader.bind(undefined, input))
      .to.throw(sentinel);
    var output = withReportedPosition(
      new muhammara.PDFWStreamForBuffer(),
      project,
    );
    var writer;
    try {
      chai
        .expect(function () {
          writer = muhammara.createWriter(output);
          writer.writePage(writer.createPage(0, 0, 100, 100));
          writer.end();
        })
        .to.throw(sentinel);
    } finally {
      if (writer) writer._abort();
    }
  });

  it("null for stream should throw an error and not crash", function () {
    var res = new muhammara.PDFStreamForResponse(null);
    chai
      .expect(muhammara.createWriter.bind(undefined, res))
      .to.throw(/Cannot read propert.*(write)?.* of null/);
  });
});
