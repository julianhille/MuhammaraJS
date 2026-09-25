import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createMuhammaraWasm, createRecipe } from "../../index.js";
import { writeOutput } from "../testOutput.mjs";

describe("Replace text", function () {
  it("replaces text at its existing position", async function () {
    var muhammara = await createMuhammaraWasm();
    var fontBytes = new Uint8Array(
      await readFile(
        new URL(
          "../../../native-with-source/tests/TestMaterials/fonts/arial.ttf",
          import.meta.url,
        ),
      ),
    );
    muhammara.registerFont("replace-text-font", fontBytes);
    var writer = muhammara.createWriter();
    var page = writer.createPage(0, 0, 200, 200);
    writer
      .startPageContentContext(page)
      .BT()
      .Tf(writer.getFontForBytes("replace-text-font"), 12)
      .Tm(1, 0, 0, 1, 20, 30)
      .Tj("Before")
      .writeFreeCode("(caf\u00e9) Tj (1x5) Tj\n")
      .ET()
      .writeFreeCode("% caf\u00e9\n");
    writer.writePage(page);
    var source = writer.end();

    var Recipe = await createRecipe();
    var output = new Recipe(source)
      .replaceText("1.5", "x", 1)
      .replaceText("Before", "$&After", 1)
      .endPDF();
    writeOutput("replaceText", output);
    var reader = muhammara.createReader(output);
    var text = reader.extractPageText(0);

    assert.equal(text.length, 3);
    assert.equal(text[0].content, "$&After");
    assert.deepEqual(text[0].textMatrix, [1, 0, 0, 1, 20, 30]);

    var contents = reader
      .parsePage(0)
      .getDictionary()
      .toPDFDictionary()
      .queryObject("Contents");
    var streamReader = reader.startReadingFromStream(
      reader
        .parseNewObject(contents.toPDFIndirectObjectReference().getObjectID())
        .toPDFStream(),
    );
    var content = [];
    while (streamReader.notEnded()) {
      content.push(...new Uint8Array(streamReader.read(65536)));
    }
    streamReader.dispose?.();
    assert.ok(
      Buffer.from(content).includes(Buffer.from("% caf\u00e9\n")),
      "non-ASCII content bytes are preserved",
    );
    assert.ok(
      Buffer.from(content).includes(Buffer.from("(caf\u00e9) Tj (1x5) Tj\n")),
      "untouched literal strings keep their bytes",
    );
    reader.end();
    muhammara.unregisterFont("replace-text-font");
    muhammara.disposeAssets();
  });

  it("matches native validation for arguments and page content streams", async function () {
    var Recipe = await createRecipe();
    assert.throws(
      () => new Recipe().replaceText("Before", 1),
      /replaceText expects text and replacement strings/,
    );

    assert.throws(
      () => new Recipe().replaceText("Before", "After"),
      /replaceText expects a positive integer page number/,
    );
    assert.throws(
      () => new Recipe().replaceText("Before", "After", 0),
      /replaceText expects a positive integer page number/,
    );
    assert.throws(() => new Recipe().replaceText("Before", "\u20ac", 1), {
      name: "TypeError",
      message: "replaceText supports only Latin-1 text and replacement strings",
    });
    assert.throws(() => new Recipe().replaceText("\u20ac", "After", 1), {
      name: "TypeError",
      message: "replaceText supports only Latin-1 text and replacement strings",
    });

    var source = new Recipe().createPage(100, 100).endPage().endPDF();
    assert.throws(
      () => new Recipe(source).replaceText("Before", "After", 1),
      /replaceText supports pages with one content stream/,
    );
  });
});
