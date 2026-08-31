import assert from "node:assert/strict";
import { createMuhammaraWasm } from "../index.js";

describe("ShutdownRestartTest", function () {
  it("normalizes bytes and rejects stale Wasm handles", async function () {
    var muhammara = await createMuhammaraWasm();
    var bytes = new Uint8Array([1, 2, 3]);
    var buffer = bytes.buffer.slice(0);

    var source = new muhammara.PDFRStreamForBuffer(buffer);
    assert.deepEqual(source.read(2), [1, 2]);
    assert.equal(source.getCurrentPosition(), 2);
    source.setPositionFromEnd(1);
    assert.deepEqual(source.read(1), [3]);

    var sink = new muhammara.PDFWStreamForBuffer();
    assert.equal(sink.write(buffer), 3);
    assert.equal(sink.write(new Uint8Array()), 0);
    assert.deepEqual(sink.buffer, bytes);
    assert.deepEqual(sink.toUint8Array(), bytes);
    assert.ok(sink.toArrayBuffer() instanceof ArrayBuffer);

    var writer = muhammara.createWriter();
    assert.throws(() => muhammara.createReader(new Blob([bytes])), /Async API/);
    var page = new muhammara.PDFPage(0, 0, 100, 100);
    var context = writer.startPageContentContext(page);
    var resources = page.getResourcesDictionary();
    context.re(0, 0, 1, 1).f();
    writer.writePage(page);
    assert.throws(
      () => resources.addProcsetResource("PDF"),
      /resources are not active/,
    );
    var pdf = writer.end();
    assert.throws(() => writer.getDocumentContext(), /has ended/);
    assert.throws(() => context.re(0, 0, 1, 1), /not active/);

    var reader = await muhammara.createReaderAsync(new Blob([pdf]));
    assert.equal(reader.getPagesCount(), 1);
    var trailer = reader.getTrailer();
    reader.end();
    reader.end();
    assert.throws(() => reader.getPagesCount(), /has ended/);
    assert.throws(() => trailer.getType(), /has ended/);

    var parsedReader = muhammara.createReader(pdf.buffer);
    var pageObject = parsedReader.parsePageDictionary(0).toPDFDictionary();
    var foreignReader = muhammara.createReader(pdf);
    assert.throws(
      () => foreignReader.queryDictionaryObject(pageObject, "Contents"),
      /Provide a dictionary/,
    );
    foreignReader.end();
    var contents = parsedReader
      .queryDictionaryObject(pageObject, "Contents")
      .toPDFStream();
    var parser = parsedReader.startReadingObjectsFromStream(contents);
    parser.end();
    parser.end();
    assert.throws(() => parser.parseNewObject(), /has ended/);
    parsedReader.end();

    var modifier = await muhammara.createModifierAsync(new Blob([pdf]));
    modifier.startPage(0).endPage();
    modifier.end();
    assert.throws(() => modifier.startPage(0), /has ended/);

    var modifyingWriter = await muhammara.createWriterToModifyAsync(
      new Blob([pdf]),
      { version: muhammara.ePDFVersion17, compress: false },
    );
    var copying = await modifyingWriter.createPDFCopyingContextAsync(
      new Blob([pdf]),
    );
    copying.end();
    assert.throws(() => copying.appendPDFPageFromPDF(0), /has ended/);
    modifyingWriter.end();
    assert.throws(() => modifyingWriter.createPage(0, 0, 10, 10), /has ended/);

    var formWriter = muhammara.createWriter();
    var form = formWriter.createFormXObject(0, 0, 10, 10);
    var formContext = form.getContentContext();
    formWriter.endFormXObject(form);
    assert.throws(() => formContext.re(0, 0, 1, 1), /has ended/);
    formWriter.end();
  });
});
