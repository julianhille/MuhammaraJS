var muhammara = require("@muhammara/native-with-source");
var textDirection = require("@muhammara/native-core/lib/text-direction");
var assert = require("chai").assert;
var path = require("path");

var Recipe = muhammara.Recipe;
var ARIAL = path.join(__dirname, "TestMaterials", "fonts", "arial.ttf");

/**
 * Read a page's decoded text runs in content stream order.
 *
 * @param {string} file PDF path.
 * @returns {string[]} The decoded text of each run.
 */
function pageText(file) {
  var reader = muhammara.createReader(file);
  var elements = reader.extractPageText(0);
  reader.end();
  return elements.map(function (element) {
    return element.text;
  });
}

/**
 * Write lines with writeText on a new page and read them back.
 *
 * @param {string} name Output file name.
 * @param {Array<{text: string, options: (object|undefined)}>} lines Lines.
 * @returns {string[]} The decoded text of each line.
 */
function writeLines(name, lines) {
  var output = path.join(__dirname, "output", name + ".pdf");
  var writer = muhammara.createWriter(output);
  var page = writer.createPage(0, 0, 400, 400);
  var font = writer.getFontForFile(ARIAL);
  var context = writer.startPageContentContext(page);
  lines.forEach(function (line, index) {
    context.writeText(
      line.text,
      10,
      380 - index * 20,
      Object.assign({ font: font, size: 12 }, line.options),
    );
  });
  writer.writePage(page).end();
  return pageText(output);
}

