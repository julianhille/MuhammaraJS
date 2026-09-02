import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createMuhammaraWasm } from "../index.js";

describe("ModifierContentContext", function () {
  it("matches page and form helpers, resource names, and line join 3", async function () {
    var muhammara = await createMuhammaraWasm();
    var sourceWriter = muhammara.createWriter();
    sourceWriter.writePage(sourceWriter.createPage(0, 0, 100, 100));
    var source = sourceWriter.end();

    var modifier = muhammara.createWriterToModify(source);
    modifier.getObjectsContext().setCompressStreams(false);
    var form = modifier.createFormXObject(0, 0, 10, 10).end();
    assert.throws(
      () => modifier.createPageModifier(-1),
      /non-negative 32-bit integer/,
    );
    assert.throws(() => modifier.createPageModifier(0, 1), /must be a boolean/);
    var pageModifier = modifier
      .createPageModifier(undefined, true)
      .startContext();
    var context = pageModifier.getContext();
    var resources = pageModifier.getResourcesDictionary();
    var fontName = resources.addFontMapping(1);
    var formName = resources.addFormXObjectMapping(form.id);

    assert.equal(
      context
        .j(3)
        .setOpacity(0.5)
        .doXObject(formName)
        .doXObject(form)
        .drawPath(
          [
            [1, 1],
            [2, 2],
          ],
          { color: 0xff0000, close: true },
        )
        .drawCircle(10, 10, 5, { type: "fill", color: 0x00ff00 })
        .drawSquare(20, 20, 5, { color: 0x0000ff })
        .drawRectangle(30, 30, 10, 5, { type: "fill", color: 0xff0000 })
        .BT()
        .Tf(fontName, 10)
        .Tm(1, 0, 0, 1, 5, 5)
        .Tj("named", { encoding: "code" })
        .ET(),
      context,
    );

    pageModifier.endContext();
    assert.throws(() => context.f(), /not active/);
    assert.throws(() => resources.addFontMapping(2), /not active/);
    pageModifier.writePage();

    var output = new TextDecoder().decode(modifier.end());
    assert.match(output, /3 j/);
    assert.match(output, /\/ca 0.5/);
    assert.match(output, /\/CA 0.5/);
    assert.match(output, new RegExp(`/${fontName} 10 Tf`));
    assert.match(output, /1 1 m/);
    assert.match(output, /15 12\.7614/);
    assert.match(output, /20 20 5 5 re/);
    assert.match(output, /30 30 10 5 re/);
  });

  it("accepts mapped font names on page and form contexts", async function () {
    var muhammara = await createMuhammaraWasm();
    var writer = muhammara.createWriter();
    writer.getObjectsContext().setCompressStreams(false);
    var form = writer.createFormXObject(0, 0, 100, 100);
    var formName = form.getResourcesDictionary().addFontMapping(1);
    form
      .getContentContext()
      .BT()
      .Tf(formName, 10)
      .Tm(1, 0, 0, 1, 5, 5)
      .Tj("form", { encoding: "code" })
      .ET();
    writer.endFormXObject(form);

    var page = writer.createPage(0, 0, 100, 100);
    var pageContext = writer.startPageContentContext(page);
    var pageName = page.getResourcesDictionary().addFontMapping(1);
    pageContext
      .j(3)
      .BT()
      .Tf(pageName, 10)
      .Tm(1, 0, 0, 1, 5, 5)
      .Tj("page", { encoding: "code" })
      .ET();
    writer.writePage(page);

    var output = new TextDecoder().decode(writer.end());
    assert.match(output, /3 j/);
    assert.match(output, new RegExp(`/${formName} 10 Tf`));
    assert.match(output, new RegExp(`/${pageName} 10 Tf`));
  });

  it("gives modifier-created forms and pages byte-safe writer lifecycle access", async function () {
    var muhammara = await createMuhammaraWasm();
    muhammara.registerFont(
      "arial",
      new Uint8Array(await readFile("tests/TestMaterials/fonts/arial.ttf")),
    );
    var sourceWriter = muhammara.createWriter();
    sourceWriter.writePage(sourceWriter.createPage(0, 0, 100, 100));
    var modifier = muhammara.createWriterToModify(sourceWriter.end());
    modifier.getObjectsContext().setCompressStreams(false);
    var id = modifier.getObjectsContext().allocateNewObjectID();
    var form = modifier.createFormXObject(0, 0, 10, 10, id);
    assert.equal(form.id, id);
    form.getResourcesDictionary().addFontMapping(1);
    form.getContentContext().q().rg(1, 0, 0).re(1, 1, 5, 5).f().Q();
    assert.equal(
      form
        .getContentStream()
        .getWriteStream()
        .write(new Uint8Array([10])),
      1,
    );
    form.end();
    assert.throws(() => form.getContentContext(), /not writable/);

    var page = modifier.createPage(0, 0, 10, 10);
    var context = modifier.startPageContentContext(page);
    assert.equal(context.getAssociatedPage(), page);
    assert.equal(
      context
        .getCurrentPageContentStream()
        .getWriteStream()
        .write(new Uint8Array([10])),
      1,
    );
    context.writeText("text", 1, 1, {
      font: modifier.getFontForBytes("arial"),
      size: 5,
      color: 0xff000000,
      colorspace: "cmyk",
      underline: true,
    });
    modifier.writePage(page);
    assert.match(new TextDecoder().decode(modifier.end()), /1 0 0 0 k/);
  });

  it("gives modifier forms the complete writer content surface", async function () {
    var muhammara = await createMuhammaraWasm();
    var jpg = new Uint8Array(
      await readFile("tests/TestMaterials/images/soundcloud_logo.jpg"),
    );
    muhammara.registerImage("jpg", jpg, "jpg");
    muhammara.registerFont(
      "arial",
      new Uint8Array(await readFile("tests/TestMaterials/fonts/arial.ttf")),
    );
    var sourceWriter = muhammara.createWriter({ compress: false });
    sourceWriter.writePage(sourceWriter.createPage(0, 0, 100, 100));
    var modifier = muhammara.createWriterToModify(sourceWriter.end());
    modifier.getObjectsContext().setCompressStreams(false);
    var form = modifier.createFormXObject(0, 0, 100, 100);
    var context = form.getContentContext();
    var font = modifier.getFontForBytes("arial");
    var resources = form.getResourcesDictionary();
    var names = {
      font: resources.addFontMapping(1),
      gs: resources.addExtGStateMapping(2),
      colorSpace: resources.addColorSpaceMapping(3),
      pattern: resources.addPatternMapping(4),
    };
    assert.equal(
      context
        .q()
        .cm(1, 0, 0, 1, 1, 1)
        .w(1)
        .J(1)
        .j(2)
        .M(4)
        .d([1, 2], 0)
        .g(0.5)
        .G(0.5)
        .rg(1, 0, 0)
        .RG(0, 1, 0)
        .k(0, 0, 0, 1)
        .K(0, 0, 0, 1)
        .m(1, 1)
        .l(2, 2)
        .c(2, 3, 3, 4, 4, 4)
        .v(4, 5, 5, 5)
        .y(5, 6, 6, 6)
        .h()
        .re(1, 1, 2, 2)
        .W()
        .WStar()
        .n()
        .setOpacity(0.5)
        .ri("RelativeColorimetric")
        .i(1)
        .gs(names.gs)
        .CS(names.colorSpace)
        .cs(names.colorSpace)
        .SC(0.1, 0.2, 0.3)
        .SCN([0.1, 0.2, 0.3], names.pattern)
        .sc(0.1, 0.2, 0.3)
        .scn(0.1, 0.2, 0.3, names.pattern)
        .drawPath(
          [
            [1, 1],
            [2, 2],
          ],
          { close: true },
        )
        .drawCircle(10, 10, 2)
        .drawSquare(20, 20, 2)
        .drawRectangle(30, 30, 2, 2)
        .drawImage(1, 1, "jpg")
        .BT()
        .Tf(font, 10)
        .Tm(1, 0, 0, 1, 1, 1)
        .Tc(1)
        .Tw(1)
        .Tz(100)
        .TL(12)
        .Tr(0)
        .Ts(1)
        .Tj("text", { encoding: "code" })
        .Quote("text")
        .DoubleQuote(1, 1, "text")
        .TJ("text", -10, "text")
        .Td(1, 1)
        .TD(1, 1)
        .TStar()
        .ET()
        .Q(),
      context,
    );
    assert.equal(await context.drawImageAsync(1, 1, new Blob([jpg])), context);
    assert.ok(modifier.getFontForBytes("arial").getFontMetrics(12).height > 0);
    assert.equal(modifier.endFormXObject(form), modifier);
    assert.throws(() => context.f(), /Unable to apply form operator/);
    assert.throws(() => resources.addFontMapping(5), /no longer active/);
    assert.throws(() => modifier.endFormXObject(form), /open form/);
    var pageModifier = modifier.createPageModifier(0).startContext();
    pageModifier.getContext().doXObject(form);
    pageModifier.endContext().writePage();
    assert.match(new TextDecoder().decode(modifier.end()), /\/XObject/);
  });
});
