// Byte-first port of tests/PDFEmbedTest.js. PDF sources are registered bytes or direct bytes.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createMuhammaraWasm } from "../index.js";

describe("PDFEmbedTest", function () {
  it("embeds PDF pages as form IDs from direct and registered bytes", async function () {
    var muhammara = await createMuhammaraWasm();
    var source = new Uint8Array(
      await readFile("tests/TestMaterials/XObjectContent.PDF"),
    );
    var writer = muhammara.createWriter();
    var formIDs = writer.createFormXObjectsFromPDF(
      source,
      muhammara.ePDFPageBoxMediaBox,
    );
    assert.equal(formIDs.length, 2);

    var asyncWriter = muhammara.createWriter();
    assert.equal(
      (await asyncWriter.createFormXObjectsFromPDFAsync(new Blob([source])))
        .length,
      2,
    );
    asyncWriter.end();

    var page = writer.createPage(0, 0, 595, 842);
    var context = writer.startPageContentContext(page);
    var resources = page.getResourcesDictionary();
    context
      .q()
      .cm(0.5, 0, 0, 0.5, 0, 421)
      .doXObject(resources.addFormXObjectMapping(formIDs[0]))
      .Q()
      .G(0)
      .w(1)
      .re(0, 421, 297.5, 421)
      .S()
      .q()
      .cm(0.5, 0, 0, 0.5, 297.5, 0)
      .doXObject(resources.addFormXObjectMapping(formIDs[1]))
      .Q();
    writer.writePage(page);
    var output = writer.end();
    var reader = muhammara.createReader(output);
    assert.equal(reader.getPagesCount(), 1);
    reader.end();

    muhammara.registerPdf("xobject-content", source);
    writer = muhammara.createWriter();
    formIDs = writer.createFormXObjectsFromPDF(
      "xobject-content",
      muhammara.ePDFPageBoxCropBox,
      {
        type: muhammara.eRangeTypeSpecific,
        specificRanges: [[0, 0]],
      },
    );
    assert.equal(formIDs.length, 1);
    page = writer.createPage();
    context = writer.startPageContentContext(page);
    context.doXObject(
      page.getResourcesDictionary().addFormXObjectMapping(formIDs[0]),
    );
    writer.writePage(page);
    assert.ok(writer.end() instanceof Uint8Array);
  });

  it("applies advanced byte-first embed options for direct and registered sources", async function () {
    var muhammara = await createMuhammaraWasm();
    var sourceWriter = muhammara.createWriter();
    var sourceObjects = sourceWriter.getObjectsContext();
    var additionalObjectId = sourceObjects.startNewIndirectObject();
    sourceObjects.writeLiteralString("batch-embed-extra").endIndirectObject();
    var sourcePage = sourceWriter.createPage(0, 0, 200, 300);
    sourceWriter.startPageContentContext(sourcePage).q().Q();
    sourceWriter.writePage(sourcePage);
    var source = sourceWriter.end();
    var options = {
      transformation: [0.5, 0, 0, 0.5, 3, 4],
      additionalObjectIds: [additionalObjectId],
    };

    function embed(input) {
      var writer = muhammara.createWriter();
      var ids = writer.createFormXObjectsFromPDF(
        input,
        [10, 20, 110, 220],
        options,
      );
      var page = writer.createPage();
      writer.startPageContentContext(page).q().Q();
      writer.writePage(page);
      var output = writer.end();
      var reader = muhammara.createReader(output);
      var form = reader.parseNewObject(ids[0]).toPDFStream().getDictionary();
      var box = form
        .queryObject("BBox")
        .toPDFArray()
        .toJSArray()
        .map((value) => value.toNumber());
      var matrix = form
        .queryObject("Matrix")
        .toPDFArray()
        .toJSArray()
        .map((value) => value.toNumber());
      reader.end();
      return { output, ids, box, matrix };
    }

    var direct = embed(source);
    muhammara.registerPdf("advanced-embed", source);
    var registered = embed("advanced-embed");
    assert.equal(direct.ids.length, 1);
    assert.equal(registered.ids.length, 1);
    assert.deepEqual(direct.box, [10, 20, 110, 220]);
    assert.deepEqual(direct.matrix, options.transformation);
    assert.deepEqual(registered.box, direct.box);
    assert.deepEqual(registered.matrix, direct.matrix);
    assert.match(new TextDecoder().decode(direct.output), /batch-embed-extra/);
    assert.match(
      new TextDecoder().decode(registered.output),
      /batch-embed-extra/,
    );
  });

  it("rejects invalid advanced PDF embed options", async function () {
    var muhammara = await createMuhammaraWasm();
    var source = new Uint8Array(
      await readFile("tests/TestMaterials/XObjectContent.PDF"),
    );
    var writer = muhammara.createWriter();
    assert.throws(
      () => writer.createFormXObjectsFromPDF(source, [0, 0, 1, Infinity]),
      /pageBox/,
    );
    assert.throws(
      () =>
        writer.createFormXObjectsFromPDF(source, 0, {
          transformation: [1, 0, 0, 1, 0, Infinity],
        }),
      /transformation/,
    );
    assert.throws(
      () =>
        writer.createFormXObjectsFromPDF(source, 0, {
          additionalObjectIds: [0x1_0000_0000],
        }),
      /additionalObjectIds/,
    );
    assert.throws(
      () => writer.createFormXObjectsFromPDF(source, 0, { password: "nope" }),
      /passwords are not supported/,
    );
    writer.end();
  });
});
