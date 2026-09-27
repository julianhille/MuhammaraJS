var assert = require("chai").assert;
var muhammara = require("@muhammara/native-with-source");
var fs = require("fs");
var os = require("os");
var path = require("path");
var { writeOutput } = require("./helpers/testOutput");

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
    writeOutput(
      "UseAfterEndTest-" + mode + "-source",
      fs.readFileSync(sourcePath),
    );
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
      writeOutput("UseAfterEndTest-" + mode, fs.readFileSync(outputPath));
      var reader = muhammara.createReader(outputPath);
      assert.equal(reader.getPagesCount(), 1);
      reader.end();
    }
  } else {
    writer.end();
    if (mode === "stream" || mode === "modified-stream") {
      writeOutput("UseAfterEndTest-" + mode, stream.buffer);
    } else if (mode === "file" || mode === "modified-file") {
      writeOutput("UseAfterEndTest-" + mode, fs.readFileSync(outputPath));
    }
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
 * Continue a shut-down writer with a JavaScript object as its log target.
 * Returns the writer together with the chunks the process-global trace writes
 * into that object.
 */
function continueWithLogStream(directory) {
  var outputPath = path.join(directory, "logged.pdf");
  var statePath = path.join(directory, "logged-state.txt");
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
          var logged = continueWithLogStream(directory);

          traceAFailure(directory);
          assert.isAbove(
            logged.written.length,
            0,
            "a live writer's log stream should receive trace output",
          );
          logged.written.forEach(function (chunk) {
            assert.instanceOf(
              chunk,
              Buffer,
              "log chunks are delivered as Buffers",
            );
          });
          var writtenWhileLive = logged.written.length;

          if (mode === "end") {
            logged.writer.end();
            writeOutput(
              "UseAfterEndTest-log-stream-end",
              fs.readFileSync(path.join(directory, "logged.pdf")),
            );
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

  describe("objects obtained before their owner ended", function () {
    /**
     * Asserts that calling a method throws because its owner has ended.
     *
     * @param {string} message The expected error message.
     * @param {Function} call Calls a method on an object whose owner ended.
     */
    function assertEnded(message, call) {
      assert.throws(call, new RegExp("^" + message + "$"));
    }

    it("rejects writer children after end()", function () {
      var writer = muhammara.createWriter(new muhammara.PDFWStreamForBuffer());
      var page = writer.createPage(0, 0, 100, 100);
      var pageContent = writer.startPageContentContext(page);
      writer.pausePageContentContext(pageContent);
      var pageStream = pageContent.getCurrentPageContentStream();
      var form = writer.createFormXObject(0, 0, 10, 10);
      var formContent = form.getContentContext();
      writer.endFormXObject(form);
      var objectsContext = writer.getObjectsContext();
      objectsContext.startNewIndirectObject();
      var dictionary = objectsContext.startDictionary();
      objectsContext.endDictionary(dictionary);
      objectsContext.endIndirectObject();
      var font = writer.getFontForFile(
        __dirname + "/TestMaterials/fonts/arial.ttf",
      );
      var documentContext = writer.getDocumentContext();
      writer.writePage(page);
      writer.end();

      assertEnded("PDF writer has ended", function () {
        pageContent.drawRectangle(1, 1, 2, 2);
      });
      assertEnded("PDF writer has ended", function () {
        pageStream.getWriteStream();
      });
      assertEnded("PDF writer has ended", function () {
        formContent.re(0, 0, 1, 1);
      });
      assertEnded("PDF writer has ended", function () {
        form.getContentContext();
      });
      assertEnded("PDF writer has ended", function () {
        objectsContext.startDictionary();
      });
      assertEnded("PDF writer has ended", function () {
        dictionary.writeKey("Key");
      });
      assertEnded("PDF writer has ended", function () {
        font.calculateTextDimensions("text", 10);
      });
      assertEnded("PDF writer has ended", function () {
        documentContext.getInfoDictionary();
      });
    });

    it("rejects a page content context after writePage()", function () {
      var writer = muhammara.createWriter(new muhammara.PDFWStreamForBuffer());
      var page = writer.createPage(0, 0, 100, 100);
      var pageContent = writer.startPageContentContext(page);
      writer.writePage(page);

      assertEnded("Page content context is not active", function () {
        pageContent.re(1, 1, 2, 2);
      });
      var nextContent = writer.startPageContentContext(page);
      nextContent.re(1, 1, 2, 2);
      writer.writePage(page);
      writer.end();
    });

    it("rejects dictionaries of a writer event after the event", function () {
      var writer = muhammara.createWriter(new muhammara.PDFWStreamForBuffer());
      var pageDictionary;
      writer.getEvents().on("OnPageWrite", function (event) {
        pageDictionary = event.pageDictionaryContext;
        pageDictionary.writeKey("PieceInfo").writeNameValue("Test");
      });
      writer.writePage(writer.createPage(0, 0, 100, 100));

      assertEnded("PDF writer event has ended", function () {
        pageDictionary.writeKey("Late");
      });
      writer.end();
    });

    it("rejects modifier and modified-file children after end()", function () {
      var directory = fs.mkdtempSync(path.join(os.tmpdir(), "muhammara-"));
      try {
        var writer = muhammara.createWriterToModify(
          path.join(__dirname, "TestMaterials", "Original.pdf"),
          { modifiedFilePath: path.join(directory, "modified.pdf") },
        );
        var modifier = new muhammara.PDFPageModifier(writer, 0, true);
        var modifierContent = modifier.startContext().getContext();
        modifierContent.re(1, 1, 2, 2);
        modifier.endContext().writePage();
        var parser = writer.getModifiedFileParser();
        var inputStream = writer.getModifiedInputFile().getInputStream();
        writer.end();

        assertEnded("PDF writer has ended", function () {
          modifierContent.re(1, 1, 2, 2);
        });
        assertEnded("PDF writer has ended", function () {
          modifier.writePage();
        });
        assertEnded("PDF writer has ended", function () {
          inputStream.read(10);
        });
        assert.throws(function () {
          parser.parsePage(0);
        }, /PDF reader has ended/);
        assert.throws(function () {
          new muhammara.PDFPageModifier(writer, 0);
        }, /PDF writer has ended/);
      } finally {
        fs.rmSync(directory, { recursive: true, force: true });
      }
    });

    it("rejects reader children after end()", function () {
      var reader = muhammara.createReader(
        path.join(__dirname, "TestMaterials", "XObjectContent.PDF"),
      );
      var page = reader.parsePage(0);
      var parserStream = reader.getParserStream();
      var contents;
      for (var id = 1; !contents && id < reader.getObjectsCount(); id++) {
        var object = reader.parseNewObject(id);
        if (object && object.getType() === muhammara.ePDFObjectStream) {
          contents = object;
        }
      }
      var contentReader = reader.startReadingFromStream(contents);
      var objectsParser = reader.startReadingObjectsFromStream(contents);
      reader.end();

      assertEnded("PDF reader has ended", function () {
        page.getCropBox();
      });
      assertEnded("PDF reader has ended", function () {
        parserStream.read(10);
      });
      assertEnded("PDF reader has ended", function () {
        contentReader.read(10);
      });
      assertEnded("PDF reader has ended", function () {
        objectsParser.parseNewObject();
      });
      assertEnded("PDF reader has ended", function () {
        muhammara.createReader(parserStream);
      });
    });

    it("rejects file streams after closeFile()", function () {
      var input = new muhammara.InputFile(
        path.join(__dirname, "TestMaterials", "Original.pdf"),
      );
      var inputStream = input.getInputStream();
      input.closeFile();
      assertEnded("Input file stream has ended", function () {
        inputStream.read(10);
      });

      var directory = fs.mkdtempSync(path.join(os.tmpdir(), "muhammara-"));
      try {
        var output = new muhammara.OutputFile(path.join(directory, "out.bin"));
        var outputStream = output.getOutputStream();
        output.closeFile();
        assertEnded("Output file stream has ended", function () {
          outputStream.write([1, 2, 3]);
        });
      } finally {
        fs.rmSync(directory, { recursive: true, force: true });
      }
    });
  });
});
