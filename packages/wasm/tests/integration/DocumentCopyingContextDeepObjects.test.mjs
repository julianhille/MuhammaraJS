import assert from "node:assert/strict";
import { createMuhammaraWasm } from "../index.js";

describe("DocumentCopyingContext deep objects", function () {
  it("copies direct-object dependencies, tracks mappings, and replaces sources", async function () {
    var muhammara = await createMuhammaraWasm();
    var sourceWriter = muhammara.createWriter();
    var sourceObjects = sourceWriter.getObjectsContext();
    var sourceObjectId = sourceObjects.startNewIndirectObject();
    sourceObjects.writeKeyword("null").endIndirectObject();
    var sourcePage = sourceWriter.createPage(0, 0, 100, 100);
    sourceWriter.startPageContentContext(sourcePage).q().Q();
    sourceWriter.writePage(sourcePage);
    var source = sourceWriter.end();

    var writer = muhammara.createWriter();
    var copying = writer.createPDFCopyingContext(source);
    var parser = copying.getSourceDocumentParser();
    var pageId = parser.getPageObjectID(0);
    var page = parser.parsePage(0).getDictionary().toPDFDictionary();
    var objects = writer.getObjectsContext();
    var replacementId = objects.startNewIndirectObject();
    objects.writeKeyword("null").endIndirectObject();

    assert.equal(
      copying.replaceSourceObjects({ [sourceObjectId]: replacementId }),
      copying,
    );
    assert.equal(copying.copyObject(sourceObjectId), replacementId);
    assert.equal(copying.getCopiedObjectID(sourceObjectId), replacementId);
    assert.equal(copying.getCopiedObjects()[sourceObjectId], replacementId);

    objects.startNewIndirectObject();
    var dictionary = objects.startDictionary();
    dictionary.writeKey("Page");
    var requiredIds = copying.copyDirectObjectWithDeepCopy(page);
    assert.ok(requiredIds.length > 0);
    assert.equal(copying.copyNewObjectsForDirectObject(requiredIds), copying);
    objects.endDictionary(dictionary).endIndirectObject();

    assert.throws(
      () => copying.getCopiedObjectID(0xffffffff),
      /No copied object/,
    );
    assert.throws(() => copying.copyObject(-1), /non-negative object ID/);
    assert.throws(
      () =>
        copying.copyNewObjectsForDirectObject([requiredIds[0], requiredIds[0]]),
      /must not contain duplicates/,
    );
    assert.throws(
      () => copying.replaceSourceObjects({ nope: replacementId }),
      /keys/,
    );
    assert.throws(
      () => copying.replaceSourceObjects({ [sourceObjectId]: -1 }),
      /non-negative/,
    );

    var foreignReader = muhammara.createReader(source);
    assert.throws(
      () =>
        copying.copyDirectObjectWithDeepCopy(
          foreignReader.parsePageDictionary(0),
        ),
      /originate from this source document parser/,
    );
    foreignReader.end();

    assert.equal(copying.end(), copying);
    assert.throws(() => copying.getCopiedObjects(), /has ended/);
    assert.throws(
      () => copying.copyDirectObjectWithDeepCopy(page),
      /has ended/,
    );

    var targetPage = writer.createPage(0, 0, 100, 100);
    writer.writePage(targetPage);
    var output = writer.end();
    var reader = muhammara.createReader(output);
    assert.equal(reader.getPagesCount(), 1);
    reader.end();
  });

  it("exposes the deep-object family on all byte-backed copying contexts", async function () {
    var muhammara = await createMuhammaraWasm();
    var sourceWriter = muhammara.createWriter();
    var sourcePage = sourceWriter.createPage();
    sourceWriter.writePage(sourcePage);
    var source = sourceWriter.end();
    var writer = muhammara.createWriter();
    var modifier = muhammara.createWriterToModify(source);
    var contexts = [
      writer.createPDFCopyingContext(source),
      modifier.createPDFCopyingContext(source),
      modifier.createPDFCopyingContextForModifiedFile(),
    ];

    contexts.forEach((copying) => {
      [
        "copyObject",
        "copyDirectObjectWithDeepCopy",
        "copyNewObjectsForDirectObject",
        "getCopiedObjectID",
        "getCopiedObjects",
        "replaceSourceObjects",
      ].forEach((name) => assert.equal(typeof copying[name], "function"));
      assert.throws(() => copying.copyDirectObjectWithDeepCopy(), /originate/);
      assert.throws(() => copying.copyNewObjectsForDirectObject("1"), /array/);
      assert.equal(copying.end(), copying);
    });
    writer.end();
    modifier.end();
  });
});
