// Byte-first port of the TIFF treatments in tests/TiffSpecialsTest.js.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createMuhammaraWasm } from "../index.js";

describe("TiffSpecialsTest", function () {
  it("creates selected TIFF directories and RGB/CMYK treatment forms", async function () {
    var muhammara = await createMuhammaraWasm();
    var multipage = new Uint8Array(
      await readFile("tests/TestMaterials/images/tiff/multipage.tif"),
    );
    var bw = new Uint8Array(
      await readFile("tests/TestMaterials/images/tiff/jim___ah.tif"),
    );
    var grayscale = new Uint8Array(
      await readFile("tests/TestMaterials/images/tiff/jim___cg.tif"),
    );
    var bw = new Uint8Array(
      await readFile("tests/TestMaterials/images/tiff/jim___ah.tif"),
    );
    muhammara.registerImage("multipage", multipage, "tiff");

    var writer = muhammara.createWriter();
    assert.equal(writer.getImagePagesCount("multipage"), 4);
    assert.equal(writer.getImagePagesCount(multipage), 4);
    assert.equal(
      await writer.getImagePagesCountAsync(new Blob([multipage])),
      4,
    );
    await writer.createFormXObjectFromTIFFAsync(new Blob([multipage]), {
      pageIndex: 0,
    });

    for (var pageIndex = 0; pageIndex < 4; pageIndex += 1) {
      var form = writer.createFormXObjectFromTIFF(
        pageIndex === 0 ? multipage : "multipage",
        { pageIndex },
      );
      var page = new muhammara.PDFPage(0, 0, 595, 842);
      writer
        .startPageContentContext(page)
        .q()
        .cm(1, 0, 0, 1, 0, 0)
        .doXObject(form)
        .Q();
      writer.writePage(page);
    }

    var objects = writer.getObjectsContext();
    var bwId = objects.allocateNewObjectID();
    var rgbId = objects.allocateNewObjectID();
    var cmykId = objects.allocateNewObjectID();
    writer.createFormXObjectFromTIFF(bw, {
      objectId: bwId,
      bwTreatment: { asImageMask: true, oneColor: [255, 128, 0] },
    });
    writer.createFormXObjectFromTIFF(grayscale, {
      objectId: rgbId,
      grayscaleTreatment: {
        asColorMap: true,
        oneColor: [0, 255, 0],
        zeroColor: [255, 255, 255],
      },
    });
    writer.createFormXObjectFromTIFF(grayscale, {
      objectId: cmykId,
      grayscaleTreatment: {
        asColorMap: true,
        oneColor: [255, 255, 0, 0],
        zeroColor: [0, 0, 0, 0],
      },
    });

    assert.throws(
      () => writer.createFormXObjectFromTIFF(multipage, { pageIndex: -1 }),
      RangeError,
    );
    [
      { bwTreatment: { oneColor: [0, 0] } },
      { bwTreatment: { oneColor: [0, 0, 256] } },
      { grayscaleTreatment: { oneColor: [0, 0, 0.5] } },
    ].forEach((options) => {
      assert.throws(() => writer.createFormXObjectFromTIFF(multipage, options));
    });
    var pdf = writer.end();
    var reader = muhammara.createReader(pdf);
    assert.equal(reader.getPagesCount(), 4);
    [bwId, rgbId, cmykId].forEach((id) => {
      var form = reader.parseNewObject(id).toPDFStream();
      var dictionary = form.getDictionary().toPDFDictionary();
      assert.equal(dictionary.queryObject("Type").value, "XObject");
      assert.equal(dictionary.queryObject("Subtype").value, "Form");
    });
    reader.end();
    var output = new TextDecoder().decode(pdf);
    assert.match(output, /\/ImageMask true/);
    assert.match(output, /\/DeviceRGB/);
    assert.match(output, /\/DeviceCMYK/);
    assert.throws(
      () => writer.createFormXObjectFromTIFF(multipage),
      /Unable to create TIFF form XObject/,
    );
  });

  it("creates TIFF forms with the same byte-safe options on modifiers", async function () {
    var muhammara = await createMuhammaraWasm();
    var sourceWriter = muhammara.createWriter();
    sourceWriter.writePage(sourceWriter.createPage(0, 0, 100, 100));
    var modifier = muhammara.createWriterToModify(sourceWriter.end());
    var grayscale = new Uint8Array(
      await readFile("tests/TestMaterials/images/tiff/jim___cg.tif"),
    );
    var bw = new Uint8Array(
      await readFile("tests/TestMaterials/images/tiff/jim___ah.tif"),
    );
    var id = modifier.getObjectsContext().allocateNewObjectID();
    assert.equal(
      modifier.createFormXObjectFromTIFF(grayscale, {
        pageIndex: 0,
        objectId: id,
        grayscaleTreatment: {
          asColorMap: true,
          oneColor: [255, 255, 0, 0],
          zeroColor: [0, 0, 0, 0],
        },
      }).id,
      id,
    );
    assert.equal(
      modifier.createFormXObjectFromTIFFBytes(bw, {
        bwTreatment: { asImageMask: true, oneColor: [255, 0, 0] },
      }).id > 0,
      true,
    );
    assert.throws(
      () => modifier.createFormXObjectFromTIFF(grayscale, { pageIndex: -1 }),
      RangeError,
    );
    var output = new TextDecoder().decode(modifier.end());
    assert.match(output, /\/DeviceCMYK/);
    assert.match(output, /\/ImageMask true/);
  });
});
