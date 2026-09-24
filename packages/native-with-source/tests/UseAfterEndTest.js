var assert = require("chai").assert;
var muhammara = require("@muhammara/native-with-source");
var fs = require("fs");
var os = require("os");
var path = require("path");

/** Exercise stateful methods after a writer enters a terminal state. */
function checkEndedWriter(directory, mode) {
  var outputPath = path.join(directory, "output.pdf");
  var stream = new muhammara.PDFWStreamForBuffer();
  var writer;
  if (mode === "unstarted") {
    writer = new muhammara.PDFWriter();
  } else if (mode === "failed-end") {
    writer = muhammara.createWriterToModify(
      path.join(__dirname, "TestMaterials", "Protected.pdf"),
      { modifiedFilePath: outputPath },
    );
  } else if (mode === "modified-file" || mode === "modified-stream") {
    var sourcePath = path.join(directory, "source.pdf");
    var source = muhammara.createWriter(sourcePath);
    source.writePage(source.createPage(0, 0, 200, 200)).end();
    writer =
      mode === "modified-file"
        ? muhammara.createWriterToModify(sourcePath, {
            modifiedFilePath: outputPath,
          })
        : muhammara.createWriterToModify(
            new muhammara.PDFRStreamForBuffer(fs.readFileSync(sourcePath)),
            stream,
          );
  } else {
    writer = muhammara.createWriter(mode === "stream" ? stream : outputPath);
  }
  var page = new muhammara.PDFPage(0, 0, 200, 200);
  if (mode === "abort") {
    writer._abort();
  } else if (mode === "failed-end") {
    writer.writePage(page);
    assert.throws(function () {
      writer.end();
    }, /Unable to end PDF/);
  } else if (mode === "shutdown" || mode === "failed-shutdown") {
    var statePath = path.join(directory, "state.txt");
    if (mode === "failed-shutdown") {
      assert.throws(function () {
        writer.shutdown(directory);
      }, /unable to save state file/);
    } else {
      writer.writePage(page);
      writer.shutdown(statePath);
      var resumed = muhammara.createWriterToContinue(outputPath, statePath);
      resumed.end();
      var reader = muhammara.createReader(outputPath);
      assert.equal(reader.getPagesCount(), 1);
      reader.end();
    }
  } else {
    writer.end();
  }
  assert.equal(writer.end(), writer);
  assert.equal(writer._abort(), writer);
  [
    ["createPage", [0, 0, 200, 200]],
    ["startPageContentContext", [page]],
    ["writePage", [page]],
    ["writePageAndReturnID", [page]],
  ].forEach(function (entry) {
    assert.throws(
      function () {
        writer[entry[0]].apply(writer, entry[1]);
      },
      /^PDF writer has ended$/,
      entry[0],
    );
  });

  // Exercise every native stateful entry point, including getters that expose
  // the finalized ObjectsContext, parser, and file wrappers.
  var independent = [
    "constructor",
    "end",
    "_abort",
    "createPDFDate",
    "createPDFTextString",
    "getEvents",
    "triggerDocumentExtensionEvent",
    "replaceObject",
    "createPage",
    "startPageContentContext",
    "writePage",
    "writePageAndReturnID",
  ];
  Object.getOwnPropertyNames(Object.getPrototypeOf(writer)).forEach(
    function (method) {
      if (independent.indexOf(method) !== -1) return;
      assert.throws(
        function () {
          writer[method]();
        },
        /^PDF writer has ended$/,
        method,
      );
    },
  );
  var text = writer.createPDFTextString();
  text.fromString("still valid");
  assert.equal(text.toString(), "still valid");
  assert.equal(writer.createPDFDate().toString(), "");
  assert.ok(writer.createPDFDate(new Date()));
  // A rejected argument must raise a JavaScript error, not abort the process.
  assert.throws(function () {
    writer.createPDFDate(42);
  }, /Provide 1 argument which is a date/);
}

/**
 * Continue a named shut-down writer with a JavaScript object as its log target.
 * Returns the writer together with the chunks the process-global trace writes
 * into that object.
 */
