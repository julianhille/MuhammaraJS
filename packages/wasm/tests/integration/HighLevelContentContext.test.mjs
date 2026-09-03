// Port of the supported behavior in tests/HighLevelContentContext.js.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createMuhammaraWasm } from "../index.js";

describe("HighLevelContentContext", function () {
  it("draws shapes and text with byte-registered fonts", async function () {
    var muhammara = await createMuhammaraWasm();
    muhammara.registerFont(
      "arial",
      new Uint8Array(await readFile("tests/TestMaterials/fonts/arial.ttf")),
    );
    var writer = muhammara.createWriter();
    writer.getObjectsContext().setCompressStreams(false);
    var page = writer.createPage(0, 0, 595, 842);
    var context = writer.startPageContentContext(page);
    var font = writer.getFontForBytes("arial");
    var fill = { color: 0xff000000, colorspace: "cmyk", type: "fill" };
    var stroke = { color: "DarkMagenta", width: 4 };
    var text = {
      font,
      size: 14,
      colorspace: "gray",
      color: 0,
      underline: true,
    };

    assert.equal(
      context.drawPath(
        [
          [75, 640],
          [149, 800],
          [225, 640],
        ],
        fill,
      ),
      context,
    );
    assert.equal(
      context.drawPath(75, 540, 110, 440, 149, 540, 188, 440, 223, 540, stroke),
      context,
    );
    assert.equal(context.drawSquare(375, 640, 120, fill), context);
    assert.equal(context.drawRectangle(375, 220, 50, 160, stroke), context);
    assert.equal(context.drawCircle(149, 300, 80, fill), context);
    assert.equal(context.writeText("Shapes", 75, 805, text), context);
    context.q().setOpacity(0.5).writeText("Transparent", 75, 370, text).Q();
    writer.writePage(page);

    var pdf = writer.end();
    var output = new TextDecoder().decode(pdf);
    assert.match(output, /\/ca 0.5/);
    assert.match(output, /\/CA 0.5/);
    assert.match(output, /75 640 m/);
    assert.match(output, /149 800 l/);
    assert.match(output, /225 640 l/);
    assert.match(output, /75 540 m/);
    assert.match(output, /223 540 l/);
    var reader = muhammara.createReader(pdf);
    assert.equal(reader.getPagesCount(), 1);
    reader.end();
  });

  it("rejects invalid opacity values with the Node error message", async function () {
    var muhammara = await createMuhammaraWasm();
    var writer = muhammara.createWriter();
    var page = writer.createPage();
    var context = writer.startPageContentContext(page);
    var message =
      /Wrong Argument, please provide 1 opacity value between 0 and 1/;

    assert.throws(() => context.setOpacity(), message);
    assert.throws(() => context.setOpacity("0.5"), message);
    assert.throws(() => context.setOpacity(NaN), message);
    assert.throws(() => context.setOpacity(-0.1), message);
    assert.throws(() => context.setOpacity(1.1), message);
    writer.writePage(page);
    writer.end();
  });

  it("rejects invalid drawPath arguments", async function () {
    var muhammara = await createMuhammaraWasm();
    var writer = muhammara.createWriter();
    var page = writer.createPage();
    var context = writer.startPageContentContext(page);

    assert.throws(() => context.drawPath(), /coordinate pairs/);
    assert.throws(() => context.drawPath([[0, 0]]), /at least two/);
    assert.throws(
      () =>
        context.drawPath([
          [0, 0],
          [1, Number.NaN],
        ]),
      /finite numbers/,
    );
    assert.throws(() => context.drawPath(0, 0, 1, 1), /options object/);
    assert.throws(
      () => context.drawPath(0, 0, 1, 1, "stroke"),
      /options object/,
    );
    writer.writePage(page);
    writer.end();
  });
});
