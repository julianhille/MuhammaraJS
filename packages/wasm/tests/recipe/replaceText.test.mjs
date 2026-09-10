import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createMuhammaraWasm, createRecipe } from "../../index.js";

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
      .ET();
    writer.writePage(page);
    var source = writer.end();

    var Recipe = await createRecipe();
    var output = new Recipe(source).replaceText("Before", "After").endPDF();
    var reader = muhammara.createReader(output);
    var text = reader.extractPageText(0);

    assert.equal(text.length, 1);
    assert.equal(text[0].content, "After");
    assert.deepEqual(text[0].textMatrix, [1, 0, 0, 1, 20, 30]);
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

    var source = new Recipe().createPage(100, 100).endPage().endPDF();
    assert.throws(
      () => new Recipe(source).replaceText("Before", "After"),
      /replaceText supports pages with one content stream/,
    );
  });
});
