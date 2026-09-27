var assert = require("assert");
var muhammara = require("@muhammara/native-with-source");
var { writeOutput } = require("./helpers/testOutput");

describe("ObjectsContextCleanup", function () {
  it("closes an unclosed dictionary during writer cleanup", function () {
    var output = new muhammara.PDFWStreamForBuffer();
    var writer = muhammara.createWriter(output);

    writer.getObjectsContext().startDictionary();
    writer.end();
    writeOutput("ObjectsContextCleanup-unclosed-dictionary", output.buffer);

    assert.equal(output.buffer.subarray(-4).toString("latin1"), ">>\r\n");
  });
});
