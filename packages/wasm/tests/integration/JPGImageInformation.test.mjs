// Byte-first port of PDFWriter.retrieveJPGImageInformation behavior.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createMuhammaraWasm } from "../index.js";
import { writeOutput } from "../testOutput.mjs";

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
    writeOutput("JPGImageInformation", writer.end());
    assert.throws(() => writer.retrieveJPGImageInformation(jpg), /ended/);
  });

  for (var [kind, file, width, height, components, w, h] of [
    // otherStage.JPG is 180 dpi, so it measures 72/180 of its samples.
    ["baseline", "images/otherStage.JPG", 1600, 1200, 3, 640, 480],
    ["baseline Adobe", "images/soundcloud_logo.jpg", 550, 350, 3, 550, 350],
    ["progressive", "recipe/myCats.jpg", 720, 960, 3, 720, 960],
    ["grayscale", "images/grayscale.jpg", 40, 30, 1, 40, 30],
    ["CMYK", "images/cmyk.jpg", 36, 24, 4, 36, 24],
  ]) {
    it(`reads the size and components of a ${kind} JPEG`, async function () {
      var muhammara = await createMuhammaraWasm();
      muhammara.registerImage(
        "jpg",
        new Uint8Array(await readFile(`tests/TestMaterials/${file}`)),
        "jpg",
      );
      var writer = muhammara.createWriter();
      var information = writer.retrieveJPGImageInformation("jpg");

      assert.equal(information.samplesWidth, width);
      assert.equal(information.samplesHeight, height);
      assert.equal(information.colorComponentsCount, components);
      assert.deepEqual(writer.getImageDimensions("jpg"), {
        width: w,
        height: h,
      });
      writer.end();
    });
  }
});
