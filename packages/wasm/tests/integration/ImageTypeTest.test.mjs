// Byte-first port of tests/ImageTypeTest.js.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createMuhammaraWasm } from "../index.js";

describe("ImageTypeTest", function () {
  it("detects registered image assets and direct bytes without paths", async function () {
    var muhammara = await createMuhammaraWasm();
    var jpg = new Uint8Array(
      await readFile("tests/TestMaterials/images/otherStage.JPG"),
    );
    var tiff = new Uint8Array(
      await readFile("tests/TestMaterials/images/tiff/FLAG_T24.TIF"),
    );
    var pdf = new Uint8Array(
      await readFile("tests/TestMaterials/AddedItem.pdf"),
    );
    var font = new Uint8Array(
      await readFile("tests/TestMaterials/fonts/arial.ttf"),
    );
    muhammara.registerImage("jpg", jpg, "jpg");
    muhammara.registerImage("tiff", tiff, "tiff");

    var writer = muhammara.createWriter();
    assert.equal(writer.getImageType("jpg"), "JPG");
    assert.equal(writer.getImageType("tiff"), "TIFF");
    assert.equal(writer.getImageType(pdf), "PDF");
    assert.equal(writer.getImageType(font), undefined);
    assert.equal(await writer.getImageTypeAsync(new Blob([jpg])), "JPG");
    assert.equal(await writer.getImagePagesCountAsync(new Blob([tiff])), 1);
    assert.throws(() => writer.getImageType("not-a-path"), TypeError);
    writer.end();
  });
});
