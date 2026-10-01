// Byte-first port of tests/TextDirectionTest.js.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  TextDirection,
  createMuhammaraWasm,
  createRecipe,
} from "../../index.js";
import { toVisual } from "../../lib/text-direction.js";
import { writeOutput } from "../testOutput.mjs";

/** Reads the shared Arial fixture, which has Hebrew glyphs. */
async function arialBytes() {
  return new Uint8Array(await readFile("tests/TestMaterials/fonts/arial.ttf"));
}

describe("TextDirection", function () {
  var muhammara;
  var Recipe;

  before(async function () {
    muhammara = await createMuhammaraWasm();
    muhammara.registerFont("arial", await arialBytes());
    Recipe = await createRecipe();
    Recipe.registerFont("arial", await arialBytes());
  });

  after(function () {
    muhammara.disposeAssets();
    Recipe.disposeAssets();
  });

  /**
   * Read a page's decoded text runs in content stream order.
   *
   * @param {Uint8Array} bytes PDF bytes.
   * @returns {Array<{text: string, x: number, y: number}>} The runs.
   */
  function pageText(bytes) {
    var reader = muhammara.createReader(bytes);
    try {
      return reader.extractPageText(0).map((element) => ({
        text: element.text,
        x: element.textMatrix[4],
        y: element.textMatrix[5],
      }));
    } finally {
      reader.end();
    }
  }

  it("exposes the directions", function () {
    assert.deepEqual(TextDirection, {
      AUTO: "auto",
      LTR: "ltr",
      RTL: "rtl",
      NONE: "none",
    });
    assert.equal(Recipe.TextDirection, TextDirection);
  });

  it("reorders numbers, embedded words, brackets and points", function () {
    assert.equal(toVisual("מחיר 120 ש״ח"), "ח״ש 120 ריחמ");
    assert.equal(toVisual("שלום abc def!"), "!abc def םולש");
    assert.equal(toVisual("שלום (עולם)"), "(םלוע) םולש");
    assert.equal(toVisual("שָׁלוֹם"), "םוֹלשָׁ");
    assert.equal(toVisual("Hello, world."), "Hello, world.");
    assert.equal(toVisual("abc שלום", "rtl"), "םולש abc");
    assert.equal(toVisual("abc שלום", "none"), "abc שלום");
  });

  it("writes right-to-left text in visual order by default", function () {
    var writer = muhammara.createWriter();
    var page = writer.createPage(0, 0, 400, 400);
    var font = writer.getFontForBytes("arial");
    var context = writer.startPageContentContext(page);
    [
      { text: "השועל החום המהיר" },
      { text: "מחיר 120 ש״ח" },
      { text: "abc שלום", options: { direction: "rtl" } },
      { text: "abc שלום", options: { direction: "ltr" } },
      { text: "שלום", options: { direction: "none" } },
      { text: "Hello, world." },
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
    assert.deepEqual(
      pageText(bytes).map((run) => run.text),
      [
        "ריהמה םוחה לעושה",
        "ח״ש 120 ריחמ",
        "םולש abc",
        "abc םולש",
        "שלום",
        "Hello, world.",
      ],
    );
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
      // Logical text written by default draws like visual text written as is.
      context
        .writeText("שלום עולם", 10, 10, { font, size: 12 })
        .writeText("םלוע םולש", 10, 10, { font, size: 12, direction: "none" })
        .writeText("שלום עולם", 10, 10, { font, size: 12, direction: "none" });
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

  it("draws each wrapped Recipe line in visual order", function () {
    var recipe = new Recipe().createPage(400, 400);
    try {
      var bytes = recipe
        .text("שלום עולם", 20, 20, { font: "arial", size: 12 })
        .text("אחת שתיים שלוש ארבע חמש", 20, 60, {
          font: "arial",
          size: 12,
          textBox: { width: 90 },
        })
        .text("Hello\nשלום abc", 20, 140, { font: "arial", size: 12 })
        .text("Hello\nשלום abc", 20, 200, {
          font: "arial",
          size: 12,
          direction: "ltr",
        })
        .text("שלום", 20, 260, { font: "arial", size: 12, direction: "none" })
        .endPage()
        .endPDF();
      writeOutput("TextDirection-recipe", bytes);
      assert.deepEqual(
        pageText(bytes).map((run) => run.text),
        [
          "םלוע םולש",
          "שולש םייתש תחא",
          "שמח עברא",
          "Hello",
          "abc םולש",
          "Hello",
          "םולש abc",
          "שלום",
        ],
      );
    } finally {
      recipe.dispose();
    }
  });

  it("places justified Recipe words from right to left", function () {
    var recipe = new Recipe().createPage(400, 400);
    try {
      var bytes = recipe
        .text("אחת שתיים שלוש ארבע חמש", 20, 20, {
          font: "arial",
          size: 12,
          textBox: { width: 120, textAlign: "justify" },
        })
        .endPage()
        .endPDF();
      writeOutput("TextDirection-justify", bytes);
      var runs = pageText(bytes);
      var firstLine = runs.filter((run) => run.y === runs[0].y);
      assert.deepEqual(
        firstLine.map((run) => run.text.trim()),
        ["עברא", "שולש", "םייתש", "תחא"],
      );
      firstLine.slice(1).forEach((run, index) => {
        assert.ok(firstLine[index].x < run.x);
      });
      assert.equal(runs[runs.length - 1].text, "שמח");
    } finally {
      recipe.dispose();
    }
  });

  it("rejects an unknown Recipe direction before drawing", function () {
    var recipe = new Recipe().createPage(200, 200);
    try {
      assert.throws(() => recipe.text("abc", 10, 10, { direction: "up" }), {
        name: "TypeError",
      });
    } finally {
      recipe.dispose();
    }
  });
});
