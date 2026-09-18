import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

  it("instantiates from caller-supplied wasmBinary bytes", async function () {
    var bytes = await readFile(
      new URL("../../dist/muhammara-wasm.wasm", import.meta.url),
    );
    var locateFile = (path) =>
      path.endsWith(".wasm") ? "/nonexistent/muhammara-wasm.wasm" : path;

    var buffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.length,
    );
    for (var wasmBinary of [new Uint8Array(bytes), buffer]) {
      var muhammara = await createMuhammaraWasm({
        wasmBinary,
        locateFile,
        limits: { maxInputBytes: 1 },
      });
      var pdf = muhammara.createBlankPdf(100, 100);
      assert.equal(new TextDecoder().decode(pdf.subarray(0, 5)), "%PDF-");
    }

    var Recipe = await createRecipe({
      wasmBinary: bytes,
      locateFile,
      defaultFont: false,
    });
    assert.ok(new Recipe().createPage("A4").endPage().endPDF().length > 0);

    for (var invalid of [
      new Uint16Array(buffer, 0, buffer.byteLength >>> 1),
      new DataView(buffer),
      new Blob([bytes]),
      "muhammara-wasm.wasm",
    ]) {
      await assert.rejects(
        createMuhammaraWasm({ wasmBinary: invalid }),
        new TypeError("wasmBinary must be a Uint8Array or ArrayBuffer"),
      );
    }
  });

  it("releases temporary PDF files and copying contexts", async function () {
    var muhammara = await createMuhammaraWasm();
    assert.equal("_module" in muhammara, false);
    var source = muhammara.createBlankPdf(100, 100);

    var reader = muhammara.createReader(source);
    var parserStream = reader.getParserStream();
    for (var index = 0; index < 100; index += 1) {
      parserStream.dispose();
      parserStream = reader.getParserStream();
    }
    parserStream.dispose();
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
    assert.throws(() => objects.startNewIndirectObject(), /writer/);
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

  it("ends raw streams without writing a second indirect-object end", async function () {
    var muhammara = await createMuhammaraWasm();
    var writer = muhammara.createWriter();
    var objects = writer.getObjectsContext();
    objects.startNewIndirectObject();
    var stream = objects.startPDFStream();
    stream.getWriteStream().write(new Uint8Array([37, 32, 114, 97, 119, 10]));
    objects.endPDFStream(stream).endIndirectObject();
    var output = new TextDecoder().decode(writer.end());
    assert.equal((output.match(/endobj/g) || []).length, 3);
  });
});
