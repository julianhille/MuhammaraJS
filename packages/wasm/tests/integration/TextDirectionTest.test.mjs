// Byte-first port of tests/TextDirectionTest.js.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import {
  TextDirection,
  createMuhammaraWasm,
  createRecipe,
  loadBidi,
} from "../../index.js";
import {
  drawnText,
  hasStrongCharacter,
  paragraphDirections,
  spaceAdvance,
  trimBreakableEnd,
  NO_BREAK_SPACES,
  LINE_BREAKS,
  readDirection,
  resolveDirection,
  drawnGaps,
  spacedGaps,
  spacedPieces,
  toVisual,
  useBidi,
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
      it("drops the spaces that end a line but the no-break spaces", function () {
        // Both ends trim lines and build their patterns from these classes.
        assert.equal(trimBreakableEnd("a \t\u0085\u2028 "), "a");
        for (var space of ["\u00a0", "\u2007", "\u202f"]) {
          assert.equal(trimBreakableEnd("a" + space + " "), "a" + space);
          assert.ok(
            NO_BREAK_SPACES.includes(space.codePointAt(0).toString(16)),
          );
        }
        assert.deepEqual(
          "a\r\nb\vc\fd\u0085e\u2028f\u2029g".split(
            new RegExp("\\r\\n|[" + LINE_BREAKS + "]"),
          ),
          ["a", "b", "c", "d", "e", "f", "g"],
        );
      });

      it("draws a no-break space ending a right-to-left line on its left", function () {
        // The bidirectional algorithm places U+00A0 and U+202F as separators
        // and U+2007 as whitespace at the line's end, on the left; spaces a
        // line breaks at stay at the end of the text.
        for (var space of ["\u00a0", "\u2007", "\u202f"]) {
          assert.equal(
            toVisual("\u05e9\u05dc\u05d5\u05dd" + space, "rtl"),
            space + "\u05dd\u05d5\u05dc\u05e9",
          );
        }
        assert.equal(
          toVisual("\u05e9\u05dc\u05d5\u05dd ", "rtl"),
          "\u05dd\u05d5\u05dc\u05e9 ",
        );
      });

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

    it("measures a space as the advance it takes between letters", function () {
      var measured = [];
      assert.equal(
        spaceAdvance(function (text) {
          measured.push(text);
          return { "o o": 13.5, oo: 10 }[text];
        }),
        3.5,
      );
      assert.deepEqual(measured, ["o o", "oo"]);
    });

    it("finds the paragraph at any offset, its break included", function () {
      // A paragraph's break belongs to it; offsets are looked up in any
      // order, past the text's end too.
      var directionAt = paragraphDirections("ab\r\n\u05d0\u05d1\nc", "auto");
      var expected = ["ltr", "ltr", "ltr", "ltr", "rtl", "rtl", "rtl", "ltr"];
      for (var offset = expected.length - 1; offset >= 0; --offset) {
        assert.equal(directionAt(offset), expected[offset], String(offset));
      }
      assert.equal(directionAt(100), "ltr");
      var paragraphs = [];
      for (var index = 0; index < 1000; ++index) {
        paragraphs.push(index % 3 ? "abc" : "\u05d0\u05d1\u05d2");
      }
      var longAt = paragraphDirections(paragraphs.join("\n"), "auto");
      for (index = 999; index >= 0; index -= 7) {
        assert.equal(longAt(index * 4 + 1), index % 3 ? "ltr" : "rtl");
      }
    });

    it("resolves a paragraph's direction as the bidirectional algorithm does", async function () {
      var bidi = (await import("bidi-js")).default();
      for (var text of [
        "1 (\u05d0) b",
        "\u2067abc\u2069 \u05d0",
        "\u2067abc \u05d0",
        "\u202babc\u202c \u05d0",
        "\u200f abc",
        "12 \n\u05d0",
        "\u2029\u05d0",
        "\u001c\u05d0",
        "\u{1e900} abc",
        "\u{10400} \u05d0",
        "\ud800 \u05d0",
        "1 2 3",
      ]) {
        // The algorithm runs on the text as reordering classifies it: a
        // lone surrogate and U+001C-U+001E are neutral there.
        var classified = text
          .replace(/[\u001c-\u001e]|[\ud800-\udbff](?![\udc00-\udfff])/g, "!")
          .replace(/\u{1e900}/gu, "\u05d0\u05b8")
          .replace(/\u{10400}/gu, "a\u05b8");
        var level = bidi.getEmbeddingLevels(classified).paragraphs[0].level;
        assert.equal(
          resolveDirection(text, "auto"),
          level % 2 ? "rtl" : "ltr",
          JSON.stringify(text),
        );
      }
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

  describe("hasStrongCharacter outside isolates", function () {
    it("skips the letters of an isolate, as the paragraph direction does", function () {
      assert.equal(hasStrongCharacter("\u2067abc\u2069 1 2"), false);
      assert.equal(hasStrongCharacter("\u2068\u2066שלום\u2069\u2069"), false);
      assert.equal(hasStrongCharacter("\u2067abc\u2069 שלום"), true);
      assert.equal(hasStrongCharacter("\u202babc\u202c"), true);
    });
  });

  describe("spacedPieces", function () {
    it("keeps character spacing out of a right-to-left letter and its points", function () {
      // Drawn order: the points of each letter come before it.
      assert.deepEqual(
        spacedPieces("\u05d0\u05b5\u05e8\u05b0\u05bc\u05d1", "rtl"),
        ["\u05d0\u05b5", "\u05e8\u05b0", "\u05bc", "\u05d1"],
      );
      assert.equal(drawnGaps("\u05d0\u05b5\u05e8\u05b0\u05bc\u05d1", "rtl"), 2);
      // Text drawn as given keeps spacing everywhere, with or without
      // bidi-js.
      assert.deepEqual(spacedPieces("\u05d0\u05b5\u05e8"), [
        "\u05d0\u05b5\u05e8",
      ]);
      assert.equal(spacedGaps("\u05d1\u05b0", "none"), 1);
      assert.equal(spacedGaps(""), 0);
    });

    it("keeps a point drawn after a left-to-right character on its letter", function () {
      // Drawn after "abc", the point of the right-to-left letter still
      // takes no spacing before that letter.
      assert.deepEqual(spacedPieces("abc\u05b8\u05d0", "rtl"), [
        "abc\u05b8",
        "\u05d0",
      ]);
      assert.deepEqual(spacedPieces("Cafe\u0301", "auto"), ["Cafe", "\u0301"]);
    });

    it("counts the same spacing in typed and in drawn order", function () {
      // Marks take no spacing on their character, so a text takes spacing
      // at one boundary fewer than its characters other than marks, however
      // reordering places them.
      for (var [text, direction, gaps] of [
        ["\u05d1\u05b0\u05bc\u05e8\u05b5\u05d0", "rtl", 2],
        ["\u05d0\u05c3\u0591\u05d1", "rtl", 2],
        ["\u05d0\u05be\u05b8\u05d1", "rtl", 2],
        ["\u05d0\u05b8\u05f4", "rtl", 1],
        ["e\u0301\u05d0 x", "ltr", 3],
        ["\u05d0Cafe\u0301", "rtl", 4],
        ["\u05d0\u05b8abc", "rtl", 3],
        ["\u05d0\u05b8123", "rtl", 3],
        ["\u05e9\u05c1\u05b8\u05dc\u05d5\u05b9\u05dd.", "rtl", 4],
        ['"\u05e9\u05c1\u05b8\u05dc\u05d5\u05b9\u05dd"', "rtl", 5],
        ["(\u05e9\u05c1\u05b8\u05dc\u05d5\u05b9\u05dd)", "auto", 5],
        ["\u05d0\u05b8\u05d11", "rtl", 2],
        ["\u{1e900}\u{1e944}\u{1e901}", "rtl", 1],
        ["\u200f\u05d0\u05b8\u05d1", "rtl", 1],
      ]) {
        assert.equal(spacedGaps(text, direction), gaps, text);
        assert.equal(
          drawnGaps(toVisual(text, direction), direction),
          gaps,
          text,
        );
      }
    });
  });

  describe("drawnText", function () {
    it("forms clusters as reordering does", function () {
      // A joiner on a right-to-left letter is drawn before it, as toVisual()
      // draws it, also in text without a mark.
      assert.equal(
        drawnText("\u05e9\u200d", "rtl"),
        toVisual("\u05e9\u200d", "rtl"),
      );
      // A mark after an isolate is not the letter's before it; after a
      // direction mark it is.
      assert.equal(drawnText("\u05e9\u2069\u05b8", "rtl"), "\u05e9\u05b8");
      assert.equal(drawnText("\u05e9\u200f\u05b8", "rtl"), "\u05b8\u05e9");
    });

    it("leaves out the formatting characters reordering drops", function () {
      assert.equal(drawnText("\u2067שלום\u2069", "auto"), "שלום");
      assert.equal(drawnText("abc\u200e", "ltr"), "abc");
      assert.equal(drawnText("\u2067שלום\u2069", "none"), "\u2067שלום\u2069");
      assert.equal(drawnText("Hello", "auto"), "Hello");
    });

    it("puts the points of a right-to-left letter before it, as drawn", function () {
      assert.equal(drawnText("\u05d1\u05b4", "rtl"), "\u05b4\u05d1");
      assert.equal(drawnText("\u05d1\u05b4", "auto"), "\u05b4\u05d1");
      // A left-to-right letter keeps its marks after it.
      assert.equal(
        drawnText("\u05d1\u05b4 e\u0301", "rtl"),
        "\u05b4\u05d1 e\u0301",
      );
      assert.equal(drawnText("\u05d1\u05b4", "none"), "\u05d1\u05b4");
    });
  });

  describe("visualRuns", function () {
    it("keeps left-to-right runs as typed whatever directions they ask for", function () {
      for (var direction of ["none", "auto", "ltr"]) {
        assert.equal(
          visualRuns(["Hello, ", "world (1) ", "again."], direction, [
            undefined,
            "ltr",
            "none",
          ]),
          null,
          direction,
        );
      }
      // A right-to-left run or line still reorders.
      assert.notEqual(
        visualRuns(["Hello, ", "world!"], "auto", [undefined, "rtl"]),
        null,
      );
      assert.notEqual(
        visualRuns(["Hello, ", "world"], "rtl", [undefined, "ltr"]),
        null,
      );
    });

    it("keeps a run that starts with a mark in one piece", function () {
      // The mark has no letter in its run; it does not join the last letter
      // of the run before it.
      assert.deepEqual(
        visualRuns(["\u05e9\u05dc\u05d5\u05dd", "\u05b8abc"], "rtl", [
          undefined,
          "none",
        ]),
        [
          { run: 1, text: "\u05b8abc" },
          { run: 0, text: "\u05dd\u05d5\u05dc\u05e9" },
        ],
      );
      // A direction mark between a letter and its point keeps them together.
      assert.equal(
        toVisual("\u05d0\u200f\u05b8\u05d1", "rtl"),
        "\u05d1\u05b8\u05d0",
      );
    });

    it("orders the runs of a right-to-left line from right to left", function () {
      assert.deepEqual(visualRuns(["שלום ", "עולם", " יפה"], "auto"), [
        { run: 2, text: "הפי " },
        { run: 1, text: "םלוע" },
        { run: 0, text: " םולש" },
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

    it("keeps every space in its own run's segment", function () {
      assert.deepEqual(visualRuns(["abc", " ", " def שלום"], "ltr"), [
        { run: 0, text: "abc" },
        { run: 1, text: " " },
        { run: 2, text: " def םולש" },
      ]);
      assert.deepEqual(visualRuns(["שלום ", "\u00a0", "עולם"], "rtl"), [
        { run: 2, text: "םלוע" },
        { run: 1, text: "\u00a0" },
        { run: 0, text: " םולש" },
      ]);
      // Spaces that end a run stay in it, at the end of the line.
      assert.deepEqual(visualRuns(["  אב ", "abc  "], "rtl"), [
        { run: 1, text: "abc" },
        { run: 0, text: " בא" },
        { run: 1, text: "  " },
        { run: 0, text: "  ", indent: true },
      ]);
    });

    it("places a run with a direction of its own as one block", function () {
      var runs = (texts, direction, runDirections) =>
        visualRuns(texts, direction, runDirections).map(
          (segment) => segment.run + ":" + segment.text,
        );
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
      assert.equal(visualRuns(["abc ", "def"], "ltr", ["ltr", "rtl"]), null);
      assert.equal(
        visualRuns(["שלום ", "abc"], "none", [undefined, "none"]),
        null,
      );
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

  describe("loading bidi-js", function () {
    afterEach(async function () {
      useBidi((await import("bidi-js")).default);
    });

    it("draws text as given without bidi-js and names it when reordering", function () {
      var text = "שלום abc";
      var cause = new TypeError('Failed to resolve module specifier "bidi-js"');
      useBidi(cause);
      // Character spacing works without it.
      assert.equal(drawnGaps("\u05b0\u05d1 a", "rtl"), 2);
      assert.equal(toVisual(text, "none"), text);
      assert.equal(toVisual("abc", "auto"), "abc");
      assert.throws(
        () => toVisual(text, "auto"),
        (error) => /needs bidi-js/.test(error.message) && error.cause === cause,
      );
    });

    /**
     * Runs `body` in a fresh Node process, where nothing has loaded bidi-js.
     *
     * @param {string} body Module code with createMuhammaraWasm, createRecipe
     *   and toVisual in scope.
     * @returns {Promise<string>} What it wrote to stdout.
     */
    async function freshProcess(body) {
      var script = [
        `import { createMuhammaraWasm, createRecipe } from ${JSON.stringify(new URL("../../index.js", import.meta.url).href)};`,
        `import { toVisual } from ${JSON.stringify(new URL("../../lib/text-direction.js", import.meta.url).href)};`,
        'var text = "\\u05e9\\u05dc\\u05d5\\u05dd abc";',
        body,
      ].join("\n");
      var { stdout } = await promisify(execFile)(process.execPath, [
        "--input-type=module",
        "--eval",
        script,
      ]);
      return stdout;
    }

    it("is loaded by createMuhammaraWasm() and createRecipe() by default", async function () {
      this.timeout(30000);
      // A literal specifier, so bundlers keep bidi-js as a chunk.
      assert.match(
        await readFile(new URL("../../index.js", import.meta.url), "utf8"),
        /import\("bidi-js"\)/,
      );
      for (var factory of [
        "createMuhammaraWasm({ recryptWorker: false })",
        "createRecipe({ defaultFont: false, recryptWorker: false })",
      ]) {
        assert.equal(
          await freshProcess(
            `await ${factory};\nprocess.stdout.write(toVisual(text, "auto"));`,
          ),
          "abc םולש",
          factory,
        );
      }
    });

    it("is not loaded with bidi: false", async function () {
      this.timeout(30000);
      assert.equal(
        await freshProcess(
          [
            "await createRecipe({ defaultFont: false, recryptWorker: false, bidi: false });",
            'process.stdout.write(toVisual(text, "none") === text ? "none;" : "reordered;");',
            "try {",
            '  toVisual(text, "auto");',
            "} catch (error) {",
            "  process.stdout.write(error.message);",
            "}",
          ].join("\n"),
        ),
        "none;Reordering right-to-left text needs bidi-js",
      );
    });

    it("is shared by every instance, bidi: false ones too", async function () {
      this.timeout(30000);
      // bidi: false skips loading bidi-js; it does not take it away from an
      // instance once another call loaded it.
      assert.equal(
        await freshProcess(
          [
            "await createRecipe({ defaultFont: false, recryptWorker: false });",
            "await createMuhammaraWasm({ recryptWorker: false, bidi: false });",
            'process.stdout.write(toVisual(text, "auto"));',
          ].join("\n"),
        ),
        "abc \u05dd\u05d5\u05dc\u05e9",
      );
    });

    it("draws flowed left-to-right runs that ask for different directions without bidi-js", async function () {
      this.timeout(30000);
      assert.equal(
        await freshProcess(
          [
            "var Recipe = await createRecipe({ recryptWorker: false, bidi: false });",
            'for (var [first, second] of [[undefined, "ltr"], ["auto", "none"]]) {',
            "  new Recipe()",
            "    .createPage(300, 300)",
            '    .text("Hello ", 50, 50, { flow: true, direction: first })',
            '    .text("world", { direction: second })',
            '    .text("", { flow: false })',
            "    .endPage()",
            "    .endPDF();",
            '  process.stdout.write("drawn;");',
            "}",
          ].join("\n"),
        ),
        "drawn;drawn;",
      );
    });

    it("spaces left-to-right text with marks without bidi-js", async function () {
      this.timeout(30000);
      // Placing the spacing around a mark between two letters asks whether
      // the letter after it is right to left, which left-to-right text
      // answers without bidi-js.
      assert.equal(
        await freshProcess(
          [
            "var Recipe = await createRecipe({ recryptWorker: false, bidi: false });",
            "new Recipe()",
            "  .createPage(200, 200)",
            '  .text("Cafe\\u0301 a\\u0301b", 10, 10, { direction: "auto", charSpace: 2 })',
            "  .endPage()",
            "  .endPDF();",
            'process.stdout.write("drawn");',
          ].join("\n"),
        ),
        "drawn",
      );
    });

    it("loads bidi-js later with loadBidi()", async function () {
      this.timeout(30000);
      var index = JSON.stringify(
        new URL("../../index.js", import.meta.url).href,
      );
      for (var load of [
        "loadBidi()",
        `loadBidi(await import(${JSON.stringify(import.meta.resolve("bidi-js"))}))`,
      ]) {
        assert.equal(
          await freshProcess(
            [
              `var { loadBidi } = await import(${index});`,
              "var Recipe = await createRecipe({ defaultFont: false, recryptWorker: false, bidi: false });",
              "try {",
              '  toVisual(text, "auto");',
              "} catch (error) {",
              '  process.stdout.write("before: " + error.message + ";");',
              "}",
              `await ${load};`,
              'process.stdout.write(toVisual(text, "auto"));',
            ].join("\n"),
          ),
          "before: Reordering right-to-left text needs bidi-js;abc \u05dd\u05d5\u05dc\u05e9",
          load,
        );
      }
    });

    it("keeps the bidi-js loadBidi() was given when a factory's import ends later", async function () {
      this.timeout(30000);
      var index = JSON.stringify(
        new URL("../../index.js", import.meta.url).href,
      );
      var bidi = JSON.stringify(import.meta.resolve("bidi-js"));
      // The factory's import of "bidi-js" ends after loadBidi() installed a
      // copy of its own, which marks the text it reorders.
      assert.equal(
        await freshProcess(
          [
            `var { loadBidi } = await import(${index});`,
            `var factory = (await import(${bidi})).default;`,
            "var own = () => {",
            "  var api = factory();",
            "  var levels = api.getEmbeddingLevels;",
            '  api.getEmbeddingLevels = (...args) => (process.stdout.write("own;"), levels(...args));',
            "  return api;",
            "};",
            "var pending = createRecipe({ defaultFont: false, recryptWorker: false });",
            "await loadBidi(own);",
            "await pending;",
            'toVisual(text, "auto");',
          ].join("\n"),
        ),
        "own;",
      );
    });

    it("uses the bidi-js instance loadBidi() checked its source with", async function () {
      var factory = (await import("bidi-js")).default;
      var built = 0;
      try {
        await loadBidi(() => {
          built++;
          return factory();
        });
        assert.equal(toVisual("\u05d0\u05d1", "rtl"), "\u05d1\u05d0");
        assert.equal(built, 1);
      } finally {
        await loadBidi(factory);
      }
    });

    it("rejects a loadBidi() source that is not bidi-js", async function () {
      for (var source of [
        null,
        "bidi-js",
        {},
        () => 1,
        { default: () => ({}) },
        () => {
          throw new RangeError("not bidi-js");
        },
      ]) {
        await assert.rejects(loadBidi(source), {
          name: "TypeError",
          message: "loadBidi() takes the bidi-js module or its default export",
        });
      }
    });

    it("rejects a bidi option that is not a boolean", async function () {
      for (var factory of [createMuhammaraWasm, createRecipe]) {
        await assert.rejects(factory({ bidi: "yes" }), {
          name: "TypeError",
          message: "bidi must be a boolean",
        });
      }
    });
  });
});
