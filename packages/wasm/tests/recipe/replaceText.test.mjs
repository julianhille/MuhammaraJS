import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createMuhammaraWasm, createRecipe } from "../../index.js";
import { writeOutput } from "../testOutput.mjs";

var FIXTURES = new URL(
  "../../../native-with-source/tests/TestMaterials/",
  import.meta.url,
);

/**
 * Read the first page's content stream bytes.
 *
 * @param {object} reader PDF reader.
 * @returns {Buffer} Decoded content stream bytes.
 */
function pageContent(reader) {
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
  return Buffer.from(content);
}

describe("Replace text", function () {
  var muhammara;
  var Recipe;
  var source;

  before(async function () {
    muhammara = await createMuhammaraWasm();
    Recipe = await createRecipe();
    muhammara.registerFont(
      "replace-text-font",
      new Uint8Array(await readFile(new URL("fonts/arial.ttf", FIXTURES))),
    );
    var writer = muhammara.createWriter();
    var page = writer.createPage(0, 0, 200, 200);
    writer
      .startPageContentContext(page)
      .BT()
      .Tf(writer.getFontForBytes("replace-text-font"), 12)
      .Tm(1, 0, 0, 1, 20, 30)
      .Tj("Before")
      .Tj("$&After")
      .writeFreeCode("(café) Tj (1x5) Tj\n")
      .Tj("café Ωmega")
      .Tj("Ω café")
      .ET()
      .writeFreeCode("% café\n");
    writer.writePage(page);
    source = writer.end();
  });

  after(function () {
    muhammara.unregisterFont("replace-text-font");
    muhammara.disposeAssets();
  });

  it("replaces text at its existing position", function () {
    var output = new Recipe(source)
      .replaceText("1.5", "x", 1)
      .replaceText("Before", "$&After", 1)
      .endPDF();
    writeOutput("replaceText", output);
    var reader = muhammara.createReader(output);
    var text = reader.extractPageText(0);

    assert.equal(text.length, 6);
    assert.equal(text[0].content, "$&After");
    assert.equal(text[0].text, "$&After");
    assert.deepEqual(text[0].textMatrix, [1, 0, 0, 1, 20, 30]);

    var content = pageContent(reader);
    assert.ok(
      content.includes(Buffer.from("% café\n")),
      "non-ASCII content bytes are preserved",
    );
    assert.ok(
      content.includes(Buffer.from("(café) Tj (1x5) Tj\n")),
      "untouched literal strings keep their bytes",
    );
    reader.end();
  });

  it("replaces non-ASCII text written with a composite font", function () {
    var output = new Recipe(source)
      .replaceText("café Ωmega", "Ω café", 1)
      .endPDF();
    var reader = muhammara.createReader(output);
    var text = reader.extractPageText(0);

    assert.equal(text[4].text, "Ω café");
    assert.equal(text[4].content, text[5].content);
    assert.match(
      pageContent(reader).toString("latin1"),
      /<[0-9A-F]+> Tj\s+<[0-9A-F]+> Tj/,
    );
    reader.end();
  });

  it("throws when the font has no glyph for a replacement character", function () {
    var recipe = new Recipe(source);

    assert.throws(() => recipe.replaceText("café Ωmega", "Zürich", 1), {
      name: "Error",
      message:
        'replaceText cannot write the replacement: font FN2 has no glyph for "Z", "ü", "r", "i", "h"',
    });
    assert.throws(() => recipe.replaceText("Before", "€", 1), {
      name: "Error",
      message:
        'replaceText cannot write the replacement: font FN1 has no glyph for "€"',
    });
    recipe.endPDF();
  });

  it("decodes and encodes text through a /Differences encoding", async function () {
    var fixture = new Uint8Array(
      await readFile(new URL("FontDifferences.pdf", FIXTURES)),
    );
    var first = new Recipe(fixture).replaceText("café", "Ω", 1).endPDF();
    var second = new Recipe(fixture).replaceText("Ω of é", "café", 1).endPDF();

    var reader = muhammara.createReader(first);
    assert.deepEqual(
      reader.extractPageText(0).map((element) => element.text),
      ["Ω", "Ω of é"],
    );
    assert.equal(
      pageContent(reader).toString("latin1"),
      "BT\n/F1 24 Tf\n20 100 Td\n(A) Tj\n0 -40 Td\n<41206F662042> Tj\nET\n",
    );
    reader.end();

    reader = muhammara.createReader(second);
    assert.deepEqual(
      reader.extractPageText(0).map((element) => element.text),
      ["café", "café"],
    );
    assert.ok(pageContent(reader).toString("latin1").includes("<63616642> Tj"));
    reader.end();
  });

  it("matches native validation for arguments and page content streams", function () {
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

    var empty = new Recipe().createPage(100, 100).endPage().endPDF();
    assert.throws(
      () => new Recipe(empty).replaceText("Before", "After", 1),
      /replaceText supports pages with one content stream/,
    );
  });
});

