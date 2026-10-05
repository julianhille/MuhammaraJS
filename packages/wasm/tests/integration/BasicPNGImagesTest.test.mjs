// Byte-first port of the malformed-PNG behavior in tests/BasicPNGImagesTest.js.
// The regular PNG placement is ported in FormXObjectTest.test.mjs.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createMuhammaraWasm } from "../index.js";
import * as malformed from "../malformedInputs.mjs";

describe("BasicPNGImagesTest", function () {
  it("keeps the writer usable after a PNG ends early", async function () {
    var muhammara = await createMuhammaraWasm();
    var png = malformed.material("images", "png", "gray-alpha-8-linear.png");
    // Without IEND, libpng fails in png_read_end, after the rows were read. It
    // used to longjmp into the frame that read the rows, which had returned.
    muhammara.registerImage("no-iend", png.subarray(0, png.length - 12), "png");
    var writer = muhammara.createWriter();
    assert.throws(() => writer.createFormXObjectFromPNGBytes("no-iend"));
    writer.writePage(writer.createPage(0, 0, 200, 200));
    assert.ok(writer.end().length > 0);
    muhammara.unregisterImage("no-iend");
  });
  for (var [title, file] of [
    [
      "embeds a PNG whose rows fail to decode",
      "image-png-error-while-reading-rows.bin",
    ],
    // 60000 x 60000 RGBA with one row of data. Padding the missing rows used
    // to push 14 GB of zeros through the compressor.
    [
      "stops a PNG at the first row that fails to decode",
      "image-png-truncated-huge-dimensions.bin",
    ],
  ]) {
    it(title, async function () {
      var muhammara = await createMuhammaraWasm();
      muhammara.registerImage(
        "malformed-png",
        fs.readFileSync(path.join(malformed.fuzzInputs, file)),
        "png",
      );
      var writer = muhammara.createWriter();
      assert.throws(() =>
        writer.createFormXObjectFromPNGBytes("malformed-png"),
      );
      assert.ok(writer.end().length > 0);
    });
  }
});
