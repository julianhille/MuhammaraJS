// Merges packages/native-with-source/tests/recipe/text-direction.js and
// packages/wasm/tests/recipe/text-direction.test.mjs.
import assert from "node:assert/strict";
import { describeEnds, writeOutput } from "../support/ends.mjs";
import { annotations, drawnContent, textRuns } from "../support/pdf.mjs";
import * as support from "../support/text-direction.mjs";
import { fills, lineRuns } from "../support/text-direction.mjs";

describeEnds("Recipe text direction", function (end) {
  /**
   * Read a page's decoded text runs in content stream order.
   *
   * @param {Uint8Array} bytes PDF bytes.
   * @returns {Array<{text: string, x: number, y: number}>} The runs.
   */
  var pageText = (bytes) => textRuns(end, bytes);

  /**
   * Draw on a new 400 by 400 page and return the finished PDF bytes.
   *
   * @param {string} name Output file name.
   * @param {function(object): void} draw Draws on the page.
   * @param {object} [options] Recipe options.
   * @returns {Uint8Array} The PDF bytes.
   */
  var drawBytes = (name, draw, options) =>
    support.drawBytes(end, name, draw, options);

  /**
   * Draw on a new 400 by 400 page, finish the Recipe, and read the page back.
   *
   * @param {string} name Output file name.
   * @param {function(object): void} draw Draws on the page.
   * @returns {Array<{text: string, x: number, y: number}>} The runs.
   */
  var drawPage = (name, draw) => support.drawPage(end, name, draw);

  /**
   * The rectangles of a page's annotations, as [x1, y1, x2, y2].
   *
   * @param {Uint8Array} bytes PDF bytes.
   * @returns {number[][]} The rectangles.
   */
  var annotationRects = (bytes) =>
    annotations(end, bytes).map((annotation) => annotation.Rect);

  /**
   * Measure where a run's glyphs end.
   *
   * @param {{text: string, x: number}} run A drawn run.
   * @param {number} size Its font size.
   * @returns {number} The x of the run's last glyph edge.
   */
  var inkRight = (run, size) => support.inkRight(end, run, size);

  /**
   * Arial as the Recipe measures it.
   *
   * @type {{calculateTextDimensions: function(string, number): object}}
   */
  var font = {
    /**
     * Measure text in the order given.
     *
     * @param {string} text The text.
     * @param {number} size The font size.
     * @returns {object} Its dimensions.
     */
    calculateTextDimensions: (text, size) => support.measure(end, text, size),
  };

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

  it("gives earlier wrapped lines the direction of a later letter", function () {
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
    /**
     * Where a string's glyphs end at 12 points.
     *
     * @param {string} text The text.
     * @returns {number} Its xMax.
     */
    var xMax = (text) => font.calculateTextDimensions(text, 12).xMax;
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
    var indent = plain.x - 20 + xMax(plain.text) - xMax(plain.text.trimStart());
    assert.ok(indent > 20, JSON.stringify(plain));
    var bytes = drawBytes("text-direction-indent-auto", (recipe) => {
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
    var hilites = fills(end, bytes);
    assert.ok(hilites.length > 1, JSON.stringify(hilites));
    hilites.forEach((hilite) => {
      assert.ok(
        hilite[1] > 139 ||
          hilites.some((other) => Math.abs(other[0] - hilite[1]) < 1),
        JSON.stringify(hilites),
      );
    });
  });

  it("wraps text with character spacing and direction marks", function () {
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

  it("justifies the styled runs of a flowed line from right to left", function () {
    var runs = drawPage("text-direction-flow-justify-runs", (recipe) => {
      var options = {
        font: "arial",
        size: 12,
        direction: "auto",
        flow: true,
        textBox: { width: 120, textAlign: "justify" },
      };
      recipe
        .text("אחת ", 20, 20, options)
        .text("שתיים ", { ...options, underline: true })
        .text("שלוש ארבע חמש שש שבע שמונה תשע", { ...options, flow: false });
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
    /**
     * Where a run's glyphs start: where they end less their word's width.
     *
     * @param {{text: string, x: number}} run A drawn run.
     * @returns {number} The x of its first glyph edge.
     */
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
    var recipe = end.newRecipe();
    var options = { font: "arial", size: 12 };
    var plain = recipe.textDimensions("שלום", {
      ...options,
      direction: "auto",
    }).xMax;
    assert.equal(
      recipe.textDimensions("\u2067שלום\u2069", {
        ...options,
        direction: "auto",
      }).xMax,
      plain,
    );
    assert.ok(recipe.textDimensions("\u2067שלום\u2069", options).xMax > plain);
    // It measures the text in the order it is drawn.
    assert.deepEqual(
      recipe.textDimensions("שלום עולם גדול", {
        ...options,
        direction: "rtl",
      }),
      recipe.textDimensions("לודג םלוע םולש", options),
    );
  });

  it("adds one text-markup annotation across a reordered line", function () {
    var bytes = drawBytes("text-direction-markup", (recipe) => {
      recipe.text("<p>שלום <u>עולם</u> יפה</p>", 20, 20, {
        font: "arial",
        size: 16,
        html: true,
        direction: "auto",
        highlight: true,
        textBox: { width: 360, textAlign: "right" },
      });
    });
    var rects = annotationRects(bytes);
    assert.equal(rects.length, 1);
    var left = Math.min(...pageText(bytes).map((run) => run.x));
    assert.ok(Math.abs(rects[0][0] - left) < 1, JSON.stringify(rects));
    // The one annotation spans every piece, to the box's right edge.
    assert.ok(Math.abs(rects[0][2] - 380) < 0.05, JSON.stringify(rects));
  });

  it("resolves the levels of a wrapped paragraph across its lines", function () {
    // The comma that ends "Hello" and "test" stays with its word, as it does
    // in the paragraph, instead of moving to the far end of its line.
    var sentence =
      '\u05d4\u05d5\u05d0 \u05db\u05ea\u05d1: "Hello, world. This is a test, okay?" \u05d5\u05d0\u05d6';
    for (var html of [false, true]) {
      var runs = drawPage("text-direction-paragraph-levels", (recipe) => {
        recipe.text(html ? "<p>" + sentence + "</p>" : sentence, 20, 20, {
          font: "arial",
          size: 10,
          html,
          direction: "rtl",
          textBox: { width: 90, textAlign: "right" },
        });
      });
      assert.deepEqual(
        [0, 1].map((line) =>
          lineRuns(runs, line)
            .map((run) => run.text)
            .join("")
            .replace(/\s/g, ""),
        ),
        ['Hello,":\u05d1\u05ea\u05db\u05d0\u05d5\u05d4', "world.Thisisatest,"],
        String(html),
      );
    }
  });

  it("ends a wrapped paragraph's levels where the paragraph ends", function () {
    var options = { font: "arial", size: 10 };
    /**
     * The first drawn line of a draw, without its spaces.
     *
     * @param {string} name Output file name.
     * @param {function(Object): void} draw Draws on the page.
     * @returns {Promise<string>|string} The line.
     */
    var firstLine = (name, draw) =>
      lineRuns(drawPage(name, draw))
        .map((run) => run.text)
        .join("")
        .replace(/\s/g, "");
    // A run with a direction of its own is an isolate to the line before
    // it, and a run kept as given too: neutral, so the comma at the end of
    // a right-to-left paragraph's line takes its direction.
    for (var direction of ["ltr", "none"]) {
      assert.equal(
        firstLine("text-direction-paragraph-isolate", (recipe) => {
          recipe
            .text(
              "\u05e9\u05dc\u05d5\u05dd \u05e2\u05d5\u05dc\u05dd abc,",
              20,
              20,
              {
                ...options,
                direction: "rtl",
                flow: true,
                textBox: { width: 90 },
              },
            )
            .text(" defghijklmnop", { ...options, direction })
            .text("", { flow: false });
        }),
        ",abc\u05dd\u05dc\u05d5\u05e2\u05dd\u05d5\u05dc\u05e9",
        direction,
      );
    }
    // A trimmed line ends its paragraph at its line break, not at the next
    // paragraph's Hebrew.
    assert.equal(
      firstLine("text-direction-paragraph-trim", (recipe) => {
        recipe.text(
          "abcd \u05e9\u05dc\u05d5\u05dd, qqqqqqqqqqqqqqqqqqqq\n\u05e2\u05d5\u05dc\u05dd",
          20,
          20,
          {
            ...options,
            direction: "ltr",
            textBox: { width: 70, wrap: "trim" },
          },
        );
      }),
      "abcd\u05dd\u05d5\u05dc\u05e9,",
    );
    // An HTML block flowed after a run starts a paragraph of its own.
    assert.equal(
      firstLine("text-direction-paragraph-block", (recipe) => {
        recipe
          .text("\u05e9\u05dc\u05d5\u05dd abcdefg,", 20, 20, {
            ...options,
            direction: "rtl",
            flow: true,
            textBox: { width: 70 },
          })
          .text("<p>hijklmn</p>", { ...options, html: true })
          .text("", { flow: false });
      }),
      ",abcdefg\u05dd\u05d5\u05dc\u05e9",
    );
  });

  it("gives each line of a paragraph its own place in it", function () {
    /**
     * The drawn lines of a draw, each without its spaces.
     *
     * @param {string} name Output file name.
     * @param {function(Object): void} draw Draws on the page.
     * @returns {Promise<string[]>|string[]} The lines from the top.
     */
    var lines = (name, draw) => {
      var runs = drawPage(name, draw);
      return [...new Set(runs.map((run) => run.y))].map((y, index) =>
        lineRuns(runs, index)
          .map((run) => run.text)
          .join("")
          .replace(/\s/g, ""),
      );
    };
    // The lines of an HTML run that share its first line's ID are told
    // apart.
    assert.equal(
      lines("text-direction-paragraph-html-line", (recipe) => {
        recipe.text(
          '<u>-50% "\u05d4\u05de\u05d7\u05dc\u05e7\u05d4?</u> World',
          20,
          20,
          {
            font: "arial",
            size: 12,
            html: true,
            direction: "ltr",
            textBox: { width: 60 },
          },
        );
      })[0],
      "-50%",
    );
    // An inline element does not end its paragraph: the comma between two
    // Latin words is left to right.
    assert.ok(
      lines("text-direction-paragraph-inline", (recipe) => {
        recipe.text(
          '<ul><li>\u05d0\u05d1\u05d2 (OK 50%, <a href="https://a.b/3">(Microsoft)</a> def \u05d2\u05d3\u05d5\u05dc</li></ul>',
          20,
          20,
          {
            font: "arial",
            size: 12,
            html: true,
            direction: "rtl",
            textBox: { width: 45, textAlign: "center" },
          },
        );
      }).includes("50%,"),
    );
    // A run with a direction of its own is as long in the paragraph as it
    // is, so the text after its line stays in the paragraph.
    var options = { font: "arial", size: 10, direction: "rtl" };
    assert.ok(
      lines("text-direction-paragraph-block-length", (recipe) => {
        recipe
          .text("\u05e9\u05dc\u05d5\u05dd ", 20, 20, {
            ...options,
            flow: true,
            textBox: { width: 100, textAlign: "right" },
          })
          .text("ABCDEFG", { ...options, direction: "ltr" })
          .text(
            " abc, d \u05d2\u05d3\u05d5\u05dc \u05de\u05d0\u05d5\u05d3",
            options,
          )
          .text("", { flow: false });
      })[0].startsWith("abc,"),
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
    // Aligned by default or to the right, the line's start, its first word,
    // ends at the right edge; the overflowing word is cut on the left.
    for (var textAlign of [undefined, "right"]) {
      var runs = drawPage("text-direction-clip-" + textAlign, (recipe) => {
        recipe.text("שלום עולם זהו טקסט ארוך בעברית שצריך", 100, 20, {
          font: "arial",
          size: 12,
          direction: "rtl",
          textBox: {
            width: 150,
            wrap: "clip",
            ...(textAlign && { textAlign }),
          },
        });
      });
      var run = runs[0];
      assert.ok(run.text.trimEnd().endsWith("םולש"), run.text);
      assert.ok(Math.abs(inkRight(run, 12) - 250) < 1, JSON.stringify(run));
      assert.ok(run.x < 100, JSON.stringify(run));
    }
    // Centred, an overflowing line keeps its start at the right edge too.
    var centred = drawPage("text-direction-clip-centre", (recipe) => {
      recipe.text("שלוםשלוםשלום", 50, 20, {
        font: "arial",
        size: 12,
        direction: "rtl",
        textBox: { width: 40, wrap: "clip", textAlign: "center" },
      });
    });
    assert.ok(
      Math.abs(inkRight(centred[0], 12) - 90) < 1,
      JSON.stringify(centred),
    );
    // A justified line keeps its start at the right edge too.
    var justified = lineRuns(
      drawPage("text-direction-clip-justify", (recipe) => {
        recipe.text("שלום עולם גדול מאוד יותר\nx", 100, 50, {
          font: "arial",
          size: 14,
          direction: "rtl",
          textBox: { width: 80, wrap: "clip", textAlign: "justify" },
        });
      }),
    );
    var start = justified[justified.length - 1];
    assert.ok(start.text.trim().endsWith("םולש"), JSON.stringify(justified));
    assert.ok(
      Math.abs(inkRight(start, 14) - 180) < 1,
      JSON.stringify(justified),
    );
  });

  it("links no spaces that end a clipped right-to-left flow", function () {
    var bytes = drawBytes("text-direction-clip-flow-link", (recipe) => {
      recipe
        .text("שלום ", 20, 20, {
          font: "arial",
          size: 12,
          direction: "rtl",
          flow: true,
          link: "https://example.com/a",
          textBox: { width: 200, wrap: "clip" },
        })
        .text("עולם ", { link: "https://example.com/b" })
        .text("", { flow: false });
    });
    // Each run's link covers its own word, and nothing past the line.
    assert.deepEqual(
      annotationRects(bytes)
        .map((rect) => [Math.round(rect[0]), Math.round(rect[2])])
        .sort((left, right) => left[0] - right[0]),
      [
        [20, 42],
        [42, 69],
      ],
    );
    // Spaces that end the flow in a run of their own drop the spaces of
    // the run before them too.
    var spaces = drawBytes("text-direction-clip-flow-spaces", (recipe) => {
      recipe
        .text("abc ", 50, 50, {
          font: "arial",
          size: 12,
          direction: "ltr",
          flow: true,
          textBox: { width: 200, wrap: "clip" },
        })
        .text("עולם  ", { underline: true })
        .text("  ")
        .text("", { flow: false });
    });
    assert.deepEqual(
      annotationRects(spaces).map((rect) => [
        Math.round(rect[0]),
        Math.round(rect[2]),
      ]),
      [[73, 94]],
    );
    // A line's last piece of only spaces takes no room for its link.
    var blank = drawBytes("text-direction-blank-piece-link", (recipe) => {
      recipe
        .text("\u200f  ", 10, 10, {
          font: "arial",
          size: 12,
          flow: true,
          direction: "rtl",
          link: "https://example.com",
          textBox: { width: 80 },
        })
        .text("\u05e9\u05dc\u05d5\u05dd", { direction: "rtl" })
        .text("", { flow: false });
    });
    // The piece of only spaces gets no link of its own.
    var blankRects = annotationRects(blank);
    assert.equal(blankRects.length, 1, JSON.stringify(blankRects));
    assert.ok(blankRects[0][2] < 35, JSON.stringify(blankRects));
  });

  it("draws a clipped flow or HTML box that ends with an empty line", function () {
    var options = {
      font: "arial",
      size: 12,
      direction: "rtl",
      textBox: { width: 107, wrap: "clip" },
    };
    var runs = drawPage("text-direction-clip-empty-line", (recipe) => {
      recipe.text("x\n\n", 20, 20, { ...options, flow: true });
      recipe.text("", { flow: false });
      recipe.text("<p>x<br><br></p>", 20, 60, { ...options, html: true });
      recipe.text("x", 20, 120, { ...options, flow: true });
      recipe.movedown(2);
      recipe.text("", { flow: false });
    });
    assert.deepEqual(
      runs.map((run) => run.text),
      ["x", "x", "x"],
    );
  });

  it("marks no line that draws only direction marks", function () {
    var bytes = drawBytes("text-direction-markup-marks", (recipe) => {
      recipe.text("abc\n\u200e", 20, 20, {
        font: "arial",
        size: 12,
        direction: "rtl",
        strikeOut: true,
        textBox: { width: 200 },
      });
      // A clipped line marks only what shows in its box.
      recipe.text("aaaaaaaaaaaaaaaaaaaaaa<span>bbb</span>", 20, 150, {
        font: "arial",
        size: 12,
        html: true,
        highlight: true,
        textBox: { width: 50, wrap: "clip" },
      });
      // A line with a negative width still fails the annotation check.
      assert.throws(
        () =>
          recipe.text("ab", 20, 100, {
            font: "arial",
            highlight: true,
            charSpace: -20,
          }),
        /Invalid annotation options/,
      );
    });
    assert.equal(annotationRects(bytes).length, 2);
  });

  it("draws HTML text with markup placed at an x of center without throwing", function () {
    var runs = drawPage("text-direction-center-markup", (recipe) => {
      recipe.text("<p>abc lorem</p>", "center", 200, {
        font: "arial",
        underline: true,
        html: true,
      });
    });
    assert.equal(runs.map((run) => run.text).join(""), "abc lorem");
  });

  it("highlights the last line of a justified right-to-left paragraph inside the box", function () {
    var bytes = drawBytes("text-direction-hilite", (recipe) => {
      recipe.text("שלום עולם זהו טקסט", 100, 20, {
        font: "arial",
        size: 12,
        direction: "rtl",
        hilite: true,
        textBox: { width: 200, textAlign: "justify" },
      });
    });
    var hilites = fills(end, bytes);
    assert.equal(hilites.length, 1);
    assert.ok(hilites[0][0] > 150, JSON.stringify(hilites));
    assert.ok(Math.abs(hilites[0][1] - 300) < 1, JSON.stringify(hilites));
  });

  it("keeps the hilite of a clipped right-to-left line inside the box", function () {
    var hilites = {};
    for (var direction of ["rtl", "none"]) {
      var bytes = drawBytes(
        "text-direction-clip-hilite-" + direction,
        (recipe) => {
          recipe.text(
            direction === "rtl"
              ? "<p>אאאאאאאאאאאאא<u>בבבבבבבבבבבבבבבבבבב</u>גגגגגגגגגגגגגגג</p>"
              : "Supercalifragilisticexpialidocious",
            20,
            20,
            {
              font: "arial",
              size: 12,
              html: direction === "rtl",
              direction,
              hilite: true,
              textBox: { width: 60, wrap: "clip", textAlign: "center" },
            },
          );
        },
      );
      hilites[direction] = fills(end, bytes);
    }
    // The hilites of the reordered pieces are limited to the box.
    assert.deepEqual(
      hilites.rtl.map((edges) => edges.map((edge) => +edge.toFixed(6))),
      [[20, 80]],
    );
    // Text that is not reordered keeps its hilite as before.
    assert.equal(hilites.none.length, 1);
    assert.ok(hilites.none[0][0] < 20, JSON.stringify(hilites.none));
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
    var bytes = drawBytes("text-direction-clip-markup", (recipe) => {
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
    var hilites = fills(end, bytes);
    assert.equal(hilites.length, 1);
    assert.ok(hilites[0][0] < 50.5, JSON.stringify(hilites));
    assert.ok(hilites[0][1] > 195, JSON.stringify(hilites));
  });

  it("keeps the hilite and links of right-to-left lines inside the box", function () {
    var bytes = drawBytes("text-direction-link-edge", (recipe) => {
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
    var hilites = fills(end, bytes);
    var links = annotationRects(bytes).sort(
      (a, b) => a[1] - b[1] || a[0] - b[0],
    );
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
      var bytes = drawBytes("text-direction-pieces-" + name, (recipe) => {
        recipe.text(text, 20, 20, {
          font: "arial",
          size: 12,
          html: text.startsWith("<"),
          direction: "rtl",
          hilite: name !== "oneWord",
          textBox: box,
        });
      });
      runs[name] = pageText(bytes);
      hilites[name] = fills(end, bytes);
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
    var bytes = drawBytes("text-direction-underline", (recipe) => {
      recipe.text("<p>שלום <u>עולם</u> יפה</p>", 20, 20, {
        font: "arial",
        size: 12,
        html: true,
        direction: "rtl",
        textBox: { width: 300, textAlign: "right" },
      });
    });
    var word = pageText(bytes).find((run) => run.text.trim() === "םלוע");
    var [, start, stop] = /([\d.]+) [\d.]+ m\s+([\d.]+) [\d.]+ l/.exec(
      drawnContent(end, bytes),
    );
    assert.ok(Math.abs(Number(start) - word.x) < 0.05, start);
    assert.ok(
      Math.abs(
        Number(stop) - word.x - font.calculateTextDimensions("םלוע", 12).xMax,
      ) < 0.05,
      stop,
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
      var bytes = drawBytes(
        "text-direction-table-" + heights.length,
        (recipe) => {
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
        },
      );
      // The heights of the cell borders the table draws.
      heights.push(
        support.paintedRects(end, bytes).map((rect) => rect.height.toFixed(3)),
      );
    }
    assert.ok(heights[0].length > 0, JSON.stringify(heights));
    assert.deepEqual(heights[1], heights[0]);
  });

  it("gives table headers the direction of their column or table", function () {
    for (var [tableOptions, columnOptions, header] of [
      [{ direction: "auto" }, {}, "\u05d0\u05dc\u05de \u05dd\u05e9"],
      [{}, { direction: "rtl" }, "\u05d0\u05dc\u05de \u05dd\u05e9"],
      // A header's own direction wins.
      [
        { direction: "rtl", header: { font: "arial", direction: "none" } },
        {},
        "\u05e9\u05dd \u05de\u05dc\u05d0",
      ],
    ]) {
      var runs = drawPage("text-direction-table-header", (recipe) => {
        recipe.table(20, 20, [{ name: "\u05d3\u05e0\u05d9" }], {
          font: "arial",
          header: { font: "arial" },
          ...tableOptions,
          columns: [
            {
              name: "name",
              text: "\u05e9\u05dd \u05de\u05dc\u05d0",
              width: 120,
              font: "arial",
              header: { font: "arial" },
              ...columnOptions,
            },
          ],
        });
      });
      assert.deepEqual(
        runs.map((run) => run.text),
        [header, "\u05d9\u05e0\u05d3"],
      );
    }
  });

  it("draws a translucent justified right-to-left line as an opaque one", function () {
    var words = ["אחת", "שתיים", "שלוש", "ארבע", "חמש"];
    var text = Array.from({ length: 40 }, (_, index) => words[index % 5]).join(
      " ",
    );
    var shown = {};
    for (var opacity of [1, 0.5]) {
      var bytes = drawBytes(
        "text-direction-translucent-" + opacity,
        (recipe) => {
          recipe.text(text, 20, 20, {
            font: "arial",
            size: 12,
            direction: "rtl",
            opacity,
            textBox: { width: 200, textAlign: "justify" },
          });
        },
      );
      // Translucent text is drawn in forms, which the text extraction does
      // not read, so the glyph strings shown are compared.
      shown[opacity] = (drawnContent(end, bytes).match(/<[0-9A-F]+>/g) || [])
        .filter((hex) => hex !== "<0003>")
        .sort();
    }
    // The same words, each in visual order, only translucent.
    assert.ok(shown[1].length > 30, JSON.stringify(shown[1]));
    assert.deepEqual(shown[0.5], shown[1]);
  });

  it("starts a paragraph with its own direction at every mandatory break", function () {
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
      // A "none" run keeps its order in a left-to-right line too.
      [
        [
          ["abc ", "ltr"],
          ["עולם 123", "none"],
        ],
        "abc עולם 123",
      ],
      // The text nodes of one HTML call are one block.
      [
        [
          ["abc ", "ltr"],
          ["<span>שלום</span> <span>עולם</span> ", "rtl", { html: true }],
          ["def", "ltr"],
        ],
        // The block's trailing space is drawn at its start, on its left.
        "abc םלוע םולשdef",
      ],
      // "auto" calls continue their paragraph together in a "none" line.
      [
        [
          ["abc ", "none"],
          ["שלום ", "auto"],
          ["עולם", "auto"],
        ],
        "abc םלוע םולש",
      ],
      // A justified line places a run with a direction of its own as one
      // block too.
      [
        [
          ["abc ", "ltr", { textBox: { width: 140, textAlign: "justify" } }],
          ["שלום עולם ", "rtl"],
          ["def ghi jkl mno pqr stu", "ltr"],
        ],
        "abc םלוע םולשdef ghi jkl",
      ],
      // A run of only a no-break space has no letter to give the line its
      // direction, so the right-to-left run after it does.
      [
        [
          ["\u00a0", "ltr"],
          ["שלום ", "rtl"],
          ["abc", "ltr"],
        ],
        "abc םולש",
      ],
    ];
    for (var [index, [texts, expected]] of cases.entries()) {
      var runs = drawPage("text-direction-run-" + index, (recipe) => {
        texts.forEach(([text, direction, extra], run) => {
          var options = { font: "arial", size: 12, direction, ...extra };
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

  it("forgets a flow's paragraph state at a new page and a table", function () {
    var options = { font: "arial", size: 12, direction: "auto" };
    /**
     * Leave a right-to-left flowed paragraph open, run `between`, then
     * continue the flow with neutral and Latin runs.
     *
     * @param {function(object): void} between Draws between the runs.
     * @param {number} pageIndex The page the continued flow is drawn on.
     * @returns {string} The continued flow's line, read from the left.
     */
    var continued = (between, pageIndex) => {
      var recipe = end.newRecipe().createPage(400, 400);
      recipe.text("\u05e9\u05dc\u05d5\u05dd ", 20, 20, {
        ...options,
        flow: true,
        textBox: { width: 300 },
      });
      between(recipe);
      recipe
        .text("1 - 2 ", { ...options, flow: true })
        .text("abc", options)
        .text("", { flow: false });
      var runs = textRuns(end, recipe.endPage().endPDF(), pageIndex);
      var abc = runs.find((run) => run.text === "abc");
      return lineRuns(runs.filter((run) => run.y === abc.y))
        .map((run) => run.text)
        .join("");
    };
    // On the same page, the runs continue the right-to-left paragraph.
    assert.equal(
      continued(() => {}, 0),
      "abc 2 - 1 \u05dd\u05d5\u05dc\u05e9",
    );
    // A new page and a table start over: the runs make a paragraph of their
    // own, left to right.
    assert.equal(
      continued((recipe) => recipe.endPage().createPage(400, 400), 1),
      "1 - 2 abc",
    );
    assert.equal(
      continued(
        (recipe) =>
          recipe.table(20, 100, [{ value: "row" }], {
            font: "arial",
            size: 10,
          }),
        0,
      ),
      "1 - 2 abc",
    );
  });

  it("keeps only the open isolates of a flowed paragraph without a letter", function () {
    var lines = {};
    for (var flow of [true, false]) {
      var runs = drawPage("text-direction-flow-neutral-" + flow, (recipe) => {
        var options = {
          font: "arial",
          size: 12,
          direction: "auto",
          textBox: { width: 360 },
        };
        var parts = [
          "(1) ",
          "\u2067abc ",
          "2 - 3 ",
          "\u2069 4 ",
          "\u05e9\u05dc\u05d5\u05dd",
        ];
        if (flow) {
          recipe.text(parts[0], 20, 20, { ...options, flow: true });
          for (var part of parts.slice(1)) recipe.text(part, options);
          recipe.text("", { flow: false });
        } else recipe.text(parts.join(""), 20, 20, options);
      });
      lines[flow] = runs
        .slice()
        .sort((a, b) => a.x - b.x)
        .map((run) => run.text)
        .join("");
    }
    // The isolate's letters do not give the flowed paragraph its direction,
    // as in one call.
    assert.equal(lines.true, lines.false);
  });

  it("lets a flowed paragraph starting with an isolate take a later letter's direction", function () {
    var text = "\u2067abc\u2069 1 2 3 4 5 6 7 8 9 ";
    var lines = {};
    for (var flow of [true, false]) {
      var runs = drawPage("text-direction-flow-isolate-" + flow, (recipe) => {
        var options = {
          font: "arial",
          size: 12,
          direction: "auto",
          textBox: { width: 60 },
        };
        if (flow) {
          recipe
            .text(text, 20, 20, { ...options, flow: true })
            .text("שלום", { ...options, flow: false });
        } else {
          recipe.text(text + "שלום", 20, 20, options);
        }
      });
      lines[flow] = runs.map((run) => run.text);
    }
    // The isolate's letters do not set the paragraph's direction; the
    // Hebrew word after it does.
    assert.deepEqual(lines[false], ["4 3 2 1 abc", "9 8 7 6 5", "םולש"]);
    assert.deepEqual(lines[true], lines[false]);
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
    // Hebrew paragraph after movedown() does not change it.
    assert.deepEqual(
      runs.map((run) => run.text),
      ["1 - 2", "םולש"],
    );
  });

  it("keeps no more of a flowed paragraph than its direction once it has one", function () {
    var runs = drawPage("text-direction-flow-kept", (recipe) => {
      var options = { font: "arial", size: 12, direction: "auto" };
      recipe.text("1 שלום ", 20, 20, {
        ...options,
        flow: true,
        textBox: { width: 360 },
      });
      for (var index = 0; index < 50; ++index) recipe.text("abc ", options);
      recipe.text("", { flow: false });
    });
    // The paragraph still takes the direction of its first letter, so the
    // first run stays rightmost on its line, whatever runs come after it.
    var first = runs.find((run) => run.text.includes("1"));
    var line = runs.filter((run) => run.y === first.y);
    assert.equal(Math.max(...line.map((run) => run.x)), first.x);
    assert.ok(line.length > 1);
  });

  it("measures a wrapping line from its words as drawn", function () {
    // A line that fits as drawn, with its spacing counted as typed, stays
    // on one line; a little narrower, it wraps.
    for (var [direction, text] of [
      ["rtl", "\u05e9\u05c1\u05b8\u05dc\u05d5\u05b9\u05dd abc 12"],
      ["auto", "\u2067\u05d0\u2069 \u05d1\u200d\u05b8x"],
      ["none", "Hello w\u0301orld"],
    ]) {
      var options = { font: "arial", size: 12, direction, charSpace: 2 };
      var width = end.newRecipe().textDimensions(text, options).xMax;
      for (var [extra, lines] of [
        [1e-6, 1],
        [-0.01, 2],
      ]) {
        var runs = drawPage(
          "text-direction-line-width-" + direction,
          (recipe) => {
            recipe.text(text, 20, 20, {
              ...options,
              textBox: { width: width + extra },
            });
          },
        );
        assert.equal(
          new Set(runs.map((run) => run.y)).size,
          lines,
          direction + " " + extra,
        );
      }
    }
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

  it("ends a flowed run at a long run of CRLFs in time", function () {
    // Each CRLF is one break, however it is matched.
    var runs = drawPage("text-direction-flow-crlfs", (recipe) => {
      recipe
        .text("Line one" + "\r\n".repeat(30), 10, 10, {
          font: "arial",
          size: 6,
          flow: true,
        })
        .text("Line two")
        .text("", { flow: false });
    });
    assert.deepEqual(
      runs.map((run) => run.text.trim()),
      ["Line one", "Line two"],
    );
    assert.ok(runs[0].y - runs[1].y > 29 * 5, JSON.stringify(runs));
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

  it("starts the run after a reordered piece where it starts as typed", function () {
    var starts = {};
    for (var direction of ["none", "ltr"]) {
      var runs = drawPage("text-direction-run-gap-" + direction, (recipe) => {
        recipe
          .text("ooo ", 20, 20, {
            font: "arial",
            size: 24,
            charSpace: 5,
            direction,
            flow: true,
          })
          .text("ooo \u05e9\u05dc\u05d5\u05dd")
          .text("", { flow: false });
      });
      starts[direction] = runs[1].x;
    }
    // The gap keeps the last "o"'s side bearing and character spacing.
    assert.ok(Math.abs(starts.ltr - starts.none) < 0.1, JSON.stringify(starts));
  });

  it("measures a reordered piece with a long run of spaces in linear time", function () {
    // A no-break space keeps the run of spaces inside its word's piece. The
    // time is compared with that of a shorter run rather than to a fixed
    // limit, which a slow build would exceed: four times the spaces take
    // about four times as long, and sixteen times as long when quadratic.
    this.timeout(120000);
    /**
     * Draw a reordered word with a run of no-break spaces and time it.
     *
     * @param {number} count The number of spaces.
     * @returns {number} The milliseconds it took.
     */
    function milliseconds(count) {
      var recipe = end.newRecipe().createPage(400, 400);
      var start = performance.now();
      recipe.text("\u05d0" + "\u00a0".repeat(count) + "\u05d1", 20, 20, {
        font: "arial",
        size: 12,
        direction: "rtl",
        textBox: { width: 1e8 },
      });
      var bytes = recipe.endPage().endPDF();
      var elapsed = performance.now() - start;
      assert.equal(pageText(bytes).length, 1);
      return elapsed;
    }
    var short = milliseconds(4000);
    var long = milliseconds(16000);
    assert.ok(long < short * 10, short + " ms and " + long + " ms");
  });

  it("draws the words of a justified line kept in logical order as typed", function () {
    var options = {
      font: "arial",
      size: 14,
      textBox: { width: 210, textAlign: "justify" },
    };
    var runs = drawPage("text-direction-justified-words", (recipe) => {
      recipe
        .text("\u05e1\u05dc ", 20, 20, { ...options, flow: true })
        .text("abc def? ghi jkl mno pqr stu vwx yz", {
          ...options,
          direction: "rtl",
          flow: false,
        });
    });
    assert.ok(
      lineRuns(runs).some((run) => run.text.trim() === "def?"),
      JSON.stringify(lineRuns(runs)),
    );
  });

  it("starts a clipped right-to-left line without a width at x", function () {
    var runs = drawPage("text-direction-clip-no-width", (recipe) => {
      recipe.text("\u05e9\u05dc\u05d5\u05dd abc", 20, 20, {
        font: "arial",
        size: 12,
        direction: "rtl",
        textBox: { wrap: "clip" },
      });
    });
    assert.equal(Math.min(...runs.map((run) => run.x)), 20);
  });

  it("keeps a line that fits only as drawn on one line", function () {
    // As typed, "ff" ends past the box; drawn in visual order, the line
    // ends at the Hebrew word's last glyph and fits.
    var runs = drawPage("text-direction-fits-drawn", (recipe) => {
      recipe.text("\u05d9\u05e4\u05d4 ff", 20, 20, {
        font: "arial",
        size: 20,
        direction: "rtl",
        textBox: { width: 44, textAlign: "right" },
      });
    });
    assert.equal(
      new Set(runs.map((run) => run.y)).size,
      1,
      JSON.stringify(runs),
    );
  });

  it("aligns a line by a point of the next run that reaches past its letter", function () {
    var options = {
      font: "arial",
      size: 15,
      direction: "rtl",
      textBox: { width: 60, textAlign: "right" },
    };
    // A segol reaches further right than its vav.
    var single = drawPage("text-direction-point-edge-single", (recipe) => {
      recipe.text("\u05d5\u05b6", 20, 20, options);
    });
    var split = drawPage("text-direction-point-edge-split", (recipe) => {
      recipe
        .text("\u05d5", 20, 20, { ...options, flow: true })
        .text("\u05b6", options)
        .text("", { flow: false });
    });
    assert.ok(
      Math.abs(
        Math.min(...split.map((run) => run.x)) -
          Math.min(...single.map((run) => run.x)),
      ) < 0.01,
      JSON.stringify([single, split]),
    );
  });

  it("advances a reordered piece by the whitespace it ends with", function () {
    var font = { font: "arial", size: 20 };
    var expected;
    var runs = drawPage("text-direction-wide-space", (recipe) => {
      // Two em spaces, each far wider than a space.
      expected =
        recipe.textDimensions("abc\u2003\u2003o", font).xMax -
        recipe.textDimensions("o", font).xMax;
      recipe
        .text("abc\u2003\u2003", 20, 20, {
          ...font,
          direction: "ltr",
          flow: true,
        })
        .text("\u05e9\u05dc\u05d5\u05dd", {
          ...font,
          direction: "ltr",
          flow: false,
        });
    });
    assert.ok(
      Math.abs(runs[1].x - runs[0].x - expected) < 0.05,
      JSON.stringify([runs, expected]),
    );
  });

  it("keeps a point that starts a run over its letter", function () {
    var options = {
      font: "arial",
      size: 30,
      direction: "rtl",
      textBox: { width: 60, textAlign: "right" },
    };
    // A point has no advance of its own: the run before it ends where the
    // point's letter starts, and the line fits as it is measured.
    var draws = {
      html: (recipe) =>
        recipe.text(
          '<span style="color:#cc0000">\u05e9\u05dc</span>\u05b9\u05d5\u05dd',
          20,
          20,
          {
            ...options,
            html: true,
          },
        ),
      flow: (recipe) =>
        recipe
          .text("\u05e9\u05dc", 20, 20, { ...options, flow: true })
          .text("\u05b9\u05d5\u05dd", options)
          .text("", { flow: false }),
    };
    for (var [name, draw] of Object.entries(draws)) {
      var runs = drawPage("text-direction-point-run-" + name, draw);
      assert.ok(
        runs.every((run) => run.x >= 20),
        name + JSON.stringify(runs),
      );
    }
  });

  it("keeps the pieces of a reordered line and their markup valid", function () {
    var options = { font: "arial", size: 12, direction: "rtl" };
    // Measuring stops at a NUL; the piece after one is not drawn before it.
    var nul = drawPage("text-direction-nul-piece", (recipe) => {
      recipe
        .text("\u05e9\u05dc\u05d5\u05dd ", 20, 20, {
          ...options,
          flow: true,
          textBox: { width: 300 },
        })
        .text("\u0000", { ...options, underline: true })
        .text("", { flow: false });
    });
    assert.ok(
      nul.every((run) => run.x >= 20),
      JSON.stringify(nul),
    );
    // A justified piece that marks nothing adds no markup.
    drawPage("text-direction-empty-markup", (recipe) => {
      var justified = {
        ...options,
        textBox: { width: 90, textAlign: "justify" },
      };
      recipe
        .text(" ", 20, 20, { ...justified, flow: true })
        .text("\u200f", justified)
        .text("\u05d0".repeat(13), justified)
        .text(" ", { ...justified, underline: true })
        .text("", { flow: false });
    });
    // Spacing that takes back more than a run's glyphs moves no piece
    // back past the one before it, and marks nothing without width.
    drawPage("text-direction-negative-spacing", (recipe) => {
      recipe
        .text("\u05e9\u05dc\u05d5\u05dd ", 20, 20, {
          ...options,
          charSpace: -3,
          flow: true,
          textBox: { width: 300 },
        })
        .text("i", { ...options, charSpace: -3, highlight: true })
        .text(" \u05e2\u05d5\u05dc\u05dd", { ...options, charSpace: -3 })
        .text("", { flow: false });
      recipe.text(
        "\u05e9\u05dc\u05d5\u05dd <b>il</b> \u05e2\u05d5\u05dc\u05dd",
        20,
        100,
        {
          ...options,
          html: true,
          charSpace: -6,
          highlight: true,
          textBox: { width: 300 },
        },
      );
    });
    // A run of only a point takes no room and marks nothing.
    var point = drawBytes("text-direction-point-markup", (recipe) => {
      recipe
        .text("abc ", 20, 20, {
          ...options,
          flow: true,
          textBox: { width: 300 },
        })
        .text("\u05b9", { ...options, highlight: true })
        .text(" def", { ...options, highlight: false })
        .text("", { flow: false, highlight: false });
    });
    assert.deepEqual(annotationRects(point), []);
    // Spacing too large to take back is written as it is set.
    var spaced = drawBytes("text-direction-huge-spacing", (recipe) => {
      recipe.text("\u05e9\u05b8\u05c1\u05dc", 20, 20, {
        ...options,
        charSpace: 1e306,
      });
    });
    var operators = drawnContent(end, spaced);
    assert.match(operators, /\bTj\b/);
    assert.doesNotMatch(operators, /\b(?:inf|nan)\b/i);
  });

  it("keeps the links of a justified reordered line inside the box", function () {
    // The last piece ends with a no-break space, which a justified line
    // does not widen past the box.
    var bytes = drawBytes("text-direction-justified-link", (recipe) => {
      recipe.text(
        "abc \u05e9\u05dc\u05d5\u05dd\u00a0 defghijkl mnopqrs",
        50,
        50,
        {
          font: "arial",
          size: 12,
          direction: "ltr",
          link: "https://example.com",
          textBox: { width: 75, textAlign: "justify" },
        },
      );
    });
    // The first line, the one reordered, is the highest.
    var rects = annotationRects(bytes);
    var top = Math.max(...rects.map((rect) => rect[1]));
    var first = rects.filter((rect) => rect[1] === top);
    assert.ok(first.length > 0);
    first.forEach((rect) => assert.ok(rect[2] <= 125.01, JSON.stringify(rect)));
  });

  it("marks a flowed run of only no-break spaces on a reordered line", function () {
    var options = {
      font: "arial",
      size: 12,
      direction: "rtl",
      highlight: true,
    };
    var bytes = drawBytes("text-direction-nbsp-run-markup", (recipe) => {
      recipe
        .text("\u05e9\u05dc\u05d5\u05dd ", 50, 50, {
          ...options,
          flow: true,
          textBox: { width: 200 },
        })
        .text("\u00a0\u00a0", options)
        .text(" \u05e2\u05d5\u05dc\u05dd", options)
        .text("", { flow: false });
    });
    assert.equal(annotationRects(bytes).length, 3);
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
    var options = {
      font: "arial",
      size: 12,
      direction: "rtl",
      underline: true,
    };
    var bytes = drawBytes("text-direction-flow-markup", (recipe) => {
      recipe
        .text("\u05e9\u05dc\u05d5\u05dd ", 50, 50, { ...options, flow: true })
        .text("\u05e2\u05d5\u05dc\u05dd ", options)
        .text("", { flow: false });
    });
    var rects = annotationRects(bytes);
    // One per run, as for a left-to-right flow, each starting at its run.
    assert.equal(rects.length, 2, JSON.stringify(rects));
    assert.deepEqual(
      rects.map((rect) => Math.round(rect[0])),
      pageText(bytes).map((run) => Math.round(run.x)),
    );
    assert.ok(rects[0][2] <= rects[1][0] + 0.01);
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

  it("keeps a reordered line that fits only as typed inside its box", function () {
    // As typed, each line ends inside its box; drawn in visual order, its
    // last glyph is another one and it ends 0.76 points further. The spaces
    // that end a line take no room, even before a right-to-left indent.
    // Where the first line of a text drawn at 50, 50 sits.
    var [first] = drawPage("text-direction-fits-drawn", (recipe) => {
      recipe.text("\u05e9", 50, 50, { font: "arial", size: 12 });
    });
    for (var [text, wrap, width, lines] of [
      [
        "\u05e9\u05b8\u05c1\u05dc\u05d5\u05b9\u05dd \u05e2\u05d5\u05b9\u05dc\u05b8\u05dd\u2026",
        "auto",
        60,
        2,
      ],
      [
        "\u05e9\u05dc\u05d5\u05dd \u05e2\u05d5\u05dc\u05dd \u05d2\u05d3\u05d5\u05dc",
        "ellipsis",
        60,
        1,
      ],
      [
        "      \u05e9\u05dc\u05d5\u05dd \u05e2\u05d5\u05dc\u05dd",
        "auto",
        44,
        2,
      ],
    ]) {
      for (var textAlign of ["left", "right"]) {
        var runs = drawPage("text-direction-fits-drawn", (recipe) => {
          recipe.text(text, 50, 50, {
            font: "arial",
            size: 12,
            direction: "auto",
            textBox: { width, wrap, textAlign },
          });
        });
        // The text starts on its first line and takes no line more.
        assert.equal(Math.max(...runs.map((run) => run.y)), first.y, text);
        assert.equal(new Set(runs.map((run) => run.y)).size, lines, text);
        for (var run of runs) {
          var right = inkRight(run, 12);
          assert.ok(
            run.x >= 50 - 0.01 && right <= 50 + width + 0.01,
            `${wrap} ${textAlign}: ${run.x}-${right}`,
          );
        }
      }
    }
    // A line of several runs, from HTML or a flow, is wrapped by its typed
    // width.
    var runs = drawPage("text-direction-fits-drawn-html", (recipe) => {
      recipe.text(
        "\u05e9\u05b8\u05c1\u05dc\u05d5\u05b9\u05dd \u05e2\u05d5\u05b9\u05dc\u05b8\u05dd\u2026",
        50,
        50,
        {
          font: "arial",
          size: 12,
          direction: "auto",
          html: true,
          textBox: { width: 60 },
        },
      );
    });
    assert.equal(runs.length, 1);
  });

  it("spaces a long right-to-left line in several TJ operators", function () {
    // Every pointed letter is a piece of its own, more than one TJ takes.
    // The time is compared with that of a shorter line, as a fixed limit
    // would fail on a slow runner: four times the letters take about four
    // times as long, and sixteen times as long when quadratic.
    this.timeout(300000);
    /**
     * Draw a long spaced right-to-left line and time it.
     *
     * @param {number} count The number of pointed letters.
     * @param {Uint8Array} [base] A PDF to edit the first page of, rather
     *   than a new page.
     * @returns {{bytes: Uint8Array, milliseconds: number}} The PDF and time.
     */
    var draw = (count, base) => {
      var recipe = base
        ? end.openRecipe(base).editPage(1)
        : end.newRecipe().createPage(400, 400);
      var start = performance.now();
      recipe.text("\u05e9\u05b8\u05c1".repeat(count), 10, 10, {
        font: "arial",
        size: 10,
        direction: "rtl",
        charSpace: 0.1,
      });
      var bytes = recipe.endPage().endPDF();
      return { bytes, milliseconds: performance.now() - start };
    };
    draw(100);
    var short = draw(1500).milliseconds;
    var drawn = draw(6000);
    assert.ok(
      drawn.milliseconds < short * 10,
      short + " ms and " + drawn.milliseconds + " ms",
    );
    writeOutput(end, "text-direction-long-tj", drawn.bytes);
    // All 18000 characters are drawn.
    assert.ok(drawnContent(end, drawn.bytes).match(/ TJ/g).length > 1);
    assert.equal(
      pageText(drawn.bytes)
        .map((run) => run.text)
        .join("").length,
      18000,
    );
    // So they are on an edited page, which draws in a form the text
    // extraction does not read: every glyph is a two-byte code.
    var base = end.newRecipe().createPage(400, 400).endPage().endPDF();
    var edited = drawnContent(end, draw(6000, base).bytes);
    assert.ok(edited.match(/ TJ/g).length > 1);
    var glyphs = (edited.match(/<[0-9A-F]+>/g) || []).reduce(
      (count, hex) => count + (hex.length - 2) / 4,
      0,
    );
    assert.equal(glyphs, 18000);
  });

  it("adds no character spacing between a right-to-left letter and its points", function () {
    var options = { font: "arial", size: 40, direction: "rtl" };
    var pointed = "\u05d1\u05b0\u05bc\u05e8\u05b5\u05d0";
    var recipe = end.newRecipe();
    // Three letters take two spacings; their points take none.
    assert.ok(
      Math.abs(
        recipe.textDimensions(pointed, { ...options, charSpace: 10 }).xMax -
          recipe.textDimensions(pointed, options).xMax -
          20,
      ) < 0.01,
    );
    var bytes = drawBytes("text-direction-char-space", (page) => {
      page.text(pointed, 50, 50, { ...options, charSpace: 10 });
    });
    // Spaced text with a NUL is drawn, as without spacing, up to the NUL.
    end
      .newRecipe()
      .createPage(400, 400)
      .text(pointed + "\u0000x", 50, 50, { ...options, charSpace: 10 });
    // The spacing after each point is taken back, so it stays over the
    // letter drawn after it, in one text run.
    assert.match(
      drawnContent(end, bytes),
      /\[\s*<[0-9A-F]+>\s*250\s*<[0-9A-F]+>\s*250\s*<[0-9A-F]+>\s*250\s*<[0-9A-F]+>\s*\]\s*TJ/,
    );
  });

  it("lets a flowed HTML paragraph without letters wait for a later run", function () {
    var options = { font: "arial", size: 12, direction: "auto" };
    /**
     * The texts of a page's first two lines.
     *
     * @param {Array<{text: string, x: number, y: number}>} runs The page's runs.
     * @returns {string[][]} The runs' texts of each line.
     */
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
    var edges = (name, draw) =>
      annotationRects(drawBytes(name, draw)).map((rect) => [
        Math.round(rect[0]),
        Math.round(rect[2]),
      ]);
    var options = { font: "arial", size: 12, direction: "auto" };
    // Only the run that asks for a highlight is highlighted.
    assert.deepEqual(
      edges("text-direction-flow-markup-own", (recipe) =>
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
      [[50, 72]],
    );
    assert.deepEqual(
      edges("text-direction-flow-markup-first", (recipe) =>
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
      [[72, 99]],
    );
    // On a justified line each annotation ends at its word's glyphs.
    var justified = edges("text-direction-flow-markup-justify", (recipe) =>
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
    /**
     * Draw a flowed run ending with a separator, then the next run.
     *
     * @param {string} separator The paragraph separator ending the first run.
     * @param {boolean} [movedown] Whether movedown(0) follows it.
     * @returns {Promise<Array<{text: string, x: number, y: number}>>|Array<{text: string, x: number, y: number}>} The runs.
     */
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
    /**
     * Draw a flow ending with a separator, then text after it.
     *
     * @param {string} separator The paragraph separator ending the flow.
     * @returns {Promise<Array<{text: string, x: number, y: number}>>|Array<{text: string, x: number, y: number}>} The runs.
     */
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
    // A space before an inner element is a run of its own, outside it.
    var inner = drawPage("text-direction-flow-html-inner-space", (recipe) => {
      recipe
        .text("abc", 50, 50, { ...options, html: true, flow: true })
        .text("<span> <u>def</u></span>", { html: true })
        .text("", { flow: false });
    });
    assert.deepEqual(
      lineRuns(inner).map((run) => run.text),
      ["abc", " ", "def"],
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
      // A wrapped line keeps the no-break space it starts with.
      var leading = drawPage("text-direction-nbsp-start", (recipe) => {
        recipe.text("aaaa bbbb " + space + "cccc dddd", 20, 20, {
          font: "arial",
          size: 12,
          textBox: { width: 60 },
        });
      });
      // Extraction reads a no-break space at a run's start as a space.
      assert.deepEqual(
        leading.map((run) => run.text.replace(/\s/g, " ")),
        ["aaaa bbbb", " cccc dddd"],
        JSON.stringify(space),
      );
    }
  });

  it("starts a paragraph at a line break inside HTML text", function () {
    for (var html of [
      "abc\n123 \u05e9\u05dc\u05d5\u05dd",
      "<p>abc\n123 \u05e9\u05dc\u05d5\u05dd</p>",
      "abc\u2029123 \u05e9\u05dc\u05d5\u05dd",
    ]) {
      var runs = drawPage("text-direction-html-break", (recipe) => {
        recipe.text(html, 30, 30, {
          font: "arial",
          size: 12,
          html: true,
          direction: "auto",
          textBox: { width: 300 },
        });
      });
      // The second paragraph takes the direction of its own first letter.
      assert.deepEqual(
        [0, 1].map((line) =>
          lineRuns(runs, line)
            .map((run) => run.text)
            .join(""),
        ),
        ["abc", "\u05dd\u05d5\u05dc\u05e9 123"],
        JSON.stringify(html),
      );
    }
  });

  it("rejects an unknown direction before drawing", function () {
    var recipe = end.newRecipe().createPage(200, 200);
    assert.throws(() => recipe.text("abc", 10, 10, { direction: "up" }), {
      name: "TypeError",
    });
  });
});
