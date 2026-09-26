var expect = require("chai").expect;
var path = require("path");
var muhammara = require("../..");
var Recipe = muhammara.Recipe;

/**
 * Read the first page's content stream bytes.
 *
 * @param {object} reader PDF reader.
 * @returns {Buffer} Decoded content stream bytes.
 */
function pageContent(reader) {
  var contents = reader.queryDictionaryObject(
    reader.parsePage(0).getDictionary(),
    "Contents",
  );
  var streamReader = reader.startReadingFromStream(contents);
  var chunks = [];
  while (streamReader.notEnded()) {
    chunks.push(Buffer.from(streamReader.read(65536)));
  }
  return Buffer.concat(chunks);
}

describe("Replace text", function () {
  var source = path.join(__dirname, "../output/Replace text source.pdf");

  before(function () {
    var writer = muhammara.createWriter(source);
    var page = writer.createPage(0, 0, 200, 200);
    var font = writer.getFontForFile(
      path.join(__dirname, "../TestMaterials/fonts/arial.ttf"),
    );

    writer
      .startPageContentContext(page)
      .BT()
      .Tf(font, 12)
      .Tm(1, 0, 0, 1, 20, 30)
      .Tj("Before")
      .Tj("$&After")
      .writeFreeCode("(café) Tj (1x5) Tj\n")
      .Tj("café Ωmega")
      .Tj("Ω café")
      .ET()
      .writeFreeCode("% café\n");
    writer.writePage(page);
    writer.end();
  });

  it("replaces text at its existing position", function () {
    var output = path.join(__dirname, "../output/Replace text output.pdf");
    var recipe = new Recipe(source, output);
    expect(() => recipe.replaceText("Before", "After")).to.throw(
      "replaceText expects a positive integer page number",
    );
    expect(() => recipe.replaceText("Before", "After", 0)).to.throw(
      "replaceText expects a positive integer page number",
    );
    recipe
      .replaceText("1.5", "x", 1)
      .replaceText("Before", "$&After", 1)
      .endPDF();

    var reader = muhammara.createReader(output);
    var text = reader.extractPageText(0);

    expect(text).to.have.lengthOf(6);
    expect(text[0].content).to.equal("$&After");
    expect(text[0].text).to.equal("$&After");
    expect(text[0].textMatrix).to.deep.equal([1, 0, 0, 1, 20, 30]);

    var content = pageContent(reader);
    expect(content.includes(Buffer.from("% café\n"))).to.equal(true);
    expect(content.includes(Buffer.from("(café) Tj (1x5) Tj\n"))).to.equal(
      true,
    );
    reader.end();
  });

  it("replaces non-ASCII text written with a composite font", function () {
    var output = path.join(__dirname, "../output/Replace text composite.pdf");
    new Recipe(source, output).replaceText("café Ωmega", "Ω café", 1).endPDF();

    var reader = muhammara.createReader(output);
    var text = reader.extractPageText(0);

    expect(text[4].text).to.equal("Ω café");
    expect(text[4].content).to.equal(text[5].content);
    expect(pageContent(reader).toString("latin1")).to.match(
      /<[0-9A-F]+> Tj\s+<[0-9A-F]+> Tj/,
    );
    reader.end();
  });

  it("throws when the font has no glyph for a replacement character", function () {
    var recipe = new Recipe(
      source,
      path.join(__dirname, "../output/Replace text missing glyph.pdf"),
    );

    expect(() => recipe.replaceText("café Ωmega", "Zürich", 1)).to.throw(
      Error,
      'replaceText cannot write the replacement: font FN2 has no glyph for "Z", "ü", "r", "i", "h"',
    );
    expect(() => recipe.replaceText("Before", "€", 1)).to.throw(
      Error,
      'replaceText cannot write the replacement: font FN1 has no glyph for "€"',
    );
    recipe.endPDF();
  });

  it("decodes and encodes text through a /Differences encoding", function () {
    var fixture = path.join(__dirname, "../TestMaterials/FontDifferences.pdf");
    var first = path.join(__dirname, "../output/Replace text differences.pdf");
    var second = path.join(
      __dirname,
      "../output/Replace text differences hex.pdf",
    );
    new Recipe(fixture, first).replaceText("café", "Ω", 1).endPDF();
    new Recipe(fixture, second).replaceText("Ω of é", "café", 1).endPDF();

    var reader = muhammara.createReader(first);
    var content = pageContent(reader).toString("latin1");
    expect(
      reader.extractPageText(0).map(function (element) {
        return element.text;
      }),
    ).to.deep.equal(["Ω", "Ω of é"]);
    expect(content).to.equal(
      "BT\n/F1 24 Tf\n20 100 Td\n(A) Tj\n0 -40 Td\n<41206F662042> Tj\nET\n",
    );
    reader.end();

    reader = muhammara.createReader(second);
    expect(
      reader.extractPageText(0).map(function (element) {
        return element.text;
      }),
    ).to.deep.equal(["café", "café"]);
    expect(pageContent(reader).toString("latin1")).to.include("<63616642> Tj");
    reader.end();
  });
});