describe("TextDirection", function () {
  describe("toVisual", function () {
    [
      ["Hebrew", "שלום עולם", "םלוע םולש"],
      ["numbers inside Hebrew", "מחיר 120 ש״ח", "ח״ש 120 ריחמ"],
      ["English inside Hebrew", "שלום abc def!", "!abc def םולש"],
      ["Hebrew inside English", "abc שלום def", "abc םולש def"],
      ["mirrored brackets", "שלום (עולם)", "(םלוע) םולש"],
      // Points come before their letter, where right-to-left fonts expect them.
      [
        "points before their letters",
        "\u05e9\u05b8\u05c1\u05dc\u05d5\u05b9\u05dd",
        "\u05dd\u05b9\u05d5\u05dc\u05c1\u05b8\u05e9",
      ],
      ["surrogate pairs", "שלום \u{1f600} עולם", "םלוע \u{1f600} םולש"],
      ["formatting characters", "\u200fשלום\u200e", "םולש"],
      [
        "a point after a formatting character",
        "\u05d0\u05d1\u200f\u05b8",
        "\u05b8\u05d1\u05d0",
      ],
      ["whitespace at both ends", " שלום ", " םולש "],
      ["left-to-right text", "Hello, world.", "Hello, world."],
    ].forEach(function (testCase) {
      it("reorders " + testCase[0], function () {
        assert.equal(textDirection.toVisual(testCase[1], "auto"), testCase[2]);
      });
    });

    it("writes text as given by default", function () {
      assert.equal(textDirection.readDirection(undefined), "none");
      assert.equal(textDirection.readDirection(null), "none");
      assert.equal(textDirection.toVisual("שלום עולם"), "שלום עולם");
      assert.equal(textDirection.toVisual("\u200fשלום"), "\u200fשלום");
    });

    it("keeps paragraph breaks in place", function () {
      assert.equal(
        textDirection.toVisual("שלום\nabc def", "auto"),
        "םולש\nabc def",
      );
      assert.equal(
        textDirection.toVisual("abc\u2029שלום עולם", "rtl"),
        "abc\u2029םלוע םולש",
      );
    });

    it("follows an explicit paragraph direction", function () {
      assert.equal(textDirection.toVisual("abc שלום", "ltr"), "abc םולש");
      assert.equal(textDirection.toVisual("abc שלום", "rtl"), "םולש abc");
      assert.equal(textDirection.toVisual("Hello.", "rtl"), ".Hello");
      assert.equal(textDirection.toVisual("abc שלום", "none"), "abc שלום");
    });

    it("rejects unknown directions", function () {
      assert.throws(function () {
        textDirection.toVisual("abc", "up");
      }, TypeError);
      assert.throws(function () {
        textDirection.readDirection("RTL");
      }, TypeError);
    });

    it("resolves each paragraph's direction", function () {
      var directionAt = textDirection.paragraphDirections(
        "Hello\nשלום abc\n\n123",
        "auto",
      );
      assert.equal(directionAt(0), "ltr");
      assert.equal(directionAt(6), "rtl");
      assert.equal(directionAt(15), "ltr");
      assert.equal(textDirection.paragraphDirections("שלום", "ltr")(0), "ltr");
      assert.equal(textDirection.paragraphDirections("שלום")(0), "none");
    });
  });

  describe("drawnText", function () {
    it("leaves out the formatting characters reordering drops", function () {
      assert.equal(textDirection.drawnText("\u2067שלום\u2069", "auto"), "שלום");
      assert.equal(textDirection.drawnText("abc\u200e", "ltr"), "abc");
      assert.equal(
        textDirection.drawnText("\u2067שלום\u2069", "none"),
        "\u2067שלום\u2069",
      );
      assert.equal(textDirection.drawnText("Hello", "auto"), "Hello");
    });
  });

  describe("visualRuns", function () {
    it("orders the runs of a right-to-left line from right to left", function () {
      assert.deepEqual(
        textDirection.visualRuns(["שלום ", "עולם", " יפה"], "auto"),
        [
          { run: 2, text: "הפי " },
          { run: 1, text: "םלוע " },
          { run: 0, text: "םולש" },
        ],
      );
    });

    it("places a run that holds both directions", function () {
      assert.deepEqual(textDirection.visualRuns(["abc שלום", " עולם"], "rtl"), [
        { run: 1, text: "םלוע " },
        { run: 0, text: "םולש abc" },
      ]);
      assert.deepEqual(textDirection.visualRuns(["abc ", "שלום"], "ltr"), [
        { run: 0, text: "abc " },
        { run: 1, text: "םולש" },
      ]);
    });

    it("keeps lines that do not reorder", function () {
      assert.isNull(textDirection.visualRuns(["Hello ", "world"], "auto"));
      assert.isNull(textDirection.visualRuns(["שלום ", "עולם"]));
      assert.isNull(textDirection.visualRuns(["שלום\n", "עולם"], "auto"));
    });

    it("splits segments into justifiable words", function () {
      assert.deepEqual(
        textDirection.visualWords(
          textDirection.visualRuns(["  מחיר 120\u00a0ש״ח ", "עולם"], "rtl"),
        ),
        [
          // Whitespace at the start of the line stays in place.
          { run: 0, text: "  ", gap: false },
          { run: 1, text: "םלוע ", gap: true },
          { run: 0, text: "ח״ש\u00a0120 ", gap: true },
          { run: 0, text: "ריחמ", gap: false },
        ],
      );
    });
  });

  describe("writeText", function () {
    it("exposes the directions", function () {
      assert.deepEqual(muhammara.TextDirection, {
        AUTO: "auto",
        LTR: "ltr",
        RTL: "rtl",
        NONE: "none",
      });
      assert.strictEqual(Recipe.TextDirection, muhammara.TextDirection);
      assert.isUndefined(muhammara.PageContentContext);
      assert.isUndefined(muhammara.XObjectContentContext);
    });

    it("writes right-to-left text in visual order on request", function () {
      assert.deepEqual(
        writeLines("TextDirectionWriteText", [
          { text: "השועל החום המהיר", options: { direction: "auto" } },
          { text: "מחיר 120 ש״ח", options: { direction: "auto" } },
          { text: "abc שלום", options: { direction: "rtl" } },
          { text: "abc שלום", options: { direction: "ltr" } },
          { text: "שלום", options: { direction: "none" } },
          { text: "שלום" },
          { text: "Hello, world.", options: { direction: "auto" } },
        ]),
        [
          "ריהמה םוחה לעושה",
          "ח״ש 120 ריחמ",
          "םולש abc",
          "abc םולש",
          "שלום",
          "שלום",
          "Hello, world.",
        ],
      );
    });

    it("reorders text in forms and modified pages", function () {
      var output = path.join(__dirname, "output", "TextDirectionForms.pdf");
      var writer = muhammara.createWriter(output);
      var font = writer.getFontForFile(ARIAL);
      var forms = [
        { text: "שלום עולם", direction: "auto" },
        { text: "םלוע םולש" },
      ].map(function (line) {
        var form = writer.createFormXObject(0, 0, 200, 50);
        form.getContentContext().writeText(line.text, 10, 10, {
          font: font,
          size: 12,
          direction: line.direction,
        });
        writer.endFormXObject(form);
        return form.id;
      });
      var page = writer.createPage(0, 0, 200, 200);
      writer.writePage(page).end();

      var reader = muhammara.createReader(output);
      var contents = forms.map(function (id) {
        var streamReader = reader.startReadingFromStream(
          reader.parseNewObject(id),
        );
        var chunks = [];
        while (streamReader.notEnded()) {
          chunks.push(Buffer.from(streamReader.read(65536)));
        }
        return Buffer.concat(chunks).toString("latin1");
      });
      reader.end();
      assert.equal(contents[0], contents[1]);

      var modified = path.join(
        __dirname,
        "output",
        "TextDirectionModified.pdf",
      );
      var modifier = muhammara.createWriterToModify(output, {
        modifiedFilePath: modified,
      });
      var pageModifier = new muhammara.PDFPageModifier(modifier, 0);
      // Page edits draw into a form, through the same reordering writeText.
      var form = modifier.createFormXObject(0, 0, 10, 10);
      assert.strictEqual(
        pageModifier.startContext().getContext().writeText,
        form.getContentContext().writeText,
      );
      modifier.endFormXObject(form);
      pageModifier.endContext().writePage();
      modifier.end();
    });

    it("rejects an unknown direction before writing", function () {
      var writer = muhammara.createWriter(new muhammara.PDFWStreamForBuffer());
      var page = writer.createPage(0, 0, 200, 200);
      var context = writer.startPageContentContext(page);
      assert.throws(function () {
        context.writeText("abc", 10, 10, {
          font: writer.getFontForFile(ARIAL),
          direction: "up",
        });
      }, /direction must be/);
    });

    it("refuses an addon that does not export its content contexts", function () {
      var createMuhammara = require("@muhammara/native-core").createMuhammara;
      var PDFReader = function () {};
      PDFReader.prototype.extractPageText = function () {};
      assert.throws(function () {
        createMuhammara({ PDFWriter: function () {}, PDFReader: PDFReader });
      }, "does not export PageContentContext");
    });
  });
});
