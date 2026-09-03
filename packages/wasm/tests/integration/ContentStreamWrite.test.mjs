// Ports PageContentContext.getCurrentPageContentStream and
// FormXObject.getContentStream using browser-safe native byte handles.
import assert from "node:assert/strict";
import { createMuhammaraWasm } from "../index.js";

function readStream(reader, stream) {
  var input = reader.startReadingFromStream(stream);
  return new Uint8Array(input.read(1024));
}

describe("ContentStreamWrite", function () {
  it("writes arbitrary bytes to page and form content streams", async function () {
    var muhammara = await createMuhammaraWasm();
    var writer = muhammara.createWriter();
    var page = writer.createPage(0, 0, 100, 100);
    var pageContext = writer.startPageContentContext(page);
    var pageBytes = new TextEncoder().encode("q 1 0 0 rg 0 0 10 10 re f Q\n");
    var pageStream = pageContext.getCurrentPageContentStream();
    var pageWriter = pageStream.getWriteStream();
    assert.equal(pageWriter.write(pageBytes), pageBytes.length);
    assert.throws(() => pageWriter.write("q Q\n"), TypeError);
    writer.pausePageContentContext(pageContext);
    assert.throws(() => pageStream.getWriteStream(), /no longer active/);
    assert.throws(() => pageWriter.write(pageBytes), /no longer active/);

    var formId = writer.getObjectsContext().allocateNewObjectID();
    var form = writer.createFormXObject(0, 0, 20, 20, formId);
    var formBytes = new Uint8Array([0x71, 0x20, 0x51, 0x0a]);
    var formStream = form.getContentStream();
    var formWriter = formStream.getWriteStream();
    assert.equal(formWriter.write(formBytes), formBytes.length);
    assert.throws(() => formWriter.write([0x71]), TypeError);
    writer.endFormXObject(form);
    assert.throws(() => form.getContentStream(), /no longer active/);
    assert.throws(() => formWriter.write(formBytes), /no longer active/);

    writer.writePage(page);
    var pdf = writer.end();
    var reader = muhammara.createReader(pdf);
    var pageContents = reader
      .queryDictionaryObject(reader.parsePageDictionary(0), "Contents")
      .toPDFStream();
    assert.deepEqual(
      Array.from(readStream(reader, pageContents)),
      Array.from(pageBytes),
    );
    assert.deepEqual(
      Array.from(
        readStream(reader, reader.parseNewObject(formId).toPDFStream()),
      ),
      Array.from(formBytes),
    );
    reader.end();
  });

  it("invalidates content stream writers when the writer ends", async function () {
    var muhammara = await createMuhammaraWasm();
    var writer = muhammara.createWriter();
    var page = writer.createPage();
    var context = writer.startPageContentContext(page);
    var streamWriter = context.getCurrentPageContentStream().getWriteStream();
    writer.writePage(page);
    writer.end();
    assert.throws(() => streamWriter.write(new Uint8Array()), /not active/);
  });
});
