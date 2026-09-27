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
});
