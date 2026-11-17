var assert = require("assert");
var muhammara = require("@muhammara/native-with-source");
var { writeOutput } = require("./helpers/testOutput");

/**
 * Starts an indirect object with two nested, unclosed dictionaries.
 * @param {Object} writer - The PDF writer.
 * @returns {Object[]} The open dictionaries, innermost last.
 */
function openNestedDictionaries(writer) {
  var objects = writer.getObjectsContext();
  objects.startNewIndirectObject();
  var outer = objects.startDictionary();
  outer.writeKey("Inner");
  return [outer, objects.startDictionary()];
}

describe("ObjectsContextCleanup", function () {
  it("refuses to end with an open dictionary and stays usable", function () {
    var output = new muhammara.PDFWStreamForBuffer();
    var writer = muhammara.createWriter(output);
    var dictionaries = openNestedDictionaries(writer);

    assert.throws(
      () => writer.end(),
      /End the active objects context operation before ending the PDF/,
    );
    var objects = writer.getObjectsContext();
    objects
      .endDictionary(dictionaries[1])
      .endDictionary(dictionaries[0])
      .endIndirectObject();
    writer.writePage(writer.createPage(0, 0, 100, 100));
    writer.end();
    writeOutput("ObjectsContextCleanup-ended-after-closing", output.buffer);

    var reader = muhammara.createReader(
      new muhammara.PDFRStreamForBuffer(output.buffer),
    );
    assert.equal(reader.getPagesCount(), 1);
  });

  it("rejects unbalanced indirect object starts and ends", function () {
    var output = new muhammara.PDFWStreamForBuffer();
    var writer = muhammara.createWriter(output, {
      userPassword: "user",
      ownerPassword: "owner",
      userProtectionFlag: 4,
    });
    var objects = writer.getObjectsContext();
    assert.throws(
      () => objects.endIndirectObject(),
      /Unable to end indirect object/,
    );
    assert.throws(() => objects.startNewIndirectObject(0), {
      name: "RangeError",
      message: "Object ID must be positive",
    });
    assert.throws(() => objects.startModifiedIndirectObject(0), {
      name: "RangeError",
      message: "Object ID must be positive",
    });
    assert.throws(
      () => objects.startModifiedIndirectObject(99999),
      /Unable to start modified indirect object/,
    );
    var id = objects.startNewIndirectObject();
    assert.throws(
      () => objects.startNewIndirectObject(),
      /Unable to start indirect object/,
    );
    // endPDFStream() ends the object, so this endIndirectObject() writes
    // nothing, and the next one has no object to end.
    objects.endPDFStream(objects.startPDFStream()).endIndirectObject();
    assert.throws(
      () => writer.getObjectsContext().endIndirectObject(),
      /Unable to end indirect object/,
    );
    assert.throws(
      () => objects.startNewIndirectObject(id),
      /Unable to start indirect object/,
    );
    writer.writePage(writer.createPage(0, 0, 100, 100));
    writer.end();
    writeOutput("ObjectsContextCleanup-unbalanced-end", output.buffer);

    assert.doesNotMatch(output.buffer.toString("latin1"), /endobj\s+endobj/);
    var reader = muhammara.createReader(
      new muhammara.PDFRStreamForBuffer(output.buffer),
      { password: "user" },
    );
    assert.equal(reader.getPagesCount(), 1);
  });

  it("releases open dictionaries on _abort() without writing them", function () {
    var output = new muhammara.PDFWStreamForBuffer();
    var writer = muhammara.createWriter(output);
    openNestedDictionaries(writer);

    writer._abort();
    writeOutput("ObjectsContextCleanup-aborted", output.buffer);
    // The output ends inside the unclosed dictionaries: nothing was written
    // for them after the abort.
    assert.match(output.buffer.toString("latin1"), /<<\r\n\t\/Inner <<\r\n$/);
  });

  it("releases open dictionaries when an unfinished writer is collected", function () {
    (function () {
      openNestedDictionaries(
        muhammara.createWriter(new muhammara.PDFWStreamForBuffer()),
      );
    })();
    global.gc();
    global.gc();
  });

  describe("unended streams", function () {
    var { collectGarbage } = require("./helpers/gc");

    /**
     * Starts an objects-context stream, writes to it, and never ends it.
     *
     * @param {object} writer The writer to start the stream on.
     * @returns {object} The unended stream.
     */
    function startUnendedStream(writer) {
      var objectsContext = writer.getObjectsContext();
      objectsContext.startNewIndirectObject();
      var stream = objectsContext.startPDFStream();
      stream.getWriteStream().write([0x41, 0x42]);
      return stream;
    }

    it("fails end() while a stream is still open", function () {
      var writer = muhammara.createWriter(new muhammara.PDFWStreamForBuffer());
      startUnendedStream(writer);
      assert.throws(function () {
        writer.end();
      }, /Unable to end PDF/);
    });

    it("releases a stream collected before its writer", async function () {
      var writer = muhammara.createWriter(new muhammara.PDFWStreamForBuffer());
      (function () {
        startUnendedStream(writer);
      })();
      await collectGarbage();
      assert.throws(function () {
        writer.end();
      }, /Unable to end PDF/);
    });

    it("releases streams collected with or after their writers", async function () {
      var streams = [];
      (function () {
        for (var i = 0; i < 20; i++) {
          startUnendedStream(
            muhammara.createWriter(new muhammara.PDFWStreamForBuffer()),
          );
          streams.push(
            startUnendedStream(
              muhammara.createWriter(new muhammara.PDFWStreamForBuffer()),
            ),
          );
        }
      })();
      await collectGarbage();
      streams = null;
      await collectGarbage();
    });
  });
});
