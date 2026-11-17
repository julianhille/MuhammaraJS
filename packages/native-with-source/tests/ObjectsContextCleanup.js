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

  it("rejects a dictionary that endDictionary() or a stream start ended", function () {
    var output = new muhammara.PDFWStreamForBuffer();
    var writer = muhammara.createWriter(output);
    var objects = writer.getObjectsContext();
    // Each entry ends the dictionary and returns what closes its object.
    [
      (dictionary) => {
        objects.endDictionary(dictionary);
        return () => objects.endIndirectObject();
      },
      (dictionary) => {
        var stream = objects.startPDFStream(dictionary);
        return () => objects.endPDFStream(stream);
      },
      (dictionary) => {
        var stream = objects.startUnfilteredPDFStream(dictionary);
        return () => objects.endPDFStream(stream);
      },
    ].forEach(function (end) {
      objects.startNewIndirectObject();
      var dictionary = objects.startDictionary();
      var close = end(dictionary);

      [
        ["writeKey", ["Late"]],
        ["writeNameValue", ["Late"]],
        ["writeLiteralStringValue", ["Late"]],
        ["writeBooleanValue", [true]],
        ["writeNumberValue", [1]],
        ["writeObjectReferenceValue", [1]],
        ["writeRectangleValue", [0, 0, 1, 1]],
      ].forEach(function ([method, args]) {
        assert.throws(
          () => dictionary[method](...args),
          { name: "Error", message: "Dictionary context is no longer active" },
          method,
        );
      });
      assert.throws(
        () => objects.endDictionary(dictionary),
        /Inconsistent ending of dictionary/,
      );
      ["startPDFStream", "startUnfilteredPDFStream"].forEach(function (method) {
        assert.throws(
          () => objects[method](dictionary),
          {
            name: "TypeError",
            message: "Provide the active dictionary context",
          },
          method,
        );
      });
      close();
    });
    writer.writePage(writer.createPage(0, 0, 100, 100));
    writer.end();
    writeOutput("ObjectsContextCleanup-ended-dictionary", output.buffer);

    assert.doesNotMatch(output.buffer.toString("latin1"), /Late/);
  });

  it("rejects an open dictionary that is not the innermost one for a stream", function () {
    var output = new muhammara.PDFWStreamForBuffer();
    var writer = muhammara.createWriter(output);
    var objects = writer.getObjectsContext();
    var [outer, inner] = openNestedDictionaries(writer);
    var other = muhammara.createWriter(new muhammara.PDFWStreamForBuffer());
    var otherObjects = other.getObjectsContext();
    otherObjects.startNewIndirectObject();
    // The outer dictionary while the inner one is open, and the inner one in
    // another writer.
    [
      [objects, outer],
      [otherObjects, inner],
    ].forEach(function ([context, dictionary]) {
      ["startPDFStream", "startUnfilteredPDFStream"].forEach(function (method) {
        assert.throws(
          () => context[method](dictionary),
          {
            name: "TypeError",
            message: "Provide the active dictionary context",
          },
          method,
        );
      });
    });
    other._abort();

    // Both stay open, and the outer one starts a stream once the inner ends.
    objects.endDictionary(inner);
    objects.endPDFStream(objects.startPDFStream(outer));
    // A stream started with the inner one ends it as well.
    [outer, inner] = openNestedDictionaries(writer);
    assert.throws(() => objects.endDictionary(outer), /Inconsistent ending/);
    objects.endPDFStream(objects.startUnfilteredPDFStream(inner));
    objects.endPDFStream(objects.startPDFStream(outer));
    writer.writePage(writer.createPage(0, 0, 100, 100));
    writer.end();
    writeOutput("ObjectsContextCleanup-inactive-dictionary", output.buffer);

    // Nothing was added to the inner dictionary.
    assert.match(output.buffer.toString("latin1"), /\/Inner <<\s*>>/);
  });

  it("throws when the stream dictionary already has a /Length key", function () {
    var output = new muhammara.PDFWStreamForBuffer();
    var writer = muhammara.createWriter(output);
    var objects = writer.getObjectsContext();
    objects.startNewIndirectObject();
    var dictionary = objects.startDictionary();
    dictionary.writeKey("Length").writeNumberValue(1);
    [
      ["startPDFStream", "Unable to start PDF stream"],
      ["startUnfilteredPDFStream", "Unable to start unfiltered PDF stream"],
    ].forEach(function ([method, message]) {
      assert.throws(
        () => objects[method](dictionary),
        { name: "Error", message },
        method,
      );
    });

    // The dictionary stays open.
    objects.endDictionary(dictionary).endIndirectObject();
    writer.writePage(writer.createPage(0, 0, 100, 100));
    writer.end();
    writeOutput("ObjectsContextCleanup-stream-length-key", output.buffer);
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
    var dictionary = openNestedDictionaries(writer)[1];

    writer._abort();
    writeOutput("ObjectsContextCleanup-aborted", output.buffer);
    // The output ends inside the unclosed dictionaries: nothing was written
    // for them after the abort.
    assert.match(output.buffer.toString("latin1"), /<<\r\n\t\/Inner <<\r\n$/);

    var other = muhammara.createWriter(new muhammara.PDFWStreamForBuffer());
    var otherObjects = other.getObjectsContext();
    otherObjects.startNewIndirectObject();
    ["startPDFStream", "startUnfilteredPDFStream"].forEach(function (method) {
      assert.throws(
        () => otherObjects[method](dictionary),
        { name: "TypeError", message: "Provide the active dictionary context" },
        method,
      );
    });
    other._abort();
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
