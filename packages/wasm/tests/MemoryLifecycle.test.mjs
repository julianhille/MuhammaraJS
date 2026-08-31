import assert from "node:assert/strict";
import { createMuhammaraWasm, createRecipe } from "../index.js";

describe("MemoryLifecycle", function () {
  it("enforces runtime byte budgets without exposing the module", async function () {
    var inputLimited = await createMuhammaraWasm({
      limits: { maxInputBytes: 2 },
    });
    assert.equal("_module" in inputLimited, false);
    assert.throws(
      () => inputLimited.createReader(new Uint8Array(3)),
      /maxInputBytes/,
    );

    var outputLimited = await createMuhammaraWasm({
      limits: { maxOutputBytes: 10 },
    });
    assert.throws(() => outputLimited.createBlankPdf(10, 10), /maxOutputBytes/);
  });

  it("releases temporary PDF files and copying contexts", async function () {
    var muhammara = await createMuhammaraWasm();
    assert.equal("_module" in muhammara, false);
    var source = muhammara.createBlankPdf(100, 100);

    var reader = muhammara.createReader(source);
    reader.end();
    assert.throws(
      () => muhammara.createReader(new Uint8Array([1, 2, 3])),
      /Unable to parse PDF/,
    );

    var compact = muhammara.createModifier(source);
    compact.dispose();
    compact = muhammara.createModifier(source);
    compact.startPage(0).endPage().end();
    assert.throws(
      () => muhammara.createModifier(new Uint8Array([1, 2, 3])),
      /Unable to modify PDF/,
    );

    var modifier = muhammara.createWriterToModify(source);
    modifier.dispose();
    modifier = muhammara.createWriterToModify(source);
    modifier.end();
    assert.throws(
      () => muhammara.createWriterToModify(new Uint8Array([1, 2, 3])),
      /Unable to modify PDF/,
    );

    var writer = muhammara.createWriter();
    var copying = writer.createPDFCopyingContext(source);
    assert.throws(() => writer.end(), /active page/);
    copying.end();
    writer.end();

    var abandonedWriter = muhammara.createWriter();
    abandonedWriter.createPDFCopyingContext(source);
    abandonedWriter.dispose();

    var imageWriter = muhammara.createWriter();
    var imagePage = imageWriter.createPage(0, 0, 100, 100);
    imageWriter
      .startPageContentContext(imagePage)
      .drawImage(0, 0, new Uint8Array([0xff, 0xd8, 0xff, 0xd9]));
    imageWriter.dispose();

    var abandonedModifier = muhammara.createWriterToModify(source);
    abandonedModifier.createPDFCopyingContext(source);
    abandonedModifier.dispose();
  });

  it("releases replaced and unregistered low-level assets", async function () {
    var muhammara = await createMuhammaraWasm();
    assert.equal("_module" in muhammara, false);
    var bytes = new Uint8Array([1, 2, 3]);

    muhammara.registerFont("font", bytes);
    muhammara.registerFont("font", bytes);
    assert.equal(muhammara.unregisterFont("font"), true);
    assert.equal(muhammara.unregisterFont("font"), false);

    muhammara.registerImage("image", bytes, "png");
    muhammara.registerImage("image", bytes, "png");
    assert.equal(muhammara.unregisterImage("image"), true);
    assert.equal(muhammara.unregisterImage("image"), false);

    muhammara.registerPdf("pdf", bytes);
    muhammara.registerPdf("pdf", bytes);
    muhammara.disposeAssets();
    assert.equal(muhammara.unregisterPdf("pdf"), false);
  });

  it("releases replaced and disposed Recipe assets", async function () {
    var Recipe = await createRecipe();
    var recipe = new Recipe();
    assert.equal("_module" in recipe, false);
    var bytes = new Uint8Array([1, 2, 3]);

    Recipe.registerFont("font", bytes);
    Recipe.registerFont("font", bytes);
    assert.equal(Recipe.unregisterFont("font"), true);
    assert.equal(Recipe.unregisterFont("font"), false);

    Recipe.registerImage("image", bytes, "png");
    Recipe.registerImage("image", bytes, "png");
    Recipe.registerPdf("pdf", bytes);
    Recipe.registerPdf("pdf", bytes);
    Recipe.disposeAssets();
    assert.equal(Recipe.unregisterImage("image"), false);
    assert.equal(Recipe.unregisterPdf("pdf"), false);
    recipe.endPDF();

    var abandoned = new Recipe();
    abandoned.dispose();
  });

  it("releases completed raw-object wrappers with their writer", async function () {
    var muhammara = await createMuhammaraWasm();
    var writer = muhammara.createWriter();
    var objects = writer.getObjectsContext();
    for (var index = 0; index < 100; index += 1) {
      objects.startNewIndirectObject();
      var dictionary = objects.startDictionary();
      dictionary.writeKey("Value").writeNumberValue(index);
      objects.endDictionary(dictionary).endIndirectObject();
    }
    writer.dispose();
  });

  it("rejects finalization with an open indirect object", async function () {
    var muhammara = await createMuhammaraWasm();
    var writer = muhammara.createWriter();
    var objects = writer.getObjectsContext();
    objects.startNewIndirectObject();
    assert.throws(() => writer.end(), /active page/);
    objects.endIndirectObject();
    assert.ok(writer.end().length > 0);

    var abandoned = muhammara.createWriter();
    abandoned.getObjectsContext().startNewIndirectObject();
    abandoned.dispose();
  });

  it("disposes an active raw stream without writing a second indirect-object end", async function () {
    var muhammara = await createMuhammaraWasm();
    var writer = muhammara.createWriter();
    var objects = writer.getObjectsContext();
    objects.startNewIndirectObject();
    var stream = objects.startPDFStream();
    stream.getWriteStream().write(new Uint8Array([37, 32, 114, 97, 119, 10]));
    writer.dispose();
  });
});
