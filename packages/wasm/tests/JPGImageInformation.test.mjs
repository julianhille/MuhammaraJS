// Byte-first port of PDFWriter.retrieveJPGImageInformation behavior.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createMuhammaraWasm } from "../index.js";

describe("JPGImageInformation", function () {
  it("retrieves Node-shaped JPEG metadata from registered and direct bytes", async function () {
    var muhammara = await createMuhammaraWasm();
    var jpg = new Uint8Array(
      await readFile("tests/TestMaterials/images/otherStage.JPG"),
    );
    var png = new Uint8Array(
      await readFile("tests/TestMaterials/images/png/original.png"),
    );
    muhammara.registerImage("jpg", jpg, "jpg");
    var writer = muhammara.createWriter();
    var registered = writer.retrieveJPGImageInformation("jpg");
    var direct = writer.retrieveJPGImageInformation(jpg);
    var directBuffer = writer.retrieveJPGImageInformation(jpg.buffer);
    var asyncDirect = await writer.retrieveJPGImageInformationAsync(
      new Blob([jpg]),
    );

    assert.deepEqual(direct, registered);
    assert.deepEqual(directBuffer, registered);
    assert.deepEqual(asyncDirect, registered);
    assert.ok(registered.samplesWidth > 0);
    assert.ok(registered.samplesHeight > 0);
    assert.ok(registered.colorComponentsCount > 0);
    for (var [exists, fields] of [
      ["JFIFInformationExists", ["JFIFUnit", "JFIFXDensity", "JFIFYDensity"]],
      ["ExifInformationExists", ["ExifUnit", "ExifXDensity", "ExifYDensity"]],
      [
        "PhotoshopInformationExists",
        ["PhotoshopXDensity", "PhotoshopYDensity"],
      ],
    ]) {
      assert.equal(typeof registered[exists], "boolean");
      for (var field of fields) {
        assert.equal(field in registered, registered[exists]);
      }
    }
    assert.throws(
      () => writer.retrieveJPGImageInformation(new Uint8Array([1, 2, 3])),
      /Unable to retrieve JPEG image information/,
    );
    assert.throws(
      () => writer.retrieveJPGImageInformation(png),
      /Unable to retrieve JPEG image information/,
    );
    assert.throws(
      () => writer.retrieveJPGImageInformation("missing"),
      TypeError,
    );
    writer.end();
    assert.throws(() => writer.retrieveJPGImageInformation(jpg), /ended/);
  });
});
