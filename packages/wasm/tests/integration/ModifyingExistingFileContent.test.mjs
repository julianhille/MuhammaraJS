// Byte-first port of the copying-context behavior in
// tests/ModifyingExistingFileContent.js and tests/MergePDFPages.js.
import assert from "node:assert/strict";
import { createMuhammaraWasm } from "../index.js";

describe("ModifyingExistingFileContent", function () {
  it("provides a modifier-owned reader view of its original bytes", async function () {
    var muhammara = await createMuhammaraWasm();
    var sourceWriter = muhammara.createWriter();
    sourceWriter.writePage(sourceWriter.createPage(0, 0, 200, 200));
    var source = sourceWriter.end();

    var writer = muhammara.createWriterToModify(source);
    var parser = writer.getModifiedFileParser();
    var pageId = parser.getPageObjectID(0);
    var page = parser.parsePage(0);
    var pageDictionary = page.getDictionary().toPDFDictionary();
    var trailer = parser.getTrailer().toPDFDictionary();
    var parserStream = parser.getParserStream();

    assert.equal(parser.getPagesCount(), 1);
    assert.equal(
      parser.parseNewObject(pageId).getType(),
      muhammara.ePDFObjectDictionary,
    );
    assert.deepEqual(page.getMediaBox(), [0, 0, 200, 200]);
    assert.equal(pageDictionary.queryObject("Type").value, "Page");
    assert.equal(trailer.queryObject("Root").getObjectID() > 0, true);
    assert.equal(
      parser.getXrefEntry(pageId).type,
      muhammara.eXrefEntryExisting,
    );
    assert.equal(typeof parser.getXrefEntry(pageId).objectPosition, "number");
    assert.equal(parser.getXrefEntry(pageId).position, undefined);
    parserStream.setPosition(0);
    assert.deepEqual(parserStream.read(5), [37, 80, 68, 70, 45]);

    assert.equal(parser.end(), parser);
    assert.equal(parser.end(), parser);
    assert.throws(() => page.getMediaBox(), /PDF reader has ended/);
    assert.equal(writer.getModifiedFileParser().getPagesCount(), 1);

    var liveParser = writer.getModifiedFileParser();
    var liveTrailer = liveParser.getTrailer();
    writer.end();
    assert.throws(() => liveParser.getPagesCount(), /PDF writer has ended/);
    assert.throws(() => liveTrailer.getType(), /PDF writer has ended/);
    assert.throws(() => writer.getModifiedFileParser(), /PDF writer has ended/);
  });

  it("copies its modified-file pages to a form and a new page", async function () {
    var muhammara = await createMuhammaraWasm();
    var sourceWriter = muhammara.createWriter();
    for (var index = 0; index < 2; ++index) {
      var sourcePage = sourceWriter.createPage(0, 0, 200, 200);
      sourceWriter
        .startPageContentContext(sourcePage)
        .re(10 + index * 20, 10, 20, 20)
        .f();
      sourceWriter.writePage(sourcePage);
    }
    var source = sourceWriter.end();

    var writer = muhammara.createWriterToModify(source);
    var copying = writer.createPDFCopyingContextForModifiedFile();
    var formId = copying.createFormXObjectFromPDFPage(0);
    var page = writer.createPage(0, 0, 200, 200);
    copying.mergePDFPageToPage(page, 1);
    writer.startPageContentContext(page).q().Q();
    writer.writePage(page);
    assert.equal(copying.end(), copying);
    assert.throws(() => copying.appendPDFPageFromPDF(0), /has ended/);

    var output = writer.end();
    var reader = muhammara.createReader(output);
    assert.equal(reader.getPagesCount(), 3);
    var form = reader.parseNewObject(formId).toPDFStream();
    assert.ok(form);
    var formDictionary = form.getDictionary().toPDFDictionary();
    assert.equal(formDictionary.queryObject("Type").value, "XObject");
    assert.equal(formDictionary.queryObject("Subtype").value, "Form");
    var pageDictionary = reader.parsePageDictionary(2).toPDFDictionary();
    var pageResources = reader
      .queryDictionaryObject(pageDictionary, "Resources")
      .toPDFDictionary();
    assert.ok(Object.keys(pageResources.toJSObject()).length > 0);
    reader.end();
  });

  it("interleaves external-source page merges and merges modified-file pages to forms", async function () {
    var muhammara = await createMuhammaraWasm();
    var sourceWriter = muhammara.createWriter();
    var sourcePage = sourceWriter.createPage(0, 0, 100, 100);
    sourceWriter.startPageContentContext(sourcePage).re(10, 10, 20, 20).f();
    sourceWriter.writePage(sourcePage);
    var source = sourceWriter.end();

    var writer = muhammara.createWriterToModify(source);
    var external = writer.createPDFCopyingContext(source);
    var page = writer.createPage(0, 0, 100, 100);
    var context = writer.startPageContentContext(page);
    context.writeFreeCode("% prefix\n");
    external.mergePDFPageToPage(page, 0);
    context.writeFreeCode("% suffix\n");
    writer.writePage(page);
    external.end();

    var modified = writer.createPDFCopyingContextForModifiedFile();
    var form = writer.createFormXObject(0, 0, 100, 100);
    assert.equal(modified.mergePDFPageToFormXObject(form, 0), modified);
    form.end();
    modified.end();
    var output = writer.end();
    var reader = muhammara.createReader(output);
    assert.equal(reader.getPagesCount(), 2);
    reader.end();
  });

  it("replaces a modified page dictionary with copied source values", async function () {
    var muhammara = await createMuhammaraWasm();
    var sourceWriter = muhammara.createWriter();
    var sourcePage = sourceWriter.createPage(0, 0, 200, 200);
    sourceWriter.writePage(sourcePage);
    var source = sourceWriter.end();

    var writer = muhammara.createWriterToModify(source);
    var copying = writer.createPDFCopyingContextForModifiedFile();
    var parser = copying.getSourceDocumentParser();
    var pageId = parser.getPageObjectID(0);
    var pageDictionary = parser.parsePage(0).getDictionary().toPDFDictionary();
    var sourceValues = pageDictionary.toJSObject();
    var objects = writer.getObjectsContext();

    objects.startModifiedIndirectObject(pageId);
    var replacement = objects.startDictionary();
    Object.entries(sourceValues).forEach(([key, value]) => {
      if (key === "MediaBox") return;
      replacement.writeKey(key);
      copying.copyDirectObjectAsIs(value);
    });
    replacement.writeKey("MediaBox");
    objects
      .startArray()
      .writeNumber(0)
      .writeNumber(0)
      .writeNumber(500)
      .writeNumber(500)
      .endArray()
      .endDictionary(replacement)
      .endIndirectObject();

    var foreignReader = muhammara.createReader(source);
    var foreignObject = foreignReader.parsePageDictionary(0);
    assert.throws(
      () => copying.copyDirectObjectAsIs(foreignObject),
      /originate from this source document parser/,
    );
    foreignObject._copyingContext = sourceValues.Type._copyingContext;
    assert.throws(
      () => copying.copyDirectObjectAsIs(foreignObject),
      /Unable to copy PDF object/,
    );
    foreignReader.end();

    assert.equal(copying.end(), copying);
    assert.throws(() => parser.getPageObjectID(0), /copying context has ended/);
    assert.throws(() => pageDictionary.getType(), /copying context has ended/);
    assert.throws(
      () => copying.copyDirectObjectAsIs(sourceValues.Type),
      /copying context has ended/,
    );

    var output = writer.end();
    var reader = muhammara.createReader(output);
    assert.deepEqual(reader.getPageBox(0), [0, 0, 500, 500]);
    reader.end();
  });
});
