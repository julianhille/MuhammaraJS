var assert = require("chai").assert;
var muhammara = require("@muhammara/native-with-source");
var childProcess = require("child_process");
var fs = require("fs");
var os = require("os");
var path = require("path");

/** Exercise terminal writer states in a child so a native crash fails the test. */
function checkEndedWriter(modulePath, directory, mode, operation) {
  var assert = require("node:assert/strict");
  var path = require("path");
  var m = require(modulePath);
  var outputPath = path.join(directory, "output.pdf");
  var stream = new m.PDFWStreamForBuffer();
  var writer;
  if (mode === "unstarted") {
    writer = new m.PDFWriter();
  } else if (mode === "failed-end") {
    writer = m.createWriterToModify(
      path.join(
        path.dirname(modulePath),
        "tests",
        "TestMaterials",
        "Protected.pdf",
      ),
      { modifiedFilePath: outputPath },
    );
  } else if (mode === "modified-file" || mode === "modified-stream") {
    var sourcePath = path.join(directory, "source.pdf");
    var source = m.createWriter(sourcePath);
    source.writePage(source.createPage(0, 0, 200, 200)).end();
    writer =
      mode === "modified-file"
        ? m.createWriterToModify(sourcePath, { modifiedFilePath: outputPath })
        : m.createWriterToModify(
            new m.PDFRStreamForBuffer(require("fs").readFileSync(sourcePath)),
            stream,
          );
  } else {
    writer = m.createWriter(mode === "stream" ? stream : outputPath);
  }
  var page = new m.PDFPage(0, 0, 200, 200);
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
      var resumed = m.createWriterToContinue(outputPath, statePath);
      resumed.end();
      var reader = m.createReader(outputPath);
      assert.equal(reader.getPagesCount(), 1);
      reader.end();
    }
  } else {
    writer.end();
  }
  assert.equal(writer.end(), writer);
  assert.equal(writer._abort(), writer);
  var args = operation === "createPage" ? [0, 0, 200, 200] : [page];
  assert.throws(function () {
    writer[operation].apply(writer, args);
  }, /^Error: PDF writer has ended$/);

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
  ];
  Object.getOwnPropertyNames(Object.getPrototypeOf(writer)).forEach(
    function (method) {
      if (independent.indexOf(method) !== -1) return;
      assert.throws(
        function () {
          writer[method]();
        },
        /^Error: PDF writer has ended$/,
        method,
      );
    },
  );
  var text = writer.createPDFTextString();
  text.fromString("still valid");
  assert.equal(text.toString(), "still valid");
  assert.ok(writer.createPDFDate());
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
    [
      "createPage",
      "startPageContentContext",
      "writePage",
      "writePageAndReturnID",
    ].forEach(function (operation) {
      it(
        "rejects " + operation + " after writer " + mode + " cleanup",
        function () {
          var directory = fs.mkdtempSync(
            path.join(os.tmpdir(), "muhammara-writer-end-"),
          );
          try {
            var result = childProcess.spawnSync(
              process.execPath,
              [
                "-e",
                "(" +
                  checkEndedWriter.toString() +
                  ")(...JSON.parse(process.argv[1]))",
                JSON.stringify([
                  require.resolve("@muhammara/native-with-source"),
                  directory,
                  mode,
                  operation,
                ]),
              ],
              {
                encoding: "utf8",
                timeout: 10000,
                env: Object.assign({}, process.env, {
                  ELECTRON_RUN_AS_NODE: "1",
                }),
              },
            );
            assert.isNull(result.signal, result.stderr);
            assert.strictEqual(result.status, 0, result.stderr);
          } finally {
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
