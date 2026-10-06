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

  /**
   * The rectangles of a page's annotations, as [x1, y1, x2, y2].
   *
   * @param {Uint8Array} bytes PDF bytes.
   * @returns {number[][]} The rectangles.
   */
  function annotationRects(bytes) {
    var reader = muhammara.createReader(bytes);
    try {
      return reader
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
  }

  /**
   * Draw on a new 400 by 400 page and return the finished PDF bytes.
   *
   * @param {string} name Output file name.
   * @param {function(object): void} draw Draws on the page.
   * @returns {Uint8Array} The PDF bytes.
   */
  function drawBytes(name, draw) {
    var recipe = new Recipe().createPage(400, 400);
    try {
      draw(recipe);
      var bytes = recipe.endPage().endPDF();
      writeOutput(name, bytes);
      return bytes;
    } finally {
      recipe.dispose();
    }
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

  it("gives earlier wrapped lines the direction of a later letter, as native does", function () {
    var runs = drawPage("text-direction-wrapped-later-letter", (recipe) => {
      recipe.text("(1) 2345 6789 1234 5678 9012 שלום עולם", 20, 20, {
        font: "arial",
        size: 12,
        direction: "auto",
        textBox: { width: 60 },
      });
    });
    var ys = [...new Set(runs.map((run) => run.y))];
    assert.deepEqual(
      ys.map((y) =>
        runs
          .filter((run) => run.y === y)
          .sort((left, right) => left.x - right.x)
          .map((run) => run.text.trim())
          .join(" "),
      ),
      ["2345 (1)", "1234 6789", "9012 5678", "םלוע םולש"],
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
    /**
     * Where a string's glyphs end at 12 points.
     *
     * @param {string} text The text.
     * @returns {number} Its xMax.
     */
    var xMax = (text) => font.calculateTextDimensions(text, 12).xMax;
    var space = xMax("o o") - xMax("oo");
    var list = "<ul><li>אחת שתיים שלוש ארבע חמש שש שבע שמונה</li></ul>";
    // The indent of a wrapped list line that is neither reordered nor
    // justified: the advance of its leading spaces.
    var plain = lineRuns(
      drawPage("text-direction-indent-none", (recipe) => {
        recipe.text(list, 20, 20, {
          font: "arial",
          size: 12,
          html: true,
          textBox: { width: 120 },
        });
      }),
      1,
    )[0];
    var indent =
      plain.x -
      20 +
      (plain.text.length - plain.text.trimStart().length) * space;
    assert.ok(indent > 20, JSON.stringify(plain));
    var hilites = [];
    var bytes = drawBytes("text-direction-indent-auto", (recipe) => {
      var rectangle = recipe.rectangle;
      /**
       * Record each hilite rectangle's horizontal extent, then draw it.
       *
       * @param {number} x Left.
       * @param {number} y Top.
       * @param {number} width Width.
       * @param {number} height Height.
       * @param {object} options Rectangle options.
       * @returns {object} The recipe.
       */
      recipe.rectangle = function (x, y, width, height, options) {
        hilites.push([x, x + width]);
        return rectangle.call(this, x, y, width, height, options);
      };
      recipe.text(list, 20, 20, {
        font: "arial",
        size: 12,
        html: true,
        direction: "auto",
        hilite: true,
        highlight: true,
        textBox: { width: 120, textAlign: "justify" },
      });
      // A wrapped line of Latin words keeps its indent on the right too.
      recipe.text(
        "<ul><li>שלום עולם abc defgh ijk lmnop qrs tuv wxyz abc def</li></ul>",
        20,
        200,
        {
          font: "arial",
          size: 12,
          html: true,
          direction: "rtl",
          textBox: { width: 120, textAlign: "justify" },
        },
      );
    });
    var runs = pageText(bytes);
    var lines = [...new Set(runs.map((run) => run.y))];
    [1, lines.length - 2].forEach((line) => {
      var visible = lineRuns(runs, line).filter((run) => run.text.trim());
      // The words fill the line from its left edge to the indent.
      assert.ok(Math.abs(visible[0].x - 20) < 2, JSON.stringify(visible));
      var last = visible[visible.length - 1];
      assert.ok(
        Math.abs(140 - indent - (last.x + xMax(last.text.trimEnd()))) < 1,
        JSON.stringify(visible),
      );
    });
    // The text markup of the justified lines ends at the box edge.
    var rects = annotationRects(bytes);
    assert.ok(rects.length > 1, JSON.stringify(rects));
    rects.forEach((rect) => {
      assert.ok(rect[2] < 140.01, JSON.stringify(rects));
    });
    // The hilite of the justified lines spans their widened gaps: every
    // rectangle ends where another starts, or at the box edge.
    assert.ok(hilites.length > 1, JSON.stringify(hilites));
    hilites.forEach((hilite) => {
      assert.ok(
        hilite[1] > 139 ||
          hilites.some((other) => Math.abs(other[0] - hilite[1]) < 1),
        JSON.stringify(hilites),
      );
    });
  });

  it("wraps text with character spacing and direction marks as native does", function () {
    var cases = [
      [
        "one two three four five six seven",
        {},
        ["one two three", "four five six", "seven"],
      ],
      [
        "\u200fשלום\u200f עולם\u200f גדול\u200f מאוד\u200f יפה\u200f",
        { direction: "rtl" },
        ["לודג םלוע םולש", "הפי דואמ"],
      ],
    ];
    cases.forEach(([text, options, expected], index) => {
      var runs = drawPage("text-direction-char-space-" + index, (recipe) => {
        recipe.text(text, 20, 20, {
          font: "arial",
          size: 12,
          charSpace: 2,
          textBox: { width: 110 },
          ...options,
        });
      });
      // The fit check counts the spacing once, and none for the marks.
      assert.deepEqual(
        runs.map((run) => run.text),
        expected,
      );
    });
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
      line
        .map((run) => run.text.trim())
        .filter(Boolean)
        .slice(-3),
      ["שולש", "םייתש", "תחא"],
    );
    // Justified, the line spans the box from edge to edge. A space drawn by
    // its own run may come after the last word.
    assert.ok(Math.abs(line[0].x - 20) < 1, JSON.stringify(line));
    assert.ok(
      Math.abs(
        inkRight(line.filter((run) => run.text.trim()).pop(), 12) - 140,
      ) < 1,
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
        .calculateTextDimensions(run.text.trimEnd(), size).xMax
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
    // Each word keeps a space before the next one, which may be drawn by
    // either run.
    var font = muhammara.createWriter().getFontForBytes("arial");
    var inkLeft = (run) => {
      var word = font.calculateTextDimensions(run.text.trim(), 16);
      return inkRight(run, 16) - word.xMax + word.xMin;
    };
    right.slice(1).forEach((run, index) => {
      assert.ok(
        inkLeft(run) - inkRight(right[index], 16) > 3,
        JSON.stringify(right),
      );
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
    // The one annotation spans every piece, to the box's right edge.
    assert.ok(
      Math.abs(annotations[0][2] - 380) < 0.05,
      JSON.stringify(annotations),
    );
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
      /**
       * Record each hilite rectangle's horizontal extent, then draw it.
       *
       * @param {number} x Left.
       * @param {number} y Top.
       * @param {number} width Width.
       * @param {number} height Height.
       * @param {object} options Rectangle options.
       * @returns {object} The recipe.
       */
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

  it("draws an HTML line that holds only a direction mark", function () {
    var runs = drawPage("text-direction-mark-line", (recipe) => {
      recipe.text("שלום<br>\u200f", 20, 20, {
        font: "arial",
        size: 12,
        html: true,
        direction: "rtl",
        textBox: { width: 200 },
      });
    });
    assert.deepEqual(
      runs.map((run) => run.text),
      ["םולש"],
    );
  });

  it("clips overflowing right-to-left lines at the padded right edge", function () {
    var runs = drawPage("text-direction-clip-padding", (recipe) => {
      var options = {
        font: "arial",
        size: 12,
        direction: "rtl",
        textBox: { width: 150, wrap: "clip", padding: [5, 7, 9, 11] },
      };
      recipe
        .text("שלום עולם זה טקסט ארוך מאוד מאוד בעברית", 20, 20, options)
        .text("<p>שלום <u>עולם</u> זה טקסט ארוך מאוד מאוד בעברית</p>", 20, 60, {
          ...options,
          html: true,
        })
        .text("אבגדהוזחטיכלמנסעפצקרשתאבגדה", 20, 100, options);
    });
    // Every line keeps its start, its first word, at the content edge, 163.
    [0, 1, 2].forEach((line) => {
      var visible = lineRuns(runs, line);
      var rightmost = visible[visible.length - 1];
      assert.ok(
        Math.abs(inkRight(rightmost, 12) - 163) < 1,
        JSON.stringify(visible),
      );
      assert.ok(visible[0].x < 31, JSON.stringify(visible));
    });
  });

  it("keeps links and text markup on the visible part of a clipped right-to-left line", function () {
    var hilites = [];
    var bytes = drawBytes("text-direction-clip-markup", (recipe) => {
      var rectangle = recipe.rectangle;
      /**
       * Record each hilite rectangle's horizontal extent, then draw it.
       *
       * @param {number} x Left.
       * @param {number} y Top.
       * @param {number} width Width.
       * @param {number} height Height.
       * @param {object} options Rectangle options.
       * @returns {object} The recipe.
       */
      recipe.rectangle = function (x, y, width, height, options) {
        hilites.push([x, x + width]);
        return rectangle.call(this, x, y, width, height, options);
      };
      recipe.text("שלום עולם זה טקסט ארוך בעברית", 50, 20, {
        font: "arial",
        size: 12,
        direction: "rtl",
        underline: true,
        hilite: true,
        link: "https://example.com",
        textBox: { width: 150, wrap: "clip" },
      });
    });
    var rects = annotationRects(bytes);
    assert.equal(rects.length, 2);
    // The text fills the box from its left edge, 50, to its right edge, 200.
    rects.forEach((rect) => {
      assert.ok(Math.abs(rect[0] - 50) < 1, JSON.stringify(rects));
      assert.ok(rect[2] <= 200.5 && rect[2] > 190, JSON.stringify(rects));
    });
    // The hilite covers the visible part of the line, the whole box; the
    // drawn text overflows on the left.
    var start = Math.min(...pageText(bytes).map((run) => run.x));
    assert.ok(start < 50, String(start));
    assert.equal(hilites.length, 1);
    assert.ok(hilites[0][0] < 50.5, JSON.stringify(hilites));
    assert.ok(hilites[0][1] > 195, JSON.stringify(hilites));
  });

  it("keeps the hilite and links of right-to-left lines inside the box", function () {
    var hilites = [];
    var bytes = drawBytes("text-direction-link-edge", (recipe) => {
      var rectangle = recipe.rectangle;
      /**
       * Record each hilite rectangle's horizontal extent, then draw it.
       *
       * @param {number} x Left.
       * @param {number} y Top.
       * @param {number} width Width.
       * @param {number} height Height.
       * @param {object} options Rectangle options.
       * @returns {object} The recipe.
       */
      recipe.rectangle = function (x, y, width, height, options) {
        hilites.push([x, x + width]);
        return rectangle.call(this, x, y, width, height, options);
      };
      var options = {
        font: "arial",
        size: 14,
        direction: "rtl",
        hilite: true,
        link: "https://example.com",
      };
      recipe
        .text("שלום Hello עולם", 20, 20, {
          ...options,
          textBox: { width: 300, textAlign: "right" },
        })
        .text("שלום עולם טוב מאוד ונהדר מאוד היום", 20, 100, {
          ...options,
          textBox: { width: 160, textAlign: "justify" },
        });
    });
    var links = annotationRects(bytes);
    // The right-aligned line ends at its box edge, 320.
    assert.ok(Math.abs(hilites[0][1] - 320) < 0.05, JSON.stringify(hilites));
    var right = links.find((rect) => rect[2] > 200);
    assert.ok(Math.abs(right[2] - 320) < 0.05, JSON.stringify(links));
    // The justified line's links cover the gaps between its words and end
    // at its box edge, 180.
    var lineBottom = links.find((rect) => Math.abs(rect[0] - 20) < 0.5)[1];
    var justified = links
      .filter((rect) => rect[1] === lineBottom)
      .sort((a, b) => a[0] - b[0]);
    assert.ok(justified.length > 1, JSON.stringify(links));
    justified.slice(1).forEach((rect, index) => {
      assert.ok(
        Math.abs(rect[0] - justified[index][2]) < 0.5,
        JSON.stringify(justified),
      );
    });
    assert.ok(
      Math.abs(justified[justified.length - 1][2] - 180) < 0.05,
      JSON.stringify(justified),
    );
  });

  it("keeps right-to-left pieces and their hilite on the line", function () {
    var font = muhammara.createWriter().getFontForBytes("arial");
    var hilites = {};
    var draws = {
      // One long word on a justified line starts at the right edge, 130.
      oneWord: [
        "אבגדהוזחטיכלמנסע פצקרשת אבג",
        { textAlign: "justify", width: 110 },
      ],
      // The hilites of styled runs meet without overlapping.
      runs: ["<p>שלום <u>עולם</u> יפה</p>", { textAlign: "right", width: 300 }],
      // The hilite of a list line covers its whole indent, up to 140.
      indent: [
        "<ul><li>אחת שתיים שלוש ארבע חמש שש שבע</li></ul>",
        { textAlign: "right", width: 120 },
      ],
      // A trimmed line and a line of only marks and spaces stay in the box.
      trim: [
        "שלום עולם זהו טקסט ארוך בעברית",
        { textAlign: "right", width: 100, wrap: "trim" },
      ],
      marks: ["\u200f  \u200f", { textAlign: "right", width: 100 }],
    };
    var runs = {};
    for (var name of Object.keys(draws)) {
      var [text, box] = draws[name];
      hilites[name] = [];
      runs[name] = drawPage("text-direction-pieces-" + name, (recipe) => {
        var rectangle = recipe.rectangle;
        /**
         * Record each hilite rectangle's horizontal extent, then draw it.
         *
         * @param {number} x Left.
         * @param {number} y Top.
         * @param {number} width Width.
         * @param {number} height Height.
         * @param {object} options Rectangle options.
         * @returns {object} The recipe.
         */
        recipe.rectangle = function (x, y, width, height, options) {
          hilites[name].push([x, x + width]);
          return rectangle.call(this, x, y, width, height, options);
        };
        recipe.text(text, 20, 20, {
          font: "arial",
          size: 12,
          html: text.startsWith("<"),
          direction: "rtl",
          hilite: name !== "oneWord",
          textBox: box,
        });
      });
    }
    var first = lineRuns(runs.oneWord)[0];
    assert.ok(
      Math.abs(
        first.x + font.calculateTextDimensions(first.text, 12).xMax - 130,
      ) < 0.05,
      JSON.stringify(first),
    );
    var pieces = hilites.runs.slice().sort((a, b) => a[0] - b[0]);
    assert.equal(pieces.length, 3);
    pieces.slice(1).forEach((piece, index) => {
      assert.ok(
        Math.abs(piece[0] - pieces[index][1]) < 0.05,
        JSON.stringify(pieces),
      );
    });
    assert.ok(Math.abs(pieces[2][1] - 320) < 0.05, JSON.stringify(pieces));
    assert.ok(
      hilites.indent.filter((hilite) => Math.abs(hilite[1] - 140) < 0.05)
        .length >= 3,
      JSON.stringify(hilites.indent),
    );
    ["trim", "marks"].forEach((name) => {
      assert.ok(hilites[name].length > 0, name);
      hilites[name].forEach((hilite) => {
        assert.ok(
          hilite[0] >= 20 && hilite[1] < 120.05,
          name + JSON.stringify(hilites[name]),
        );
      });
    });
  });

  it("keeps the underline of a reordered run under its glyphs", function () {
    var font = muhammara.createWriter().getFontForBytes("arial");
    var recipe = new Recipe({ compress: false }).createPage(400, 400);
    var bytes;
    try {
      bytes = recipe
        .text("<p>שלום <u>עולם</u> יפה</p>", 20, 20, {
          font: "arial",
          size: 12,
          html: true,
          direction: "rtl",
          textBox: { width: 300, textAlign: "right" },
        })
        .endPage()
        .endPDF();
    } finally {
      recipe.dispose();
    }
    writeOutput("text-direction-underline", bytes);
    var word = pageText(bytes).find((run) => run.text.trim() === "םלוע");
    var [, start, end] = /([\d.]+) [\d.]+ m\s+([\d.]+) [\d.]+ l/.exec(
      new TextDecoder("latin1").decode(bytes),
    );
    assert.ok(Math.abs(Number(start) - word.x) < 0.05, start);
    assert.ok(
      Math.abs(
        Number(end) - word.x - font.calculateTextDimensions("םלוע", 12).xMax,
      ) < 0.05,
      end,
    );
  });

  it("draws nothing for a line of only direction marks", function () {
    var runs = drawPage("text-direction-mark-only", (recipe) => {
      recipe.text("\u200f", 20, 20, {
        font: "arial",
        size: 12,
        direction: "rtl",
      });
      recipe.text("שלום\n\u200f", 20, 60, {
        font: "arial",
        size: 12,
        direction: "rtl",
      });
    });
    assert.deepEqual(
      runs.map((run) => run.text).filter((text) => text.trim() !== ""),
      ["םולש"],
    );
  });

  it("marks only the word of a justified right-to-left line without gaps", function () {
    var bytes = drawBytes("text-direction-no-gaps", (recipe) => {
      recipe.text("אאא בבבבבבבבבבבבבבבבבבבבב גג", 20, 20, {
        font: "arial",
        size: 12,
        direction: "rtl",
        highlight: true,
        textBox: { width: 100, textAlign: "justify" },
      });
    });
    annotationRects(bytes).forEach((rect) => {
      assert.ok(rect[2] < 120.05, JSON.stringify(rect));
    });
  });

  it("measures table rows without direction marks", function () {
    var heights = [];
    for (var text of [
      "שלום abc עולם def זה ghi טקסט jk ארוך",
      "שלום \u2067abc\u2069 עולם \u2067def\u2069 זה \u2067ghi\u2069 טקסט \u2067jk\u2069 ארוך",
    ]) {
      drawPage("text-direction-table-" + heights.length, (recipe) => {
        var rectangle = recipe.rectangle;
        /**
         * Record each hilite rectangle's horizontal extent, then draw it.
         *
         * @param {number} x Left.
         * @param {number} y Top.
         * @param {number} width Width.
         * @param {number} height Height.
         * @param {object} options Rectangle options.
         * @returns {object} The recipe.
         */
        recipe.rectangle = function (x, y, width, height, options) {
          heights.push(height);
          return rectangle.call(this, x, y, width, height, options);
        };
        recipe.table(20, 20, [{ text }], {
          columns: [
            {
              name: "text",
              width: 160,
              font: "arial",
              size: 14,
              direction: "rtl",
            },
          ],
          border: true,
        });
      });
    }
    assert.ok(heights.length >= 2, JSON.stringify(heights));
    assert.equal(heights[heights.length - 1], heights[0]);
  });

  it("reorders each line once, as native does", function () {
    var segment = Intl.Segmenter.prototype.segment;
    var calls = 0;
    Intl.Segmenter.prototype.segment = function (...args) {
      calls++;
      return segment.apply(this, args);
    };
    var counts = [];
    try {
      for (var textBox of [{}, { width: 300, textAlign: "justify" }]) {
        calls = 0;
        drawPage("text-direction-reorder-once", (recipe) => {
          recipe.text("שלום עולם", 20, 20, {
            font: "arial",
            size: 12,
            direction: "rtl",
            textBox,
          });
        });
        counts.push(calls);
      }
    } finally {
      Intl.Segmenter.prototype.segment = segment;
    }
    // Every reordering segments the line's graphemes once.
    assert.deepEqual(counts, [1, 1]);
  });

  it("measures each piece of a justified right-to-left line once", function () {
    var base = new Recipe().createPage(400, 400).endPage().endPDF();
    var words = ["אחת", "שתיים", "שלוש", "ארבע", "חמש"];
    var text = Array.from({ length: 40 }, (_, index) => words[index % 5]).join(
      " ",
    );
    var counts = {};
    for (var direction of ["none", "rtl"]) {
      // A Recipe that edits a PDF measures through its writer's fonts.
      var recipe = new Recipe(base);
      var calls = 0;
      var getFont = recipe.writer.getFontForBytes;
      recipe.writer.getFontForBytes = function (...args) {
        var font = getFont.apply(this, args);
        if (!font.counted) {
          var measure = font.calculateTextDimensions;
          font.counted = true;
          font.calculateTextDimensions = function (...measureArgs) {
            calls++;
            return measure.apply(this, measureArgs);
          };
        }
        return font;
      };
      try {
        recipe.editPage(1).text(text, 20, 20, {
          font: "arial",
          size: 12,
          direction,
          textBox: { width: 200, textAlign: "justify" },
        });
        recipe.endPage().endPDF();
      } finally {
        recipe.dispose();
      }
      counts[direction] = calls;
    }
    // Drawing the words in visual order reuses their measurements.
    assert.ok(counts.rtl <= counts.none, JSON.stringify(counts));
  });

  it("draws a translucent justified right-to-left line without a form per word, as native", function () {
    var words = ["אחת", "שתיים", "שלוש", "ארבע", "חמש"];
    var text = Array.from({ length: 40 }, (_, index) => words[index % 5]).join(
      " ",
    );
    var forms = {};
    for (var direction of ["none", "rtl"]) {
      var recipe = new Recipe().createPage(400, 400);
      try {
        recipe.text(text, 20, 20, {
          font: "arial",
          size: 12,
          direction,
          opacity: 0.5,
          textBox: { width: 200, textAlign: "justify" },
        });
        var bytes = recipe.endPage().endPDF();
        writeOutput("text-direction-translucent-" + direction, bytes);
        forms[direction] = (
          new TextDecoder("latin1")
            .decode(bytes)
            .match(/\/Subtype\s*\/Form/g) || []
        ).length;
      } finally {
        recipe.dispose();
      }
    }
    // Reordering adds no forms to a translucent line.
    assert.equal(forms.rtl, forms.none);
  });

  it("starts a paragraph with its own direction at every mandatory break, as native", function () {
    var breaks = [
      "\n",
      "\r",
      "\r\n",
      "\u000b",
      "\f",
      "\u0085",
      "\u2028",
      "\u2029",
    ];
    breaks.forEach((lineBreak, index) => {
      var runs = drawPage("text-direction-break-" + index, (recipe) => {
        recipe.text("abc" + lineBreak + "שלום abc", 20, 20, {
          font: "arial",
          size: 12,
          direction: "auto",
        });
      });
      assert.deepEqual(
        runs.map((run) => run.text),
        ["abc", "abc םולש"],
        JSON.stringify(lineBreak),
      );
    });
  });

  it("orders flowed runs of one line as one line", function () {
    var runs = drawPage("text-direction-flow", (recipe) => {
      var options = {
        font: "arial",
        size: 12,
        direction: "auto",
        flow: true,
        textBox: { width: 300 },
      };
      recipe
        .text("שלום ", 20, 20, options)
        .text("עולם יפה", options)
        .text("", { flow: false });
    });
    assert.deepEqual(
      lineRuns(runs).map((run) => run.text.trim()),
      ["הפי םלוע", "םולש"],
    );
  });

  it("gives flowed runs the direction of the paragraph they continue", function () {
    var lines = {};
    for (var flow of [true, false]) {
      var runs = drawPage("text-direction-flow-paragraph-" + flow, (recipe) => {
        var options = {
          font: "arial",
          size: 12,
          direction: "auto",
          textBox: { width: 90 },
        };
        if (flow) {
          recipe
            .text("Hello there ", 20, 20, { ...options, flow: true })
            .text("שלום abc עולם def", options)
            .text("", { flow: false });
        } else {
          recipe.text("Hello there שלום abc עולם def", 20, 20, options);
        }
      });
      lines[flow] = lineRuns(runs, 1).map((run) => run.text.trim());
    }
    // The paragraph starts with a Latin word, so it runs left to right.
    assert.deepEqual(lines[true], ["abc םלוע def"]);
    assert.deepEqual(lines[true], lines[false]);
  });

  it("lets a flowed run without letters take the direction of the runs after it", function () {
    var lines = {};
    for (var flow of [true, false]) {
      var runs = drawPage("text-direction-flow-number-" + flow, (recipe) => {
        var options = {
          font: "arial",
          size: 12,
          direction: "auto",
          textBox: { width: 200 },
        };
        if (flow) {
          recipe
            .text("(1) ", 20, 20, { ...options, flow: true })
            .text("שלום עולם", options)
            .text("", { flow: false });
        } else {
          recipe.text("(1) שלום עולם", 20, 20, options);
        }
      });
      lines[flow] = lineRuns(runs)
        .map((run) => run.text.trim())
        .join(" ");
    }
    assert.equal(lines[true], "םלוע םולש (1)");
    assert.equal(lines[true], lines[false]);
  });

  it("gives earlier wrapped lines of a flowed paragraph the direction found later", function () {
    var lines = {};
    for (var flow of [true, false]) {
      var runs = drawPage("text-direction-flow-wrapped-" + flow, (recipe) => {
        var options = {
          font: "arial",
          size: 12,
          direction: "auto",
          textBox: { width: 60 },
        };
        if (flow) {
          recipe
            .text("(1) 2345 6789 1234 5678 9012 ", 20, 20, {
              ...options,
              flow: true,
            })
            .text("שלום עולם", options)
            .text("", { flow: false });
        } else {
          recipe.text(
            "(1) 2345 6789 1234 5678 9012 שלום עולם",
            20,
            20,
            options,
          );
        }
      });
      var ys = [...new Set(runs.map((run) => run.y))];
      lines[flow] = ys.map((y, index) =>
        lineRuns(runs, index)
          .map((run) => run.text.trim())
          .join(" "),
      );
    }
    // The first strong letter is Hebrew, on the last line, so every line of
    // the paragraph runs right to left.
    assert.deepEqual(lines[false], [
      "2345 (1)",
      "1234 6789",
      "9012 5678",
      "םלוע םולש",
    ]);
    assert.deepEqual(lines[true], lines[false]);
  });

  it("ends the last line of a flowed justified right-to-left paragraph at the right edge", function () {
    var font = muhammara.createWriter().getFontForBytes("arial");
    var runs = drawPage("text-direction-flow-justify", (recipe) => {
      var options = {
        font: "arial",
        size: 12,
        direction: "rtl",
        flow: true,
        textBox: { width: 200, textAlign: "justify" },
      };
      recipe
        .text("שלום עולם ", 100, 20, options)
        .text("זהו טקסט", options)
        .text("", { flow: false });
    });
    var line = lineRuns(runs);
    assert.deepEqual(
      line.map((run) => run.text.trim()),
      ["טסקט והז", "םלוע םולש"],
    );
    var last = line[line.length - 1];
    assert.ok(
      Math.abs(
        last.x +
          font.calculateTextDimensions(last.text.trimEnd(), 12).xMax -
          300,
      ) < 1,
      JSON.stringify(line),
    );
  });

  it("gives each flowed run the direction it asked for", function () {
    // Runs and the line they draw, read from left to right.
    var cases = [
      [
        [
          ["Hello ", undefined],
          ["שלום עולם", "rtl"],
        ],
        "Hello םלוע םולש",
      ],
      [
        [
          ["שלום ", "rtl"],
          ["עולם", "rtl"],
          [" יפה", "rtl"],
        ],
        "הפי םלוע םולש",
      ],
      [
        [
          ["שלום ", "rtl"],
          ["abc ופ", "none"],
          [" עולם", "rtl"],
        ],
        "םלוע abc ופ םולש",
      ],
      [
        [
          ["שלום ", "auto"],
          ["abc", "auto"],
        ],
        "abc םולש",
      ],
      [
        [
          ["שלום ", "rtl"],
          ["abc def", "ltr"],
          [" עולם", "rtl"],
        ],
        "םלוע abc def םולש",
      ],
      [
        [
          ["abc ", "ltr"],
          ["שלום עולם!", "rtl"],
          [" def", "ltr"],
        ],
        "abc !םלוע םולש def",
      ],
    ];
    for (var [index, [texts, expected]] of cases.entries()) {
      var runs = drawPage("text-direction-run-" + index, (recipe) => {
        texts.forEach(([text, direction], run) => {
          var options = { font: "arial", size: 12, direction };
          if (run === 0) recipe.text(text, 20, 20, { ...options, flow: true });
          else recipe.text(text, { ...options, flow: run < texts.length - 1 });
        });
      });
      assert.equal(
        lineRuns(runs)
          .map((run) => run.text)
          .join("")
          .replace(/\s+/g, " ")
          .trim(),
        expected,
        JSON.stringify(texts),
      );
    }
  });

  it("closes a flowed paragraph's direction at movedown()", function () {
    var runs = drawPage("text-direction-flow-movedown", (recipe) => {
      var options = { font: "arial", size: 12, direction: "auto" };
      recipe
        .text("1 - 2", 20, 20, { ...options, flow: true })
        .movedown()
        .text("שלום", { ...options, flow: true })
        .text("", { flow: false });
    });
    // The first paragraph has no letter, so it keeps its order; the
    // Hebrew paragraph after movedown() does not change it, as on native.
    assert.deepEqual(
      runs.map((run) => run.text),
      ["1 - 2", "םולש"],
    );
  });

  it("gives a paragraph starting with an isolate a later letter's direction, as native", function () {
    var runs = drawPage("text-direction-isolate-paragraph", (recipe) => {
      recipe.text("\u2067abc\u2069 1 2 3 4 5 6 7 8 9 שלום", 20, 20, {
        font: "arial",
        size: 12,
        direction: "auto",
        textBox: { width: 60 },
      });
    });
    assert.deepEqual(
      runs.map((run) => run.text),
      ["4 3 2 1 abc", "9 8 7 6 5", "םולש"],
    );
  });

  it("ends a flowed paragraph where an HTML block element ends", function () {
    var runs = drawPage("text-direction-flow-html-block", (recipe) => {
      var options = { font: "arial", size: 12, direction: "auto" };
      recipe
        .text("\u05e9\u05dc\u05d5\u05dd ", 50, 50, { ...options, flow: true })
        .text("<p>x</p>", { ...options, html: true })
        .text("123 def.", { ...options, html: false })
        .text("", { flow: false });
    });
    // "x" starts a paragraph of its own, which the plain run after it
    // continues on the same line.
    assert.deepEqual(
      runs.map((run) => run.text),
      ["\u05dd\u05d5\u05dc\u05e9", "x", "123 def."],
    );
  });

  it("continues a right-to-left flowed paragraph with inline HTML", function () {
    var runs = drawPage("text-direction-flow-html-inline", (recipe) => {
      var options = { font: "arial", size: 12, direction: "auto" };
      recipe
        .text("\u05e9\u05dc\u05d5\u05dd \u05e2\u05d5\u05dc\u05dd ", 50, 50, {
          ...options,
          flow: true,
          textBox: { width: 120 },
        })
        .text("<span>abc def ghi jkl mno.</span>", { ...options, html: true })
        .text("", { flow: false });
    });
    // The paragraph starts with Hebrew, so its wrapped line is right to left.
    // The space after the Hebrew run is its own, drawn on its left.
    assert.deepEqual(
      runs.map((run) => run.text),
      [
        "abc def ghi",
        " \u05dd\u05dc\u05d5\u05e2 \u05dd\u05d5\u05dc\u05e9",
        ".jkl mno",
      ],
    );
  });

  it("gives every flowed HTML block element a paragraph of its own", function () {
    var runs = drawPage("text-direction-flow-html-blocks", (recipe) => {
      var options = { font: "arial", size: 12, html: true, direction: "auto" };
      recipe
        .text("<p>\u05e9\u05dc\u05d5\u05dd</p>", 50, 50, {
          ...options,
          flow: true,
        })
        .text("<p>abc def.</p>", options)
        .text("", { flow: false });
    });
    assert.deepEqual(
      runs.map((run) => run.text),
      ["\u05dd\u05d5\u05dc\u05e9", "abc def."],
    );
  });

  it("breaks a flowed line at every paragraph separator", function () {
    for (var separator of ["\u2028", "\u2029", "\v", "\f", "\u0085", "\r"]) {
      var runs = drawPage("text-direction-flow-separator", (recipe) => {
        var options = { font: "arial", size: 12, direction: "rtl" };
        recipe
          .text(
            "\u05e9\u05dc\u05d5\u05dd" +
              separator +
              "\u05e2\u05d5\u05dc\u05dd ",
            10,
            10,
            {
              ...options,
              flow: true,
            },
          )
          .text("\u05d0\u05d1\u05d2", { ...options, color: "#f00" })
          .text("", { flow: false });
      });
      // The separator is not drawn; the runs after it are reordered as the
      // second line.
      assert.deepEqual(
        [0, 1].map((line) =>
          lineRuns(runs, line).map((run) => run.text.trim()),
        ),
        [
          ["\u05dd\u05d5\u05dc\u05e9"],
          ["\u05d2\u05d1\u05d0", "\u05dd\u05dc\u05d5\u05e2"],
        ],
        JSON.stringify(separator),
      );
    }
  });

  it("resolves a waiting flowed paragraph with the direction its lines asked for", function () {
    var cases = [
      [
        "\u2067\u05e9\u05dc\u05d5\u05dd\u2069 ",
        "none",
        "\u05dd\u05d5\u05dc\u05e9",
      ],
      [
        "\u2067\u05e9\u05dc\u05d5\u05dd\u2069 ",
        "rtl",
        "\u05dd\u05d5\u05dc\u05e9",
      ],
      [
        "\u0661\u0662\u0663 - \u0664\u0665\u0666 ",
        "none",
        "\u0664\u0665\u0666 - \u0661\u0662\u0663",
      ],
    ];
    for (var [text, direction, visual] of cases) {
      var runs = drawPage("text-direction-flow-waiting", (recipe) => {
        var options = { font: "arial", size: 12 };
        recipe
          .text(text, 50, 50, { ...options, direction: "auto", flow: true })
          .text("abc", { ...options, direction })
          .text("", { flow: false });
      });
      // The first run has no letter of its own, so its "auto" paragraph
      // takes the left-to-right direction of "abc", whatever "abc" asked
      // for, and the first run is still reordered.
      assert.deepEqual(
        runs.map((run) => run.text.trim()),
        [visual, "abc"],
        direction,
      );
    }
  });

  it("draws each space of a reordered line with its own run", function () {
    var runs = drawPage("text-direction-run-spaces", (recipe) => {
      var options = { font: "arial", size: 12, direction: "rtl" };
      recipe
        .text("  \u05d0\u05d1 ", 50, 50, {
          ...options,
          flow: true,
          hilite: { color: "#ff0" },
        })
        .text("abc  ", { ...options, size: 24 })
        .text("", { flow: false });
    });
    // The space after the Hebrew run is that run's, drawn at its size on the
    // left of its word, not with the larger Latin run.
    assert.deepEqual(
      lineRuns(runs)
        .slice(0, 2)
        .map((run) => run.text),
      ["abc", " \u05d1\u05d0"],
    );
  });

  it("adds a text-markup annotation to each piece of a reordered flowed line", function () {
    var recipe = new Recipe().createPage(400, 400);
    var options = {
      font: "arial",
      size: 12,
      direction: "rtl",
      underline: true,
    };
    var bytes;
    try {
      bytes = recipe
        .text("\u05e9\u05dc\u05d5\u05dd ", 50, 50, { ...options, flow: true })
        .text("\u05e2\u05d5\u05dc\u05dd ", options)
        .text("", { flow: false })
        .endPage()
        .endPDF();
    } finally {
      recipe.dispose();
    }
    writeOutput("text-direction-flow-markup", bytes);
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
    // One per run, as for a left-to-right flow, each starting at its run.
    assert.equal(annotations.length, 2, JSON.stringify(annotations));
    assert.deepEqual(
      annotations.map((rect) => Math.round(rect[0])),
      runs.map((run) => Math.round(run.textMatrix[4])),
    );
    assert.ok(annotations[0][2] <= annotations[1][0] + 0.01);
  });

  it("measures a pointed right-to-left letter as it is drawn", function () {
    // Drawn, the line is 277 points wide: the point comes before its letter
    // and sits over it. After its letter, as typed, it would reach past the
    // letter to 303 points and wrap the line.
    var runs = drawPage("text-direction-pointed-width", (recipe) => {
      recipe.text("\u05e9\u05dc\u05d5\u05dd \u05d1\u05b4", 50, 50, {
        font: "arial",
        size: 100,
        direction: "rtl",
        textBox: { width: 290 },
      });
    });
    assert.deepEqual(
      runs.map((run) => run.text),
      ["\u05b4\u05d1 \u05dd\u05d5\u05dc\u05e9"],
    );
  });

  it("adds no character spacing between a right-to-left letter and its points", function () {
    var options = { font: "arial", size: 40, direction: "rtl" };
    var pointed = "\u05d1\u05b0\u05bc\u05e8\u05b5\u05d0";
    var recipe = new Recipe();
    try {
      // Three letters take two spacings; their points take none.
      assert.ok(
        Math.abs(
          recipe.textDimensions(pointed, { ...options, charSpace: 10 }).xMax -
            recipe.textDimensions(pointed, options).xMax -
            20,
        ) < 0.01,
      );
    } finally {
      recipe.dispose();
    }
    var page = new Recipe().createPage(400, 400);
    var bytes;
    try {
      bytes = page
        .text(pointed, 50, 50, { ...options, charSpace: 10 })
        .endPage()
        .endPDF();
    } finally {
      page.dispose();
    }
    writeOutput("text-direction-char-space", bytes);
    // The spacing after each point is taken back, so it stays over the
    // letter drawn after it, in one text run as on native.
    var reader = muhammara.createReader(bytes);
    try {
      var contents = reader.queryDictionaryObject(
        reader.parsePageDictionary(0),
        "Contents",
      );
      var input = reader.startReadingFromStream(contents);
      var content = [];
      while (input.notEnded()) content.push(...input.read(1024));
    } finally {
      reader.end();
    }
    assert.match(
      new TextDecoder("latin1").decode(new Uint8Array(content)),
      /\[\s*<[0-9A-F]+>\s*250\s*<[0-9A-F]+>\s*250\s*<[0-9A-F]+>\s*250\s*<[0-9A-F]+>\s*\]\s*TJ/,
    );
  });

  it("lets a flowed HTML paragraph without letters wait for a later run", function () {
    var options = { font: "arial", size: 12, direction: "auto" };
    var lines = (runs) =>
      [0, 1].map((line) => lineRuns(runs, line).map((run) => run.text));
    var html = drawPage("text-direction-flow-html-waiting", (recipe) => {
      recipe
        .text("123 (5)<br>456 (7) ", 50, 50, {
          ...options,
          html: true,
          flow: true,
        })
        .text("\u05e9\u05dc\u05d5\u05dd", {
          ...options,
          html: false,
          flow: false,
        });
    });
    // The second paragraph's first letter is the Hebrew of the later run.
    assert.deepEqual(lines(html), [
      ["123 (5)"],
      ["\u05dd\u05d5\u05dc\u05e9", " (7) 456"],
    ]);
    var mixed = drawPage("text-direction-flow-html-waiting-mixed", (recipe) => {
      recipe
        .text("123 (5) ", 50, 50, { ...options, flow: true })
        .text("456 (7)<br>789 ", { ...options, html: true })
        .text("\u05e9\u05dc\u05d5\u05dd", {
          ...options,
          html: false,
          flow: false,
        });
    });
    assert.deepEqual(lines(mixed), [
      ["123 (5) ", "456 (7)"],
      ["\u05dd\u05d5\u05dc\u05e9", " 789"],
    ]);
  });

  it("ends a flowed paragraph at a line break that starts or ends an HTML run", function () {
    var options = { font: "arial", size: 12, direction: "auto" };
    var ending = drawPage("text-direction-flow-html-break-end", (recipe) => {
      recipe
        .text("123 (5) ", 50, 50, { ...options, flow: true })
        .text("<span>456</span><br>", { ...options, html: true })
        .text("\u05e9\u05dc\u05d5\u05dd", {
          ...options,
          html: false,
          flow: false,
        });
    });
    // The Hebrew after the break leaves the line before it left to right.
    assert.deepEqual(
      lineRuns(ending).map((run) => run.text),
      ["123 (5) ", "456"],
    );
    var starting = drawPage(
      "text-direction-flow-html-break-start",
      (recipe) => {
        recipe
          .text("123 (5) ", 50, 50, { ...options, flow: true })
          .text("<br>\u05e9\u05dc\u05d5\u05dd \u05e2\u05d5\u05dc\u05dd", {
            ...options,
            html: true,
            flow: false,
          });
      },
    );
    assert.deepEqual(
      lineRuns(starting).map((run) => run.text),
      ["123 (5)"],
    );
  });

  it("marks each piece of a reordered flowed line with its own run's markup", function () {
    /**
     * Draw a flow and read the left and right edges of its annotations.
     *
     * @param {string} name Output file name.
     * @param {function(object): void} draw Draws on the page.
     * @returns {number[][]} Each annotation's rounded left and right.
     */
    var annotations = (name, draw) => {
      var recipe = new Recipe();
      var bytes;
      try {
        draw(recipe.createPage(400, 400));
        bytes = recipe.endPage().endPDF();
      } finally {
        recipe.dispose();
      }
      writeOutput(name, bytes);
      var reader = muhammara.createReader(bytes);
      try {
        var annots = reader.parsePage(0).getDictionary().toJSObject().Annots;
        return annots
          ? annots.toJSArray().map((reference) => {
              var rect = reader
                .parseNewObject(reference.getObjectID())
                .toJSObject()
                .Rect.toJSArray()
                .map((value) => value.value);
              return [Math.round(rect[0]), Math.round(rect[2])];
            })
          : [];
      } finally {
        reader.end();
      }
    };
    var options = { font: "arial", size: 12, direction: "auto" };
    // Only the run that asks for a highlight is highlighted.
    assert.deepEqual(
      annotations("text-direction-flow-markup-own", (recipe) =>
        recipe
          .text("\u05e9\u05dc\u05d5\u05dd ", 50, 50, {
            ...options,
            flow: true,
            textBox: { width: 300 },
          })
          .text("\u05e2\u05d5\u05dc\u05dd", {
            ...options,
            flow: false,
            highlight: true,
          }),
      ),
      [[50, 71]],
    );
    assert.deepEqual(
      annotations("text-direction-flow-markup-first", (recipe) =>
        recipe
          .text("\u05e9\u05dc\u05d5\u05dd ", 50, 50, {
            ...options,
            flow: true,
            highlight: true,
            textBox: { width: 300 },
          })
          .text("\u05e2\u05d5\u05dc\u05dd", {
            ...options,
            flow: false,
            highlight: false,
          }),
      ),
      [[71, 98]],
    );
    // On a justified line each annotation ends at its word's glyphs.
    var justified = annotations(
      "text-direction-flow-markup-justify",
      (recipe) =>
        recipe
          .text("\u05e9\u05dc\u05d5\u05dd \u05e2\u05d5\u05dc\u05dd ", 50, 50, {
            ...options,
            direction: "rtl",
            flow: true,
            highlight: true,
            textBox: { width: 200, textAlign: "justify" },
          })
          .text(
            "\u05d8\u05d5\u05d1 \u05de\u05d0\u05d5\u05d3 \u05e9\u05dc\u05d5\u05dd \u05e2\u05d5\u05dc\u05dd \u05d8\u05d5\u05d1 \u05de\u05d0\u05d5\u05d3 \u05e9\u05dc\u05d5\u05dd \u05e2\u05d5\u05dc\u05dd \u05d8\u05d5\u05d1",
            {
              ...options,
              direction: "rtl",
              flow: false,
              highlight: true,
            },
          ),
    );
    assert.deepEqual(justified.slice(0, 3), [
      [50, 72],
      [77, 93],
      [98, 119],
    ]);
  });

  it("ends a flowed line at any paragraph separator that ends a run", function () {
    var options = { font: "arial", size: 12, direction: "auto" };
    var draw = (separator, movedown) =>
      drawPage("text-direction-flow-trailing-separator", (recipe) => {
        recipe.text("\u05e9\u05dc\u05d5\u05dd" + separator, 50, 50, {
          ...options,
          flow: true,
          textBox: { width: 300 },
        });
        if (movedown) recipe.movedown(0);
        recipe.text("\u05e2\u05d5\u05dc\u05dd", { ...options, flow: false });
      });
    for (var movedown of [false, true]) {
      var expected = draw("\n", movedown).map((run) => [run.text, run.y]);
      for (var separator of [
        "\u2029",
        "\u2028",
        "\r\n",
        "\r",
        "\v",
        "\f",
        "\u0085",
      ]) {
        // Not drawn; the next run starts the next line, as after "\n".
        assert.deepEqual(
          draw(separator, movedown).map((run) => [run.text, run.y]),
          expected,
          JSON.stringify(separator) + (movedown ? " with movedown(0)" : ""),
        );
      }
      assert.notEqual(expected[0][1], expected[1][1]);
    }
  });

  it("moves the cursor below a flow that ends with any paragraph separator", function () {
    var options = { font: "arial", size: 12, direction: "auto" };
    var draw = (separator) =>
      drawPage("text-direction-flow-cursor", (recipe) => {
        recipe
          .text("\u05e9\u05dc\u05d5\u05dd" + separator, 50, 50, {
            ...options,
            flow: true,
            textBox: { width: 300 },
          })
          .text("abc" + separator, options)
          .text("", { ...options, flow: false })
          .text("after", options);
      });
    var expected = draw("\n").map((run) => [run.text, run.y]);
    for (var separator of ["\u2029", "\u2028", "\r", "\v", "\f", "\u0085"]) {
      assert.deepEqual(
        draw(separator).map((run) => [run.text, run.y]),
        expected,
        JSON.stringify(separator),
      );
    }
    // "after" starts the line below "abc".
    assert.ok(expected[2][1] < expected[1][1]);
  });

  it("keeps the space a flowed run starts with on a line movedown() ends", function () {
    var options = { font: "arial", size: 12, direction: "auto" };
    for (var ending of ["movedown", "\n"]) {
      var runs = drawPage("text-direction-flow-ended-space", (recipe) => {
        recipe.text("x", 50, 50, { ...options, flow: true });
        if (ending === "movedown") {
          recipe.text(" \u05e2\u05d5\u05dc\u05dd", options).movedown();
        } else {
          recipe.text(" \u05e2\u05d5\u05dc\u05dd" + ending, options);
        }
        recipe.text("def", { ...options, flow: false });
      });
      // The space keeps "x" and the Hebrew word apart.
      assert.deepEqual(
        runs.map((run) => run.text),
        ["x", " \u05dd\u05dc\u05d5\u05e2", "def"],
        ending,
      );
    }
  });

  it("moves the cursor below a flow whose break a run of spaces follows", function () {
    var options = { font: "arial", size: 12, direction: "auto" };
    for (var separator of ["\n", "\u2029", "\r\n", "\u0085"]) {
      var runs = drawPage("text-direction-flow-cursor-spaces", (recipe) => {
        recipe
          .text("abc", 50, 150, { ...options, flow: true })
          .text("\u05d0" + separator, options)
          .text(" ", options)
          .text("", { ...options, flow: false })
          .text("after", options);
      });
      var after = runs.find((run) => run.text === "after");
      // The next text starts below the flow, not over its line.
      assert.ok(after.y < runs[0].y - 5, JSON.stringify(separator));
    }
  });

  it("keeps the spaces a flowed line starts with when movedown() ends it", function () {
    var options = { font: "arial", size: 12, direction: "auto" };
    var box = { width: 200, textAlign: "right" };
    for (var first of ["", null]) {
      var runs = drawPage("text-direction-flow-leading-space", (recipe) => {
        if (first === null) {
          recipe.text(" \u05e2\u05d5\u05dc\u05dd", 50, 150, {
            ...options,
            flow: true,
            textBox: box,
          });
        } else {
          recipe
            .text(first, 50, 150, { ...options, flow: true, textBox: box })
            .text(" \u05e2\u05d5\u05dc\u05dd", options);
        }
        recipe.movedown().text("x", { ...options, flow: false });
      });
      // The space is kept as the indent of the line's start, on its right.
      assert.deepEqual(
        lineRuns(runs).map((run) => run.text),
        ["\u05dd\u05dc\u05d5\u05e2", " "],
        JSON.stringify(first),
      );
    }
  });

  it("keeps the space a flowed HTML run starts with inside its first element", function () {
    var options = { font: "arial", size: 12, direction: "auto" };
    var runs = drawPage("text-direction-flow-html-space", (recipe) => {
      recipe
        .text("1 2 3 4 5", 50, 150, { ...options, flow: true })
        .text("<span> 6 7</span>", { ...options, html: true })
        .text(" \u05e9\u05dc\u05d5\u05dd", { ...options, html: false })
        .text("", { ...options, flow: false });
    });
    // "5" and "6" stay two numbers, so the line keeps their order.
    assert.equal(
      lineRuns(runs)
        .map((run) => run.text)
        .join(""),
      "\u05dd\u05d5\u05dc\u05e9 7 6 5 4 3 2 1",
    );
  });

  it("keeps words joined by any non-breaking space on one line", function () {
    for (var space of ["\u00a0", "\u2007", "\u202f"]) {
      var runs = drawPage("text-direction-nbsp", (recipe) => {
        recipe.text("aaaa bbbb" + space + "cccc dddd", 20, 20, {
          font: "arial",
          size: 12,
          textBox: { width: 70 },
        });
      });
      assert.deepEqual(
        runs.map((run) => run.text),
        ["aaaa", "bbbb" + space + "cccc", "dddd"],
        JSON.stringify(space),
      );
    }
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