// Regression table shared with packages/native-with-source/tests/recipe/replaceText.js.
// FontEncodings.pdf has one page per case: [page, text, replacement, operand
// written back].
var ENCODING_CASES = [
  ["MacRomanEncoding", 1, "café", "éfac", "(\x8efac) Tj"],
  ["implicit StandardEncoding", 2, "It’s", "’sIt", "('sIt) Tj"],
  ["WinAnsiEncoding hex operand", 3, "€ 5", "5 €", "<352080> Tj"],
  ["Type0 bfrange ranges and arrays", 4, "abc", "üΩa", "<000500040001> Tj"],
  ["literal string escapes", 5, "(a)\\b", "b\\(a)", "(b\\\\\\(a\\)) Tj"],
  ["font restored by Q", 6, "é", "éa", "(\x8ea) Tj"],
  ["ToUnicode ligature", 7, "find", "dfi", "<6401> Tj"],
  ["/Differences glyph names", 8, "€fia", "afi€", "<030201> Tj"],
  ["/Widths glyph availability", 9, "ab", "ba", "(ba) Tj"],
  [
    "Identity-H with a one-byte ToUnicode codespace",
    10,
    "xy",
    "yx",
    "<00420041> Tj",
  ],
];

// Real fonts written by the low-level writer: [file, index or metrics file,
// text, replacement]. Arial and the Type1 font write simple single-byte
// fonts; KozGo and Lucida Grande write composite fonts.
var FONT_CASES = [
  ["arial.ttf", null, "Größe über", "über Größe"],
  ["Couri.ttf", null, "naïve café", "café naïve"],
  ["BrushScriptStd.otf", null, "Grüße", "Süße"],
  ["KozGoPro-Regular.otf", null, "こんにちは世界", "世界こんにちは"],
  ["HLB_____.PFB", "HLB_____.PFM", "Übung", "Bügnu"],
  ["LucidaGrande.ttc", 0, "Ωμέγα", "μέγαΩ"],
  ["Courier.dfont", 0, "déjà vu", "vu déjà"],
];

describe("Replace text across font encodings", function () {
  var muhammara;
  var Recipe;
  var fixture;

  before(async function () {
    muhammara = await createMuhammaraWasm();
    Recipe = await createRecipe();
    fixture = new Uint8Array(
      await readFile(new URL("FontEncodings.pdf", FIXTURES)),
    );
  });

  after(function () {
    muhammara.disposeAssets();
  });

  ENCODING_CASES.forEach(function (testCase) {
    var pageNumber = testCase[1];
    it("replaces text with " + testCase[0], function () {
      var reader = muhammara.createReader(fixture);
      assert.equal(reader.extractPageText(pageNumber - 1)[0].text, testCase[2]);
      reader.end();

      var output = new Recipe(fixture)
        .replaceText(testCase[2], testCase[3], pageNumber)
        .endPDF();

      reader = muhammara.createReader(output);
      assert.equal(reader.extractPageText(pageNumber - 1)[0].text, testCase[3]);
      var contents = reader
        .parsePage(pageNumber - 1)
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
      assert.ok(Buffer.from(content).toString("latin1").includes(testCase[4]));
      reader.end();
    });
  });

  it("throws for a code whose /Widths entry is zero", function () {
    var recipe = new Recipe(fixture);
    assert.throws(() => recipe.replaceText("ab", "abc", 9), {
      message:
        'replaceText cannot write the replacement: font F7 has no glyph for "c"',
    });
    recipe.endPDF();
  });

  FONT_CASES.forEach(function (testCase) {
    it("replaces text written with " + testCase[0], async function () {
      var fontName = "replace-text-" + testCase[0];
      var metricsName = fontName + "-metrics";
      muhammara.registerFont(
        fontName,
        new Uint8Array(
          await readFile(new URL("fonts/" + testCase[0], FIXTURES)),
        ),
      );
      if (typeof testCase[1] === "string") {
        muhammara.registerFont(
          metricsName,
          new Uint8Array(
            await readFile(new URL("fonts/" + testCase[1], FIXTURES)),
          ),
        );
      }
      try {
        var writer = muhammara.createWriter();
        var page = writer.createPage(0, 0, 300, 100);
        var font =
          typeof testCase[1] === "string"
            ? writer.getFontForBytes(fontName, metricsName)
            : typeof testCase[1] === "number"
              ? writer.getFontForBytes(fontName, testCase[1])
              : writer.getFontForBytes(fontName);
        writer
          .startPageContentContext(page)
          .BT()
          .Tf(font, 12)
          .Tj(testCase[2])
          .Tj(testCase[3])
          .ET();
        writer.writePage(page);

        var output = new Recipe(writer.end())
          .replaceText(testCase[2], testCase[3], 1)
          .endPDF();
        var reader = muhammara.createReader(output);
        var text = reader.extractPageText(0);
        reader.end();
        assert.deepEqual(
          text.map((element) => element.text),
          [testCase[3], testCase[3]],
        );
        assert.equal(text[0].content, text[1].content);
      } finally {
        muhammara.unregisterFont(fontName);
        if (typeof testCase[1] === "string") {
          muhammara.unregisterFont(metricsName);
        }
      }
    });
  });
});
