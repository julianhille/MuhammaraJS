// Byte-first port of tests/TextDirectionTest.js.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  TextDirection,
  createMuhammaraWasm,
  createRecipe,
} from "../../index.js";
import {
  drawnText,
  hasStrongCharacter,
  paragraphDirections,
  readDirection,
  resolveDirection,
  toVisual,
  visualRuns,
  visualWords,
} from "../../lib/text-direction.js";
import { writeOutput } from "../testOutput.mjs";

/** Reads the shared Arial fixture, which has Hebrew glyphs. */
async function arialBytes() {
  return new Uint8Array(await readFile("tests/TestMaterials/fonts/arial.ttf"));
}

describe("TextDirection", function () {
  var muhammara;

  before(async function () {
    muhammara = await createMuhammaraWasm();
    muhammara.registerFont("arial", await arialBytes());
  });

  after(function () {
    muhammara.disposeAssets();
  });

  /**
   * Read a page's decoded text runs in content stream order.
   *
   * @param {Uint8Array} bytes PDF bytes.
   * @returns {string[]} The decoded text of each run.
   */
  function pageText(bytes) {
    var reader = muhammara.createReader(bytes);
    try {
      return reader.extractPageText(0).map((element) => element.text);
    } finally {
      reader.end();
    }
  }

  describe("toVisual", function () {
    for (var [name, text, visual, direction] of [
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
    ]) {
      addToVisualTest(name, text, visual, direction);
    }

    /** Check that `text` reorders to `visual`, with direction "auto" by default. */
    function addToVisualTest(name, text, visual, direction = "auto") {
      it("reorders " + name, function () {
        assert.equal(toVisual(text, direction), visual);
      });
    }

    it("writes text as given by default", function () {
      assert.equal(readDirection(undefined), "none");
      assert.equal(readDirection(null), "none");
      assert.equal(toVisual("שלום עולם"), "שלום עולם");
      assert.equal(toVisual("\u200fשלום"), "\u200fשלום");
    });

    it("keeps paragraph breaks in place", function () {
      assert.equal(toVisual("שלום\nabc def", "auto"), "םולש\nabc def");
      assert.equal(toVisual("abc\u2029שלום עולם", "rtl"), "abc\u2029םלוע םולש");
    });

    it("follows an explicit paragraph direction", function () {
      assert.equal(toVisual("abc שלום", "ltr"), "abc םולש");
      assert.equal(toVisual("abc שלום", "rtl"), "םולש abc");
      assert.equal(toVisual("Hello.", "rtl"), ".Hello");
      assert.equal(toVisual("abc שלום", "none"), "abc שלום");
    });

    it("rejects unknown directions", function () {
      assert.throws(() => toVisual("abc", "up"), TypeError);
      assert.throws(() => readDirection("RTL"), TypeError);
    });

    it("resolves each paragraph's direction", function () {
      var directionAt = paragraphDirections("Hello\nשלום abc\n\n123", "auto");
      assert.equal(directionAt(0), "ltr");
      assert.equal(directionAt(6), "rtl");
      assert.equal(directionAt(15), "ltr");
      assert.equal(paragraphDirections("שלום", "ltr")(0), "ltr");
      assert.equal(paragraphDirections("שלום")(0), "none");
      assert.equal(resolveDirection("\u{1f600} שלום", "auto"), "rtl");
    });
  });

  describe("hasStrongCharacter", function () {
    it("finds letters and direction marks, not digits or brackets", function () {
      assert.equal(hasStrongCharacter("(1) abc"), true);
      assert.equal(hasStrongCharacter("12 שלום"), true);
      assert.equal(hasStrongCharacter("\u200f(1)"), true);
      assert.equal(hasStrongCharacter("(1) 2345, 6789!"), false);
      assert.equal(hasStrongCharacter(""), false);
    });
  });

  describe("grapheme segmenter", function () {
    it("is created once, not for every reordered text", function () {
      toVisual("שלום עולם", "rtl");
      var Segmenter = Intl.Segmenter;
      var created = 0;
      Intl.Segmenter = function (...args) {
        created++;
        return new Segmenter(...args);
      };
      try {
        for (var index = 0; index < 3; index++) {
          assert.equal(toVisual("שלום עולם", "rtl"), "םלוע םולש");
        }
      } finally {
        Intl.Segmenter = Segmenter;
      }
      assert.equal(created, 0);
    });
  });

  describe("drawnText", function () {
    it("leaves out the formatting characters reordering drops", function () {
      assert.equal(drawnText("\u2067שלום\u2069", "auto"), "שלום");
      assert.equal(drawnText("abc\u200e", "ltr"), "abc");
      assert.equal(drawnText("\u2067שלום\u2069", "none"), "\u2067שלום\u2069");
      assert.equal(drawnText("Hello", "auto"), "Hello");
    });
  });

  describe("visualRuns", function () {
    it("orders the runs of a right-to-left line from right to left", function () {
      assert.deepEqual(visualRuns(["שלום ", "עולם", " יפה"], "auto"), [
        { run: 2, text: "הפי " },
        { run: 1, text: "םלוע " },
        { run: 0, text: "םולש" },
      ]);
    });

    it("places a run that holds both directions", function () {
      assert.deepEqual(visualRuns(["abc שלום", " עולם"], "rtl"), [
        { run: 1, text: "םלוע " },
        { run: 0, text: "םולש abc" },
      ]);
      assert.deepEqual(visualRuns(["  abc ", "שלום"], "ltr"), [
        { run: 0, text: "  ", indent: true },
        { run: 0, text: "abc " },
        { run: 1, text: "םולש" },
      ]);
    });

    it("never returns a segment of only whitespace", function () {
      assert.deepEqual(visualRuns(["abc", " ", " def שלום"], "ltr"), [
        { run: 0, text: "abc  " },
        { run: 2, text: "def םולש" },
      ]);
      assert.deepEqual(visualRuns(["שלום ", "\u00a0", "עולם"], "rtl"), [
        { run: 2, text: "םלוע\u00a0 " },
        { run: 0, text: "םולש" },
      ]);
    });

    it("keeps lines that do not reorder", function () {
      assert.equal(visualRuns(["Hello ", "world"], "auto"), null);
      assert.equal(visualRuns(["שלום ", "עולם"]), null);
      assert.equal(visualRuns(["שלום\n", "עולם"], "auto"), null);
      assert.equal(visualRuns(["\u200f"], "rtl"), null);
      assert.equal(visualRuns(["  ", "\u202b"], "rtl"), null);
    });

    it("splits segments into justifiable words", function () {
      assert.deepEqual(
        visualWords(visualRuns(["  מחיר 120\u00a0ש״ח ", "עולם"], "rtl")),
        [
          { run: 1, text: "םלוע ", gap: true },
          { run: 0, text: "ח״ש\u00a0120 ", gap: true },
          { run: 0, text: "ריחמ", gap: false },
          // The indent stays at the line's start, its right end.
          { run: 0, text: "  ", gap: false, indent: true },
        ],
      );
    });
  });

  describe("writeText", function () {
    it("exposes the directions", async function () {
      assert.deepEqual(TextDirection, {
        AUTO: "auto",
        LTR: "ltr",
        RTL: "rtl",
        NONE: "none",
      });
      var Recipe = await createRecipe();
      assert.equal(Recipe.TextDirection, TextDirection);
    });

    it("writes right-to-left text in visual order on request", function () {
      var writer = muhammara.createWriter();
      var page = writer.createPage(0, 0, 400, 400);
      var font = writer.getFontForBytes("arial");
      var context = writer.startPageContentContext(page);
      [
        { text: "השועל החום המהיר", options: { direction: "auto" } },
        { text: "מחיר 120 ש״ח", options: { direction: "auto" } },
        { text: "abc שלום", options: { direction: "rtl" } },
        { text: "abc שלום", options: { direction: "ltr" } },
        { text: "שלום", options: { direction: "none" } },
        { text: "שלום" },
        { text: "Hello, world.", options: { direction: "auto" } },
      ].forEach((line, index) => {
        context.writeText(line.text, 10, 380 - index * 20, {
          font,
          size: 12,
          ...line.options,
        });
      });
      writer.writePage(page);
      var bytes = writer.end();
      writeOutput("TextDirection-writeText", bytes);
      assert.deepEqual(pageText(bytes), [
        "ריהמה םוחה לעושה",
        "ח״ש 120 ריחמ",
        "םולש abc",
        "abc םולש",
        "שלום",
        "שלום",
        "Hello, world.",
      ]);
    });

    for (var mode of ["page", "form", "modified-page", "modified-form"]) {
      addContextTest(mode);
    }

    /** Check that every writer content context reorders written text. */
    function addContextTest(mode) {
      it("reorders writeText on a " + mode + " context", function () {
        var writer;
        if (mode.startsWith("modified")) {
          var original = muhammara.createWriter();
          original.writePage(original.createPage(0, 0, 100, 100));
          writer = muhammara.createWriterToModify(original.end(), {
            compress: false,
          });
        } else writer = muhammara.createWriter({ compress: false });
        writer.getObjectsContext().setCompressStreams(false);
        var form = mode.endsWith("form")
          ? writer.createFormXObject(0, 0, 100, 100)
          : null;
        var page = form ? null : writer.createPage(0, 0, 100, 100);
        var context = form
          ? form.getContentContext()
          : writer.startPageContentContext(page);
        var font = writer.getFontForBytes("arial");
        // Logical text written with "auto" draws like visual text written as
        // is, the default.
        context
          .writeText("שלום עולם", 10, 10, { font, size: 12, direction: "auto" })
          .writeText("םלוע םולש", 10, 10, { font, size: 12 })
          .writeText("שלום עולם", 10, 10, { font, size: 12 });
        if (form) {
          writer.endFormXObject(form);
          writer.writePage(writer.createPage(0, 0, 100, 100));
        } else writer.writePage(page);
        var bytes = writer.end();
        writeOutput("TextDirection-" + mode, bytes);
        var shown = Array.from(
          new TextDecoder("latin1").decode(bytes).matchAll(/(<[0-9A-F]+>) Tj/g),
          (match) => match[1],
        );
        assert.equal(shown.length, 3);
        assert.equal(shown[0], shown[1]);
        assert.notEqual(shown[0], shown[2]);
      });
    }

    it("rejects an unknown direction before writing", function () {
      var writer = muhammara.createWriter();
      var context = writer.startPageContentContext(
        writer.createPage(0, 0, 100, 100),
      );
      assert.throws(
        () =>
          context.writeText("abc", 10, 10, {
            font: writer.getFontForBytes("arial"),
            direction: "up",
          }),
        { name: "TypeError", message: /direction must be/ },
      );
    });
  });
});
