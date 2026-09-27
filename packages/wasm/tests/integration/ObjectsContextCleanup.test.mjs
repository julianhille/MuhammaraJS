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

  it("releases an open dictionary when the writer is disposed", function () {
    var writer = muhammara.createWriter();
    var objects = writer.getObjectsContext();
    objects.startNewIndirectObject();
    objects.startDictionary().writeKey("Open");
    writer.dispose();
    assert.throws(() => writer.end(), /writer/);
  });
});