function continueWithLogStream(directory, name) {
  var outputPath = path.join(directory, name + ".pdf");
  var statePath = path.join(directory, name + "-state.txt");
  var source = muhammara.createWriter(outputPath);
  source.writePage(source.createPage(0, 0, 200, 200));
  source.shutdown(statePath);

  var written = [];
  var writer = muhammara.createWriterToContinue(outputPath, statePath, {
    log: {
      write: function (bytes) {
        written.push(bytes);
        return bytes.length;
      },
    },
  });
  return { writer: writer, written: written };
}

/** Make the process-global trace emit, from code unrelated to any writer. */
function traceAFailure(directory) {
  assert.throws(function () {
    muhammara.createReader(path.join(directory, "missing.pdf"));
  });
}

describe("UseAfterEndTest", function () {
  [
    "file",
    "stream",
    "modified-file",
    "modified-stream",
    "abort",
    "failed-end",
    "unstarted",
    "shutdown",
    "failed-shutdown",
  ].forEach(function (mode) {
    it(
      "rejects stateful methods after writer " + mode + " cleanup",
      function () {
        var directory = fs.mkdtempSync(
          path.join(os.tmpdir(), "muhammara-writer-end-"),
        );
        try {
          checkEndedWriter(directory, mode);
        } finally {
          fs.rmSync(directory, { recursive: true, force: true });
        }
      },
    );
  });

  ["end", "abort"].forEach(function (mode) {
    it(
      "detaches a log stream from the global trace on writer " + mode,
      function () {
        var directory = fs.mkdtempSync(
          path.join(os.tmpdir(), "muhammara-writer-log-"),
        );
        try {
          var logged = continueWithLogStream(directory, "logged");

          traceAFailure(directory);
          assert.isAbove(
            logged.written.length,
            0,
            "a live writer's log stream should receive trace output",
          );
          var writtenWhileLive = logged.written.length;

          if (mode === "end") {
            logged.writer.end();
          } else {
            logged.writer._abort();
          }

          // The trace keeps a raw pointer to the native proxy behind this
          // stream. Tracing once the proxy has been freed wrote through freed
          // memory and aborted the process.
          traceAFailure(directory);
          assert.equal(
            logged.written.length,
            writtenWhileLive,
            "an ended writer's log stream should receive nothing further",
          );
        } finally {
          fs.rmSync(directory, { recursive: true, force: true });
        }
      },
    );
  });

  ["end", "abort"].forEach(function (mode) {
    ["stream", "file"].forEach(function (destination) {
      it(
        "preserves a newer " +
          destination +
          " logger when an older writer " +
          mode +
          "s",
        function () {
          var directory = fs.mkdtempSync(
            path.join(os.tmpdir(), "muhammara-overlapping-writer-log-"),
          );
          var older;
          var newer;
          try {
            older = continueWithLogStream(directory, "older");
            traceAFailure(directory);
            assert.isAbove(
              older.written.length,
              0,
              "the older writer's log stream should initially be active",
            );

            var logPath = path.join(directory, "newer.log");
            if (destination === "stream") {
              newer = continueWithLogStream(directory, "newer");
            } else {
              newer = {
                writer: muhammara.createWriter(
                  path.join(directory, "newer.pdf"),
                  { log: logPath },
                ),
              };
            }

            if (mode === "end") {
              older.writer.end();
            } else {
              older.writer._abort();
            }

            var writtenBeforeTrace =
              destination === "stream"
                ? newer.written.length
                : fs.existsSync(logPath)
                  ? fs.statSync(logPath).size
                  : 0;
            traceAFailure(directory);
            var writtenAfterTrace =
              destination === "stream"
                ? newer.written.length
                : fs.existsSync(logPath)
                  ? fs.statSync(logPath).size
                  : 0;
            assert.isAbove(
              writtenAfterTrace,
              writtenBeforeTrace,
              "the newer writer's logger should remain active",
            );
          } finally {
            if (older) older.writer._abort();
            if (newer) newer.writer._abort();
            var reset = muhammara.createWriter(
              path.join(directory, "reset-trace.pdf"),
            );
            reset._abort();
            fs.rmSync(directory, { recursive: true, force: true });
          }
        },
      );
    });
  });

  it("should reject all PDF reader use after end", function () {
    var reader = muhammara.createReader(
      __dirname + "/TestMaterials/XObjectContent.PDF",
    );
    var methods = Object.getOwnPropertyNames(
      Object.getPrototypeOf(reader),
    ).filter(function (method) {
      return method !== "constructor" && method !== "end";
    });

    reader.end();
    reader.end();

    methods.forEach(function (method) {
      assert.throws(
        function () {
          reader[method]();
        },
        /PDF reader has ended/,
        method,
      );
    });
  });

  it("should reject copying context use after end", function () {
    var writer = muhammara.createWriter(
      __dirname + "/output/UseAfterEndTest.PDF",
    );
    var copyingContext = writer.createPDFCopyingContext(
      __dirname + "/TestMaterials/BasicTIFFImagesTest.PDF",
    );

    copyingContext.end();

    assert.throws(function () {
      copyingContext.getSourceDocumentParser();
    }, /PDF copying context has ended/);
    writer.end();
  });

  it("should reject a copying context after its writer ends", function () {
    var writer = muhammara.createWriter(
      __dirname + "/output/UseCopyingContextAfterWriterEndTest.PDF",
    );
    var copyingContext = writer.createPDFCopyingContext(
      __dirname + "/TestMaterials/BasicTIFFImagesTest.PDF",
    );
    var reader = copyingContext.getSourceDocumentParser();

    writer.end();

    assert.throws(function () {
      copyingContext.appendPDFPageFromPDF(0);
    }, /copying context/);
    assert.throws(function () {
      reader.getPagesCount();
    }, /PDF reader has ended/);
    reader.end();
    copyingContext.end();
  });

  it("should retain source reader ownership after its writer ends", function () {
    var reader = muhammara.createReader(
      __dirname + "/TestMaterials/XObjectContent.PDF",
    );
    var writer = muhammara.createWriter(
      __dirname + "/output/UseReaderContextAfterWriterEndTest.PDF",
    );
    var copyingContext = writer.createPDFCopyingContext(reader);

    writer.end();

    assert.throws(function () {
      copyingContext.appendPDFPageFromPDF(0);
    }, /copying context/);
    assert.isAbove(reader.getPagesCount(), 0);
    copyingContext.end();
    reader.end();
  });

  it("should reject a source reader after its copying context ends", function () {
    var writer = muhammara.createWriter(
      __dirname + "/output/UseSourceReaderAfterEndTest.PDF",
    );
    var copyingContext = writer.createPDFCopyingContext(
      __dirname + "/TestMaterials/BasicTIFFImagesTest.PDF",
    );
    var reader = copyingContext.getSourceDocumentParser();

    copyingContext.end();

    assert.throws(function () {
      reader.getPagesCount();
    }, /PDF reader has ended/);
    reader.end();
    writer.end();
  });

  it("should reject an ended reader when creating a copying context", function () {
    var reader = muhammara.createReader(
      __dirname + "/TestMaterials/XObjectContent.PDF",
    );
    var writer = muhammara.createWriter(
      __dirname + "/output/UseEndedReaderCopyingContextTest.PDF",
    );
    reader.end();

    assert.throws(function () {
      writer.createPDFCopyingContext(reader);
    }, /PDF reader has ended/);
    writer.end();
  });

  it("should reject a copying context after its source reader ends", function () {
    var reader = muhammara.createReader(
      __dirname + "/TestMaterials/XObjectContent.PDF",
    );
    var writer = muhammara.createWriter(
      __dirname + "/output/UseCopyingContextAfterReaderEndTest.PDF",
    );
    var copyingContext = writer.createPDFCopyingContext(reader);

    reader.end();

    assert.throws(function () {
      copyingContext.appendPDFPageFromPDF(0);
    });
    copyingContext.end();
    writer.end();
  });
});
