// Byte-first port of tests/ObjectReplacementTest.js page-scoped replacement.
import assert from "node:assert/strict";
import { createMuhammaraWasm } from "../index.js";

function getPageContentsID(reader, pageIndex) {
  return reader
    .parsePage(pageIndex)
    .getDictionary()
    .toPDFDictionary()
    .queryObject("Contents")
    .toPDFIndirectObjectReference()
    .getObjectID();
}

describe("ObjectReplacement", function () {
  it("replaces a direct page reference with a modifier-owned object", async function () {
    var muhammara = await createMuhammaraWasm();
    var sourceWriter = muhammara.createWriter();
    for (var index = 0; index < 2; ++index) {
      var page = sourceWriter.createPage(0, 0, 100, 100);
      sourceWriter
        .startPageContentContext(page)
        .writeFreeCode(`% source page ${index}\n`);
      sourceWriter.writePage(page);
    }
    var source = sourceWriter.end();
    var sourceReader = muhammara.createReader(source);
    var firstContentsId = getPageContentsID(sourceReader, 0);
    var secondContentsId = getPageContentsID(sourceReader, 1);
    sourceReader.end();

    var writer = muhammara.createWriterToModify(source);
    var objects = writer.getObjectsContext();
    var replacementId = objects.startNewIndirectObject();
    var replacement = objects.startPDFStream();
    replacement
      .getWriteStream()
      .write(new TextEncoder().encode("% replacement object\n"));
    objects.endPDFStream(replacement).endIndirectObject();
    assert.equal(
      writer.replaceObject(0, firstContentsId, replacementId),
      writer,
    );
    var output = writer.end();

    var reader = muhammara.createReader(output);
    assert.equal(getPageContentsID(reader, 0), replacementId);
    assert.equal(getPageContentsID(reader, 1), secondContentsId);
    var stream = reader.parseNewObject(replacementId).toPDFStream();
    var bytes = reader.startReadingFromStream(stream).read(100);
    assert.match(
      new TextDecoder().decode(new Uint8Array(bytes)),
      /replacement object/,
    );
    reader.end();
  });

  it("rejects invalid IDs, pages, active pages, and ended modifiers", async function () {
    var muhammara = await createMuhammaraWasm();
    var sourceWriter = muhammara.createWriter();
    var sourcePage = sourceWriter.createPage(0, 0, 100, 100);
    sourceWriter.startPageContentContext(sourcePage).q().Q();
    sourceWriter.writePage(sourcePage);
    var source = sourceWriter.end();
    var reader = muhammara.createReader(source);
    var sourceId = getPageContentsID(reader, 0);
    reader.end();

    var writer = muhammara.createWriterToModify(source);
    var objects = writer.getObjectsContext();
    var replacementId = objects.startNewIndirectObject();
    var replacement = objects.startPDFStream();
    objects.endPDFStream(replacement).endIndirectObject();
    assert.throws(
      () => writer.replaceObject(-1, sourceId, replacementId),
      /unsigned 32-bit/,
    );
    assert.throws(
      () => writer.replaceObject(0, 0, replacementId),
      /unsigned 32-bit/,
    );
    assert.throws(
      () => writer.replaceObject(0, sourceId, 0),
      /unsigned 32-bit/,
    );
    assert.throws(
      () => writer.replaceObject(0.5, sourceId, replacementId),
      /unsigned 32-bit/,
    );
    assert.throws(
      () => writer.replaceObject(0, sourceId, 0x100000000),
      /unsigned 32-bit/,
    );
    assert.throws(
      () => writer.replaceObject(1, sourceId, replacementId),
      /must belong to the modified PDF/,
    );
    assert.throws(
      () => writer.replaceObject(0, sourceId, replacementId + 100),
      /must belong to the modified PDF/,
    );
    var page = writer.createPage(0, 0, 100, 100);
    writer.startPageContentContext(page).q().Q();
    assert.throws(
      () => writer.replaceObject(0, sourceId, replacementId),
      /must belong to the modified PDF/,
    );
    writer.writePage(page).end();
    assert.throws(
      () => writer.replaceObject(0, sourceId, replacementId),
      /has ended/,
    );
  });

  it("replaces matching page references globally when requested", async function () {
    var muhammara = await createMuhammaraWasm();
    var sourceWriter = muhammara.createWriter();
    for (var index = 0; index < 2; ++index) {
      var page = sourceWriter.createPage(0, 0, 100, 100);
      sourceWriter.startPageContentContext(page).q().Q();
      sourceWriter.writePage(page);
    }
    var source = sourceWriter.end();
    var sourceReader = muhammara.createReader(source);
    var firstContentsId = getPageContentsID(sourceReader, 0);
    var secondContentsId = getPageContentsID(sourceReader, 1);
    sourceReader.end();

    var sharingWriter = muhammara.createWriterToModify(source);
    sharingWriter.replaceObject(1, secondContentsId, firstContentsId);
    var shared = sharingWriter.end();

    var writer = muhammara.createWriterToModify(shared);
    var objects = writer.getObjectsContext();
    var replacementId = objects.startNewIndirectObject();
    var replacement = objects.startPDFStream();
    objects.endPDFStream(replacement).endIndirectObject();
    writer.replaceObject(0, firstContentsId, replacementId, {
      scope: "global",
    });
    var output = writer.end();

    var reader = muhammara.createReader(output);
    assert.equal(getPageContentsID(reader, 0), replacementId);
    assert.equal(getPageContentsID(reader, 1), replacementId);
    reader.end();
  });
});
