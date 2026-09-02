// Port of the page box and rotation behavior in tests/PageBoxes.js.
import assert from "node:assert/strict";
import { createMuhammaraWasm } from "../index.js";

describe("PageBoxes", function () {
  it("writes page boxes and rotation", async function () {
    var muhammara = await createMuhammaraWasm();
    var page = new muhammara.PDFPage(0, 0, 595, 842);
    assert.equal(page.cropBox, undefined);
    assert.equal(page.bleedBox, undefined);
    assert.equal(page.trimBox, undefined);
    assert.equal(page.artBox, undefined);
    assert.equal(page.rotate, undefined);
    page.cropBox = [1, 1, 594, 841];
    page.bleedBox = [2, 2, 593, 840];
    page.trimBox = [3, 3, 592, 839];
    page.artBox = [4, 4, 591, 838];
    page.rotate = 90;

    var writer = muhammara.createWriter();
    writer.startPageContentContext(page).n();
    writer.writePage(page);
    var reader = muhammara.createReader(writer.end());
    assert.deepEqual(reader.getPageBox(0, "media"), [0, 0, 595, 842]);
    assert.deepEqual(reader.getPageBox(0, "crop"), [1, 1, 594, 841]);
    assert.deepEqual(reader.getPageBox(0, "bleed"), [2, 2, 593, 840]);
    assert.deepEqual(reader.getPageBox(0, "trim"), [3, 3, 592, 839]);
    assert.deepEqual(reader.getPageBox(0, "art"), [4, 4, 591, 838]);
    assert.equal(reader.getPageInfo(0).rotate, 90);
    reader.end();
  });
});
