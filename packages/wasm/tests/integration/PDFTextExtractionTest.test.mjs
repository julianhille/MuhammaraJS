// Byte-first port of tests/PDFTextExtractionTest.js.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createMuhammaraWasm } from "../index.js";
import { writeOutput } from "../testOutput.mjs";

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

    var pdf = writer.end();
    writeOutput("PDFTextExtractionTest-text-state", pdf);
    var reader = muhammara.createReader(pdf);
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
    var decoded = writer.end();
    writeOutput("PDFTextExtractionDecoded", decoded);

    var reader = muhammara.createReader(decoded);
    var elements = reader.extractPageText(0);
    reader.end();

    assert.deepEqual(
      elements.map((element) => element.text),
      // Text before any Tf has no font to decode through.
      ["\ufffd".repeat(7), "plain", "café Ωmega"],
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

  it("decodes malformed and symbolic fonts without failing", async function () {
    var muhammara = await createMuhammaraWasm();
    var reader = muhammara.createReader(
      new Uint8Array(
        await readFile(
          new URL(
            "../../../native-with-source/tests/TestMaterials/FontMalformed.pdf",
            import.meta.url,
          ),
        ),
      ),
    );
    [
      // A /Parent cycle and no resources: no font to decode through.
      [0, "\ufffd\ufffd\ufffd"],
      // Unresolvable /Differences and /Widths items are skipped.
      [1, "BA"],
      // An unreadable /ToUnicode falls back to the encoding.
      [2, "café"],
      // The Symbol standard font has no Latin encoding.
      [3, "\ufffd\ufffd"],
      // A Symbolic-flagged font's /Differences apply over StandardEncoding.
      [4, "Ωb"],
      // A /ToUnicode over the size limit is ignored.
      [5, "a"],
      // /Differences past its item limit is ignored.
      [6, "a"],
      // A bfrange past the range budget is ignored.
      [7, "a"],
      // A Symbolic-flagged TrueType subset without /Encoding.
      [9, "Total"],
      // One-byte ToUnicode destinations.
      [10, "ABCZ"],
      // Glyph names from the full Adobe Glyph List.
      [11, "ąłАś"],
      // A short /Widths array does not affect decoding.
      [12, "ab"],
      // Embedded Type 1 programs have an unknown built-in encoding.
      [15, "\ufffd\ufffd"],
      [16, "Ω\ufffd"],
      // A CMap flooded with unclosed strings still tokenizes in linear time.
      [18, "Ω"],
      // Glyph names for surrogate code points are unknown.
      [20, "\ufffd😀\ufffd"],
      // A Type 3 font's codes mean only what /Differences names.
      [21, "a\ufffd"],
    ].forEach(([pageIndex, text]) => {
      assert.equal(
        reader.extractPageText(pageIndex)[0].text,
        text,
        "page " + (pageIndex + 1),
      );
    });
    reader.end();
  });

  it("counts font decoding against maxParsedObjects", async function () {
    var muhammara = await createMuhammaraWasm();
    var reader = muhammara.createReader(
      new Uint8Array(
        await readFile(
          new URL(
            "../../../native-with-source/tests/TestMaterials/FontMalformed.pdf",
            import.meta.url,
          ),
        ),
      ),
    );
    var extract = (limit) =>
      reader.extractPageText(17, { maxParsedObjects: limit });
    var limitError = { message: "Page content exceeds text extraction limits" };
    // Page 18's content fits in 60 objects, but reading both of its fonts
    // does not. Each call pays for fonts cached by earlier calls, including
    // ones that failed, so the answer never depends on what came before.
    assert.throws(() => extract(60), limitError);
    assert.throws(() => extract(60), limitError);
    reader.extractPageText(17);
    assert.throws(() => extract(60), limitError);
    assert.deepEqual(
      extract(96).map((element) => element.text),
      ["a", "b"],
    );
    reader.end();
  });

  it("charges every font that shares a CMap for its ranges", async function () {
    var muhammara = await createMuhammaraWasm();
    var reader = muhammara.createReader(
      new Uint8Array(
        await readFile(
          new URL(
            "../../../native-with-source/tests/TestMaterials/FontMalformed.pdf",
            import.meta.url,
          ),
        ),
      ),
    );
    var texts = () => reader.extractPageText(19).map((element) => element.text);
    // Forty fonts share one CMap whose bfrange expands to 65,536 codes; the
    // call's range budget covers thirty-two of them.
    var expected = Array(32).fill("Ω").concat(Array(8).fill("a"));
    assert.deepEqual(texts(), expected);
    assert.deepEqual(texts(), expected);
    reader.end();
  });

  it("drops the least recently used fonts from a reader's cache", async function () {
    var muhammara = await createMuhammaraWasm();
    var reader = muhammara.createReader(
      new Uint8Array(
        await readFile(
          new URL(
            "../../../native-with-source/tests/TestMaterials/FontMalformed.pdf",
            import.meta.url,
          ),
        ),
      ),
    );
    var queryDictionaryObject = reader.queryDictionaryObject;
    var reads = 0;
    /**
     * Count dictionary reads before delegating to the reader.
     *
     * @returns {object|undefined} The resolved entry.
     */
    reader.queryDictionaryObject = function () {
      reads++;
      return queryDictionaryObject.apply(this, arguments);
    };
    // Page 23 uses three hundred fonts, more than a reader keeps.
    assert.equal(reader.extractPageText(22).length, 300);
    reads = 0;
    reader.extractPageText(22);
    assert.ok(reads > 300, "evicted fonts are read again");
    reader.end();
  });

  it("reads a simple font's widths only when encoding", async function () {
    var muhammara = await createMuhammaraWasm();
    muhammara.registerFont(
      "widths-font",
      new Uint8Array(
        await readFile(
          new URL(
            "../../../native-with-source/tests/TestMaterials/fonts/arial.ttf",
            import.meta.url,
          ),
        ),
      ),
    );
    var writer = muhammara.createWriter();
    var page = writer.createPage(0, 0, 200, 200);
    writer
      .startPageContentContext(page)
      .BT()
      .Tf(writer.getFontForBytes("widths-font"), 12)
      .Tj("Widths")
      .ET();
    writer.writePage(page);
    var widths = writer.end();
    writeOutput("PDFTextExtractionWidths", widths);
    var reader = muhammara.createReader(widths);
    // Reading /Widths would need about a hundred more objects.
    assert.equal(
      reader.extractPageText(0, { maxParsedObjects: 100 })[0].text,
      "Widths",
    );
    reader.end();
    muhammara.unregisterFont("widths-font");
    muhammara.disposeAssets();
  });

  it("skips decoding when decodeText is false", async function () {
    var muhammara = await createMuhammaraWasm();
    var reader = muhammara.createReader(
      new Uint8Array(
        await readFile(
          new URL(
            "../../../native-with-source/tests/TestMaterials/FontEncodings.pdf",
            import.meta.url,
          ),
        ),
      ),
    );
    var parsePageDictionary = reader.parsePageDictionary;
    var parses = 0;
    /**
     * Count page parses before delegating to the reader.
     *
     * @returns {object} The page dictionary.
     */
    reader.parsePageDictionary = function () {
      parses++;
      return parsePageDictionary.apply(this, arguments);
    };
    var element = reader.extractPageText(3, undefined, {
      decodeText: false,
    })[0];
    assert.equal("text" in element, false);
    assert.equal(element.content, "\x00\x01\x00\x02\x00\x03");
    assert.equal(parses, 0);
    assert.equal(
      reader.extractPageText(3, { maxElements: 5 }, { decodeText: true })[0]
        .text,
      "abc",
    );
    assert.throws(() => reader.extractPageText(3, undefined, null), {
      name: "TypeError",
      message: "Text extraction options must be an object",
    });
    assert.throws(
      () => reader.extractPageText(3, undefined, { decodeText: "no" }),
      { name: "TypeError", message: "decodeText must be a boolean" },
    );
    reader.end();
  });

  it("resolves font resources with non-ASCII names", async function () {
    var muhammara = await createMuhammaraWasm();
    var reader = muhammara.createReader(
      new Uint8Array(
        await readFile(
          new URL(
            "../../../native-with-source/tests/TestMaterials/FontMalformed.pdf",
            import.meta.url,
          ),
        ),
      ),
    );
    var element = reader.extractPageText(14)[0];
    assert.equal(element.fontResource, "Fé");
    assert.equal(element.text, "abc");
    reader.end();
  });

  it("parses the glyph list on first use", async function () {
    var normalize = String.prototype.normalize;
    var calls = 0;
    /**
     * Count normalizations, which parsing the glyph list performs.
     *
     * @returns {string} The normalized string.
     */
    String.prototype.normalize = function () {
      calls++;
      return normalize.apply(this, arguments);
    };
    try {
      // A query string loads a fresh module instance.
      var glyphList = await import(
        new URL(`../../lib/glyph-list.js?fresh=${Date.now()}`, import.meta.url)
      );
      assert.equal(calls, 0, "loading the module does not parse the list");
      assert.equal(glyphList.glyphs().aogonek, "ą");
      assert.ok(calls > 0);
    } finally {
      String.prototype.normalize = normalize;
    }
  });

  it("decodes text when extractPageText is called detached", async function () {
    var muhammara = await createMuhammaraWasm();
    var reader = muhammara.createReader(
      new Uint8Array(
        await readFile(
          new URL(
            "../../../native-with-source/tests/TestMaterials/FontEncodings.pdf",
            import.meta.url,
          ),
        ),
      ),
    );
    var { extractPageText } = reader;
    // Wasm reader methods close over their reader, unlike native methods.
    assert.equal(extractPageText(3)[0].text, "abc");
    reader.end();
  });

  it("gives each call its own ToUnicode budget", async function () {
    var muhammara = await createMuhammaraWasm();
    var reader = muhammara.createReader(
      new Uint8Array(
        await readFile(
          new URL(
            "../../../native-with-source/tests/TestMaterials/FontMalformed.pdf",
            import.meta.url,
          ),
        ),
      ),
    );
    var texts = (pageIndex) =>
      reader.extractPageText(pageIndex).map((element) => element.text);
    // Nine fonts with 4,000,000-byte CMaps: eight fit the 32 MiB budget.
    var budgetPage = ["Ω", "Ω", "Ω", "Ω", "Ω", "Ω", "Ω", "Ω", "a"];
    assert.deepEqual(texts(8), budgetPage);
    // A later call still reads a new font's CMap.
    assert.deepEqual(texts(10), ["ABCZ"]);
    // Cached fonts count against each call's budget, so repeating the call
    // gives the same result.
    assert.deepEqual(texts(8), budgetPage);
    reader.end();
  });

  it("reads a font's ToUnicode CMap once per reader", async function () {
    var muhammara = await createMuhammaraWasm();
    var reader = muhammara.createReader(
      new Uint8Array(
        await readFile(
          new URL(
            "../../../native-with-source/tests/TestMaterials/FontEncodings.pdf",
            import.meta.url,
          ),
        ),
      ),
    );
    var startReadingFromStream = reader.startReadingFromStream;
    var reads = 0;
    /**
     * Count stream reads before delegating to the reader.
     *
     * @returns {object} The stream reader.
     */
    reader.startReadingFromStream = function () {
      reads++;
      return startReadingFromStream.apply(this, arguments);
    };
    assert.equal(reader.extractPageText(3)[0].text, "abc");
    assert.equal(reader.extractPageText(3)[0].text, "abc");
    assert.equal(reads, 1);
    reader.end();
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

    var pdf = writer.end();
    writeOutput("PDFTextExtractionTest-inline-image", pdf);
    var reader = muhammara.createReader(pdf);
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

    var pdf = writer.end();
    writeOutput("PDFTextExtractionTest-positioning", pdf);
    var reader = muhammara.createReader(pdf);
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

    var pdf = writer.end();
    writeOutput("PDFTextExtractionTest-ctm", pdf);
    var reader = muhammara.createReader(pdf);
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

    var pdf = writer.end();
    writeOutput("PDFTextExtractionTest-malformed-positioning", pdf);
    var reader = muhammara.createReader(pdf);
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

    var pdf = writer.end();
    writeOutput("PDFTextExtractionTest-malformed-boundaries", pdf);
    var reader = muhammara.createReader(pdf);
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

    var pdf = writer.end();
    writeOutput("PDFTextExtractionTest-graphics-state", pdf);
    var reader = muhammara.createReader(pdf);
    var elements = reader.extractPageText(0);
    reader.end();

    assert.deepEqual(elements[0].textMatrix, [1, 0, 0, 1, 0, -7]);
    assert.equal(elements[0].fontResource, "F1");
    assert.equal(elements[0].fontSize, 10);
  });
  it("validates the page index", async function () {
    var muhammara = await createMuhammaraWasm();
    var pdf = muhammara.createBlankPdf(20, 20);
    writeOutput("PDFTextExtractionTest-page-index", pdf);
    var reader = muhammara.createReader(pdf);
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
    var pdf = writer.end();
    writeOutput("PDFTextExtractionTest-limits", pdf);
    var reader = muhammara.createReader(pdf);

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
