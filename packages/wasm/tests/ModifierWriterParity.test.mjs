// Byte-first modifier parity for existing PDFWriter operations.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createMuhammaraWasm } from "../index.js";

describe("ModifierWriterParity", function () {
  it("exposes safe writer operations on byte-backed modifiers", async function () {
    var muhammara = await createMuhammaraWasm();
    var sourceWriter = muhammara.createWriter();
    var sourcePage = sourceWriter.createPage(0, 0, 100, 100);
    sourceWriter.startPageContentContext(sourcePage).re(1, 1, 10, 10).f();
    sourceWriter.writePage(sourcePage);
    var source = sourceWriter.end();
    var jpeg = new Uint8Array(
      await readFile("tests/TestMaterials/images/soundcloud_logo.jpg"),
    );
    muhammara.registerImage("logo", jpeg, "jpg");

    var writer = muhammara.createWriterToModify(source, {
      version: muhammara.ePDFVersion17,
      compress: false,
    });
    assert.equal(writer.createPDFTextString("text").toString(), "text");
    assert.match(
      writer.createPDFDate("D:20200101000000").toString(),
      /^D:2020/,
    );
    writer.getDocumentContext().getInfoDictionary().title = "modified";
    assert.equal(writer.getImageDimensions("logo").width > 0, true);
    assert.equal(writer.getImageType(jpeg), "JPG");
    assert.equal(
      writer.retrieveJPGImageInformation("logo").samplesWidth > 0,
      true,
    );
    assert.equal(writer.createImageXObjectFromJPGBytes("logo").id > 0, true);
    assert.equal(writer.createFormXObjectFromJPGBytes("logo").id > 0, true);

    var page = writer.createPage(0, 0, 100, 100);
    var context = writer.startPageContentContext(page);
    writer.pausePageContentContext(context);
    writer.attachURLLinktoCurrentPage("https://example.test", 1, 1, 5, 5);
    writer.createAnnotation("Text", 6, 6, 10, 10, { contents: "note" });
    var objects = writer.getObjectsContext();
    var rawAnnotation = objects.startNewIndirectObject();
    var dictionary = objects.startDictionary();
    dictionary.writeKey("Type").writeNameValue("Annot");
    objects.endDictionary(dictionary).endIndirectObject();
    writer.registerAnnotationReferenceForNextPageWrite(rawAnnotation);
    assert.equal(writer.writePageAndReturnID(page) > 0, true);
    assert.equal(writer.appendPDFPagesFromPDF(source).length, 1);
    var forms = writer.createFormXObjectsFromPDF(source);
    assert.equal(forms.length, 1);
    var output = writer.end();
    var reader = muhammara.createReader(output);
    assert.equal(reader.getPagesCount(), 3);
    reader.end();

    var asyncWriter = await muhammara.createWriterToModifyAsync(
      new Blob([source]),
      { version: muhammara.ePDFVersion17, compress: false },
    );
    assert.equal(await asyncWriter.getImageTypeAsync(new Blob([jpeg])), "JPG");
    assert.equal(
      (await asyncWriter.retrieveJPGImageInformationAsync(new Blob([jpeg])))
        .samplesWidth > 0,
      true,
    );
    assert.equal(
      (await asyncWriter.createFormXObjectsFromPDFAsync(new Blob([source])))
        .length,
      1,
    );
    asyncWriter.end();

    var mergeWriter = muhammara.createWriterToModify(source);
    var mergePage = mergeWriter.createPage(0, 0, 100, 100);
    var called = false;
    mergeWriter.startPageContentContext(mergePage).q().Q();
    mergeWriter.mergePDFPagesToPage(mergePage, source, () => {
      called = true;
    });
    mergeWriter.writePage(mergePage);
    assert.equal(called, true);
    var mergeReader = muhammara.createReader(mergeWriter.end());
    assert.equal(mergeReader.getPagesCount(), 2);
    mergeReader.end();
  });
});
