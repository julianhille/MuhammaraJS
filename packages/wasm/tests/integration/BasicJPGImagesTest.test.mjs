// Byte-first port of the corrupt-JPEG behavior in tests/BasicJPGImagesTest.js.
// The regular JPEG placement is ported in FormXObjectTest.test.mjs.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createMuhammaraWasm } from "../index.js";
import * as malformed from "../malformedInputs.mjs";

describe("BasicJPGImagesTest", function () {
  it("keeps decoding corrupt JPEG data without leaking the stack", async function () {
    var muhammara = await createMuhammaraWasm();
    // Each libjpeg error escaped as a bare number and leaked Wasm stack, so
    // a few reads overflowed it and later, unrelated calls crashed.
    muhammara.registerImage(
      "corrupt-jpeg",
      fs.readFileSync(
        path.join(malformed.fuzzInputs, "image-corrupt-jpeg-scan-data.bin"),
      ),
      "jpg",
    );
    var writer = muhammara.createWriter();
    var image = writer.createImageXObjectFromJPGBytes("corrupt-jpeg");
    var page = writer.createPage(0, 0, 200, 200);
    writer
      .startPageContentContext(page)
      .q()
      .cm(100, 0, 0, 100, 0, 0)
      .doXObject(image)
      .Q();
    writer.writePage(page);
    var pdf = writer.end();
    muhammara.unregisterImage("corrupt-jpeg");
    var reader = muhammara.createReader(pdf);
    var streams = 0;
    for (var round = 0; round < 50; ++round) {
      for (var id = 1; id < reader.getXrefSize(); ++id) {
        var object = reader.parseNewObject(id);
        if (object?.getType() !== muhammara.ePDFObjectStream) continue;
        var filter = reader.queryDictionaryObject(
          object.getDictionary(),
          "Filter",
        );
        if (filter?.value !== "DCTDecode") continue;
        ++streams;
        var bytes = reader.startReadingFromStream(object);
        for (var reads = 0; bytes.notEnded(); ++reads) {
          assert.ok(reads < 1000, "the stream keeps reporting unread data");
          bytes.read(65536);
        }
      }
    }
    assert.equal(streams, 50);
    // An unrelated call after the decoding errors still works.
    assert.equal(muhammara.createReader(pdf).getPagesCount(), 1);
    reader.end();
  });
});
