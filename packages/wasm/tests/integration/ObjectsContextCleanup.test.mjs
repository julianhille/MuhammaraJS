// Ports tests/ObjectsContextCleanup.js. Wasm allows one open dictionary at a
// time, so these tests leave a single dictionary open.
import assert from "node:assert/strict";
import { createMuhammaraWasm } from "../index.js";
import { writeOutput } from "../testOutput.mjs";

describe("ObjectsContextCleanup", function () {
  var muhammara;

  before(async function () {
    muhammara = await createMuhammaraWasm();
  });

  it("refuses to end with an open dictionary and stays usable", function () {
    var writer = muhammara.createWriter();
    var objects = writer.getObjectsContext();
    objects.startNewIndirectObject();
    var dictionary = objects.startDictionary();

    assert.throws(
      () => writer.end(),
      /End the active objects context operation before ending the PDF/,
    );
    objects.endDictionary(dictionary).endIndirectObject();
    writer.writePage(writer.createPage(0, 0, 100, 100));
    var bytes = writer.end();
    writeOutput("ObjectsContextCleanup-ended-after-closing", bytes);

    var reader = muhammara.createReader(bytes);
    assert.equal(reader.getPagesCount(), 1);
    reader.end();
  });

  it("rejects a dictionary that endDictionary() or a stream start ended", function () {
    var writer = muhammara.createWriter();
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
    var bytes = writer.end();
    writeOutput("ObjectsContextCleanup-ended-dictionary", bytes);

    assert.doesNotMatch(Buffer.from(bytes).toString("latin1"), /Late/);
  });

  it("rejects unbalanced indirect object starts and ends", function () {
    var writer = muhammara.createWriter({
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
    var bytes = writer.end();
    writeOutput("ObjectsContextCleanup-unbalanced-end", bytes);

    assert.doesNotMatch(
      Buffer.from(bytes).toString("latin1"),
      /endobj\s+endobj/,
    );
    var reader = muhammara.createReader(bytes, { password: "user" });
    assert.equal(reader.getPagesCount(), 1);
    reader.end();
  });

  it("releases an open dictionary when the writer is disposed", function () {
    var writer = muhammara.createWriter();
    var objects = writer.getObjectsContext();
    objects.startNewIndirectObject();
    var dictionary = objects.startDictionary().writeKey("Open");
    writer.dispose();
    assert.throws(() => writer.end(), /writer/);

    var other = muhammara.createWriter();
    var otherObjects = other.getObjectsContext();
    otherObjects.startNewIndirectObject();
    ["startPDFStream", "startUnfilteredPDFStream"].forEach(function (method) {
      assert.throws(
        () => otherObjects[method](dictionary),
        { name: "TypeError", message: "Provide the active dictionary context" },
        method,
      );
    });
    other.dispose();
  });
});
