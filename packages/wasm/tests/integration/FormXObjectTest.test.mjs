// Ports safe byte-first behavior from BasicJPGImagesTest.js, BasicPNGImagesTest.js,
// TiffImageTest.js, HighLevelImages.js, and FormXObjectTest.js.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createMuhammaraWasm } from "../index.js";

describe("FormXObjectTest", function () {
  it("matches page content operators, helpers, resources, and lifecycle", async function () {
    var muhammara = await createMuhammaraWasm();
    await muhammara.registerFont(
      "arial",
      new Uint8Array(await readFile("tests/TestMaterials/fonts/arial.ttf")),
    );
    var writer = muhammara.createWriter();
    var child = writer.createFormXObject(0, 0, 10, 10);
    child.getContentContext().re(0, 0, 10, 10).f();
    writer.endFormXObject(child);

    var form = writer.createFormXObject(0, 0, 100, 100);
    var context = form.getContentContext();
    var font = writer.getFontForBytes("arial");
    var childName = form
      .getResourcesDictionary()
      .addFormXObjectMapping(child.id);
    assert.ok(form.getResourcesDictinary());
    assert.match(childName, /^Fm/);
    assert.equal(
      context
        .RG(0.1, 0.2, 0.3)
        .rg(0.4, 0.5, 0.6)
        .K(0.1, 0.2, 0.3, 0.4)
        .J(1)
        .j(2)
        .M(3)
        .d([1, 2], 0.5)
        .m(1, 1)
        .c(2, 2, 3, 3, 4, 4)
        .v(5, 5, 6, 6)
        .y(7, 7, 8, 8)
        .h()
        .b()
        .re(1, 1, 2, 2)
        .bStar()
        .re(1, 1, 2, 2)
        .B()
        .re(1, 1, 2, 2)
        .BStar()
        .re(1, 1, 2, 2)
        .s()
        .re(1, 1, 2, 2)
        .F()
        .re(1, 1, 2, 2)
        .fStar()
        .re(1, 1, 2, 2)
        .W()
        .n()
        .re(1, 1, 2, 2)
        .WStar()
        .n()
        .setOpacity(0.5)
        .doXObject(child)
        .doXObject(childName)
        .drawPath(
          [
            [10, 10],
            [20, 20],
          ],
          { color: 0xff0000 },
        )
        .drawCircle(30, 30, 5, { type: "fill", color: 0x00ff00 })
        .drawSquare(40, 40, 5, { color: 0x0000ff })
        .drawRectangle(50, 50, 10, 5, { type: "fill", color: 0xff0000 })
        .writeText("Form", 5, 80, { font, size: 10, underline: true }),
      context,
    );
    assert.throws(() => context.setOpacity(2), /opacity value between 0 and 1/);
    assert.throws(() => context.d([1, NaN]), /finite dash array/);
    assert.throws(() => context.doXObject(form), /completed XObject/);
    writer.endFormXObject(form);
    assert.throws(() => context.f(), /content has ended/);
    assert.throws(
      () => form.getResourcesDictionary(),
      /resources are not active/,
    );

    var page = writer.createPage(0, 0, 100, 100);
    writer.startPageContentContext(page).doXObject(form);
    writer.writePage(page);
    var pdf = writer.end();
    var output = new TextDecoder().decode(pdf);
    var reader = muhammara.createReader(pdf);
    var operators = new Set();
    for (var objectId = 1; objectId < reader.getXrefSize(); ++objectId) {
      var stream = reader.parseNewObject(objectId)?.toPDFStream();
      if (!stream) continue;
      var parser = reader.startReadingObjectsFromStream(stream);
      for (var index = 0; index < 200; ++index) {
        var object = parser.parseNewObject();
        if (!object) break;
        operators.add(object.toString());
      }
      parser.end();
    }
    reader.end();
    for (var operator of [
      "b",
      "b*",
      "B",
      "B*",
      "s",
      "f*",
      "n",
      "c",
      "v",
      "y",
      "h",
      "J",
      "j",
      "M",
      "d",
      "RG",
      "rg",
      "K",
      "W",
      "W*",
      "Do",
      "BT",
      "Tj",
    ]) {
      assert.ok(
        operators.has(operator),
        `expected ${operator} content operator`,
      );
    }
    assert.match(output, /\/XObject/);
    assert.match(output, /\/ca 0.5/);
    assert.match(output, /\/CA 0.5/);
  });

  it("writes image and form XObjects from bytes", async function () {
    var muhammara = await createMuhammaraWasm();
    var loadImage = async (name, path, extension) =>
      muhammara.registerImage(
        name,
        new Uint8Array(await readFile(path)),
        extension,
      );

    await loadImage("jpg", "tests/TestMaterials/images/otherStage.JPG", "jpg");
    await loadImage(
      "png",
      "tests/TestMaterials/images/png/original.png",
      "png",
    );
    await loadImage(
      "png-transparent",
      "tests/TestMaterials/images/png/original_transparent.png",
      "png",
    );
    await loadImage(
      "png-logo",
      "tests/TestMaterials/images/png/pnglogo-grr.png",
      "png",
    );
    await loadImage(
      "png-gray-alpha",
      "tests/TestMaterials/images/png/gray-alpha-8-linear.png",
      "png",
    );
    await loadImage(
      "png-gray-16",
      "tests/TestMaterials/images/png/gray-16-linear.png",
      "png",
    );
    await loadImage(
      "tiff",
      "tests/TestMaterials/images/tiff/cramps.tif",
      "tiff",
    );

    var writer = muhammara.createWriter();
    var page = new muhammara.PDFPage(0, 0, 595, 842);
    var pageContext = writer.startPageContentContext(page);
    pageContext.q().k(100, 0, 0, 0).re(500, 0, 100, 100).f().Q();
    writer.pausePageContentContext(pageContext);

    var dimensions = writer.getImageDimensions("jpg");
    assert.ok(dimensions.width > 0);
    assert.ok(dimensions.height > 0);

    var jpgImage = writer.createImageXObjectFromJPGBytes("jpg");
    var jpgForm = writer.createFormXObjectFromJPGBytes("jpg");
    var pngForms = [
      "png",
      "png-transparent",
      "png-logo",
      "png-gray-alpha",
      "png-gray-16",
    ].map((name) => writer.createFormXObjectFromPNGBytes(name));
    var tiffForm = writer.createFormXObjectFromTIFFBytes("tiff");
    var form = writer.createFormXObject(0, 0, 200, 100);
    assert.ok(jpgImage.id > 0);
    assert.ok(jpgForm.id > 0);
    assert.ok(form.id > 0);
    var formContext = form.getContentContext();
    assert.equal(
      formContext.q().k(0, 100, 100, 0).re(0, 0, 200, 100).f().Q(),
      formContext,
    );
    assert.throws(() => pageContext.doXObject(form), TypeError);
    writer.endFormXObject(form);
    assert.throws(() => form.getContentContext(), Error);

    pageContext
      .q()
      .cm(500, 0, 0, 400, 0, 0)
      .doXObject(jpgImage)
      .Q()
      .q()
      .cm(1, 0, 0, 1, 0, 400)
      .doXObject(jpgForm)
      .Q()
      .q()
      .cm(1, 0, 0, 1, 200, 600)
      .doXObject(form)
      .Q()
      .q()
      .cm(1, 0, 0, 1, 200, 200)
      .doXObject(form)
      .Q();
    writer.writePage(page);

    for (var index = 0; index < pngForms.length; index += 1) {
      page = new muhammara.PDFPage(0, 0, 595, 842);
      pageContext = writer.startPageContentContext(page);
      pageContext
        .q()
        .cm(0.5, 0, 0, 0.5, 10, 200)
        .doXObject(pngForms[index])
        .Q();
      writer.writePage(page);
    }

    page = new muhammara.PDFPage(0, 0, 595, 842);
    pageContext = writer.startPageContentContext(page);
    pageContext.q().cm(1, 0, 0, 1, 10, 10).doXObject(tiffForm).Q();
    writer.writePage(page);

    var pdf = writer.end();
    assert.ok(pdf instanceof Uint8Array);
    assert.match(new TextDecoder().decode(pdf), /\/XObject/);
    var reader = muhammara.createReader(pdf);
    assert.equal(reader.getPagesCount(), 7);
    reader.end();
  });
});
