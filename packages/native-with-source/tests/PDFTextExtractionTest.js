var muhammara = require("@muhammara/native-with-source");
var assert = require("chai").assert;
var path = require("path");

describe("PDFTextExtraction", function () {
  it("returns text operations and their active text state", function () {
    var output = __dirname + "/output/PDFTextExtraction.pdf";
    var writer = muhammara.createWriter(output);
    var page = writer.createPage(0, 0, 200, 200);
    var font = writer.getFontForFile(
      path.join(__dirname, "TestMaterials", "fonts", "arial.ttf"),
    );
    var context = writer.startPageContentContext(page);
    context
      .BT()
      .Tf(font, 12)
      .Tm(1, 0, 0, 1, 25, 50)
      .Tj("first")
      .Tm(1, 0, 0, 1, 25, 75)
      .Tj("second")
      .ET();
    writer.writePage(page).end();

    var reader = muhammara.createReader(output);
    var elements = reader.extractPageText(0);
    reader.end();

    assert.deepEqual(
      elements.map(function (element) {
        return element.content;
      }),
      ["first", "second"],
    );
    assert.equal(elements[0].fontSize, 12);
    assert.deepEqual(elements[0].textMatrix, [1, 0, 0, 1, 25, 50]);
    assert.deepEqual(elements[1].textMatrix, [1, 0, 0, 1, 25, 75]);
  });

  it("decodes Unicode text through the page font", function () {
    var output = path.join(__dirname, "output", "PDFTextExtractionDecoded.pdf");
    var writer = muhammara.createWriter(output);
    var page = writer.createPage(0, 0, 200, 200);
    var font = writer.getFontForFile(
      path.join(__dirname, "TestMaterials", "fonts", "arial.ttf"),
    );
    writer
      .startPageContentContext(page)
      .writeFreeCode("BT (no font) Tj ET\n")
      .BT()
      .Tf(font, 12)
      .Tj("plain")
      .Tj("café Ωmega")
      .ET();
    writer.writePage(page).end();

    var reader = muhammara.createReader(output);
    var elements = reader.extractPageText(0);
    reader.end();

    assert.deepEqual(
      elements.map(function (element) {
        return element.text;
      }),
      // Text before any Tf has no font to decode through.
      ["\ufffd".repeat(7), "plain", "café Ωmega"],
    );
    assert.equal(elements[2].content.length, 20, "content keeps raw codes");

    var differences = path.join(
      __dirname,
      "TestMaterials",
      "FontDifferences.pdf",
    );
    reader = muhammara.createReader(differences);
    assert.deepEqual(
      reader.extractPageText(0).map(function (element) {
        return [element.content, element.text];
      }),
      [
        ["cafB", "café"],
        ["A of B", "Ω of é"],
      ],
    );
    reader.end();

    var modifier = muhammara.createWriterToModify(differences, {
      modifiedFilePath: path.join(
        __dirname,
        "output",
        "PDFTextExtractionModified.pdf",
      ),
    });
    var parser = modifier.getModifiedFileParser();
    assert.equal(parser.extractPageText(0)[0].text, "café");
    var copyingContext = modifier.createPDFCopyingContextForModifiedFile();
    assert.equal(
      copyingContext.getSourceDocumentParser().extractPageText(0)[1].text,
      "Ω of é",
    );
    copyingContext.end();
    modifier.end();
  });

  it("decodes malformed and symbolic fonts without failing", function () {
    var reader = muhammara.createReader(
      path.join(__dirname, "TestMaterials", "FontMalformed.pdf"),
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
    ].forEach(function (testCase) {
      assert.equal(
        reader.extractPageText(testCase[0])[0].text,
        testCase[1],
        "page " + (testCase[0] + 1),
      );
    });
    reader.end();
  });

  it("counts font decoding against maxParsedObjects", function () {
    var reader = muhammara.createReader(
      path.join(__dirname, "TestMaterials", "FontMalformed.pdf"),
    );
    var extract = function (limit) {
      return reader.extractPageText(17, { maxParsedObjects: limit });
    };
    // Page 18's content fits in 60 objects, but reading both of its fonts
    // does not. Each call pays for fonts cached by earlier calls, including
    // ones that failed, so the answer never depends on what came before.
    assert.throws(function () {
      extract(60);
    }, "Page content exceeds text extraction limits");
    assert.throws(function () {
      extract(60);
    }, "Page content exceeds text extraction limits");
    reader.extractPageText(17);
    assert.throws(function () {
      extract(60);
    }, "Page content exceeds text extraction limits");
    assert.deepEqual(
      extract(96).map(function (element) {
        return element.text;
      }),
      ["a", "b"],
    );
    reader.end();
  });

  it("charges every font that shares a CMap for its ranges", function () {
    var reader = muhammara.createReader(
      path.join(__dirname, "TestMaterials", "FontMalformed.pdf"),
    );
    var texts = function () {
      return reader.extractPageText(19).map(function (element) {
        return element.text;
      });
    };
    // Forty fonts share one CMap whose bfrange expands to 65,536 codes; the
    // call's range budget covers thirty-two of them.
    var expected = Array(32).fill("Ω").concat(Array(8).fill("a"));
    assert.deepEqual(texts(), expected);
    assert.deepEqual(texts(), expected);
    reader.end();
  });

  it("drops the least recently used fonts from a reader's cache", function () {
    var reader = muhammara.createReader(
      path.join(__dirname, "TestMaterials", "FontMalformed.pdf"),
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
    assert.isAbove(reads, 300, "evicted fonts are read again");
    reader.end();
  });

  it("reads a simple font's widths only when encoding", function () {
    var output = path.join(__dirname, "output", "PDFTextExtractionWidths.pdf");
    var writer = muhammara.createWriter(output);
    var page = writer.createPage(0, 0, 200, 200);
    writer
      .startPageContentContext(page)
      .BT()
      .Tf(
        writer.getFontForFile(
          path.join(__dirname, "TestMaterials", "fonts", "arial.ttf"),
        ),
        12,
      )
      .Tj("Widths")
      .ET();
    writer.writePage(page).end();

    var reader = muhammara.createReader(output);
    // Reading /Widths would need about a hundred more objects.
    assert.equal(
      reader.extractPageText(0, { maxParsedObjects: 100 })[0].text,
      "Widths",
    );
    reader.end();
  });

  it("skips decoding when decodeText is false", function () {
    var reader = muhammara.createReader(
      path.join(__dirname, "TestMaterials", "FontEncodings.pdf"),
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
    assert.notProperty(element, "text");
    assert.equal(element.content, "\x00\x01\x00\x02\x00\x03");
    assert.equal(parses, 0);
    assert.equal(
      reader.extractPageText(3, { maxElements: 5 }, { decodeText: true })[0]
        .text,
      "abc",
    );
    assert.throws(function () {
      reader.extractPageText(3, undefined, null);
    }, "Text extraction options must be an object");
    assert.throws(function () {
      reader.extractPageText(3, undefined, { decodeText: "no" });
    }, "decodeText must be a boolean");
    reader.end();
  });

  it("refuses an addon that does not export its reader class", function () {
    var createMuhammara = require("@muhammara/native-core").createMuhammara;
    assert.throws(function () {
      createMuhammara({ PDFWriter: function () {} });
    }, "does not export PDFReader");
  });

  it("resolves font resources with non-ASCII names", function () {
    var reader = muhammara.createReader(
      path.join(__dirname, "TestMaterials", "FontMalformed.pdf"),
    );
    var element = reader.extractPageText(14)[0];
    assert.equal(element.fontResource, "Fé");
    assert.equal(element.text, "abc");
    reader.end();
  });

  it("parses the glyph list on first use", function () {
    var modulePath = path.join(
      __dirname,
      "..",
      "..",
      "native-core",
      "lib",
      "glyph-list.js",
    );
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
      delete require.cache[modulePath];
      var glyphList = require(modulePath);
      assert.equal(calls, 0, "loading the module does not parse the list");
      assert.equal(glyphList.glyphs().aogonek, "ą");
      assert.isAbove(calls, 0);
    } finally {
      String.prototype.normalize = normalize;
      delete require.cache[modulePath];
    }
  });

  it("gives each call its own ToUnicode budget", function () {
    var reader = muhammara.createReader(
      path.join(__dirname, "TestMaterials", "FontMalformed.pdf"),
    );
    var texts = function (pageIndex) {
      return reader.extractPageText(pageIndex).map(function (element) {
        return element.text;
      });
    };
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

  it("reads a font's ToUnicode CMap once per reader", function () {
    var reader = muhammara.createReader(
      path.join(__dirname, "TestMaterials", "FontEncodings.pdf"),
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

  it("skips inline image payloads", function () {
    var output = __dirname + "/output/PDFTextExtractionInlineImage.pdf";
    var writer = muhammara.createWriter(output);
    var page = writer.createPage(0, 0, 200, 200);
    writer
      .startPageContentContext(page)
      .writeFreeCode(
        "BI /W 4 /H 1 /BPC 8 /CS /G ID BT (fabricated) Tj ET EI BT (real) Tj ET",
      );
    writer.writePage(page).end();

    var reader = muhammara.createReader(output);
    var elements = reader.extractPageText(0);
    reader.end();

    assert.deepEqual(
      elements.map(function (element) {
        return element.content;
      }),
      ["real"],
    );
  });

  it("tracks text and line positioning matrices", function () {
    var output = __dirname + "/output/PDFTextExtractionMatrices.pdf";
    var writer = muhammara.createWriter(output);
    var page = writer.createPage(0, 0, 200, 200);
    writer
      .startPageContentContext(page)
      .writeFreeCode(
        "BT 0 1 -1 0 90 80 Tm (rotated) Tj 10 20 Td (relative) Tj ET " +
          "BT (reset) Tj 10 20 Td (td) Tj 5 -4 TD (TD) Tj T* (star) Tj " +
          "6 TL T* (leading) Tj (quote) ' 1 2 (double-quote) \" ET",
      );
    writer.writePage(page).end();

    var reader = muhammara.createReader(output);
    var elements = reader.extractPageText(0);
    reader.end();

    assert.deepEqual(
      elements.map(function (element) {
        return [element.content, element.textMatrix];
      }),
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

  it("applies and restores the graphics CTM in reported text matrices", function () {
    var output = __dirname + "/output/PDFTextExtractionCTM.pdf";
    var writer = muhammara.createWriter(output);
    var page = writer.createPage(0, 0, 200, 200);
    writer
      .startPageContentContext(page)
      .writeFreeCode(
        "q 2 0 0 3 10 20 cm BT 1 0 0 1 5 7 Tm (outer) Tj ET " +
          "q 0 1 -1 0 100 200 cm BT 1 0 0 1 2 3 Tm (nested) Tj ET Q " +
          "BT 1 0 0 1 1 1 Tm (restored-outer) Tj ET Q " +
          "BT 1 0 0 1 4 6 Tm (restored-page) Tj ET",
      );
    writer.writePage(page).end();

    var reader = muhammara.createReader(output);
    var elements = reader.extractPageText(0);
    reader.end();

    assert.deepEqual(
      elements.map(function (element) {
        return [element.content, element.textMatrix];
      }),
      [
        ["outer", [2, 0, 0, 3, 20, 41]],
        ["nested", [0, 3, -2, 0, 204, 626]],
        ["restored-outer", [2, 0, 0, 3, 12, 23]],
        ["restored-page", [1, 0, 0, 1, 4, 6]],
      ],
    );
  });

  it("ignores malformed and out-of-context text positioning", function () {
    var output = __dirname + "/output/PDFTextExtractionMalformedMatrices.pdf";
    var writer = muhammara.createWriter(output);
    var page = writer.createPage(0, 0, 200, 200);
    writer
      .startPageContentContext(page)
      .writeFreeCode(
        "/bad 0 0 1 10 20 cm 9 TL T* BT /bad TL T* (after-leading) Tj /bad 2 Td (after-td) Tj " +
          "/bad 0 0 1 5 6 Tm (after-tm) Tj 99 T* (after-star) Tj " +
          "/bad ' 99 (ignored-quote) ' (after-quote) Tj " +
          '1 2 /bad " 1 /bad (ignored-double-quote) " (after-double-quote) Tj ET',
      );
    writer.writePage(page).end();

    var reader = muhammara.createReader(output);
    var elements = reader.extractPageText(0);
    reader.end();

    assert.deepEqual(
      elements.map(function (element) {
        return [element.content, element.textMatrix];
      }),
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

  it("ignores malformed text object boundaries", function () {
    var output = __dirname + "/output/PDFTextExtractionMalformedObjects.pdf";
    var writer = muhammara.createWriter(output);
    var page = writer.createPage(0, 0, 200, 200);
    writer
      .startPageContentContext(page)
      .writeFreeCode(
        "99 BT (outside) Tj BT 10 20 Td BT (after-nested) Tj 99 ET (after-et) Tj ET",
      );
    writer.writePage(page).end();

    var reader = muhammara.createReader(output);
    var elements = reader.extractPageText(0);
    reader.end();

    assert.deepEqual(
      elements.map(function (element) {
        return [element.content, element.textMatrix];
      }),
      [
        ["after-nested", [1, 0, 0, 1, 10, 20]],
        ["after-et", [1, 0, 0, 1, 10, 20]],
      ],
    );
  });

  it("restores extracted text state with the graphics state", function () {
    var output = __dirname + "/output/PDFTextExtractionLeadingState.pdf";
    var writer = muhammara.createWriter(output);
    var page = writer.createPage(0, 0, 200, 200);
    writer
      .startPageContentContext(page)
      .writeFreeCode(
        "BT /F1 10 Tf 7 TL ET q BT /F2 20 Tf 3 TL ET Q BT T* (restored) Tj ET",
      );
    writer.writePage(page).end();

    var reader = muhammara.createReader(output);
    var elements = reader.extractPageText(0);
    reader.end();

    assert.deepEqual(elements[0].textMatrix, [1, 0, 0, 1, 0, -7]);
    assert.equal(elements[0].fontResource, "F1");
    assert.equal(elements[0].fontSize, 10);
  });
  it("enforces configurable extraction limits", function () {
    var output = __dirname + "/output/PDFTextExtractionLimits.pdf";
    var writer = muhammara.createWriter(output);
    var page = writer.createPage(0, 0, 200, 200);
    var font = writer.getFontForFile(
      path.join(__dirname, "TestMaterials", "fonts", "arial.ttf"),
    );
    writer
      .startPageContentContext(page)
      .BT()
      .Tf(font, 12)
      .Tm(1, 0, 0, 1, 25, 50)
      .Tj("first")
      .Tm(1, 0, 0, 1, 25, 75)
      .Tj("second")
      .ET();
    writer.writePage(page).end();

    var reader = muhammara.createReader(output);
    assert.lengthOf(reader.extractPageText(0), 2);
    assert.throws(function () {
      reader.extractPageText(0, { maxElements: 1 });
    }, /extraction limits/);
    assert.throws(function () {
      reader.extractPageText(0, { maxTextBytes: 5 });
    }, /extraction limits/);
    // Requests above the ceiling clamp down instead of raising the backstop.
    assert.lengthOf(reader.extractPageText(0, { maxElements: 0xffffffff }), 2);
    [0, -1, 1.5, 0x100000000].forEach(function (value) {
      assert.throws(function () {
        reader.extractPageText(0, { maxParsedObjects: value });
      }, /positive 32-bit integer/);
    });
    reader.end();
  });
});
