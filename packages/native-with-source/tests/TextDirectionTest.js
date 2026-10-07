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
      // An indent stays at the start of a right-to-left line, its right end.
      ["whitespace at both ends", "  שלום ", "םולש   "],
      ["whitespace in a left-to-right line", "  abc שלום ", "  abc םולש "],
      ["left-to-right text", "Hello, world.", "Hello, world."],
      [
        "an emoji with a skin tone",
        "\u05d0 \u{1f44b}\u{1f3fd} \u05d1",
        "\u05d1 \u{1f44b}\u{1f3fd} \u05d0",
        "rtl",
      ],
      [
        "an emoji joined with U+200D",
        "\u05d0 \u{1f468}\u200d\u{1f469}\u200d\u{1f467} \u05d1",
        "\u05d1 \u{1f468}\u200d\u{1f469}\u200d\u{1f467} \u05d0",
        "rtl",
      ],
      [
        "a flag",
        "\u05d0 \u{1f1ee}\u{1f1f1} \u05d1",
        "\u05d1 \u{1f1ee}\u{1f1f1} \u05d0",
        "rtl",
      ],
      [
        "an astral mark on its letter",
        "\u05d0\u{101fd}\u05d1",
        "\u05d1\u{101fd}\u05d0",
        "rtl",
      ],
      [
        "emoji as neutral characters",
        "\u05d0 \u{1f600}\u{1f603} \u05d1",
        "\u05d1 \u{1f603}\u{1f600} \u05d0",
        "rtl",
      ],
      [
        "a number after an emoji",
        "\u05d0 \u{1f600} 12",
        "12 \u{1f600} \u05d0",
        "rtl",
      ],
      [
        "an astral right-to-left script",
        "\u{10900}\u{10901} abc",
        "abc \u{10901}\u{10900}",
        "auto",
      ],
      [
        "a variation selector after its character",
        "\u05d0 \u2764\ufe0f \u05d1",
        "\u05d1 \u2764\ufe0f \u05d0",
        "rtl",
      ],
      [
        "an information separator inside a paragraph",
        "abc\u001c\u05d0\u05d1",
        "abc\u001c\u05d1\u05d0",
        "auto",
      ],
    ].forEach(function (testCase) {
      it("reorders " + testCase[0], function () {
        assert.equal(
          textDirection.toVisual(testCase[1], testCase[3] || "auto"),
          testCase[2],
        );
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
      assert.equal(
        textDirection.resolveDirection("\u{1f600} שלום", "auto"),
        "rtl",
      );
    });
  });

  describe("hasStrongCharacter", function () {
    it("finds letters and direction marks, not digits or brackets", function () {
      assert.isTrue(textDirection.hasStrongCharacter("(1) abc"));
      assert.isTrue(textDirection.hasStrongCharacter("12 שלום"));
      assert.isTrue(textDirection.hasStrongCharacter("\u200f(1)"));
      assert.isFalse(textDirection.hasStrongCharacter("(1) 2345, 6789!"));
      assert.isFalse(textDirection.hasStrongCharacter(""));
    });
  });

  describe("grapheme segmenter", function () {
    it("is created once, not for every reordered text", function () {
      textDirection.toVisual("שלום עולם", "rtl");
      const Segmenter = Intl.Segmenter;
      let created = 0;
      Intl.Segmenter = function (...args) {
        created++;
        return new Segmenter(...args);
      };
      try {
        for (let index = 0; index < 3; index++) {
          assert.equal(textDirection.toVisual("שלום עולם", "rtl"), "םלוע םולש");
        }
      } finally {
        Intl.Segmenter = Segmenter;
      }
      assert.equal(created, 0);
    });
  });

  describe("hasStrongCharacter outside isolates", function () {
    it("skips the letters of an isolate, as the paragraph direction does", function () {
      assert.isFalse(textDirection.hasStrongCharacter("\u2067abc\u2069 1 2"));
      assert.isFalse(
        textDirection.hasStrongCharacter("\u2068\u2066שלום\u2069\u2069"),
      );
      assert.isTrue(textDirection.hasStrongCharacter("\u2067abc\u2069 שלום"));
      assert.isTrue(textDirection.hasStrongCharacter("\u202babc\u202c"));
    });
  });

  describe("spacedPieces", function () {
    it("keeps character spacing out of a right-to-left letter and its points", function () {
      // Drawn order: the points of each letter come before it.
      assert.deepEqual(
        textDirection.spacedPieces(
          "\u05d0\u05b5\u05e8\u05b0\u05bc\u05d1",
          "rtl",
        ),
        ["\u05d0\u05b5", "\u05e8\u05b0", "\u05bc", "\u05d1"],
      );
      assert.equal(
        textDirection.drawnGaps("\u05d0\u05b5\u05e8\u05b0\u05bc\u05d1", "rtl"),
        2,
      );
      // Text drawn as given keeps spacing everywhere, with or without
      // bidi-js.
      assert.deepEqual(textDirection.spacedPieces("\u05d0\u05b5\u05e8"), [
        "\u05d0\u05b5\u05e8",
      ]);
      assert.equal(textDirection.spacedGaps("\u05d1\u05b0", "none"), 1);
      assert.equal(textDirection.spacedGaps(""), 0);
    });

    it("counts the same spacing in typed and in drawn order", function () {
      // Points stay with the character reordering drew them before, a
      // right-to-left punctuation mark too, and marks after any other
      // character stay with it, wherever neutral characters stand.
      for (var [text, direction, gaps] of [
        ["\u05d1\u05b0\u05bc\u05e8\u05b5\u05d0", "rtl", 2],
        ["\u05d0\u05c3\u0591\u05d1", "rtl", 2],
        ["\u05d0\u05be\u05b8\u05d1", "rtl", 2],
        ["\u05d0\u05b8\u05f4", "rtl", 1],
        ["e\u0301\u05d0 x", "ltr", 4],
        ["\u05d0Cafe\u0301", "rtl", 5],
        ["\u05e9\u05c1\u05b8\u05dc\u05d5\u05b9\u05dd.", "rtl", 4],
        ['"\u05e9\u05c1\u05b8\u05dc\u05d5\u05b9\u05dd"', "rtl", 5],
        ["(\u05e9\u05c1\u05b8\u05dc\u05d5\u05b9\u05dd)", "auto", 5],
        ["\u05d0\u05b8\u05d11", "rtl", 2],
        ["\u{1e900}\u{1e944}\u{1e901}", "rtl", 1],
        ["\u200f\u05d0\u05b8\u05d1", "rtl", 1],
      ]) {
        assert.equal(textDirection.spacedGaps(text, direction), gaps, text);
        assert.equal(
          textDirection.drawnGaps(
            textDirection.toVisual(text, direction),
            direction,
          ),
          gaps,
          text,
        );
      }
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

    it("puts the points of a right-to-left letter before it, as drawn", function () {
      assert.equal(
        textDirection.drawnText("\u05d1\u05b4", "rtl"),
        "\u05b4\u05d1",
      );
      assert.equal(
        textDirection.drawnText("\u05d1\u05b4", "auto"),
        "\u05b4\u05d1",
      );
      // A left-to-right letter keeps its marks after it.
      assert.equal(
        textDirection.drawnText("\u05d1\u05b4 e\u0301", "rtl"),
        "\u05b4\u05d1 e\u0301",
      );
      assert.equal(
        textDirection.drawnText("\u05d1\u05b4", "none"),
        "\u05d1\u05b4",
      );
    });
  });

  describe("visualRuns", function () {
    it("orders the runs of a right-to-left line from right to left", function () {
      assert.deepEqual(
        textDirection.visualRuns(["שלום ", "עולם", " יפה"], "auto"),
        [
          { run: 2, text: "הפי " },
          { run: 1, text: "םלוע" },
          { run: 0, text: " םולש" },
        ],
      );
    });

    it("places a run that holds both directions", function () {
      assert.deepEqual(textDirection.visualRuns(["abc שלום", " עולם"], "rtl"), [
        { run: 1, text: "םלוע " },
        { run: 0, text: "םולש abc" },
      ]);
      assert.deepEqual(textDirection.visualRuns(["  abc ", "שלום"], "ltr"), [
        { run: 0, text: "  ", indent: true },
        { run: 0, text: "abc " },
        { run: 1, text: "םולש" },
      ]);
    });

    it("keeps every space in its own run's segment", function () {
      assert.deepEqual(
        textDirection.visualRuns(["abc", " ", " def שלום"], "ltr"),
        [
          { run: 0, text: "abc" },
          { run: 1, text: " " },
          { run: 2, text: " def םולש" },
        ],
      );
      assert.deepEqual(
        textDirection.visualRuns(["שלום ", "\u00a0", "עולם"], "rtl"),
        [
          { run: 2, text: "םלוע" },
          { run: 1, text: "\u00a0" },
          { run: 0, text: " םולש" },
        ],
      );
      // Spaces that end a run stay in it, at the end of the line.
      assert.deepEqual(textDirection.visualRuns(["  אב ", "abc  "], "rtl"), [
        { run: 1, text: "abc" },
        { run: 0, text: " בא" },
        { run: 1, text: "  " },
        { run: 0, text: "  ", indent: true },
      ]);
    });

    it("places a run with a direction of its own as one block", function () {
      const runs = (texts, direction, runDirections) =>
        textDirection
          .visualRuns(texts, direction, runDirections)
          .map((segment) => segment.run + ":" + segment.text);
      // An "rtl" run in a "none" line is reordered on its own.
      assert.deepEqual(runs(["Hello ", "שלום עולם"], "none", ["none", "rtl"]), [
        "0:Hello ",
        "1:םלוע םולש",
      ]);
      // A "none" run in a right-to-left line stays exactly as given.
      assert.deepEqual(
        runs(["שלום ", "abc ופ", " עולם"], "rtl", ["rtl", "none", "rtl"]),
        ["2:םלוע ", "1:abc ופ", "0: םולש"],
      );
      // A right-to-left run in a left-to-right line keeps its punctuation.
      assert.deepEqual(
        runs(["abc ", "שלום עולם!", " def"], "ltr", ["ltr", "rtl", "ltr"]),
        ["0:abc ", "1:!םלוע םולש", "2: def"],
      );
      // Runs that follow the line, or keep their order, change nothing.
      assert.equal(
        textDirection.visualRuns(["abc ", "def"], "ltr", ["ltr", "rtl"]),
        null,
      );
      assert.equal(
        textDirection.visualRuns(["שלום ", "abc"], "none", [undefined, "none"]),
        null,
      );
    });

    it("keeps lines that do not reorder", function () {
      assert.isNull(textDirection.visualRuns(["Hello ", "world"], "auto"));
      assert.isNull(textDirection.visualRuns(["שלום ", "עולם"]));
      assert.isNull(textDirection.visualRuns(["שלום\n", "עולם"], "auto"));
      assert.isNull(textDirection.visualRuns(["\u200f"], "rtl"));
      assert.isNull(textDirection.visualRuns(["  ", "\u202b"], "rtl"));
    });

    it("splits segments into justifiable words", function () {
      assert.deepEqual(
        textDirection.visualWords(
          textDirection.visualRuns(["  מחיר 120\u00a0ש״ח ", "עולם"], "rtl"),
        ),
        [
          { run: 1, text: "םלוע", gap: false },
          // The space after the second run's first word is its own.
          { run: 0, text: " ", gap: true },
          { run: 0, text: "ח״ש\u00a0120 ", gap: true },
          { run: 0, text: "ריחמ", gap: false },
          // The indent stays at the line's start, its right end.
          { run: 0, text: "  ", gap: false, indent: true },
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
        compress: false,
      });
      var pageModifier = new muhammara.PDFPageModifier(modifier, 0);
      var modifiedFont = modifier.getFontForFile(ARIAL);
      // Logical text written with "auto" draws like visual text written as
      // is, the default.
      pageModifier
        .startContext()
        .getContext()
        .writeText("שלום עולם", 10, 100, {
          font: modifiedFont,
          size: 12,
          direction: "auto",
        })
        .writeText("םלוע םולש", 10, 80, { font: modifiedFont, size: 12 })
        .writeText("שלום עולם", 10, 60, { font: modifiedFont, size: 12 });
      pageModifier.endContext().writePage();
      modifier.end();
      var shown = Array.from(
        require("fs")
          .readFileSync(modified, "latin1")
          .matchAll(/(<[0-9A-F]+>) Tj/g),
        function (match) {
          return match[1];
        },
      );
      assert.equal(shown.length, 3);
      assert.equal(shown[0], shown[1]);
      assert.notEqual(shown[0], shown[2]);
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

    it("reorders once when the module is loaded again", function () {
      // Jest loads native-core again for every test file while the addon
      // stays loaded; writeText must keep wrapping the addon's original.
      var indexPath = require.resolve("@muhammara/native-core");
      var bindingPath = require("@mapbox/node-pre-gyp").find(
        require.resolve("@muhammara/native-with-source/package.json"),
      );
      var cached = require.cache[indexPath];
      delete require.cache[indexPath];
      try {
        require(indexPath).createMuhammara(require(bindingPath));
      } finally {
        require.cache[indexPath] = cached;
      }
      assert.deepEqual(
        writeLines("TextDirectionReload", [
          { text: "שלום עולם", options: { direction: "auto" } },
        ]),
        ["םלוע םולש"],
      );
    });

    it("refuses an addon that does not export its content contexts", function () {
      var createMuhammara = require("@muhammara/native-core").createMuhammara;
      /** A reader class stub. */
      var PDFReader = function () {};
      /**
       * A text extraction stub.
       *
       * @returns {void}
       */
      PDFReader.prototype.extractPageText = function () {};
      /** A writer class stub. */
      var PDFWriter = function () {};
      assert.throws(function () {
        createMuhammara({ PDFWriter: PDFWriter, PDFReader: PDFReader });
      }, "does not export PageContentContext");
    });
  });

  describe("loading bidi-js", function () {
    afterEach(function () {
      textDirection.useBidi(require("bidi-js"));
    });

    it("draws text as given without bidi-js and names it when reordering", function () {
      var text = "שלום abc";
      var cause = new Error("Cannot find module 'bidi-js'");
      textDirection.useBidi(cause);
      // Character spacing works without it.
      assert.equal(textDirection.drawnGaps("\u05b0\u05d1 a", "rtl"), 2);
      assert.equal(textDirection.toVisual(text, "none"), text);
      assert.equal(textDirection.toVisual("abc", "auto"), "abc");
      var error;
      try {
        textDirection.toVisual(text, "auto");
      } catch (thrown) {
        error = thrown;
      }
      assert.match(error.message, /needs bidi-js/);
      assert.strictEqual(error.cause, cause);
    });

    it("reorders with the factory it is given", function () {
      textDirection.useBidi(require("bidi-js"));
      assert.equal(textDirection.toVisual("שלום abc", "auto"), "abc םולש");
    });
  });
});
