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

  it("should throw TypeError for missing stream arguments", function () {
    ["createWriter", "createReader", "createWriterToModify"].forEach(
      function (method) {
        chai
          .expect(muhammara[method].bind(undefined))
          .to.throw(TypeError, /arguments/i);
      },
    );
  });

  it("null for stream should throw an error and not crash", function () {
    var res = new muhammara.PDFStreamForResponse(null);
    chai
      .expect(muhammara.createWriter.bind(undefined, res))
      .to.throw(/Cannot read propert.*(write)?.* of null/);
  });

  // https://github.com/julianhille/MuhammaraJS/issues/324
  it("delivers written bytes as Buffers the stream may keep", function () {
    var chunks = [];
    var position = 0;
    var writer = muhammara.createWriter({
      write: function (bytes) {
        chunks.push(bytes);
        position += bytes.length;
        return bytes.length;
      },
      getCurrentPosition: function () {
        return position;
      },
    });
    writer.writePage(writer.createPage(0, 0, 100, 100));
    writer.end();

    chai.expect(chunks.length).to.be.above(0);
    chunks.forEach(function (chunk) {
      chai.expect(Buffer.isBuffer(chunk)).to.equal(true);
    });
    // Chunks are copies, so keeping them past write() must not see them change.
    var produced = Buffer.concat(chunks);
    chai.expect(produced.length).to.equal(position);
    chai.expect(produced.subarray(0, 5).toString("latin1")).to.equal("%PDF-");
    var reader = muhammara.createReader(
      new muhammara.PDFRStreamForBuffer(produced),
    );
    chai.expect(reader.getPagesCount()).to.equal(1);
  });

  // https://github.com/julianhille/MuhammaraJS/issues/324
  it("accepts Uint8Arrays and byte arrays from custom read streams", function () {
    var source = require("fs").readFileSync(
      __dirname + "/TestMaterials/MultipleChange.pdf",
    );
    var expected = muhammara
      .createReader(__dirname + "/TestMaterials/MultipleChange.pdf")
      .getPagesCount();
    [
      function (bytes) {
        return new Uint8Array(bytes);
      },
      function (bytes) {
        return Array.from(bytes);
      },
    ].forEach(function (convert) {
      var stream = new muhammara.PDFRStreamForBuffer(source);
      var read = stream.read.bind(stream);
      stream.read = function (amount) {
        return convert(read(amount));
      };
      chai
        .expect(muhammara.createReader(stream).getPagesCount())
        .to.equal(expected);
    });
  });

  // https://github.com/julianhille/MuhammaraJS/issues/324
  it("returns Buffers from the built-in read streams", function () {
    var path = __dirname + "/TestMaterials/MultipleChange.pdf";
    var fileStream = new muhammara.PDFRStreamForFile(path);
    var bufferStream = new muhammara.PDFRStreamForBuffer(
      require("fs").readFileSync(path),
    );
    try {
      [fileStream, bufferStream].forEach(function (stream) {
        var bytes = stream.read(5);
        chai.expect(Buffer.isBuffer(bytes)).to.equal(true);
        chai.expect(bytes.toString("latin1")).to.equal("%PDF-");
        chai.expect(stream.getCurrentPosition()).to.equal(5);
      });
    } finally {
      fileStream.close();
    }
  });

  // https://github.com/julianhille/MuhammaraJS/issues/324
  it("joins PDFWStreamForBuffer chunks into its buffer on access", function () {
    var stream = new muhammara.PDFWStreamForBuffer();
    chai.expect(stream.buffer).to.equal(null);
    chai.expect(stream.write(Buffer.from("ab"))).to.equal(2);
    chai.expect(stream.write(Buffer.alloc(0))).to.equal(0);
    chai.expect(stream.write(Buffer.from("cd"))).to.equal(2);
    chai.expect(stream.buffer.toString("latin1")).to.equal("abcd");
    stream.write(Buffer.from("e"));
    chai.expect(stream.buffer.toString("latin1")).to.equal("abcde");
    chai.expect(stream.getCurrentPosition()).to.equal(5);
    stream.buffer = Buffer.from("x");
    chai.expect(stream.buffer.toString("latin1")).to.equal("x");
    // Arrays of byte values still work, and written Buffers are copied.
    chai.expect(stream.write([121])).to.equal(1);
    var reused = Buffer.from("z");
    stream.write(reused);
    reused[0] = 0x21;
    chai.expect(stream.buffer.toString("latin1")).to.equal("xyz");
  });

  // https://github.com/julianhille/MuhammaraJS/issues/324
  it("accepts arrays of byte values in PDFWStreamForFile writes", function (done) {
    var path = __dirname + "/output/PDFWStreamForFileArrayWrite.bin";
    var stream = new muhammara.PDFWStreamForFile(path);
    chai.expect(stream.write([37, 80])).to.equal(2);
    chai.expect(stream.write(Buffer.from("DF"))).to.equal(2);
    stream.close(function () {
      chai.expect(require("fs").readFileSync(path, "latin1")).to.equal("%PDF");
      done();
    });
  });

  // https://github.com/julianhille/MuhammaraJS/issues/324
  it("fails end() when the batched tail of the output is not written", function () {
    var position = 0;
    var failTail = false;
    var writer = muhammara.createWriter({
      write: function (bytes) {
        if (failTail) return 0;
        position += bytes.length;
        return bytes.length;
      },
      getCurrentPosition: function () {
        return position;
      },
    });
    writer.writePage(writer.createPage(0, 0, 100, 100));
    failTail = true;
    chai.expect(writer.end.bind(writer)).to.throw(/Unable to end PDF/);
  });

  // https://github.com/julianhille/MuhammaraJS/issues/324
  it("fails shutdown() when the batched tail of the output is not written", function () {
    var position = 0;
    var failTail = false;
    var writer = muhammara.createWriter({
      write: function (bytes) {
        if (failTail) return 0;
        position += bytes.length;
        return bytes.length;
      },
      getCurrentPosition: function () {
        return position;
      },
    });
    writer.writePage(writer.createPage(0, 0, 100, 100));
    failTail = true;
    chai
      .expect(
        writer.shutdown.bind(
          writer,
          __dirname + "/output/ShutdownUnwrittenTailState.txt",
        ),
      )
      .to.throw(/unable to save state file/);
  });

  // https://github.com/julianhille/MuhammaraJS/issues/324
  it("fails creation when the header cannot be written", function () {
    chai
      .expect(
        muhammara.createWriter.bind(undefined, {
          write: function () {
            return 0;
          },
          getCurrentPosition: function () {
            return 0;
          },
        }),
      )
      .to.throw(/Unable to create PDF/);
  });

  // https://github.com/julianhille/MuhammaraJS/issues/324
  it("fails every later write after one lost batch", function () {
    var position = 0;
    var failNext = false;
    var writer = muhammara.createWriter({
      write: function (bytes) {
        if (failNext) {
          failNext = false;
          return 0;
        }
        position += bytes.length;
        return bytes.length;
      },
      getCurrentPosition: function () {
        return position;
      },
    });
    failNext = true;
    var page = writer.createPage(0, 0, 100, 100);
    // More than one 64 KiB batch, so a batch is delivered before end().
    writer
      .startPageContentContext(page)
      .writeFreeCode("0 0 m 10 10 l S\n".repeat(10000));
    // The lost batch fails every later write, so the page cannot complete.
    chai
      .expect(writer.writePage.bind(writer, page))
      .to.throw(/Unable to finalize page context/);
    chai.expect(failNext).to.equal(false);
    chai.expect(writer.end.bind(writer)).to.throw(/Unable to end PDF/);
  });

  // https://github.com/julianhille/MuhammaraJS/issues/324
  it("writes Uint8Arrays and byte arrays into PDF streams", function () {
    var output = new muhammara.PDFWStreamForBuffer();
    var writer = muhammara.createWriter(output);
    var objectsContext = writer.getObjectsContext();
    var objectIDs = [
      new Uint8Array(Buffer.from("uint8 bytes")),
      Array.from(Buffer.from("array bytes")),
    ].map(function (bytes) {
      var objectID = objectsContext.startNewIndirectObject();
      var pdfStream = objectsContext.startUnfilteredPDFStream();
      chai.expect(pdfStream.getWriteStream().write(bytes)).to.equal(11);
      objectsContext.endPDFStream(pdfStream).endIndirectObject();
      return objectID;
    });
    writer.writePage(writer.createPage(0, 0, 100, 100));
    writer.end();

    var reader = muhammara.createReader(
      new muhammara.PDFRStreamForBuffer(output.buffer),
    );
    chai
      .expect(
        objectIDs.map(function (objectID) {
          var streamReader = reader.startReadingFromStream(
            reader.parseNewObject(objectID),
          );
          var bytes = streamReader.read(64);
          chai.expect(Buffer.isBuffer(bytes)).to.equal(true);
          return bytes.toString("latin1");
        }),
      )
      .to.deep.equal(["uint8 bytes", "array bytes"]);
  });

  it("keeps memory bounded when modifying a large file into a JS stream", function () {
    this.timeout(120000);
    var sourcePath = __dirname + "/output/LargeModificationSource.pdf";
    var sourceWriter = muhammara.createWriter(sourcePath, { compress: false });
    var content = "0 0 m 10 10 l S\n".repeat(20000);
    for (var i = 0; i < 50; ++i) {
      var page = sourceWriter.createPage(0, 0, 595, 842);
      sourceWriter.startPageContentContext(page).writeFreeCode(content);
      sourceWriter.writePage(page);
    }
    sourceWriter.end();

    // The source copy runs inside a single native call, so memory held per
    // written byte only shows up as an out-of-memory crash in a small heap.
    // A child process is the deliberate exception to the in-process test
    // rule: only it can cap the heap without affecting the rest of the run.
    var script = [
      "var muhammara = require(" +
        JSON.stringify(require("path").join(__dirname, "..")) +
        ");",
      "var written = 0;",
      "var outStream = {",
      "  write: function (bytes) { written += bytes.length; return bytes.length; },",
      "  getCurrentPosition: function () { return written; },",
      "};",
      "muhammara",
      "  .createWriterToModify(",
      "    new muhammara.PDFRStreamForFile(" +
        JSON.stringify(sourcePath) +
        "),",
      "    outStream,",
      "  )",
      "  .end();",
      "process.stdout.write(String(written));",
    ].join("\n");
    var result = require("child_process").spawnSync(
      process.execPath,
      ["--max-old-space-size=128", "-e", script],
      {
        cwd: __dirname,
        encoding: "utf8",
        // Under electron-mocha execPath is the Electron binary; this makes it
        // run as plain Node. Plain Node ignores it.
        env: Object.assign({}, process.env, { ELECTRON_RUN_AS_NODE: "1" }),
      },
    );

    chai.expect(result.status, result.stderr).to.equal(0);
    chai
      .expect(Number(result.stdout))
      .to.be.at.least(require("fs").statSync(sourcePath).size);
  });
});
