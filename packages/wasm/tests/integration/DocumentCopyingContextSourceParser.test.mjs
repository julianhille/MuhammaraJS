// Byte-first port of DocumentCopyingContext source parser and stream behavior.
import assert from "node:assert/strict";
import { createMuhammaraWasm } from "../index.js";

describe("DocumentCopyingContext source parser", function () {
  it("matches the reader parser surface and retains copying ownership", async function () {
    var muhammara = await createMuhammaraWasm();
    var sourceWriter = muhammara.createWriter();
    var sourcePage = sourceWriter.createPage(0, 0, 200, 200);
    sourceWriter
      .startPageContentContext(sourcePage)
      .writeFreeCode("10 20 m 30 40 l S");
    sourceWriter.writePage(sourcePage);
    var source = sourceWriter.end();

    var writer = muhammara.createWriter();
    var copying = writer.createPDFCopyingContext(source);
    var parser = copying.getSourceDocumentParser();
    [
      "getPDFLevel",
      "getTrailer",
      "queryArrayObject",
      "queryDictionaryObject",
      "parseNewObject",
      "getObjectsCount",
      "isEncrypted",
      "getXrefSize",
      "getXrefPosition",
      "getXrefEntry",
      "parsePage",
      "parsePageDictionary",
      "startReadingFromStream",
      "startReadingFromStreamForPlainCopying",
      "startReadingObjectsFromStream",
      "startReadingObjectsFromStreams",
      "getParserStream",
    ].forEach((name) => assert.equal(typeof parser[name], "function"));
    assert.equal(parser.getPDFLevel(), 1.4);
    assert.equal(parser.isEncrypted(), false);
    assert.ok(parser.getObjectsCount() > 0);
    assert.ok(parser.getXrefSize() > 0);
    assert.equal(typeof parser.getXrefPosition(), "number");

    var pageId = parser.getPageObjectID(0);
    assert.equal(
      parser.getXrefEntry(pageId).type,
      muhammara.eXrefEntryExisting,
    );
    var pageInput = parser.parsePage(0);
    assert.deepEqual(pageInput.getMediaBox(), [0, 0, 200, 200]);
    var page = pageInput.getDictionary().toPDFDictionary();
    assert.equal(page.exists("Contents"), true);
    assert.equal(page.queryObject("Type").toPDFName().value, "Page");
    var contents = parser.queryDictionaryObject(page, "Contents").toPDFStream();
    assert.ok(contents.getStreamContentStart() >= 0);
    assert.equal(
      contents.getDictionary().toPDFDictionary().exists("Length"),
      true,
    );
    assert.deepEqual(parser.startReadingFromStream(contents).read(2), [49, 48]);
    assert.equal(
      parser.startReadingFromStreamForPlainCopying(contents).read(2).length,
      2,
    );
    assert.equal(
      parser
        .startReadingObjectsFromStream(contents)
        .parseNewObject()
        .toNumber(),
      10,
    );
    var parserStream = parser.getParserStream();
    parserStream.setPosition(0);
    assert.deepEqual(parserStream.read(5), [37, 80, 68, 70, 45]);
    assert.equal(typeof parserStream.getCurrentPosition(), "number");

    var sourceStream = copying.getSourceDocumentStream();
    sourceStream.setPosition(0);
    assert.deepEqual(sourceStream.read(5), [37, 80, 68, 70, 45]);
    assert.equal(typeof sourceStream.skip(1).getCurrentPosition(), "number");
    copying.end();
    assert.throws(() => parser.getTrailer(), /copying context has ended/);
    assert.throws(() => page.getType(), /copying context has ended/);
    assert.throws(() => sourceStream.read(1), /copying context has ended/);
    writer.end();
  });

  it("supports PDF-page forms and open modifier forms for external sources", async function () {
    var muhammara = await createMuhammaraWasm();
    var sourceWriter = muhammara.createWriter();
    sourceWriter.writePage(sourceWriter.createPage(0, 0, 200, 200));
    var source = sourceWriter.end();
    var modifier = muhammara.createWriterToModify(source);
    var copying = modifier.createPDFCopyingContext(source);
    assert.ok(copying.createFormXObjectFromPDFPage(0) > 0);
    var form = modifier.createFormXObject(0, 0, 200, 200);
    assert.equal(copying.mergePDFPageToFormXObject(form, 0), copying);
    form.end();
    copying.end();
    var output = modifier.end();
    var reader = muhammara.createReader(output);
    assert.equal(reader.getPagesCount(), 1);
    reader.end();
  });
});
