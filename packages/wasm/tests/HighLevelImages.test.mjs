// Byte-first port of tests/HighLevelImages.js.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createMuhammaraWasm } from "../index.js";

async function fixture(path) {
  return new Uint8Array(await readFile(`tests/TestMaterials/${path}`));
}

describe("HighLevelImages", function () {
  it("draws registered and direct image assets in page, form, and modifier contexts", async function () {
    var muhammara = await createMuhammaraWasm();
    var jpg = await fixture("images/soundcloud_logo.jpg");
    var png = await fixture("images/png/original.png");
    var tiff = await fixture("images/tiff/multipage.tif");
    muhammara.registerImage("jpg", jpg, "jpg");
    muhammara.registerImage("png", png, "png");
    muhammara.registerImage("multipage", tiff, "tiff");

    var source = muhammara.createWriter();
    source.writePage(source.createPage());
    source.writePage(source.createPage());
    var sourcePdf = source.end();
    muhammara.registerPdf("source", sourcePdf);

    var writer = muhammara.createWriter();
    var page = writer.createPage();
    var context = writer.startPageContentContext(page);
    assert.equal(context.drawImage(10, 10, "jpg"), context);
    assert.equal(
      await context.drawImageAsync(10, 55, new Blob([jpg])),
      context,
    );
    context.drawImage(10, 100, tiff, { index: 2 });
    context.drawImage(100, 10, jpg, {
      transformation: [0.25, 0, 0, 0.25, 0, 0],
    });
    context.drawImage(200, 10, "source", {
      index: 1,
      transformation: { width: 100, height: 100 },
    });
    context.drawImage(320, 10, sourcePdf, {
      transformation: {
        width: 100,
        height: 100,
        proportional: true,
        fit: "always",
      },
    });
    writer.writePage(page);

    var form = writer.createFormXObject(0, 0, 100, 100);
    form.getContentContext().drawImage(0, 0, "png", {
      transformation: { width: 80, height: 80, proportional: true },
    });
    await form.getContentContext().drawImageAsync(0, 0, new Blob([png]));
    writer.endFormXObject(form);
    page = writer.createPage();
    writer.startPageContentContext(page).doXObject(form);
    writer.writePage(page);
    var output = writer.end();
    assert.match(new TextDecoder().decode(output), /\/XObject/);
    var reader = muhammara.createReader(output);
    assert.equal(reader.getPagesCount(), 2);
    reader.end();
    assert.throws(() => context.drawImage(0, 0, "jpg"), /not active/);

    var modifier = muhammara.createWriterToModify(output);
    var modifiedPage = modifier.createPageModifier(0);
    var modifierContext = modifiedPage.startContext().getContext();
    modifierContext.drawImage(20, 20, png, {
      transformation: { width: 60, height: 60 },
    });
    await modifierContext.drawImageAsync(90, 20, new Blob([png]));
    modifiedPage.endContext().writePage();
    var modified = modifier.end();
    reader = muhammara.createReader(modified);
    assert.equal(reader.getPagesCount(), 2);
    reader.end();
    assert.throws(() => modifierContext.drawImage(0, 0, "jpg"), /ended/);
  });

  it("rejects invalid drawImage inputs and stale modifier contexts", async function () {
    var muhammara = await createMuhammaraWasm();
    muhammara.registerImage(
      "jpg",
      await fixture("images/soundcloud_logo.jpg"),
      "jpg",
    );
    var writer = muhammara.createWriter();
    var page = writer.createPage();
    var context = writer.startPageContentContext(page);
    assert.throws(() => context.drawImage(NaN, 0, "jpg"), TypeError);
    assert.throws(
      () => context.drawImage(0, 0, "missing"),
      /Unknown image asset/,
    );
    assert.throws(
      () => context.drawImage(0, 0, "jpg", { index: -1 }),
      RangeError,
    );
    assert.throws(
      () => context.drawImage(0, 0, "jpg", { password: "x" }),
      /password/,
    );
    assert.throws(() => context.drawImage(0, 0, "jpg", { path: "x" }), /path/);
    assert.throws(
      () => context.drawImage(0, 0, "jpg", { stream: {} }),
      /stream/,
    );
    assert.throws(
      () => context.drawImage(0, 0, "jpg", { transformation: [1, 0] }),
      /six finite numbers/,
    );
    assert.throws(
      () =>
        context.drawImage(0, 0, "jpg", {
          transformation: { width: 0, height: 1 },
        }),
      RangeError,
    );
    writer.writePage(page);
    var input = writer.end();

    var modifier = muhammara.createWriterToModify(input);
    var pageModifier = modifier.createPageModifier(0);
    var modifierContext = pageModifier.startContext().getContext();
    modifierContext.drawImage(0, 0, "jpg");
    pageModifier.endContext().writePage();
    var modified = modifier.end();
    var reader = muhammara.createReader(modified);
    assert.equal(reader.getPagesCount(), 1);
    reader.end();
    assert.throws(() => modifierContext.drawImage(0, 0, "jpg"), /ended/);
  });
});
