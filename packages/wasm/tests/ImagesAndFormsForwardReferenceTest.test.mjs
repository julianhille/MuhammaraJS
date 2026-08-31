// Byte-first port of tests/ImagesAndFormsForwardReferenceTest.js.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createMuhammaraWasm } from "../index.js";

describe("ImagesAndFormsForwardReferenceTest", function () {
  it("maps and places byte assets before defining their supplied object IDs", async function () {
    var muhammara = await createMuhammaraWasm();
    muhammara.registerImage(
      "jpg",
      new Uint8Array(
        await readFile("tests/TestMaterials/images/otherStage.JPG"),
      ),
      "jpg",
    );
    muhammara.registerImage(
      "png",
      new Uint8Array(
        await readFile("tests/TestMaterials/images/png/original.png"),
      ),
      "png",
    );
    muhammara.registerImage(
      "tiff",
      new Uint8Array(
        await readFile("tests/TestMaterials/images/tiff/multipage.tif"),
      ),
      "tiff",
    );

    var writer = muhammara.createWriter();
    var objects = writer.getObjectsContext();
    var ids = Array.from({ length: 5 }, () => objects.allocateNewObjectID());
    var page = writer.createPage(0, 0, 595, 842);
    var content = writer.startPageContentContext(page);
    var resources = page.getResourcesDictionary();
    var names = [
      resources.addImageXObjectMapping(ids[0]),
      resources.addFormXObjectMapping(ids[1]),
      resources.addFormXObjectMapping(ids[2]),
      resources.addFormXObjectMapping(ids[3]),
      resources.addFormXObjectMapping(ids[4]),
    ];

    resources.addProcsetResource(muhammara.KProcsetImageB);
    resources.addProcsetResource(muhammara.KProcsetImageC);
    resources.addProcsetResource(muhammara.KProcsetImageI);
    names.forEach((name, index) => {
      content
        .q()
        .cm(1, 0, 0, 1, index * 100, index * 100)
        .doXObject(name)
        .Q();
    });
    writer.writePage(page);

    writer.createImageXObjectFromJPGBytes("jpg", ids[0]);
    writer.createFormXObjectFromJPGBytes("jpg", ids[1]);
    writer.createFormXObjectFromPNGBytes("png", ids[2]);
    writer.createFormXObjectFromTIFF("tiff", {
      objectId: ids[3],
      pageIndex: 1,
    });
    var form = writer.createFormXObject(0, 0, 200, 100, ids[4]);
    form.getContentContext().q().k(0, 100, 100, 0).re(0, 0, 200, 100).f().Q();
    writer.endFormXObject(form);

    var pdf = writer.end();
    var reader = muhammara.createReader(pdf);
    assert.equal(reader.getPagesCount(), 1);
    reader.end();
    var output = new TextDecoder().decode(pdf);
    ids.forEach((id) => assert.match(output, new RegExp(`${id} 0 obj`)));
    names.forEach((name) => assert.match(output, new RegExp(`/${name} `)));
  });

  it("rejects invalid supplied object IDs", async function () {
    var muhammara = await createMuhammaraWasm();
    muhammara.registerImage(
      "jpg",
      new Uint8Array(
        await readFile("tests/TestMaterials/images/otherStage.JPG"),
      ),
      "jpg",
    );
    muhammara.registerImage(
      "png",
      new Uint8Array(
        await readFile("tests/TestMaterials/images/png/original.png"),
      ),
      "png",
    );
    muhammara.registerImage(
      "tiff",
      new Uint8Array(
        await readFile("tests/TestMaterials/images/tiff/multipage.tif"),
      ),
      "tiff",
    );
    var writer = muhammara.createWriter();

    assert.throws(
      () => writer.createImageXObjectFromJPGBytes("jpg", 0),
      RangeError,
    );
    assert.throws(
      () => writer.createFormXObjectFromJPGBytes("jpg", -1),
      RangeError,
    );
    assert.throws(
      () => writer.createFormXObjectFromPNGBytes("png", 1.5),
      RangeError,
    );
    assert.throws(
      () => writer.createFormXObjectFromTIFF("tiff", { objectId: 0 }),
      RangeError,
    );
    assert.throws(
      () => writer.createFormXObject(0, 0, 10, 10, 0x100000000),
      RangeError,
    );
    writer.end();
  });
});
