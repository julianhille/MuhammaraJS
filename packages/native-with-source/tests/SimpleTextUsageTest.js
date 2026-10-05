var muhammara = require("@muhammara/native-with-source");
var assert = require("node:assert/strict");
var path = require("path");
var malformed = require("./helpers/malformedInputs");

/**
 * Writes text in a font and ends the document, which subsets the font. The
 * broken fonts may fail to embed, but must not crash.
 * @param {string} fontPath - Font file.
 * @param {string} text - Text to write.
 */
function embedText(fontPath, text) {
  var writer = muhammara.createWriter(new muhammara.PDFWStreamForBuffer());
  // Loading the font must work; only embedding it may be rejected.
  var font = writer.getFontForFile(fontPath);
  var page = writer.createPage(0, 0, 200, 200);
  try {
    writer
      .startPageContentContext(page)
      .writeText(text, 10, 100, { font: font, size: 12 });
    writer.writePage(page);
    writer.end();
  } catch (error) {
    if (!(error instanceof Error)) throw error;
  }
}

describe("SimpleTextUsageTest", function () {
  it("should complete without error", function () {
    var pdfWriter = muhammara.createWriter(
      __dirname + "/output/SimpleTextUsageCFF.pdf",
    );
    var page = pdfWriter.createPage(0, 0, 595, 842);
    var font = pdfWriter.getFontForFile(
      __dirname + "/TestMaterials/fonts/BrushScriptStd.otf",
    );
    var fontK = pdfWriter.getFontForFile(
      __dirname + "/TestMaterials/fonts/KozGoPro-Regular.otf",
    );
    pdfWriter
      .startPageContentContext(page)
      .BT()
      .k(0, 0, 0, 1)
      .Tf(font, 1)
      .Tm(30, 0, 0, 30, 78.4252, 662.8997)
      .Tj("abcd")
      .ET()
      .BT()
      .k(0, 0, 0, 1)
      .Tf(fontK, 1)
      .Tm(30, 0, 0, 30, 78.4252, 400.8997)
      .Tj("abcd")
      .ET();
    pdfWriter.writePage(page).end();

    // ---

    var pdfWriter = muhammara.createWriter(
      __dirname + "/output/SimpleTextUsageTTF.pdf",
    );
    var page = pdfWriter.createPage(0, 0, 595, 842);

    var font = pdfWriter.getFontForFile(
      __dirname + "/TestMaterials/fonts/arial.ttf",
    );
    pdfWriter
      .startPageContentContext(page)
      .BT()
      .k(0, 0, 0, 1)
      .Tf(font, 1)
      .Tm(30, 0, 0, 30, 78.4252, 662.8997)
      .Tj("abcd")
      .ET();

    pdfWriter.writePage(page).end();

    // ---

    var pdfWriter = muhammara.createWriter(
      __dirname + "/output/SimpleTextUsageType1.pdf",
    );
    var page = pdfWriter.createPage(0, 0, 595, 842);
    var font = pdfWriter.getFontForFile(
      __dirname + "/TestMaterials/fonts/HLB_____.PFB",
      __dirname + "/TestMaterials/fonts/HLB_____.PFM",
    );
    pdfWriter
      .startPageContentContext(page)
      .BT()
      .k(0, 0, 0, 1)
      .Tf(font, 1)
      .Tm(30, 0, 0, 30, 78.4252, 662.8997)
      .Tj("abcd")
      .ET();

    pdfWriter.writePage(page).end();

    // ---

    // this one is about creating a font object, but not really using it. make sure no crash happens
    var pdfWriter = muhammara.createWriter(
      __dirname + "/output/SimpleTextUsageType1Empty.pdf",
    );
    var page = pdfWriter.createPage(0, 0, 595, 842);
    var font = pdfWriter.getFontForFile(
      __dirname + "/TestMaterials/fonts/HLB_____.PFB",
      __dirname + "/TestMaterials/fonts/HLB_____.PFM",
    );
    pdfWriter
      .startPageContentContext(page)
      .BT()
      .k(0, 0, 0, 1)
      .Tf(font, 1)
      .Tm(30, 0, 0, 30, 78.4252, 662.8997)
      .ET();

    pdfWriter.writePage(page).end();

    // ---

    // this one adds text using the GlyphIds
    var pdfWriter = muhammara.createWriter(
      __dirname + "/output/SimpleTextUsageGlyphs.pdf",
    );
    var page = pdfWriter.createPage(0, 0, 595, 842);
    var font = pdfWriter.getFontForFile(
      __dirname + "/TestMaterials/fonts/arial.ttf",
    );
    pdfWriter
      .startPageContentContext(page)
      .BT()
      .k(0, 0, 0, 1)
      .Tf(font, 1)
      .Tm(30, 0, 0, 30, 78.4252, 662.8997)
      .Tj([
        [68, 97],
        [69, 98],
        [70, 99],
        [71, 100],
      ])
      .ET();
    pdfWriter.writePage(page).end();
  });

  it("rejects glyph lists with items that are not glyph mappings", function () {
    var writer = muhammara.createWriter(
      __dirname + "/output/SimpleTextUsageInvalidGlyphs.pdf",
    );
    var page = writer.createPage(0, 0, 100, 100);
    var context = writer.startPageContentContext(page).BT();
    [
      function () {
        context.TJ(["ab", -100, "c"]);
      },
      function () {
        context.Tj([[68, 97], 69]);
      },
      function () {
        context.Quote([[]]);
      },
    ].forEach(function (call) {
      assert.throws(
        call,
        /glyph text requires \[glyphId, unicodeCodePoint\] pairs/,
      );
    });
    assert.throws(function () {
      context.TJ("a", -1, [[36, 65]]);
    }, /either string\/glyphs list or number/);
    context.TJ("ab", -100, "c").ET();
    writer.writePage(page).end();
  });

  var NUL_TEXT = "before\0after";
  var NUL_BYTES = [98, 101, 102, 111, 114, 101, 0, 97, 102, 116, 101, 114];

  // Reads the single text operand of the first content stream operator back as
  // raw bytes, so an embedded NUL is visible instead of ending the string.
  function readTextOperandBytes(outputPath, toStringObject) {
    var reader = muhammara.createReader(outputPath);
    var stream = reader
      .queryDictionaryObject(reader.parsePageDictionary(0), "Contents")
      .toPDFStream();
    var parser = reader.startReadingObjectsFromStream(stream);
    parser.parseNewObject();
    var bytes = toStringObject(parser.parseNewObject()).toBytesArray();
    reader.end();
    return bytes;
  }

  [
    { encoding: "hex", accessor: "toPDFHexString" },
    { encoding: "code", accessor: "toPDFLiteralString" },
  ].forEach(function (variant) {
    it(
      "preserves embedded NUL bytes in " + variant.encoding + " TJ strings",
      function () {
        var outputPath =
          __dirname +
          "/output/SimpleTextUsageTest-nul-" +
          variant.encoding +
          "-tj-array.pdf";
        var writer = muhammara.createWriter(outputPath);
        var page = writer.createPage(0, 0, 100, 100);
        writer
          .startPageContentContext(page)
          .BT()
          .TJ(NUL_TEXT, { encoding: variant.encoding })
          .ET();
        writer.writePage(page).end();

        assert.deepEqual(
          readTextOperandBytes(outputPath, function (object) {
            return object.toPDFArray().queryObject(0)[variant.accessor]();
          }),
          NUL_BYTES,
        );
      },
    );

    it(
      "preserves embedded NUL bytes in " + variant.encoding + " Tj strings",
      function () {
        var outputPath =
          __dirname +
          "/output/SimpleTextUsageTest-nul-" +
          variant.encoding +
          "-tj-string.pdf";
        var writer = muhammara.createWriter(outputPath);
        var page = writer.createPage(0, 0, 100, 100);
        writer
          .startPageContentContext(page)
          .BT()
          .Tj(NUL_TEXT, { encoding: variant.encoding })
          .ET();
        writer.writePage(page).end();

        assert.deepEqual(
          readTextOperandBytes(outputPath, function (object) {
            return object[variant.accessor]();
          }),
          NUL_BYTES,
        );
      },
    );
  });

  it("embeds a CFF font whose charstrings call missing local subroutines", function () {
    var writer = muhammara.createWriter(
      path.join(__dirname, "output", "FuzzCFFWithoutSubrs.pdf"),
    );
    var font = writer.getFontForFile(
      path.join(malformed.fuzzInputs, "font-cff-callsubr-without-subrs.bin"),
    );
    var page = writer.createPage(0, 0, 595, 842);
    writer
      .startPageContentContext(page)
      .writeText("Hello", 10, 100, { font: font, size: 12 });
    writer.writePage(page);
    // Writing the font subset interprets the charstrings.
    try {
      writer.end();
    } catch (error) {
      assert.match(error.message, /end/i);
    }
  });

  it("embeds a CFF font whose local subroutines cannot be read", function () {
    var writer = muhammara.createWriter(
      path.join(__dirname, "output", "FuzzCFFUnreadableSubrs.pdf"),
    );
    var font = writer.getFontForFile(
      path.join(malformed.fuzzInputs, "font-cff-unreadable-local-subrs.bin"),
    );
    var page = writer.createPage(0, 0, 595, 842);
    writer
      .startPageContentContext(page)
      .writeText("Hello", 10, 100, { font: font, size: 12 });
    writer.writePage(page);
    try {
      writer.end();
    } catch (error) {
      assert.match(error.message, /end/i);
    }
  });

  it("embeds a CFF font whose glyphs call local subrs that the font lacks", function () {
    var font = malformed.material("fonts", "BrushScriptStd.otf");
    var top = malformed.cffTopDict(font);
    var privateDict = top.dict[18].operands;
    var start = top.cff + privateDict[1];
    var subrs = malformed.cffDict(font, start, start + privateDict[0])[19];
    // Turn /Subrs into a second /defaultWidthX, so the font has no local subrs.
    font[subrs.at] = 20;
    embedText(malformed.writeFixture("FuzzNoLocalSubrs.otf", font), "Hello");
  });

  it("embeds a CID CFF font with an empty FDArray", function () {
    var font = malformed.material("fonts", "KozGoPro-Regular.otf");
    var top = malformed.cffTopDict(font);
    font.writeUInt16BE(0, top.cff + top.dict[1236].operands[0]);
    embedText(malformed.writeFixture("FuzzEmptyFDArray.otf", font), "Hello");
  });

  it("embeds a font with an invalid OS/2 width class", function () {
    var font = malformed.material("fonts", "BrushScriptStd.otf");
    for (var i = 0, count = font.readUInt16BE(4); i < count; ++i) {
      var record = 12 + i * 16;
      if (font.toString("latin1", record, record + 4) === "OS/2")
        // usWidthClass indexed a 10-entry table of FontStretch names.
        font.writeUInt16BE(0x7000, font.readUInt32BE(record + 8) + 6);
    }
    embedText(malformed.writeFixture("FuzzWidthClass.otf", font), "Hello");
  });

  it("rejects a CID CFF font whose local subrs index is invalid", function () {
    var font = malformed.material("fonts", "KozGoPro-Regular.otf");
    var top = malformed.cffTopDict(font);
    var fontDict = malformed.cffIndex(
      font,
      top.cff + top.dict[1236].operands[0],
    ).first;
    var privateDict = malformed.cffDict(font, fontDict[0], fontDict[1])[18]
      .operands;
    var start = top.cff + privateDict[1];
    var subrs =
      start +
      malformed.cffDict(font, start, start + privateDict[0])[19].operands[0];
    // Raise the second offset above the third. FreeType reads subrs lazily and
    // accepts the font, the embedder rejects the INDEX. That failure used to
    // leak the subrs and dereference the end of their map.
    font[subrs + 3 + font[subrs + 2]] = 0xff;
    embedText(malformed.writeFixture("FuzzBadLocalSubrs.otf", font), "Hello");
  });

  it("frees a composite glyph that refers to a missing glyph", function () {
    // numberOfContours -1, an empty box, then one component naming glyph 65535
    var glyph = Buffer.from([
      0xff, 0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0x00, 0x01, 0xff, 0xff, 0, 0, 0, 0,
    ]);
    embedText(
      malformed.writeFixture(
        "FuzzMissingComponent.ttf",
        malformed.fontWithOnlyGlyph(glyph),
      ),
      "Hello",
    );
  });
});
