// Byte-first port of tests/PDFTextExtractionTest.js.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createMuhammaraWasm } from "../index.js";

describe("PDFTextExtraction", function () {
  it("returns text operations and their active text state", async function () {
    var muhammara = await createMuhammaraWasm();
    var writer = muhammara.createWriter({ compress: false });
    var page = writer.createPage(0, 0, 200, 200);
    writer
      .startPageContentContext(page)
      .writeFreeCode(
        "BT /F1 12 Tf 1 0 0 1 25 50 Tm (first) Tj 1 0 0 1 25 75 Tm (second) Tj ET",
      );
    writer.writePage(page);

    var reader = muhammara.createReader(writer.end());
    var elements = reader.extractPageText(0);

    assert.deepEqual(
      elements.map((element) => element.content),
      ["first", "second"],
    );
    assert.equal(elements[0].fontResource, "F1");
    assert.equal(elements[0].fontSize, 12);
    assert.deepEqual(elements[0].textMatrix, [1, 0, 0, 1, 25, 50]);
    assert.deepEqual(elements[1].textMatrix, [1, 0, 0, 1, 25, 75]);

    reader.end();
    assert.throws(() => reader.extractPageText(0), /PDF reader has ended/);
  });

  it("decodes Unicode text through the page font", async function () {
    var fixtures = new URL(
      "../../../native-with-source/tests/TestMaterials/",
      import.meta.url,
    );
    var muhammara = await createMuhammaraWasm();
    muhammara.registerFont(
      "text-extraction-font",
      new Uint8Array(await readFile(new URL("fonts/arial.ttf", fixtures))),
    );
    var writer = muhammara.createWriter();
    var page = writer.createPage(0, 0, 200, 200);
    writer
      .startPageContentContext(page)
      .writeFreeCode("BT (no font) Tj ET\n")
      .BT()
      .Tf(writer.getFontForBytes("text-extraction-font"), 12)
      .Tj("plain")
      .Tj("café Ωmega")
      .ET();
    writer.writePage(page);

    var reader = muhammara.createReader(writer.end());
    var elements = reader.extractPageText(0);
    reader.end();

    assert.deepEqual(
      elements.map((element) => element.text),
      ["no font", "plain", "café Ωmega"],
    );
    assert.equal(elements[2].content.length, 20, "content keeps raw codes");

    var differences = new Uint8Array(
      await readFile(new URL("FontDifferences.pdf", fixtures)),
    );
    reader = muhammara.createReader(differences);
    assert.deepEqual(
      reader
        .extractPageText(0)
        .map((element) => [element.content, element.text]),
      [
        ["cafB", "café"],
        ["A of B", "Ω of é"],
      ],
    );
    reader.end();

    var modifier = muhammara.createWriterToModify(differences);
    var parser = modifier.getModifiedFileParser();
    assert.equal(parser.extractPageText(0)[0].text, "café");
    parser.end();
    var copyingContext = modifier.createPDFCopyingContextForModifiedFile();
    assert.equal(
      copyingContext.getSourceDocumentParser().extractPageText(0)[1].text,
      "Ω of é",
    );
    copyingContext.end();
    modifier.end();
    muhammara.unregisterFont("text-extraction-font");
    muhammara.disposeAssets();
  });

  it("skips inline image payloads", async function () {
    var muhammara = await createMuhammaraWasm();
    var writer = muhammara.createWriter({ compress: false });
    var page = writer.createPage(0, 0, 200, 200);
    writer
      .startPageContentContext(page)
      .writeFreeCode(
        "BI /W 4 /H 1 /BPC 8 /CS /G ID BT (fabricated) Tj ET EI BT (real) Tj ET",
      );
    writer.writePage(page);

    var reader = muhammara.createReader(writer.end());
    var elements = reader.extractPageText(0);
    reader.end();

    assert.deepEqual(
      elements.map((element) => element.content),
      ["real"],
    );
  });

  it("tracks text and line positioning matrices", async function () {
    var muhammara = await createMuhammaraWasm();
    var writer = muhammara.createWriter({ compress: false });
    var page = writer.createPage(0, 0, 200, 200);
    writer
      .startPageContentContext(page)
      .writeFreeCode(
        "BT 0 1 -1 0 90 80 Tm (rotated) Tj 10 20 Td (relative) Tj ET " +
          "BT (reset) Tj 10 20 Td (td) Tj 5 -4 TD (TD) Tj T* (star) Tj " +
          "6 TL T* (leading) Tj (quote) ' 1 2 (double-quote) \" ET",
      );
    writer.writePage(page);

    var reader = muhammara.createReader(writer.end());
    var elements = reader.extractPageText(0);
    reader.end();

    assert.deepEqual(
      elements.map((element) => [element.content, element.textMatrix]),
      [
        ["rotated", [0, 1, -1, 0, 90, 80]],
        ["relative", [0, 1, -1, 0, 70, 90]],
        ["reset", [1, 0, 0, 1, 0, 0]],
        ["td", [1, 0, 0, 1, 10, 20]],
        ["TD", [1, 0, 0, 1, 15, 16]],
        ["star", [1, 0, 0, 1, 15, 12]],
        ["leading", [1, 0, 0, 1, 15, 6]],
        ["quote", [1, 0, 0, 1, 15, 0]],
        ["double-quote", [1, 0, 0, 1, 15, -6]],
      ],
    );
  });

  it("applies and restores the graphics CTM in reported text matrices", async function () {
    var muhammara = await createMuhammaraWasm();
    var writer = muhammara.createWriter({ compress: false });
    var page = writer.createPage(0, 0, 200, 200);
    writer
      .startPageContentContext(page)
      .writeFreeCode(
        "q 2 0 0 3 10 20 cm BT 1 0 0 1 5 7 Tm (outer) Tj ET " +
          "q 0 1 -1 0 100 200 cm BT 1 0 0 1 2 3 Tm (nested) Tj ET Q " +
          "BT 1 0 0 1 1 1 Tm (restored-outer) Tj ET Q " +
          "BT 1 0 0 1 4 6 Tm (restored-page) Tj ET",
      );
    writer.writePage(page);

    var reader = muhammara.createReader(writer.end());
    var elements = reader.extractPageText(0);
    reader.end();

    assert.deepEqual(
      elements.map((element) => [element.content, element.textMatrix]),
      [
        ["outer", [2, 0, 0, 3, 20, 41]],
        ["nested", [0, 3, -2, 0, 204, 626]],
        ["restored-outer", [2, 0, 0, 3, 12, 23]],
        ["restored-page", [1, 0, 0, 1, 4, 6]],
      ],
    );
  });

  it("ignores malformed and out-of-context text positioning", async function () {
    var muhammara = await createMuhammaraWasm();
    var writer = muhammara.createWriter({ compress: false });
    var page = writer.createPage(0, 0, 200, 200);
    writer
      .startPageContentContext(page)
      .writeFreeCode(
        "/bad 0 0 1 10 20 cm 9 TL T* BT /bad TL T* (after-leading) Tj /bad 2 Td (after-td) Tj " +
          "/bad 0 0 1 5 6 Tm (after-tm) Tj 99 T* (after-star) Tj " +
          "/bad ' 99 (ignored-quote) ' (after-quote) Tj " +
          '1 2 /bad " 1 /bad (ignored-double-quote) " (after-double-quote) Tj ET',
      );
    writer.writePage(page);

    var reader = muhammara.createReader(writer.end());
    var elements = reader.extractPageText(0);
    reader.end();

    assert.deepEqual(
      elements.map((element) => [element.content, element.textMatrix]),
      [
        ["after-leading", [1, 0, 0, 1, 0, 0]],
        ["after-td", [1, 0, 0, 1, 0, 0]],
        ["after-tm", [1, 0, 0, 1, 0, 0]],
        ["after-star", [1, 0, 0, 1, 0, 0]],
        ["after-quote", [1, 0, 0, 1, 0, 0]],
        ["after-double-quote", [1, 0, 0, 1, 0, 0]],
      ],
    );
  });

  it("ignores malformed text object boundaries", async function () {
    var muhammara = await createMuhammaraWasm();
    var writer = muhammara.createWriter({ compress: false });
    var page = writer.createPage(0, 0, 200, 200);
    writer
      .startPageContentContext(page)
      .writeFreeCode(
        "99 BT (outside) Tj BT 10 20 Td BT (after-nested) Tj 99 ET (after-et) Tj ET",
      );
    writer.writePage(page);

    var reader = muhammara.createReader(writer.end());
    var elements = reader.extractPageText(0);
    reader.end();

    assert.deepEqual(
      elements.map((element) => [element.content, element.textMatrix]),
      [
        ["after-nested", [1, 0, 0, 1, 10, 20]],
        ["after-et", [1, 0, 0, 1, 10, 20]],
      ],
    );
  });

  it("restores extracted text state with the graphics state", async function () {
    var muhammara = await createMuhammaraWasm();
    var writer = muhammara.createWriter({ compress: false });
    var page = writer.createPage(0, 0, 200, 200);
    writer
      .startPageContentContext(page)
      .writeFreeCode(
        "BT /F1 10 Tf 7 TL ET q BT /F2 20 Tf 3 TL ET Q BT T* (restored) Tj ET",
      );
    writer.writePage(page);

    var reader = muhammara.createReader(writer.end());
    var elements = reader.extractPageText(0);
    reader.end();

    assert.deepEqual(elements[0].textMatrix, [1, 0, 0, 1, 0, -7]);
    assert.equal(elements[0].fontResource, "F1");
    assert.equal(elements[0].fontSize, 10);
  });
  it("validates the page index", async function () {
    var muhammara = await createMuhammaraWasm();
    var reader = muhammara.createReader(muhammara.createBlankPdf(20, 20));
    assert.throws(
      () => reader.extractPageText(-1),
      /Page index must be a non-negative integer/,
    );
    assert.throws(() => reader.extractPageText(1), /Unable to read page 1/);
    reader.end();
  });

  it("enforces configurable extraction limits", async function () {
    var muhammara = await createMuhammaraWasm();
    var writer = muhammara.createWriter({ compress: false });
    var page = writer.createPage(0, 0, 100, 100);
    writer
      .startPageContentContext(page)
      .writeFreeCode("BT (first) Tj (second) Tj ET");
    writer.writePage(page);
    var reader = muhammara.createReader(writer.end());

    assert.throws(
      () => reader.extractPageText(0, { maxElements: 1 }),
      /extraction limits/,
    );
    assert.throws(
      () => reader.extractPageText(0, { maxTextBytes: 5 }),
      /extraction limits/,
    );
    for (var value of [0, -1, 1.5, 0x100000000]) {
      assert.throws(
        () => reader.extractPageText(0, { maxParsedObjects: value }),
        /positive 32-bit integer/,
      );
    }
    reader.end();
  });
});