// Regression table shared with packages/wasm/tests/recipe/replaceText.test.mjs.
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
  var fixture = path.join(__dirname, "../TestMaterials/FontEncodings.pdf");

  ENCODING_CASES.forEach(function (testCase) {
    var name = testCase[0];
    var pageNumber = testCase[1];
    it("replaces text with " + name, function () {
      var output = path.join(
        __dirname,
        "../output/Replace text encoding " + pageNumber + ".pdf",
      );
      var reader = muhammara.createReader(fixture);
      expect(reader.extractPageText(pageNumber - 1)[0].text).to.equal(
        testCase[2],
      );
      reader.end();

      new Recipe(fixture, output)
        .replaceText(testCase[2], testCase[3], pageNumber)
        .endPDF();

      reader = muhammara.createReader(output);
      expect(reader.extractPageText(pageNumber - 1)[0].text).to.equal(
        testCase[3],
      );
      var contents = reader.queryDictionaryObject(
        reader.parsePage(pageNumber - 1).getDictionary(),
        "Contents",
      );
      var streamReader = reader.startReadingFromStream(contents);
      var chunks = [];
      while (streamReader.notEnded()) {
        chunks.push(Buffer.from(streamReader.read(65536)));
      }
      expect(Buffer.concat(chunks).toString("latin1")).to.include(testCase[4]);
      reader.end();
    });
  });

  it("throws for a code whose /Widths entry is zero", function () {
    var recipe = new Recipe(
      fixture,
      path.join(__dirname, "../output/Replace text zero width.pdf"),
    );
    expect(() => recipe.replaceText("ab", "abc", 9)).to.throw(
      'replaceText cannot write the replacement: font F7 has no glyph for "c"',
    );
    recipe.endPDF();
  });

  FONT_CASES.forEach(function (testCase) {
    it("replaces text written with " + testCase[0], function () {
      var fonts = path.join(__dirname, "../TestMaterials/fonts");
      var source = path.join(
        __dirname,
        "../output/Replace text font " + testCase[0] + ".pdf",
      );
      var output = path.join(
        __dirname,
        "../output/Replace text font " + testCase[0] + " output.pdf",
      );
      var writer = muhammara.createWriter(source);
      var page = writer.createPage(0, 0, 300, 100);
      var font =
        typeof testCase[1] === "string"
          ? writer.getFontForFile(
              path.join(fonts, testCase[0]),
              path.join(fonts, testCase[1]),
            )
          : typeof testCase[1] === "number"
            ? writer.getFontForFile(path.join(fonts, testCase[0]), testCase[1])
            : writer.getFontForFile(path.join(fonts, testCase[0]));
      writer
        .startPageContentContext(page)
        .BT()
        .Tf(font, 12)
        .Tj(testCase[2])
        .Tj(testCase[3])
        .ET();
      writer.writePage(page);
      writer.end();

      new Recipe(source, output)
        .replaceText(testCase[2], testCase[3], 1)
        .endPDF();

      var reader = muhammara.createReader(output);
      var text = reader.extractPageText(0);
      reader.end();
      expect(
        text.map(function (element) {
          return element.text;
        }),
      ).to.deep.equal([testCase[3], testCase[3]]);
      expect(text[0].content).to.equal(text[1].content);
    });
  });
});
