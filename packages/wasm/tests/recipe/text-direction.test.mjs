// Byte-first port of tests/recipe/text-direction.js.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createMuhammaraWasm } from "../../index.js";
import { writeOutput } from "../testOutput.mjs";
import { getRecipe } from "./recipe.mjs";

describe("Recipe text direction", function () {
  var muhammara;
  var Recipe;

  before(async function () {
    muhammara = await createMuhammaraWasm();
    muhammara.registerFont(
      "arial",
      new Uint8Array(await readFile("tests/TestMaterials/fonts/arial.ttf")),
    );
    Recipe = await getRecipe();
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

  /**
   * Draw on a new 400 by 400 page, finish the Recipe, and read the page back.
   *
   * @param {string} name Output file name.
   * @param {function(object): void} draw Draws on the page.
   * @returns {Array<{text: string, x: number, y: number}>} The runs.
   */
  function drawPage(name, draw) {
    var recipe = new Recipe().createPage(400, 400);
    try {
      draw(recipe);
      var bytes = recipe.endPage().endPDF();
      writeOutput(name, bytes);
      return pageText(bytes);
    } finally {
      recipe.dispose();
    }
  }

  /**
   * The runs drawn on one line, from left to right.
   *
   * @param {Array<{text: string, x: number, y: number}>} runs The page's runs.
   * @param {number} [line=0] The zero-based line.
   * @returns {Array<{text: string, x: number, y: number}>} The line's runs.
   */
  function lineRuns(runs, line = 0) {
    var ys = [...new Set(runs.map((run) => run.y))];
    return runs
      .filter((run) => run.y === ys[line])
      .sort((left, right) => left.x - right.x);
  }

  it("draws text as given by default", function () {
    var runs = drawPage("text-direction-default", (recipe) => {
      recipe.text("שלום עולם", 20, 20, { font: "arial", size: 12 });
    });
    assert.deepEqual(
      runs.map((run) => run.text),
      ["שלום עולם"],
    );
  });

  it("draws each wrapped line in visual order", function () {
    var runs = drawPage("text-direction-lines", (recipe) => {
      var options = { font: "arial", size: 12, direction: "auto" };
      recipe
        .text("שלום עולם", 20, 20, options)
        .text("אחת שתיים שלוש ארבע חמש", 20, 60, {
          ...options,
          textBox: { width: 90 },
        })
        .text("Hello\nשלום abc", 20, 140, options)
        .text("Hello\nשלום abc", 20, 200, { ...options, direction: "ltr" })
        .text("שלום", 20, 260, { ...options, direction: "none" });
    });
    assert.deepEqual(
      runs.map((run) => run.text),
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
  });

  it("places justified words from right to left", function () {
    var runs = drawPage("text-direction-justify", (recipe) => {
      recipe.text("אחת שתיים שלוש ארבע חמש", 20, 20, {
        font: "arial",
        size: 12,
        direction: "auto",
        textBox: { width: 120, textAlign: "justify" },
      });
    });
    assert.deepEqual(
      lineRuns(runs).map((run) => run.text.trim()),
      ["עברא", "שולש", "םייתש", "תחא"],
    );
    assert.equal(runs[runs.length - 1].text, "שמח");
  });

  it("keeps non-breaking spaces inside justified words", function () {
    var runs = drawPage("text-direction-nbsp", (recipe) => {
      recipe.text("אחת שתיים מחיר 120\u00a0ש״ח ארבע חמש שש שבע", 20, 20, {
        font: "arial",
        size: 12,
        direction: "auto",
        textBox: { width: 150, textAlign: "justify" },
      });
    });
    assert.ok(
      runs.some((run) => run.text.trim() === "ח״ש\u00a0120"),
      JSON.stringify(runs),
    );
  });

  it("indents justified right-to-left list items from the right", function () {
    var font = muhammara.createWriter().getFontForBytes("arial");
    var space =
      font.calculateTextDimensions("o o", 12).xMax -
      font.calculateTextDimensions("oo", 12).xMax;
    /**
     * Where a run's glyphs start, after its leading spaces.
     * @param {{text: string, x: number}} run A drawn run.
     * @returns {number} The x of the run's first glyph edge.
     */
    var inkLeft = (run) =>
      run.x +
      (run.text.length - run.text.trimStart().length) * space +
      font.calculateTextDimensions(run.text.trimStart(), 12).xMin;
    var gaps = {};
    for (var direction of ["auto", "none"]) {
      var runs = drawPage("text-direction-indent-" + direction, (recipe) => {
        recipe.text(
          "<ul><li>אחת שתיים שלוש ארבע חמש שש שבע שמונה</li></ul>",
          20,
          20,
          {
            font: "arial",
            size: 12,
            html: true,
            direction,
            textBox: { width: 120, textAlign: "justify" },
          },
        );
      });
      // The second line is wrapped, indented and justified.
      var visible = lineRuns(runs, 1).filter((run) => run.text.trim());
      gaps[direction] = {
        left: Math.min(...visible.map(inkLeft)) - 20,
        right:
          140 -
          Math.max(
            ...visible.map(
              (run) =>
                run.x +
                font.calculateTextDimensions(run.text.trimEnd(), 12).xMax,
            ),
          ),
      };
    }
    assert.ok(gaps.none.left > 20, JSON.stringify(gaps));
    // Reordered, the indent moves to the right side by the same width.
    assert.ok(
      Math.abs(gaps.auto.right - gaps.none.left) < 2,
      JSON.stringify(gaps),
    );
    assert.ok(gaps.auto.left < 2, JSON.stringify(gaps));
  });

  it("orders the styled runs of an HTML line as one line", function () {
    var runs = drawPage("text-direction-html", (recipe) => {
      recipe.text("<p>שלום <u>עולם</u> יפה</p>", 20, 20, {
        font: "arial",
        size: 12,
        html: true,
        direction: "auto",
        textBox: { width: 300 },
      });
    });
    // Read from the right, the line is "שלום עולם יפה".
    assert.deepEqual(
      lineRuns(runs).map((run) => run.text.trim()),
      ["הפי", "םלוע", "םולש"],
    );
  });

  it("justifies the styled runs of an HTML line from right to left", function () {
    var runs = drawPage("text-direction-html-justify", (recipe) => {
      recipe.text(
        "<p>אחת <u>שתיים</u> שלוש ארבע חמש שש שבע שמונה תשע</p>",
        20,
        20,
        {
          font: "arial",
          size: 12,
          html: true,
          direction: "auto",
          textBox: { width: 120, textAlign: "justify" },
        },
      );
    });
    var line = lineRuns(runs);
    assert.deepEqual(
      line.slice(-3).map((run) => run.text.trim()),
      ["שולש", "םייתש", "תחא"],
    );
    // Justified, the line spans the box from edge to edge.
    assert.ok(Math.abs(line[0].x - 20) < 1, JSON.stringify(line));
    assert.ok(
      Math.abs(inkRight(line[line.length - 1], 12) - 140) < 1,
      JSON.stringify(line),
    );
  });

  it("aligns text by the width it draws, without formatting characters", function () {
    var runs = drawPage("text-direction-marks", (recipe) => {
      var options = {
        font: "arial",
        size: 12,
        direction: "auto",
        textBox: { width: 200, textAlign: "right" },
      };
      recipe
        .text("שלום", 20, 20, options)
        .text("\u2067שלום\u2069", 20, 60, options);
    });
    assert.equal(runs[1].text, runs[0].text);
    assert.ok(Math.abs(runs[1].x - runs[0].x) < 0.01, JSON.stringify(runs));
  });

  /**
   * Measure where a run's glyphs end.
   *
   * @param {{text: string, x: number}} run A drawn run.
   * @param {number} size Its font size.
   * @returns {number} The x of the run's last glyph edge.
   */
  function inkRight(run, size) {
    var writer = muhammara.createWriter();
    return (
      run.x +
      writer
        .getFontForBytes("arial")
        .calculateTextDimensions(run.text.trim(), size).xMax
    );
  }

  it("aligns a reordered HTML line by its drawn width, with its spaces", function () {
    var runs = drawPage("text-direction-html-align", (recipe) => {
      ["right", "center", "left"].forEach((textAlign, index) => {
        recipe.text("<p>שלום <u>עולם</u> יפה</p>", 20, 20 + index * 30, {
          font: "arial",
          size: 16,
          html: true,
          direction: "auto",
          textBox: { width: 380, textAlign },
        });
      });
    });
    var [right, center, left] = [0, 1, 2].map((line) => lineRuns(runs, line));
    assert.ok(Math.abs(inkRight(right[right.length - 1], 16) - 400) < 0.5);
    assert.ok(
      Math.abs(
        (center[0].x + inkRight(center[center.length - 1], 16)) / 2 - 210,
      ) < 0.5,
    );
    assert.ok(Math.abs(left[0].x - 20) < 0.5);
    // Each word keeps a space before the next one.
    right.slice(1).forEach((run, index) => {
      assert.ok(run.x - inkRight(right[index], 16) > 3, JSON.stringify(right));
    });
  });

  it("ends the last line of a justified right-to-left paragraph at the right edge", function () {
    var runs = drawPage("text-direction-justify-last", (recipe) => {
      recipe
        .text("השועל החום המהיר קפץ מעל הכלב העצלן ושוב קפץ", 20, 20, {
          font: "arial",
          size: 12,
          direction: "auto",
          textBox: { width: 200, textAlign: "justify" },
        })
        .text("the quick brown fox jumps over the lazy dog again", 20, 100, {
          font: "arial",
          size: 12,
          direction: "auto",
          textBox: { width: 200, textAlign: "justify" },
        });
    });
    var rtlLast = runs.filter((run) => run.y > 300).pop();
    var ltrLast = runs.filter((run) => run.y < 300).pop();
    assert.ok(
      Math.abs(inkRight(rtlLast, 12) - 220) < 0.5,
      JSON.stringify(rtlLast),
    );
    assert.ok(Math.abs(ltrLast.x - 20) < 0.5, JSON.stringify(ltrLast));
  });

  it("measures text without the formatting characters text() drops", function () {
    var recipe = new Recipe();
    try {
      var options = { font: "arial", size: 12 };
      var plain = recipe.textDimensions("שלום", options).xMax;
      assert.equal(
        recipe.textDimensions("\u2067שלום\u2069", {
          ...options,
          direction: "auto",
        }).xMax,
        plain,
      );
      assert.ok(
        recipe.textDimensions("\u2067שלום\u2069", options).xMax > plain,
      );
    } finally {
      recipe.dispose();
    }
  });

  it("adds one text-markup annotation across a reordered line", function () {
    var recipe = new Recipe().createPage(400, 400);
    var bytes;
    try {
      bytes = recipe
        .text("<p>שלום <u>עולם</u> יפה</p>", 20, 20, {
          font: "arial",
          size: 16,
          html: true,
          direction: "auto",
          highlight: true,
          textBox: { width: 360, textAlign: "right" },
        })
        .endPage()
        .endPDF();
    } finally {
      recipe.dispose();
    }
    writeOutput("text-direction-markup", bytes);
    var reader = muhammara.createReader(bytes);
    try {
      var runs = reader.extractPageText(0);
      var annotations = reader
        .parsePage(0)
        .getDictionary()
        .toJSObject()
        .Annots.toJSArray()
        .map((reference) =>
          reader
            .parseNewObject(reference.getObjectID())
            .toJSObject()
            .Rect.toJSArray()
            .map((value) => value.value),
        );
    } finally {
      reader.end();
    }
    assert.equal(annotations.length, 1);
    var left = Math.min(...runs.map((run) => run.textMatrix[4]));
    assert.ok(
      Math.abs(annotations[0][0] - left) < 1,
      JSON.stringify(annotations),
    );
    assert.ok(annotations[0][2] <= 381, JSON.stringify(annotations));
  });

  it("keeps an HTML paragraph's direction on its wrapped lines", function () {
    var runs = drawPage("text-direction-html-paragraph", (recipe) => {
      var options = {
        font: "arial",
        size: 12,
        html: true,
        direction: "auto",
        textBox: { width: 120 },
      };
      recipe
        .text("<p>אחת שתיים שלוש ארבע hello חמש שש</p>", 20, 20, options)
        .text("<p>hello עולם</p><p>שלום world</p>", 20, 100, {
          ...options,
          textBox: { width: 300 },
        });
    });
    assert.deepEqual(
      runs.map((run) => run.text),
      ["עברא שולש םייתש תחא", "שש שמח hello", "hello םלוע", "world םולש"],
    );
  });

  it("clips an overflowing right-to-left line at its end", function () {
    var runs = drawPage("text-direction-clip", (recipe) => {
      recipe.text("שלום עולם זהו טקסט ארוך בעברית שצריך", 100, 20, {
        font: "arial",
        size: 12,
        direction: "rtl",
        textBox: { width: 150, wrap: "clip" },
      });
    });
    var run = runs[0];
    // The line's start, its first word, ends at the right edge; the
    // overflow is cut on the left.
    assert.ok(run.text.trimEnd().endsWith("םולש"), run.text);
    assert.ok(Math.abs(inkRight(run, 12) - 250) < 1, JSON.stringify(run));
    assert.ok(run.x < 100, JSON.stringify(run));
  });

  it("highlights the last line of a justified right-to-left paragraph inside the box", function () {
    var rectangles = [];
    drawPage("text-direction-hilite", (recipe) => {
      var rectangle = recipe.rectangle;
      recipe.rectangle = function (x, y, width, height, options) {
        rectangles.push({ x, width });
        return rectangle.call(this, x, y, width, height, options);
      };
      recipe.text("שלום עולם זהו טקסט", 100, 20, {
        font: "arial",
        size: 12,
        direction: "rtl",
        hilite: true,
        textBox: { width: 200, textAlign: "justify" },
      });
    });
    assert.equal(rectangles.length, 1);
    assert.ok(rectangles[0].x > 150, JSON.stringify(rectangles));
    assert.ok(
      Math.abs(rectangles[0].x + rectangles[0].width - 300) < 1,
      JSON.stringify(rectangles),
    );
  });

  it("rejects an unknown direction before drawing", function () {
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
