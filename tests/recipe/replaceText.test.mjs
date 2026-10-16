import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describeEnds, fixture, writeOutput } from "../support/ends.mjs";
import { pageContent } from "../support/pdf.mjs";
import { extractedText, lowLevelPdf } from "../support/tables.mjs";

/**
 * A page of Arial text runs: "Before", "$&After", two literal strings written
 * as free code, a composite run and its replacement, then a non-ASCII comment.
 * @param {object} end - The end.
 * @returns {Uint8Array} The source PDF.
 */
function source(end) {
  return lowLevelPdf(end, 200, 200, (context, font) => {
    context
      .BT()
      .Tf(font("arial.ttf"), 12)
      .Tm(1, 0, 0, 1, 20, 30)
      .Tj("Before")
      .Tj("$&After")
      .writeFreeCode("(café) Tj (1x5) Tj\n")
      .Tj("café Ωmega")
      .Tj("Ω café")
      .ET()
      .writeFreeCode("% café\n");
  });
}

/**
 * The page content as raw bytes, so non-ASCII bytes compare exactly.
 * @param {object} end - The end.
 * @param {Uint8Array} bytes - The PDF.
 * @param {number} [pageIndex=0] - The zero-based page.
 * @returns {Buffer} The content bytes.
 */
function contentBytes(end, bytes, pageIndex = 0) {
  return Buffer.from(pageContent(end, bytes, pageIndex), "latin1");
}

// Regression table: FontEncodings.pdf has one page per case: [name, page,
// text, replacement, operand written back].
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
  ["arial.ttf", undefined, "Größe über", "über Größe"],
  ["Couri.ttf", undefined, "naïve café", "café naïve"],
  ["BrushScriptStd.otf", undefined, "Grüße", "Süße"],
  ["KozGoPro-Regular.otf", undefined, "こんにちは世界", "世界こんにちは"],
  ["HLB_____.PFB", "HLB_____.PFM", "Übung", "Bügnu"],
  ["LucidaGrande.ttc", 0, "Ωμέγα", "μέγαΩ"],
  ["Courier.dfont", 0, "déjà vu", "vu déjà"],
];

describeEnds("Recipe replaceText", function (end) {
  it("validates arguments, page numbers and page content streams", function () {
    var recipe = end.openRecipe(source(end));
    assert.throws(() => recipe.replaceText("Before", 1), {
      name: "TypeError",
      message: "replaceText expects text and replacement strings",
    });
    assert.throws(() => recipe.replaceText("Before", "After"), {
      name: "TypeError",
      message: "replaceText expects a positive integer page number",
    });
    assert.throws(() => recipe.replaceText("Before", "After", 0), {
      name: "TypeError",
      message: "replaceText expects a positive integer page number",
    });
    assert.throws(() => recipe.replaceText("Before", "After", 999), {
      name: "RangeError",
      message: "replaceText page 999 does not exist",
    });
    assert.throws(() => end.newRecipe().replaceText("Before", "After", 1), {
      name: "RangeError",
      message: "replaceText page 1 does not exist",
    });
    recipe.endPDF();

    var empty = end.newRecipe().createPage(100, 100).endPage().endPDF();
    writeOutput(end, "replaceText-validation-source", empty);
    assert.throws(
      () => end.openRecipe(empty).replaceText("Before", "After", 1),
      /replaceText supports pages with one content stream/,
    );
  });

  it("replaces text at its existing position", function () {
    var output = end
      .openRecipe(source(end))
      .replaceText("1.5", "x", 1)
      .replaceText("Before", "$&After", 1)
      .endPDF();
    writeOutput(end, "replaceText", output);
    var text = extractedText(end, output);

    assert.equal(text.length, 6);
    assert.equal(text[0].content, "$&After");
    assert.equal(text[0].text, "$&After");
    assert.deepEqual(text[0].textMatrix, [1, 0, 0, 1, 20, 30]);

    var content = contentBytes(end, output);
    assert.ok(
      content.includes(Buffer.from("% café\n")),
      "non-ASCII content bytes are preserved",
    );
    assert.ok(
      content.includes(Buffer.from("(café) Tj (1x5) Tj\n")),
      "untouched literal strings keep their bytes",
    );
  });

  it("replaces non-ASCII text written with a composite font", function () {
    var output = end
      .openRecipe(source(end))
      .replaceText("café Ωmega", "Ω café", 1)
      .endPDF();
    writeOutput(end, "replaceText-composite", output);
    var text = extractedText(end, output);

    assert.equal(text[4].text, "Ω café");
    assert.equal(text[4].content, text[5].content);
    assert.match(pageContent(end, output), /<[0-9A-F]+> Tj\s+<[0-9A-F]+> Tj/);
  });

  it("throws when the font has no glyph for a replacement character", function () {
    var recipe = end.openRecipe(source(end));

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
    writeOutput(end, "replaceText-missing-glyph", recipe.endPDF());
  });

  it("decodes and encodes text through a /Differences encoding", function () {
    var first = end
      .openRecipe("FontDifferences.pdf")
      .replaceText("café", "Ω", 1)
      .endPDF();
    var second = end
      .openRecipe("FontDifferences.pdf")
      .replaceText("Ω of é", "café", 1)
      .endPDF();
    writeOutput(end, "replaceText-differences", first);
    writeOutput(end, "replaceText-differences-hex", second);

    assert.deepEqual(
      extractedText(end, first).map((run) => run.text),
      ["Ω", "Ω of é"],
    );
    assert.equal(
      pageContent(end, first),
      "BT\n/F1 24 Tf\n20 100 Td\n(A) Tj\n0 -40 Td\n<41206F662042> Tj\nET\n",
    );
    assert.deepEqual(
      extractedText(end, second).map((run) => run.text),
      ["café", "café"],
    );
    assert.ok(pageContent(end, second).includes("<63616642> Tj"));
  });
});

