// Byte-first port of PDFWriter.getImageDimensions stream behavior.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createMuhammaraWasm } from "../index.js";

describe("ImageDimensions", function () {
  it("reads registered and direct JPEG, TIFF directories, PDF pages, and async bytes", async function () {
    var muhammara = await createMuhammaraWasm();
    var jpg = new Uint8Array(
      await readFile("tests/TestMaterials/images/otherStage.JPG"),
    );
    var tiff = new Uint8Array(
      await readFile("tests/TestMaterials/images/tiff/multipage.tif"),
    );
    var png = new Uint8Array(
      await readFile("tests/TestMaterials/images/png/original.png"),
    );
    muhammara.registerImage("jpg", jpg, "jpg");
    muhammara.registerImage("tiff", tiff, "tiff");

    var pdfWriter = muhammara.createWriter();
    pdfWriter.writePage(new muhammara.PDFPage(0, 0, 100, 200));
    pdfWriter.writePage(new muhammara.PDFPage(0, 0, 300, 400));
    var pdf = pdfWriter.end();
    muhammara.registerPdf("boxes", pdf);

    var writer = muhammara.createWriter();
    var registeredJpg = writer.getImageDimensions("jpg");
    assert.deepEqual(writer.getImageDimensions(jpg), registeredJpg);
    assert.deepEqual(writer.getImageDimensions(jpg.buffer), registeredJpg);
    assert.ok(registeredJpg.width > 0);
    assert.ok(registeredJpg.height > 0);
    assert.ok(writer.getImageDimensions(png).width > 0);

    var firstTiff = writer.getImageDimensions("tiff", 0);
    var laterTiff = writer.getImageDimensions(tiff, 1);
    assert.ok(writer.getImagePagesCount("tiff") > 1);
    assert.ok(firstTiff.width > 0);
    assert.ok(laterTiff.height > 0);
    assert.deepEqual(writer.getImageDimensions("tiff", 1), laterTiff);

    assert.deepEqual(writer.getImageDimensions("boxes", 0), {
      width: 100,
      height: 200,
    });
    assert.deepEqual(writer.getImageDimensions(pdf, 1), {
      width: 300,
      height: 400,
    });
    assert.deepEqual(
      await writer.getImageDimensionsAsync(new Blob([jpg])),
      registeredJpg,
    );
    assert.deepEqual(
      await writer.getImageDimensionsAsync(new File([jpg], "image.jpg")),
      registeredJpg,
    );

    assert.throws(
      () => writer.getImageDimensions(new Uint8Array([1, 2, 3])),
      /Unable to read image dimensions/,
    );
    for (var imageIndex of [-1, 1.5, 0x100000000]) {
      assert.throws(
        () => writer.getImageDimensions(jpg, imageIndex),
        RangeError,
      );
    }
    assert.throws(() => writer.getImageDimensions("missing"), TypeError);
    writer.end();
    assert.throws(() => writer.getImageDimensions(jpg), /ended/);
  });
});
