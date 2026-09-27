import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createMuhammaraWasm, createRecipe } from "../index.js";
import { writeOutput } from "../testOutput.mjs";

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
      writeOutput("MemoryLifecycle-wasm-binary", pdf);
      assert.equal(new TextDecoder().decode(pdf.subarray(0, 5)), "%PDF-");
    }

    var Recipe = await createRecipe({
      wasmBinary: bytes,
      locateFile,
      defaultFont: false,
    });
    var recipePdf = new Recipe().createPage("A4").endPage().endPDF();
    writeOutput("MemoryLifecycle-wasm-binary-recipe", recipePdf);
    assert.ok(recipePdf.length > 0);

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
    writeOutput("MemoryLifecycle-release-source", source);

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
    writeOutput(
      "MemoryLifecycle-release-compact-modifier",
      compact.startPage(0).endPage().end(),
    );
    assert.throws(
      () => muhammara.createModifier(new Uint8Array([1, 2, 3])),
      /Unable to modify PDF/,
    );

    var modifier = muhammara.createWriterToModify(source);
    modifier.dispose();
    modifier = muhammara.createWriterToModify(source);
    writeOutput("MemoryLifecycle-release-modifier", modifier.end());
    assert.throws(
      () => muhammara.createWriterToModify(new Uint8Array([1, 2, 3])),
      /Unable to modify PDF/,
    );

    var writer = muhammara.createWriter();
    var copying = writer.createPDFCopyingContext(source);
    // Like native, end() releases copying contexts left open.
    var copyingOutput = writer.end();
    writeOutput("MemoryLifecycle-release-copying-writer", copyingOutput);
    assert.ok(copyingOutput.length > 0);
    assert.throws(() => copying.copyObject(1), /ended|released|context/i);
    assert.throws(() => writer.end(), /PDF writer has ended/);

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
    writeOutput("MemoryLifecycle-recipe-assets", recipe.endPDF());

    var abandoned = new Recipe();
    abandoned.dispose();
  });

  it("releases open pages and edited pages on dispose()", async function () {
    var Recipe = await createRecipe();
    var source = new Uint8Array(
      await readFile("tests/TestMaterials/Original.pdf"),
    );
    // Each open page used to keep its content stream, about 0.5 MB, so the
    // 512 MB heap aborted after roughly a thousand disposed Recipes.
    for (var index = 0; index < 1200; index += 1) {
      new Recipe().createPage("A4").text("open page", 10, 10).dispose();
      new Recipe(source).editPage(1).text("edited", 10, 10).dispose();
    }
    var pdf = new Recipe().createPage("A4").text("after", 10, 10).endPage();
    assert.ok(pdf.endPDF().length > 0);
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
    assert.throws(() => writer.end(), /active objects context operation/);
    objects.endIndirectObject();
    var output = writer.end();
    writeOutput("MemoryLifecycle-open-indirect-object", output);
    assert.ok(output.length > 0);

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
    var pdf = writer.end();
    writeOutput("MemoryLifecycle-raw-stream", pdf);
    var output = new TextDecoder().decode(pdf);
    assert.equal((output.match(/endobj/g) || []).length, 3);
  });
});