describeEnds("Recipe replaceText across font encodings", function (end) {
  var encodings = readFileSync(fixture("FontEncodings.pdf"));

  ENCODING_CASES.forEach(function ([
    name,
    pageNumber,
    text,
    replacement,
    operand,
  ]) {
    it("replaces text with " + name, function () {
      assert.equal(extractedText(end, encodings, pageNumber - 1)[0].text, text);
      var output = end
        .openRecipe("FontEncodings.pdf")
        .replaceText(text, replacement, pageNumber)
        .endPDF();
      writeOutput(end, "replaceText-encoding-" + pageNumber, output);

      assert.equal(
        extractedText(end, output, pageNumber - 1)[0].text,
        replacement,
      );
      assert.ok(pageContent(end, output, pageNumber - 1).includes(operand));
    });
  });

  it("replaces text in malformed fonts and cyclic page trees", function () {
    var recipe = end.openRecipe("FontMalformed.pdf");

    // Page 1 has a /Parent cycle and no fonts: nothing decodes to "abc".
    recipe.replaceText("abc", "cba", 1);
    // Pages 2 and 14 show the same font, whose /Widths holds an unresolvable
    // item; the error names the font as each page calls it.
    assert.throws(() => recipe.replaceText("BA", "AB", 2), {
      message:
        "replaceText cannot write the replacement: font F1 has a malformed /Widths array",
    });
    assert.throws(() => recipe.replaceText("BA", "AB", 14), {
      message:
        "replaceText cannot write the replacement: font F7 has a malformed /Widths array",
    });
    assert.throws(() => recipe.replaceText("ab", "ba", 13), {
      message:
        "replaceText cannot write the replacement: font F1 has a malformed /Widths array",
    });
    // Page 16's embedded Type 1 program has an unknown built-in encoding.
    assert.throws(() => recipe.replaceText("��", "ab", 16), {
      message:
        'replaceText cannot write the replacement: font F1 has no glyph for "a", "b"',
    });
    var output = recipe
      .replaceText("Total", "Tal", 10)
      .replaceText("ABCZ", "ZCBA", 11)
      .replaceText("ąłАś", "śАłą", 12)
      // Page 15's font resource is named /F#C3#A9.
      .replaceText("abc", "cba", 15)
      .endPDF();
    writeOutput(end, "replaceText-malformed", output);

    assert.equal(extractedText(end, output, 0)[0].content, "abc");
    assert.deepEqual(
      [9, 10, 11, 14].map(
        (pageIndex) => extractedText(end, output, pageIndex)[0].text,
      ),
      ["Tal", "ZCBA", "śАłą", "cba"],
    );
  });

  it("throws for a code whose /Widths entry is zero", function () {
    var recipe = end.openRecipe("FontEncodings.pdf");
    assert.throws(() => recipe.replaceText("ab", "abc", 9), {
      message:
        'replaceText cannot write the replacement: font F7 has no glyph for "c"',
    });
    writeOutput(end, "replaceText-zero-width", recipe.endPDF());
  });

  FONT_CASES.forEach(function ([file, extra, text, replacement]) {
    it("replaces text written with " + file, function () {
      var input = lowLevelPdf(end, 300, 100, (context, font) => {
        context.BT().Tf(font(file, extra), 12).Tj(text).Tj(replacement).ET();
      });
      writeOutput(end, "replaceText-font-" + file + "-source", input);
      var output = end
        .openRecipe(input)
        .replaceText(text, replacement, 1)
        .endPDF();
      writeOutput(end, "replaceText-font-" + file, output);

      var runs = extractedText(end, output);
      assert.deepEqual(
        runs.map((run) => run.text),
        [replacement, replacement],
      );
      assert.equal(runs[0].content, runs[1].content);
    });
  });
});
