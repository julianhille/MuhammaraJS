var assert = require("node:assert/strict");
var muhammara = require("@muhammara/native-with-source");
var { writeOutput } = require("./helpers/testOutput");

/**
 * Reads the decoded bytes of a stream.
 *
 * @param {object} reader The reader that parsed the stream.
 * @param {object} stream The PDF stream object.
 * @returns {number[]} The decoded bytes.
 */
function readStream(reader, stream) {
  var input = reader.startReadingFromStream(stream);
  var bytes = [];
  while (input.notEnded()) bytes = bytes.concat(Array.from(input.read(1024)));
  return bytes;
}

describe("ContentStreamWrite", function () {
  it("writes arbitrary bytes to page and form content streams", function () {
    var output = new muhammara.PDFWStreamForBuffer();
    var writer = muhammara.createWriter(output);
    var page = writer.createPage(0, 0, 100, 100);
    var pageContext = writer.startPageContentContext(page);
    var pageBytes = Array.from(Buffer.from("q 1 0 0 rg 0 0 10 10 re f Q\n"));
    var pageStream = pageContext.getCurrentPageContentStream();
    var pageWriter = pageStream.getWriteStream();
    assert.equal(pageWriter.write(pageBytes), pageBytes.length);
    writer.pausePageContentContext(pageContext);
    assert.throws(
      () => pageStream.getWriteStream(),
      /^Error: PDF stream is no longer active$/,
    );
    assert.throws(
      () => pageWriter.write(pageBytes),
      /^Error: PDF stream is no longer active$/,
    );

    var formId = writer.getObjectsContext().allocateNewObjectID();
    var form = writer.createFormXObject(0, 0, 20, 20, formId);
    var formBytes = [0x71, 0x20, 0x51, 0x0a];
    var formStream = form.getContentStream();
    var formWriter = formStream.getWriteStream();
    assert.equal(formWriter.write(formBytes), formBytes.length);
    writer.endFormXObject(form);
    assert.throws(
      () => form.getContentStream(),
      /^Error: Form XObject content stream is no longer active$/,
    );
    assert.throws(
      () => formWriter.write(formBytes),
      /^Error: Form XObject content has ended$/,
    );

    writer.writePage(page);
    assert.throws(
      () => writer.pausePageContentContext(pageContext),
      /^Error: Page content context is not active$/,
    );
    writer.end();
    writeOutput("ContentStreamWrite", output.buffer);
    var reader = muhammara.createReader(
      new muhammara.PDFRStreamForBuffer(output.buffer),
    );
    var pageContents = reader.queryDictionaryObject(
      reader.parsePageDictionary(0),
      "Contents",
    );
    assert.deepEqual(readStream(reader, pageContents), pageBytes);
    assert.deepEqual(
      readStream(reader, reader.parseNewObject(formId)),
      formBytes,
    );
    reader.end();
  });

  it("ends an objects-context stream exactly once", function () {
    var writer = muhammara.createWriter(new muhammara.PDFWStreamForBuffer());
    var objectsContext = writer.getObjectsContext();
    objectsContext.startNewIndirectObject();
    var stream = objectsContext.startPDFStream();
    var streamWriter = stream.getWriteStream();
    streamWriter.write([0x41]);
    objectsContext.endPDFStream(stream);
    assert.throws(
      () => objectsContext.endPDFStream(stream),
      /^Error: Unable to end PDF stream$/,
    );
    assert.throws(
      () => stream.getWriteStream(),
      /^Error: PDF stream is no longer active$/,
    );
    assert.throws(
      () => streamWriter.write([0x42]),
      /^Error: PDF stream is no longer active$/,
    );
    objectsContext.endIndirectObject();
    writer.end();
  });

  it("invalidates content stream writers when the writer ends", function () {
    var writer = muhammara.createWriter(new muhammara.PDFWStreamForBuffer());
    var page = writer.createPage(0, 0, 100, 100);
    var context = writer.startPageContentContext(page);
    var streamWriter = context.getCurrentPageContentStream().getWriteStream();
    writer.writePage(page);
    writer.end();
    assert.throws(() => streamWriter.write([]), /not active|has ended/);
  });
});
