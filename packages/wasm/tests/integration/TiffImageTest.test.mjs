// Byte-first port of the malformed-tile behavior in tests/TiffImageTest.js.
// The regular TIFF placement is ported in FormXObjectTest.test.mjs.
import assert from "node:assert/strict";
import { createMuhammaraWasm } from "../index.js";
import * as malformed from "../malformedInputs.mjs";

describe("TiffImageTest", function () {
  it("frees the tile buffer of a TIFF tile that fails to decode", async function () {
    var muhammara = await createMuhammaraWasm();
    var tiff = malformed.material("images", "tiff", "quad-tile.tif");
    // Garble LZW data in the middle of tile 9, as the fuzzer did.
    tiff.writeUInt32BE(0xffffffff, 155530 + 14550);
    var writer = muhammara.createWriter();
    assert.throws(() => writer.createFormXObjectFromTIFF(tiff));
    writer.end();
  });
});
