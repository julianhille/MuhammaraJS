const assert = require("node:assert/strict");
const muhammara = require("@muhammara/native-with-source");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const Recipe = muhammara.Recipe;

// The package bundles its own copy; this source copy needs bidi-js too.
require("@muhammara/shared/text-direction.js").useBidi(require("bidi-js"));
const ARIAL = path.join(__dirname, "../TestMaterials/fonts/arial.ttf");

/**
 * Read a page's decoded text runs in content stream order.
 *
 * @param {string} file PDF path.
 * @returns {Array<{text: string, x: number, y: number}>} The runs.
 */
function pageText(file) {
  const reader = muhammara.createReader(file);
  const elements = reader.extractPageText(0);
  reader.end();
  return elements.map((element) => ({
    text: element.text,
    x: element.textMatrix[4],
    y: element.textMatrix[5],
  }));
}

/**
 * Draw on a new 400 by 400 page, finish the Recipe, and read the page back.
 *
 * @param {string} name Output file name.
 * @param {function(Recipe): void} draw Draws on the page.
 * @returns {Promise<Array<{text: string, x: number, y: number}>>} The runs.
 */
function drawPage(name, draw) {
  const output = path.join(__dirname, "../output", name + ".pdf");
  const recipe = new Recipe("new", output);
  recipe.registerFont("arial", ARIAL);
  recipe.createPage(400, 400);
  draw(recipe);
  return new Promise((resolve) => {
    recipe.endPage().endPDF(() => resolve(pageText(output)));
  });
}

/**
 * The runs drawn on the line of the first run, from left to right.
 *
 * @param {Array<{text: string, x: number, y: number}>} runs The page's runs.
 * @param {number} [line=0] The zero-based line.
 * @returns {Array<{text: string, x: number, y: number}>} The line's runs.
 */
function lineRuns(runs, line = 0) {
  const ys = [...new Set(runs.map((run) => run.y))];
  return runs
    .filter((run) => run.y === ys[line])
    .sort((left, right) => left.x - right.x);
}

/**
 * The rectangles of a page's annotations, as [x1, y1, x2, y2].
 *
 * @param {string} file PDF path.
 * @returns {number[][]} The rectangles.
 */
function annotationRects(file) {
  const reader = muhammara.createReader(file);
  const rects = reader
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
  reader.end();
  return rects;
}

/**
 * Read a page's decoded content stream.
 *
 * @param {string} file PDF path.
 * @returns {string} The content operators, as Latin-1 text.
 */
function pageContent(file) {
  const reader = muhammara.createReader(file);
  let contents = reader.parsePageDictionary(0).queryObject("Contents");
  if (contents.getType() === muhammara.ePDFObjectIndirectObjectReference) {
    contents = reader.parseNewObject(contents.getObjectID());
  }
  const streams =
    contents.getType() === muhammara.ePDFObjectArray
      ? contents
          .toJSArray()
          .map((reference) => reader.parseNewObject(reference.getObjectID()))
      : [contents];
  const chunks = [];
  streams.forEach((stream) => {
    const streamReader = reader.startReadingFromStream(stream);
    while (streamReader.notEnded()) {
      chunks.push(Buffer.from(streamReader.read(65536)));
    }
  });
  reader.end();
  return Buffer.concat(chunks).toString("latin1");
}

describe("Recipe text direction", function () {
  this.timeout(15000);

  it("draws text as given by default", async function () {
    const runs = await drawPage("text-direction-default", (recipe) => {
      recipe.text("שלום עולם", 20, 20, { font: "arial", size: 12 });
    });
    assert.deepEqual(
      runs.map((run) => run.text),
      ["שלום עולם"],
    );
  });

  it("draws each wrapped line in visual order", async function () {
    const runs = await drawPage("text-direction-lines", (recipe) => {
      const options = { font: "arial", size: 12, direction: "auto" };
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

  it("places justified words from right to left", async function () {
    const runs = await drawPage("text-direction-justify", (recipe) => {
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

  it("keeps non-breaking spaces inside justified words", async function () {
    const runs = await drawPage("text-direction-nbsp", (recipe) => {
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

  it("indents justified right-to-left list items from the right", async function () {
    const writer = muhammara.createWriter(new muhammara.PDFWStreamForBuffer());
    const font = writer.getFontForFile(ARIAL);
    /**
     * Where a string's glyphs end at 12 points.
     *
     * @param {string} text The text.
     * @returns {number} Its xMax.
     */
    const xMax = (text) => font.calculateTextDimensions(text, 12).xMax;
    const list = "<ul><li>אחת שתיים שלוש ארבע חמש שש שבע שמונה</li></ul>";
    // The indent of a wrapped list line that is neither reordered nor
    // justified: the advance of its leading spaces.
    const plain = lineRuns(
      await drawPage("text-direction-indent-none", (recipe) => {
        recipe.text(list, 20, 20, {
          font: "arial",
          size: 12,
          html: true,
          textBox: { width: 120 },
        });
      }),
      1,
    )[0].text;
    const indent = xMax(plain) - xMax(plain.trimStart());
    assert.ok(indent > 20, plain);
    const hilites = [];
    const runs = await drawPage("text-direction-indent-auto", (recipe) => {
      const rectangle = recipe.rectangle;
      /**
       * Record each hilite rectangle's horizontal extent, then draw it.
       *
       * @param {number} x Left.
       * @param {number} y Top.
       * @param {number} width Width.
       * @param {number} height Height.
       * @param {Object} options Rectangle options.
       * @returns {Recipe} The recipe.
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
    const lines = [...new Set(runs.map((run) => run.y))];
    [1, lines.length - 2].forEach((line) => {
      const visible = lineRuns(runs, line).filter((run) => run.text.trim());
      // The words fill the line from its left edge to the indent.
      assert.ok(Math.abs(visible[0].x - 20) < 2, JSON.stringify(visible));
      const last = visible[visible.length - 1];
      assert.ok(
        Math.abs(140 - indent - (last.x + xMax(last.text.trimEnd()))) < 1,
        JSON.stringify(visible),
      );
    });
    // The text markup of the justified lines ends at the box edge.
    const rects = annotationRects(
      path.join(__dirname, "../output/text-direction-indent-auto.pdf"),
    );
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

  it("wraps text with character spacing and direction marks as Wasm does", async function () {
    const cases = [
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
    for (const [index, [text, options, expected]] of cases.entries()) {
      const runs = await drawPage(
        "text-direction-char-space-" + index,
        (recipe) => {
          recipe.text(text, 20, 20, {
            font: "arial",
            size: 12,
            charSpace: 2,
            textBox: { width: 110 },
            ...options,
          });
        },
      );
      assert.deepEqual(
        runs.map((run) => run.text),
        expected,
      );
    }
  });

  it("orders the styled runs of an HTML line as one line", async function () {
    const runs = await drawPage("text-direction-html", (recipe) => {
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

  it("justifies the styled runs of a flowed line from right to left", async function () {
    const runs = await drawPage("text-direction-flow-justify", (recipe) => {
      const options = {
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
    const line = lineRuns(runs);
    assert.deepEqual(
      line
        .map((run) => run.text.trim())
        .filter(Boolean)
        .slice(-3),
      ["שולש", "םייתש", "תחא"],
    );
    // Justified, the line spans the box from edge to edge.
    const font = muhammara
      .createWriter(new muhammara.PDFWStreamForBuffer())
      .getFontForFile(ARIAL);
    // A space drawn by its own run may come after the last word.
    const last = line.filter((run) => run.text.trim()).pop();
    assert.ok(Math.abs(line[0].x - 20) < 1, JSON.stringify(line));
    assert.ok(
      Math.abs(
        last.x +
          font.calculateTextDimensions(last.text.trimEnd(), 12).xMax -
          140,
      ) < 1,
      JSON.stringify(line),
    );
  });

  it("orders flowed runs of one line as one line", async function () {
    const runs = await drawPage("text-direction-flow", (recipe) => {
      const options = {
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

  it("aligns text by the width it draws, without formatting characters", async function () {
    const runs = await drawPage("text-direction-marks", (recipe) => {
      const options = {
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

  it("aligns a reordered HTML line by its drawn width, with its spaces", async function () {
    const writer = muhammara.createWriter(new muhammara.PDFWStreamForBuffer());
    const font = writer.getFontForFile(ARIAL);
    /**
     * Where a drawn run's glyphs end, without its trailing spaces.
     *
     * @param {{text: string, x: number}} run A drawn run.
     * @returns {number} The x of its right glyph edge.
     */
    const inkRight = (run) =>
      run.x + font.calculateTextDimensions(run.text.trimEnd(), 16).xMax;
    const runs = await drawPage("text-direction-html-align", (recipe) => {
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
    const [right, center, left] = [0, 1, 2].map((line) => lineRuns(runs, line));
    assert.ok(Math.abs(inkRight(right[right.length - 1]) - 400) < 0.5);
    assert.ok(
      Math.abs((center[0].x + inkRight(center[center.length - 1])) / 2 - 210) <
        0.5,
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
    const inkLeft = (run) => {
      const word = font.calculateTextDimensions(run.text.trim(), 16);
      return inkRight(run) - word.xMax + word.xMin;
    };
    right.slice(1).forEach((run, index) => {
      assert.ok(
        inkLeft(run) - inkRight(right[index]) > 3,
        JSON.stringify(right),
      );
    });
  });

  it("ends the last line of a justified right-to-left paragraph at the right edge", async function () {
    const writer = muhammara.createWriter(new muhammara.PDFWStreamForBuffer());
    const font = writer.getFontForFile(ARIAL);
    const runs = await drawPage("text-direction-justify-last", (recipe) => {
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
    const rtlLast = runs.filter((run) => run.y > 300).pop();
    const ltrLast = runs.filter((run) => run.y < 300).pop();
    assert.ok(
      Math.abs(
        rtlLast.x +
          font.calculateTextDimensions(rtlLast.text.trimEnd(), 12).xMax -
          220,
      ) < 0.5,
      JSON.stringify(rtlLast),
    );
    assert.ok(Math.abs(ltrLast.x - 20) < 0.5, JSON.stringify(ltrLast));
  });

  it("measures text without the formatting characters text() drops", function () {
    const recipe = new Recipe(
      "new",
      path.join(__dirname, "../output/text-direction-dimensions.pdf"),
    );
    recipe.registerFont("arial", ARIAL);
    const options = { font: "arial", size: 12 };
    const plain = recipe.textDimensions("שלום", {
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
      recipe.textDimensions("שלום עולם גדול", { ...options, direction: "rtl" }),
      recipe.textDimensions("לודג םלוע םולש", options),
    );
  });

  it("adds one text-markup annotation across a reordered line", async function () {
    const output = path.join(__dirname, "../output/text-direction-markup.pdf");
    const recipe = new Recipe("new", output);
    recipe.registerFont("arial", ARIAL);
    recipe.createPage(400, 400).text("<p>שלום <u>עולם</u> יפה</p>", 20, 20, {
      font: "arial",
      size: 16,
      html: true,
      direction: "auto",
      highlight: true,
      textBox: { width: 360, textAlign: "right" },
    });
    await new Promise((resolve) => recipe.endPage().endPDF(resolve));
    const reader = muhammara.createReader(output);
    const runs = reader.extractPageText(0);
    const annotations = reader
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
    reader.end();
    assert.equal(annotations.length, 1);
    const left = Math.min(...runs.map((run) => run.textMatrix[4]));
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

  it("resolves the levels of a wrapped paragraph across its lines", async function () {
    // The comma that ends "Hello" and "test" stays with its word, as it does
    // in the paragraph, instead of moving to the far end of its line.
    const sentence =
      '\u05d4\u05d5\u05d0 \u05db\u05ea\u05d1: "Hello, world. This is a test, okay?" \u05d5\u05d0\u05d6';
    for (const html of [false, true]) {
      const runs = await drawPage(
        "text-direction-paragraph-levels",
        (recipe) => {
          recipe.text(html ? "<p>" + sentence + "</p>" : sentence, 20, 20, {
            font: "arial",
            size: 10,
            html,
            direction: "rtl",
            textBox: { width: 90, textAlign: "right" },
          });
        },
      );
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

  it("ends a wrapped paragraph's levels where the paragraph ends", async function () {
    const options = { font: "arial", size: 10 };
    /**
     * The first drawn line of a draw, without its spaces.
     *
     * @param {string} name Output file name.
     * @param {function(Object): void} draw Draws on the page.
     * @returns {Promise<string>|string} The line.
     */
    const firstLine = async (name, draw) =>
      lineRuns(await drawPage(name, draw))
        .map((run) => run.text)
        .join("")
        .replace(/\s/g, "");
    // A run with a direction of its own is an isolate to the line before
    // it, and a run kept as given too: neutral, so the comma at the end of
    // a right-to-left paragraph's line takes its direction.
    for (const direction of ["ltr", "none"]) {
      assert.equal(
        await firstLine("text-direction-paragraph-isolate", (recipe) => {
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
      await firstLine("text-direction-paragraph-trim", (recipe) => {
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
      await firstLine("text-direction-paragraph-block", (recipe) => {
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

  it("gives each line of a paragraph its own place in it", async function () {
    /**
     * The drawn lines of a draw, each without its spaces.
     *
     * @param {string} name Output file name.
     * @param {function(Object): void} draw Draws on the page.
     * @returns {Promise<string[]>|string[]} The lines from the top.
     */
    const lines = async (name, draw) => {
      const runs = await drawPage(name, draw);
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
      (
        await lines("text-direction-paragraph-html-line", (recipe) => {
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
        })
      )[0],
      "-50%",
    );
    // An inline element does not end its paragraph: the comma between two
    // Latin words is left to right.
    assert.ok(
      (
        await lines("text-direction-paragraph-inline", (recipe) => {
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
        })
      ).includes("50%,"),
    );
    // A run with a direction of its own is as long in the paragraph as it
    // is, so the text after its line stays in the paragraph.
    const options = { font: "arial", size: 10, direction: "rtl" };
    assert.ok(
      (
        await lines("text-direction-paragraph-block-length", (recipe) => {
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
        })
      )[0].startsWith("abc,"),
    );
  });

  it("keeps an HTML paragraph's direction on its wrapped lines", async function () {
    const runs = await drawPage("text-direction-html-paragraph", (recipe) => {
      const options = {
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

  it("clips an overflowing right-to-left line at its end", async function () {
    const font = muhammara
      .createWriter(new muhammara.PDFWStreamForBuffer())
      .getFontForFile(ARIAL);
    const runs = await drawPage("text-direction-clip", (recipe) => {
      recipe.text("שלום עולם זהו טקסט ארוך בעברית שצריך", 100, 20, {
        font: "arial",
        size: 12,
        direction: "rtl",
        textBox: { width: 150, wrap: "clip", textAlign: "right" },
      });
    });
    const run = runs[0];
    // The line's start, its first word, ends at the right edge; the
    // overflowing word is cut on the left.
    assert.ok(run.text.trimEnd().endsWith("םולש"), run.text);
    assert.ok(
      Math.abs(
        run.x + font.calculateTextDimensions(run.text.trimEnd(), 12).xMax - 250,
      ) < 1,
      JSON.stringify(run),
    );
    assert.ok(run.x < 100, JSON.stringify(run));
    // Centred, an overflowing line keeps its start at the right edge too.
    const centred = await drawPage("text-direction-clip-centre", (recipe) => {
      recipe.text("שלוםשלוםשלום", 50, 20, {
        font: "arial",
        size: 12,
        direction: "rtl",
        textBox: { width: 40, wrap: "clip", textAlign: "center" },
      });
    });
    assert.ok(
      Math.abs(
        centred[0].x +
          font.calculateTextDimensions(centred[0].text, 12).xMax -
          90,
      ) < 1,
      JSON.stringify(centred),
    );
    // A justified line keeps its start at the right edge too.
    const justified = lineRuns(
      await drawPage("text-direction-clip-justify", (recipe) => {
        recipe.text("שלום עולם גדול מאוד יותר\nx", 100, 50, {
          font: "arial",
          size: 14,
          direction: "rtl",
          textBox: { width: 80, wrap: "clip", textAlign: "justify" },
        });
      }),
    );
    const start = justified[justified.length - 1];
    assert.ok(start.text.trim().endsWith("םולש"), JSON.stringify(justified));
    assert.ok(
      Math.abs(
        start.x +
          font.calculateTextDimensions(start.text.trimEnd(), 14).xMax -
          180,
      ) < 1,
      JSON.stringify(justified),
    );
  });

  it("links no spaces that end a clipped right-to-left flow", async function () {
    const output = path.join(
      __dirname,
      "../output/text-direction-clip-flow-link.pdf",
    );
    const recipe = new Recipe("new", output);
    recipe.registerFont("arial", ARIAL);
    recipe
      .createPage(400, 400)
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
    await new Promise((resolve) => recipe.endPage().endPDF(resolve));
    // Each run's link covers its own word, and nothing past the line.
    assert.deepEqual(
      annotationRects(output)
        .map((rect) => [Math.round(rect[0]), Math.round(rect[2])])
        .sort((left, right) => left[0] - right[0]),
      [
        [20, 42],
        [42, 69],
      ],
    );
    // Spaces that end the flow in a run of their own drop the spaces of
    // the run before them too.
    const spacesOutput = path.join(
      __dirname,
      "../output/text-direction-clip-flow-spaces.pdf",
    );
    const spaces = new Recipe("new", spacesOutput);
    spaces.registerFont("arial", ARIAL);
    spaces
      .createPage(400, 400)
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
    await new Promise((resolve) => spaces.endPage().endPDF(resolve));
    assert.deepEqual(
      annotationRects(spacesOutput).map((rect) => [
        Math.round(rect[0]),
        Math.round(rect[2]),
      ]),
      [[73, 94]],
    );
    // A line's last piece of only spaces takes no room for its link.
    const blankOutput = path.join(
      __dirname,
      "../output/text-direction-blank-piece-link.pdf",
    );
    const blank = new Recipe("new", blankOutput);
    blank.registerFont("arial", ARIAL);
    blank
      .createPage(400, 400)
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
    await new Promise((resolve) => blank.endPage().endPDF(resolve));
    // The piece of only spaces gets no link of its own.
    const blankRects = annotationRects(blankOutput);
    assert.equal(blankRects.length, 1, JSON.stringify(blankRects));
    assert.ok(blankRects[0][2] < 35, JSON.stringify(blankRects));
  });

  it("draws a clipped flow or HTML box that ends with an empty line", async function () {
    const options = {
      font: "arial",
      size: 12,
      direction: "rtl",
      textBox: { width: 107, wrap: "clip" },
    };
    const runs = await drawPage("text-direction-clip-empty-line", (recipe) => {
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

  it("marks no line that draws only direction marks", async function () {
    const output = path.join(
      __dirname,
      "../output/text-direction-markup-marks.pdf",
    );
    const recipe = new Recipe("new", output);
    recipe.registerFont("arial", ARIAL);
    recipe.createPage(400, 400).text("abc\n\u200e", 20, 20, {
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
    await new Promise((resolve) => recipe.endPage().endPDF(resolve));
    assert.equal(annotationRects(output).length, 2);
  });

  it("draws HTML text with markup placed at an x of center without throwing", async function () {
    const runs = await drawPage("text-direction-center-markup", (recipe) => {
      recipe.text("<p>abc lorem</p>", "center", 200, {
        font: "arial",
        underline: true,
        html: true,
      });
    });
    assert.equal(runs.map((run) => run.text).join(""), "abc lorem");
  });

  it("highlights the last line of a justified right-to-left paragraph inside the box", async function () {
    const rectangles = [];
    await drawPage("text-direction-hilite", (recipe) => {
      const rectangle = recipe.rectangle;
      /**
       * Record each hilite rectangle's horizontal extent, then draw it.
       *
       * @param {number} x Left.
       * @param {number} y Top.
       * @param {number} width Width.
       * @param {number} height Height.
       * @param {Object} options Rectangle options.
       * @returns {Recipe} The recipe.
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

  it("gives flowed runs the direction of the paragraph they continue", async function () {
    const lines = {};
    for (const flow of [true, false]) {
      const runs = await drawPage(
        "text-direction-flow-paragraph-" + flow,
        (recipe) => {
          const options = {
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
        },
      );
      lines[flow] = lineRuns(runs, 1).map((run) => run.text.trim());
    }
    // The paragraph starts with a Latin word, so it runs left to right.
    assert.deepEqual(lines[true], ["abc םלוע def"]);
    assert.deepEqual(lines[true], lines[false]);
  });

  it("lets a flowed run without letters take the direction of the runs after it", async function () {
    const lines = {};
    for (const flow of [true, false]) {
      const runs = await drawPage(
        "text-direction-flow-number-" + flow,
        (recipe) => {
          const options = {
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
        },
      );
      lines[flow] = lineRuns(runs)
        .map((run) => run.text.trim())
        .join(" ");
    }
    assert.equal(lines[true], "םלוע םולש (1)");
    assert.equal(lines[true], lines[false]);
  });

  it("gives earlier wrapped lines of a flowed paragraph the direction found later", async function () {
    const lines = {};
    for (const flow of [true, false]) {
      const runs = await drawPage(
        "text-direction-flow-wrapped-" + flow,
        (recipe) => {
          const options = {
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
        },
      );
      const ys = [...new Set(runs.map((run) => run.y))];
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

  it("keeps the hilite of a clipped right-to-left line inside the box", async function () {
    // Native draws hilites outside the clip, so it limits them to the box.
    const hilites = { rtl: [], none: [] };
    for (const direction of ["rtl", "none"]) {
      await drawPage("text-direction-clip-hilite-" + direction, (recipe) => {
        const rectangle = recipe.rectangle;
        /**
         * Record each hilite rectangle's horizontal extent, then draw it.
         *
         * @param {number} x Left.
         * @param {number} y Top.
         * @param {number} width Width.
         * @param {number} height Height.
         * @param {Object} options Rectangle options.
         * @returns {Recipe} The recipe.
         */
        recipe.rectangle = function (x, y, width, height, options) {
          hilites[direction].push([x, x + width]);
          return rectangle.call(this, x, y, width, height, options);
        };
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
      });
    }
    assert.deepEqual(
      hilites.rtl.map((edges) => edges.map((edge) => +edge.toFixed(6))),
      [[20, 80]],
    );
    // Text that is not reordered keeps its hilite as before.
    assert.equal(hilites.none.length, 1);
    assert.ok(hilites.none[0][0] < 20, JSON.stringify(hilites.none));
  });

  it("ends the last line of a flowed justified right-to-left paragraph at the right edge", async function () {
    const font = muhammara
      .createWriter(new muhammara.PDFWStreamForBuffer())
      .getFontForFile(ARIAL);
    const runs = await drawPage("text-direction-flow-justify", (recipe) => {
      const options = {
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
    const line = lineRuns(runs);
    assert.deepEqual(
      line.map((run) => run.text.trim()),
      ["טסקט והז", "םלוע םולש"],
    );
    const last = line[line.length - 1];
    assert.ok(
      Math.abs(
        last.x +
          font.calculateTextDimensions(last.text.trimEnd(), 12).xMax -
          300,
      ) < 1,
      JSON.stringify(line),
    );
  });

  it("draws an HTML line that holds only a direction mark", async function () {
    const runs = await drawPage("text-direction-mark-line", (recipe) => {
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

  it("clips overflowing right-to-left lines at the padded right edge", async function () {
    const font = muhammara
      .createWriter(new muhammara.PDFWStreamForBuffer())
      .getFontForFile(ARIAL);
    /**
     * Where a drawn run's glyphs end, without its trailing spaces.
     *
     * @param {{text: string, x: number}} run A drawn run.
     * @returns {number} The x of its right glyph edge.
     */
    const inkRight = (run) =>
      run.x + font.calculateTextDimensions(run.text.trimEnd(), 12).xMax;
    const runs = await drawPage("text-direction-clip-padding", (recipe) => {
      const options = {
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
      const visible = lineRuns(runs, line);
      const rightmost = visible[visible.length - 1];
      assert.ok(
        Math.abs(inkRight(rightmost) - 163) < 1,
        JSON.stringify(visible),
      );
      assert.ok(visible[0].x < 31, JSON.stringify(visible));
    });
  });

  it("keeps links and text markup on the visible part of a clipped right-to-left line", async function () {
    const output = path.join(
      __dirname,
      "../output/text-direction-clip-markup.pdf",
    );
    const recipe = new Recipe("new", output);
    recipe.registerFont("arial", ARIAL);
    const hilites = [];
    const rectangle = recipe.rectangle;
    /**
     * Record each hilite rectangle's horizontal extent, then draw it.
     *
     * @param {number} x Left.
     * @param {number} y Top.
     * @param {number} width Width.
     * @param {number} height Height.
     * @param {Object} options Rectangle options.
     * @returns {Recipe} The recipe.
     */
    recipe.rectangle = function (x, y, width, height, options) {
      hilites.push([x, x + width]);
      return rectangle.call(this, x, y, width, height, options);
    };
    recipe.createPage(400, 400).text("שלום עולם זה טקסט ארוך בעברית", 50, 20, {
      font: "arial",
      size: 12,
      direction: "rtl",
      underline: true,
      hilite: true,
      link: "https://example.com",
      textBox: { width: 150, wrap: "clip" },
    });
    await new Promise((resolve) => recipe.endPage().endPDF(resolve));
    const rects = annotationRects(output);
    assert.equal(rects.length, 2);
    // The text fills the box from its left edge, 50, to its right edge, 200.
    rects.forEach((rect) => {
      assert.ok(Math.abs(rect[0] - 50) < 1, JSON.stringify(rects));
      assert.ok(rect[2] <= 200.5 && rect[2] > 190, JSON.stringify(rects));
    });
    // The hilite covers the visible part of the line, the whole box; the
    // drawn text overflows on the left.
    const start = Math.min(...pageText(output).map((run) => run.x));
    assert.ok(start < 50, String(start));
    assert.equal(hilites.length, 1);
    assert.ok(hilites[0][0] < 50.5, JSON.stringify(hilites));
    assert.ok(hilites[0][1] > 195, JSON.stringify(hilites));
  });

  it("keeps the hilite and links of right-to-left lines inside the box", async function () {
    const output = path.join(
      __dirname,
      "../output/text-direction-link-edge.pdf",
    );
    const recipe = new Recipe("new", output);
    recipe.registerFont("arial", ARIAL);
    const hilites = [];
    const rectangle = recipe.rectangle;
    /**
     * Record each hilite rectangle's horizontal extent, then draw it.
     *
     * @param {number} x Left.
     * @param {number} y Top.
     * @param {number} width Width.
     * @param {number} height Height.
     * @param {Object} options Rectangle options.
     * @returns {Recipe} The recipe.
     */
    recipe.rectangle = function (x, y, width, height, options) {
      hilites.push([x, x + width]);
      return rectangle.call(this, x, y, width, height, options);
    };
    const options = {
      font: "arial",
      size: 14,
      direction: "rtl",
      hilite: true,
      link: "https://example.com",
    };
    recipe
      .createPage(400, 400)
      .text("שלום Hello עולם", 20, 20, {
        ...options,
        textBox: { width: 300, textAlign: "right" },
      })
      .text("שלום עולם טוב מאוד ונהדר מאוד היום", 20, 100, {
        ...options,
        textBox: { width: 160, textAlign: "justify" },
      });
    await new Promise((resolve) => recipe.endPage().endPDF(resolve));
    const links = annotationRects(output).sort(
      (a, b) => a[1] - b[1] || a[0] - b[0],
    );
    // The right-aligned line ends at its box edge, 320.
    assert.ok(Math.abs(hilites[0][1] - 320) < 0.05, JSON.stringify(hilites));
    const right = links.find((rect) => rect[2] > 200);
    assert.ok(Math.abs(right[2] - 320) < 0.05, JSON.stringify(links));
    // The justified line's links cover the gaps between its words and end
    // at its box edge, 180.
    const lineBottom = links.find((rect) => Math.abs(rect[0] - 20) < 0.5)[1];
    const justified = links
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

  it("keeps right-to-left pieces and their hilite on the line", async function () {
    const font = muhammara
      .createWriter(new muhammara.PDFWStreamForBuffer())
      .getFontForFile(ARIAL);
    const hilites = {};
    const draws = {
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
    const runs = {};
    for (const name of Object.keys(draws)) {
      const [text, box] = draws[name];
      hilites[name] = [];
      runs[name] = await drawPage("text-direction-pieces-" + name, (recipe) => {
        const rectangle = recipe.rectangle;
        /**
         * Record each hilite rectangle's horizontal extent, then draw it.
         *
         * @param {number} x Left.
         * @param {number} y Top.
         * @param {number} width Width.
         * @param {number} height Height.
         * @param {Object} options Rectangle options.
         * @returns {Recipe} The recipe.
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
    const first = lineRuns(runs.oneWord)[0];
    assert.ok(
      Math.abs(
        first.x + font.calculateTextDimensions(first.text, 12).xMax - 130,
      ) < 0.05,
      JSON.stringify(first),
    );
    const pieces = hilites.runs.slice().sort((a, b) => a[0] - b[0]);
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

  it("keeps the underline of a reordered run under its glyphs", async function () {
    const font = muhammara
      .createWriter(new muhammara.PDFWStreamForBuffer())
      .getFontForFile(ARIAL);
    const output = path.join(
      __dirname,
      "../output/text-direction-underline.pdf",
    );
    const runs = await drawPage("text-direction-underline", (recipe) => {
      recipe.text("<p>שלום <u>עולם</u> יפה</p>", 20, 20, {
        font: "arial",
        size: 12,
        html: true,
        direction: "rtl",
        textBox: { width: 300, textAlign: "right" },
      });
    });
    const word = runs.find((run) => run.text.trim() === "םלוע");
    const [, start, end] = /([\d.]+) [\d.]+ m\s+([\d.]+) [\d.]+ l/.exec(
      pageContent(output),
    );
    assert.ok(Math.abs(Number(start) - word.x) < 0.05, start);
    assert.ok(
      Math.abs(
        Number(end) - word.x - font.calculateTextDimensions("םלוע", 12).xMax,
      ) < 0.05,
      end,
    );
  });

  it("draws nothing for a line of only direction marks", async function () {
    const runs = await drawPage("text-direction-mark-only", (recipe) => {
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

  it("marks only the word of a justified right-to-left line without gaps", async function () {
    const output = path.join(__dirname, "../output/text-direction-no-gaps.pdf");
    await drawPage("text-direction-no-gaps", (recipe) => {
      recipe.text("אאא בבבבבבבבבבבבבבבבבבבבב גג", 20, 20, {
        font: "arial",
        size: 12,
        direction: "rtl",
        highlight: true,
        textBox: { width: 100, textAlign: "justify" },
      });
    });
    annotationRects(output).forEach((rect) => {
      assert.ok(rect[2] < 120.05, JSON.stringify(rect));
    });
  });

  it("measures table rows without direction marks", async function () {
    const heights = [];
    for (const text of [
      "שלום abc עולם def זה ghi טקסט jk ארוך",
      "שלום \u2067abc\u2069 עולם \u2067def\u2069 זה \u2067ghi\u2069 טקסט \u2067jk\u2069 ארוך",
    ]) {
      await drawPage("text-direction-table-" + heights.length, (recipe) => {
        const rectangle = recipe.rectangle;
        /**
         * Record each hilite rectangle's horizontal extent, then draw it.
         *
         * @param {number} x Left.
         * @param {number} y Top.
         * @param {number} width Width.
         * @param {number} height Height.
         * @param {Object} options Rectangle options.
         * @returns {Recipe} The recipe.
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

  it("gives table headers the direction of their column or table", async function () {
    for (const [tableOptions, columnOptions, header] of [
      [{ direction: "auto" }, {}, "\u05d0\u05dc\u05de \u05dd\u05e9"],
      [{}, { direction: "rtl" }, "\u05d0\u05dc\u05de \u05dd\u05e9"],
      // A header's own direction wins.
      [
        { direction: "rtl", header: { font: "arial", direction: "none" } },
        {},
        "\u05e9\u05dd \u05de\u05dc\u05d0",
      ],
    ]) {
      const runs = await drawPage("text-direction-table-header", (recipe) => {
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

  it("reorders each line once", async function () {
    const segment = Intl.Segmenter.prototype.segment;
    let calls = 0;
    /**
     * Count each grapheme segmentation, then segment.
     *
     * @param {...*} args The segment() arguments.
     * @returns {Object} The segments.
     */
    Intl.Segmenter.prototype.segment = function (...args) {
      calls++;
      return segment.apply(this, args);
    };
    const counts = [];
    try {
      for (const textBox of [{}, { width: 300, textAlign: "justify" }]) {
        calls = 0;
        await drawPage("text-direction-reorder-once", (recipe) => {
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

  it("measures each piece of a justified right-to-left line once", async function () {
    const font = muhammara
      .createWriter(new muhammara.PDFWStreamForBuffer())
      .getFontForFile(ARIAL);
    const proto = Object.getPrototypeOf(font);
    const measure = proto.calculateTextDimensions;
    let calls = 0;
    /**
     * Count each measurement, then measure.
     *
     * @param {...*} args The calculateTextDimensions() arguments.
     * @returns {Object} The text dimensions.
     */
    proto.calculateTextDimensions = function (...args) {
      calls++;
      return measure.apply(this, args);
    };
    const words = ["אחת", "שתיים", "שלוש", "ארבע", "חמש"];
    const text = Array.from(
      { length: 40 },
      (_, index) => words[index % 5],
    ).join(" ");
    const counts = {};
    try {
      for (const direction of ["none", "rtl"]) {
        calls = 0;
        await drawPage("text-direction-measure-" + direction, (recipe) => {
          recipe.text(text, 20, 20, {
            font: "arial",
            size: 12,
            direction,
            textBox: { width: 200, textAlign: "justify" },
          });
        });
        counts[direction] = calls;
      }
    } finally {
      proto.calculateTextDimensions = measure;
    }
    // Laying out the words measures them already; drawing them in visual
    // order adds about one measurement per word, not one per use.
    assert.ok(counts.rtl <= counts.none * 1.6, JSON.stringify(counts));
  });

  it("draws the pieces of a translucent line in one form per run", async function () {
    const words = ["אחת", "שתיים", "שלוש", "ארבע", "חמש"];
    const text = Array.from(
      { length: 40 },
      (_, index) => words[index % 5],
    ).join(" ");
    const forms = {};
    for (const direction of ["none", "rtl"]) {
      const name = "text-direction-translucent-" + direction;
      await drawPage(name, (recipe) => {
        recipe.text(text, 20, 20, {
          font: "arial",
          size: 12,
          direction,
          opacity: 0.5,
          textBox: { width: 200, textAlign: "justify" },
        });
      });
      const bytes = fs.readFileSync(
        path.join(__dirname, "../output", name + ".pdf"),
        "latin1",
      );
      forms[direction] = (bytes.match(/\/Subtype\s*\/Form/g) || []).length;
    }
    // One form per line, not one per word.
    assert.ok(forms.none > 0);
    assert.equal(forms.rtl, forms.none);
  });

  it("starts a paragraph with its own direction at every mandatory break", async function () {
    const breaks = [
      "\n",
      "\r",
      "\r\n",
      "\u000b",
      "\f",
      "\u0085",
      "\u2028",
      "\u2029",
    ];
    for (const [index, lineBreak] of breaks.entries()) {
      const runs = await drawPage("text-direction-break-" + index, (recipe) => {
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
    }
  });

  it("gives each flowed run the direction it asked for", async function () {
    // Runs and the line they draw, read from left to right.
    const cases = [
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
    for (const [index, [texts, expected]] of cases.entries()) {
      const runs = await drawPage("text-direction-run-" + index, (recipe) => {
        texts.forEach(([text, direction, extra], run) => {
          const options = { font: "arial", size: 12, direction, ...extra };
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

  it("closes a flowed paragraph's direction at movedown()", async function () {
    const runs = await drawPage("text-direction-flow-movedown", (recipe) => {
      const options = { font: "arial", size: 12, direction: "auto" };
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

  it("keeps no more of a flowed paragraph than its direction once it has one", async function () {
    const kept = [];
    const runs = await drawPage("text-direction-flow-kept", (recipe) => {
      const options = { font: "arial", size: 12, direction: "auto" };
      recipe.text("1 שלום ", 20, 20, {
        ...options,
        flow: true,
        textBox: { width: 360 },
      });
      for (let index = 0; index < 50; ++index) {
        recipe.text("abc ", options);
        kept.push(recipe._flowParagraph.length);
      }
      recipe.text("", { flow: false });
    });
    // Each run would otherwise search the whole paragraph again, so a flow
    // took time with the square of its runs.
    assert.ok(
      kept.every((length) => length === 1),
      "kept " + kept.join(),
    );
    // The paragraph still takes the direction of its first letter, so the
    // first run stays rightmost on its line, whatever runs come after it.
    const first = runs.find((run) => run.text.includes("1"));
    const line = runs.filter((run) => run.y === first.y);
    assert.equal(Math.max(...line.map((run) => run.x)), first.x);
    assert.ok(line.length > 1);
  });

  it("measures a wrapping line from its words as drawn", function () {
    const {
      Word,
      Line,
    } = require("@muhammara/native-core/lib/recipe/text.helper");
    const { drawnText } = require("@muhammara/shared/text-direction.js");
    const font = muhammara
      .createWriter(new muhammara.PDFWStreamForBuffer())
      .getFontForFile(ARIAL);
    for (const [direction, words] of [
      ["rtl", ["\u05e9\u05c1\u05b8\u05dc\u05d5\u05b9\u05dd ", "abc ", "12"]],
      ["auto", ["\u2067\u05d0\u2069 ", "\u05d1\u200d", "\u05b8x"]],
      ["none", ["Hello ", "w\u0301orld"]],
    ]) {
      const options = { font, size: 12, direction, charSpace: 2 };
      const line = new Line(1000, 12, 12, options);
      words.forEach((word) => line.addWord(new Word(word, options)));
      // The line adds up its words, and draws a word that continues the
      // cluster before it with that cluster, as the whole line is drawn.
      const value = words.join("");
      assert.equal(
        line.currentWidth,
        font.calculateTextDimensions(drawnText(value, direction), 12).xMax +
          line.charSpacing(value),
        direction,
      );
    }
  });

  it("forgets a flow's paragraph state at a new page and a table", async function () {
    /**
     * Leave a flow's paragraph state behind, as an unfinished flow would.
     *
     * @param {Recipe} recipe The Recipe.
     */
    const stale = (recipe) => {
      recipe._flowParagraph = "\u05d0";
      recipe._flowWaits = true;
      recipe._flowLines = [{}];
    };
    /**
     * A flow's paragraph state.
     *
     * @param {Recipe} recipe The Recipe.
     * @returns {Array} Its open paragraph, whether it waits, and its waiting lines.
     */
    const cleared = (recipe) => [
      recipe._flowParagraph,
      recipe._flowWaits,
      recipe._flowLines.length,
    ];
    await drawPage("text-direction-flow-reset", (recipe) => {
      stale(recipe);
      recipe.endPage().createPage(400, 400);
      assert.deepEqual(cleared(recipe), ["", false, 0]);
      stale(recipe);
      recipe.table(20, 20, [{ value: "row" }], { font: "arial", size: 10 });
      assert.deepEqual(cleared(recipe), ["", false, 0]);
    });
  });

  it("keeps only the open isolates of a flowed paragraph without a letter", async function () {
    const kept = [];
    const lines = {};
    for (const flow of [true, false]) {
      const runs = await drawPage(
        "text-direction-flow-neutral-" + flow,
        (recipe) => {
          const options = {
            font: "arial",
            size: 12,
            direction: "auto",
            textBox: { width: 360 },
          };
          const parts = [
            "(1) ",
            "\u2067abc ",
            "2 - 3 ",
            "\u2069 4 ",
            "\u05e9\u05dc\u05d5\u05dd",
          ];
          if (flow) {
            recipe.text(parts[0], 20, 20, { ...options, flow: true });
            for (const part of parts.slice(1)) {
              recipe.text(part, options);
              kept.push(recipe._flowParagraph);
            }
            recipe.text("", { flow: false });
          } else recipe.text(parts.join(""), 20, 20, options);
        },
      );
      lines[flow] = runs
        .slice()
        .sort((a, b) => a.x - b.x)
        .map((run) => run.text)
        .join("");
    }
    // The paragraph without a letter kept growing with each run.
    assert.deepEqual(kept, [" \u2066", " \u2066", " ", "\u05d0"]);
    // The isolate's letters do not give the flowed paragraph its direction,
    // as in one call.
    assert.equal(lines.true, lines.false);
  });

  it("lets a flowed paragraph starting with an isolate take a later letter's direction", async function () {
    const text = "\u2067abc\u2069 1 2 3 4 5 6 7 8 9 ";
    const lines = {};
    for (const flow of [true, false]) {
      const runs = await drawPage(
        "text-direction-flow-isolate-" + flow,
        (recipe) => {
          const options = {
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
        },
      );
      lines[flow] = runs.map((run) => run.text);
    }
    // The isolate's letters do not set the paragraph's direction; the
    // Hebrew word after it does.
    assert.deepEqual(lines[false], ["4 3 2 1 abc", "9 8 7 6 5", "םולש"]);
    assert.deepEqual(lines[true], lines[false]);
  });

  it("ends a flowed paragraph where an HTML block element ends", async function () {
    const runs = await drawPage("text-direction-flow-html-block", (recipe) => {
      const options = { font: "arial", size: 12, direction: "auto" };
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

  it("continues a right-to-left flowed paragraph with inline HTML", async function () {
    const runs = await drawPage("text-direction-flow-html-inline", (recipe) => {
      const options = { font: "arial", size: 12, direction: "auto" };
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

  it("gives every flowed HTML block element a paragraph of its own", async function () {
    const runs = await drawPage("text-direction-flow-html-blocks", (recipe) => {
      const options = {
        font: "arial",
        size: 12,
        html: true,
        direction: "auto",
      };
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

  it("breaks a flowed line at every paragraph separator", async function () {
    for (const separator of ["\u2028", "\u2029", "\v", "\f", "\u0085", "\r"]) {
      const runs = await drawPage("text-direction-flow-separator", (recipe) => {
        const options = { font: "arial", size: 12, direction: "rtl" };
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

  it("ends a flowed run at a long run of CRLFs in time", async function () {
    // Each CRLF is one break, however it is matched.
    const runs = await drawPage("text-direction-flow-crlfs", (recipe) => {
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

  it("resolves a waiting flowed paragraph with the direction its lines asked for", async function () {
    const cases = [
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
    for (const [text, direction, visual] of cases) {
      const runs = await drawPage("text-direction-flow-waiting", (recipe) => {
        const options = { font: "arial", size: 12 };
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

  it("starts the run after a reordered piece where it starts as typed", async function () {
    const starts = {};
    for (const direction of ["none", "ltr"]) {
      const runs = await drawPage(
        "text-direction-run-gap-" + direction,
        (recipe) => {
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
        },
      );
      starts[direction] = runs[1].x;
    }
    // The gap keeps the last "o"'s side bearing and character spacing.
    assert.ok(Math.abs(starts.ltr - starts.none) < 0.1, JSON.stringify(starts));
  });

  it("draws the words of a justified line kept in logical order as typed", async function () {
    const options = {
      font: "arial",
      size: 14,
      textBox: { width: 210, textAlign: "justify" },
    };
    const runs = await drawPage("text-direction-justified-words", (recipe) => {
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

  it("starts a clipped right-to-left line without a width at x", async function () {
    const runs = await drawPage("text-direction-clip-no-width", (recipe) => {
      recipe.text("\u05e9\u05dc\u05d5\u05dd abc", 20, 20, {
        font: "arial",
        size: 12,
        direction: "rtl",
        textBox: { wrap: "clip" },
      });
    });
    assert.equal(Math.min(...runs.map((run) => run.x)), 20);
  });

  it("keeps a line that fits only as drawn on one line", async function () {
    // As typed, "ff" ends past the box; drawn in visual order, the line
    // ends at the Hebrew word's last glyph and fits.
    const runs = await drawPage("text-direction-fits-drawn", (recipe) => {
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

  it("aligns a line by a point of the next run that reaches past its letter", async function () {
    const options = {
      font: "arial",
      size: 15,
      direction: "rtl",
      textBox: { width: 60, textAlign: "right" },
    };
    // A segol reaches further right than its vav.
    const single = await drawPage(
      "text-direction-point-edge-single",
      (recipe) => {
        recipe.text("\u05d5\u05b6", 20, 20, options);
      },
    );
    const split = await drawPage(
      "text-direction-point-edge-split",
      (recipe) => {
        recipe
          .text("\u05d5", 20, 20, { ...options, flow: true })
          .text("\u05b6", options)
          .text("", { flow: false });
      },
    );
    assert.ok(
      Math.abs(
        Math.min(...split.map((run) => run.x)) -
          Math.min(...single.map((run) => run.x)),
      ) < 0.01,
      JSON.stringify([single, split]),
    );
  });

  it("advances a reordered piece by the whitespace it ends with", async function () {
    const font = { font: "arial", size: 20 };
    let expected;
    const runs = await drawPage("text-direction-wide-space", (recipe) => {
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

  it("keeps a point that starts a run over its letter", async function () {
    const options = {
      font: "arial",
      size: 30,
      direction: "rtl",
      textBox: { width: 60, textAlign: "right" },
    };
    // A point has no advance of its own: the run before it ends where the
    // point's letter starts, and the line fits as it is measured.
    const draws = {
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
    for (const [name, draw] of Object.entries(draws)) {
      const runs = await drawPage("text-direction-point-run-" + name, draw);
      assert.ok(
        runs.every((run) => run.x >= 20),
        name + JSON.stringify(runs),
      );
    }
  });

  it("keeps the pieces of a reordered line and their markup valid", async function () {
    const options = { font: "arial", size: 12, direction: "rtl" };
    // Measuring stops at a NUL; the piece after one is not drawn before it.
    const nul = await drawPage("text-direction-nul-piece", (recipe) => {
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
    await drawPage("text-direction-empty-markup", (recipe) => {
      const justified = {
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
    await drawPage("text-direction-negative-spacing", (recipe) => {
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
    const pointOutput = path.join(
      __dirname,
      "../output/text-direction-point-markup.pdf",
    );
    const point = new Recipe("new", pointOutput);
    point.registerFont("arial", ARIAL);
    point
      .createPage(400, 400)
      .text("abc ", 20, 20, { ...options, flow: true, textBox: { width: 300 } })
      .text("\u05b9", { ...options, highlight: true })
      .text(" def", { ...options, highlight: false })
      .text("", { flow: false, highlight: false });
    await new Promise((resolve) => point.endPage().endPDF(resolve));
    assert.throws(() => annotationRects(pointOutput));
    // Spacing too large to take back is written as it is set.
    await drawPage("text-direction-huge-spacing", (recipe) => {
      recipe.text("\u05e9\u05b8\u05c1\u05dc", 20, 20, {
        ...options,
        charSpace: 1e306,
      });
    });
    const operators = fs
      .readFileSync(
        path.join(__dirname, "../output/text-direction-huge-spacing.pdf"),
      )
      .toString("latin1")
      .split("stream\r\n")
      .slice(1)
      .map((chunk) => {
        const data = Buffer.from(chunk.split("endstream")[0], "latin1");
        try {
          return zlib.inflateSync(data).toString("latin1");
        } catch {
          return "";
        }
      })
      .join("\n");
    assert.match(operators, /\bTj\b/);
    assert.doesNotMatch(operators, /\b(?:inf|nan)\b/i);
  });

  it("keeps the links of a justified reordered line inside the box", async function () {
    // The last piece ends with a no-break space, which a justified line
    // does not widen past the box.
    const output = path.join(
      __dirname,
      "../output/text-direction-justified-link.pdf",
    );
    const recipe = new Recipe("new", output);
    recipe.registerFont("arial", ARIAL);
    recipe
      .createPage(400, 400)
      .text("abc \u05e9\u05dc\u05d5\u05dd\u00a0 defghijkl mnopqrs", 50, 50, {
        font: "arial",
        size: 12,
        direction: "ltr",
        link: "https://example.com",
        textBox: { width: 75, textAlign: "justify" },
      });
    await new Promise((resolve) => recipe.endPage().endPDF(resolve));
    // The first line, the one reordered, is the highest.
    const rects = annotationRects(output);
    const top = Math.max(...rects.map((rect) => rect[1]));
    const first = rects.filter((rect) => rect[1] === top);
    assert.ok(first.length > 0);
    first.forEach((rect) => assert.ok(rect[2] <= 125.01, JSON.stringify(rect)));
  });

  it("marks a flowed run of only no-break spaces on a reordered line", async function () {
    const output = path.join(
      __dirname,
      "../output/text-direction-nbsp-run-markup.pdf",
    );
    const recipe = new Recipe("new", output);
    recipe.registerFont("arial", ARIAL);
    const options = {
      font: "arial",
      size: 12,
      direction: "rtl",
      highlight: true,
    };
    recipe
      .createPage(400, 400)
      .text("\u05e9\u05dc\u05d5\u05dd ", 50, 50, {
        ...options,
        flow: true,
        textBox: { width: 200 },
      })
      .text("\u00a0\u00a0", options)
      .text(" \u05e2\u05d5\u05dc\u05dd", options)
      .text("", { flow: false });
    await new Promise((resolve) => recipe.endPage().endPDF(resolve));
    assert.equal(annotationRects(output).length, 3);
  });

  it("draws each space of a reordered line with its own run", async function () {
    const runs = await drawPage("text-direction-run-spaces", (recipe) => {
      const options = { font: "arial", size: 12, direction: "rtl" };
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

  it("adds a text-markup annotation to each piece of a reordered flowed line", async function () {
    const output = path.join(
      __dirname,
      "../output/text-direction-flow-markup.pdf",
    );
    const recipe = new Recipe("new", output);
    recipe.registerFont("arial", ARIAL);
    const options = {
      font: "arial",
      size: 12,
      direction: "rtl",
      underline: true,
    };
    recipe
      .createPage(400, 400)
      .text("\u05e9\u05dc\u05d5\u05dd ", 50, 50, { ...options, flow: true })
      .text("\u05e2\u05d5\u05dc\u05dd ", options)
      .text("", { flow: false });
    await new Promise((resolve) => recipe.endPage().endPDF(resolve));
    const reader = muhammara.createReader(output);
    const runs = reader.extractPageText(0);
    const annotations = reader
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
    reader.end();
    // One per run, as for a left-to-right flow, each starting at its run.
    assert.equal(annotations.length, 2, JSON.stringify(annotations));
    assert.deepEqual(
      annotations.map((rect) => Math.round(rect[0])),
      runs.map((run) => Math.round(run.textMatrix[4])),
    );
    assert.ok(annotations[0][2] <= annotations[1][0] + 0.01);
  });

  it("measures a pointed right-to-left letter as it is drawn", async function () {
    // Drawn, the line is 277 points wide: the point comes before its letter
    // and sits over it. After its letter, as typed, it would reach past the
    // letter to 303 points and wrap the line.
    const runs = await drawPage("text-direction-pointed-width", (recipe) => {
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

  it("keeps a reordered line that fits only as typed inside its box", async function () {
    // As typed, each line ends inside its box; drawn in visual order, its
    // last glyph is another one and it ends 0.76 points further. The spaces
    // that end a line take no room, even before a right-to-left indent.
    const font = muhammara
      .createWriter(new muhammara.PDFWStreamForBuffer())
      .getFontForFile(ARIAL);
    // Where the first line of a text drawn at 50, 50 sits.
    const [first] = await drawPage("text-direction-fits-drawn", (recipe) => {
      recipe.text("\u05e9", 50, 50, { font: "arial", size: 12 });
    });
    for (const [text, wrap, width, lines] of [
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
      for (const textAlign of ["left", "right"]) {
        const runs = await drawPage("text-direction-fits-drawn", (recipe) => {
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
        for (const run of runs) {
          const right = run.x + font.calculateTextDimensions(run.text, 12).xMax;
          assert.ok(
            run.x >= 50 - 0.01 && right <= 50 + width + 0.01,
            `${wrap} ${textAlign}: ${run.x}-${right}`,
          );
        }
      }
    }
    // A line of several runs, from HTML or a flow, is wrapped by its typed
    // width, as in Wasm.
    const runs = await drawPage("text-direction-fits-drawn-html", (recipe) => {
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

  it("spaces a long right-to-left line in several TJ operators", async function () {
    // Every pointed letter is a piece of its own, more than one TJ takes. The
    // time is compared with that of a shorter line, as a fixed limit would
    // fail on a slow runner: four times the letters take about four times as
    // long, and sixteen times as long when quadratic.
    this.timeout(120000);
    const output = path.join(__dirname, "../output/text-direction-long-tj.pdf");
    const draw = async (count) => {
      const recipe = new Recipe("new", output);
      recipe.registerFont("arial", ARIAL);
      const start = performance.now();
      recipe
        .createPage(400, 400)
        .text("\u05e9\u05b8\u05c1".repeat(count), 10, 10, {
          font: "arial",
          size: 10,
          direction: "rtl",
          charSpace: 0.1,
        });
      await new Promise((resolve) => recipe.endPage().endPDF(resolve));
      return performance.now() - start;
    };
    await draw(100);
    const short = await draw(1500);
    const long = await draw(6000);
    assert.ok(long < short * 10, short + " ms and " + long + " ms");
    assert.ok(pageContent(output).match(/ TJ/g).length > 1);
    assert.equal(
      pageText(output)
        .map((run) => run.text)
        .join("").length,
      18000,
    );
  });

  it("adds no character spacing between a right-to-left letter and its points", async function () {
    const output = path.join(
      __dirname,
      "../output/text-direction-char-space.pdf",
    );
    const recipe = new Recipe("new", output);
    recipe.registerFont("arial", ARIAL);
    const options = { font: "arial", size: 40, direction: "rtl" };
    const pointed = "\u05d1\u05b0\u05bc\u05e8\u05b5\u05d0";
    // Three letters take two spacings; their points take none.
    assert.ok(
      Math.abs(
        recipe.textDimensions(pointed, { ...options, charSpace: 10 }).xMax -
          recipe.textDimensions(pointed, options).xMax -
          20,
      ) < 0.01,
    );
    recipe
      .createPage(400, 400)
      .text(pointed, 50, 50, { ...options, charSpace: 10 });
    await new Promise((resolve) => recipe.endPage().endPDF(resolve));
    // The spacing after each point is taken back, so it stays over the
    // letter drawn after it.
    const reader = muhammara.createReader(output);
    const contents = reader.queryDictionaryObject(
      reader.parsePageDictionary(0),
      "Contents",
    );
    const input = reader.startReadingFromStream(contents);
    let bytes = [];
    while (input.notEnded()) bytes = bytes.concat(Array.from(input.read(1024)));
    reader.end();
    assert.match(
      Buffer.from(bytes).toString("latin1"),
      /\[\s*<[0-9A-F]+>\s*250\s*<[0-9A-F]+>\s*250\s*<[0-9A-F]+>\s*250\s*<[0-9A-F]+>\s*\]\s*TJ/,
    );
  });

  it("lets a flowed HTML paragraph without letters wait for a later run", async function () {
    const options = { font: "arial", size: 12, direction: "auto" };
    /**
     * The texts of a page's first two lines.
     *
     * @param {Array<{text: string, x: number, y: number}>} runs The page's runs.
     * @returns {string[][]} The runs' texts of each line.
     */
    const lines = (runs) =>
      [0, 1].map((line) => lineRuns(runs, line).map((run) => run.text));
    const html = await drawPage(
      "text-direction-flow-html-waiting",
      (recipe) => {
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
      },
    );
    // The second paragraph's first letter is the Hebrew of the later run.
    assert.deepEqual(lines(html), [
      ["123 (5)"],
      ["\u05dd\u05d5\u05dc\u05e9", " (7) 456"],
    ]);
    const mixed = await drawPage(
      "text-direction-flow-html-waiting-mixed",
      (recipe) => {
        recipe
          .text("123 (5) ", 50, 50, { ...options, flow: true })
          .text("456 (7)<br>789 ", { ...options, html: true })
          .text("\u05e9\u05dc\u05d5\u05dd", {
            ...options,
            html: false,
            flow: false,
          });
      },
    );
    assert.deepEqual(lines(mixed), [
      ["123 (5) ", "456 (7)"],
      ["\u05dd\u05d5\u05dc\u05e9", " 789"],
    ]);
  });

  it("ends a flowed paragraph at a line break that starts or ends an HTML run", async function () {
    const options = { font: "arial", size: 12, direction: "auto" };
    const ending = await drawPage(
      "text-direction-flow-html-break-end",
      (recipe) => {
        recipe
          .text("123 (5) ", 50, 50, { ...options, flow: true })
          .text("<span>456</span><br>", { ...options, html: true })
          .text("\u05e9\u05dc\u05d5\u05dd", {
            ...options,
            html: false,
            flow: false,
          });
      },
    );
    // The Hebrew after the break leaves the line before it left to right.
    assert.deepEqual(
      lineRuns(ending).map((run) => run.text),
      ["123 (5) ", "456"],
    );
    const starting = await drawPage(
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

  it("marks each piece of a reordered flowed line with its own run's markup", async function () {
    /**
     * Draw a flow and read the left and right edges of its annotations.
     *
     * @param {string} name Output file name.
     * @param {function(object): void} draw Draws on the page.
     * @returns {Promise<number[][]>} Each annotation's rounded left and right.
     */
    const annotations = async (name, draw) => {
      const output = path.join(__dirname, "../output", name + ".pdf");
      const recipe = new Recipe("new", output);
      recipe.registerFont("arial", ARIAL);
      draw(recipe.createPage(400, 400));
      await new Promise((resolve) => recipe.endPage().endPDF(resolve));
      const reader = muhammara.createReader(output);
      const annots = reader.parsePage(0).getDictionary().toJSObject().Annots;
      const rects = annots
        ? annots.toJSArray().map((reference) => {
            const rect = reader
              .parseNewObject(reference.getObjectID())
              .toJSObject()
              .Rect.toJSArray()
              .map((value) => value.value);
            return [Math.round(rect[0]), Math.round(rect[2])];
          })
        : [];
      reader.end();
      return rects;
    };
    const options = { font: "arial", size: 12, direction: "auto" };
    // Only the run that asks for a highlight is highlighted.
    assert.deepEqual(
      await annotations("text-direction-flow-markup-own", (recipe) =>
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
      await annotations("text-direction-flow-markup-first", (recipe) =>
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
    const justified = await annotations(
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

  it("ends a flowed line at any paragraph separator that ends a run", async function () {
    const options = { font: "arial", size: 12, direction: "auto" };
    /**
     * Draw a flowed run ending with a separator, then the next run.
     *
     * @param {string} separator The paragraph separator ending the first run.
     * @param {boolean} [movedown] Whether movedown(0) follows it.
     * @returns {Promise<Array<{text: string, x: number, y: number}>>|Array<{text: string, x: number, y: number}>} The runs.
     */
    const draw = (separator, movedown) =>
      drawPage("text-direction-flow-trailing-separator", (recipe) => {
        recipe.text("\u05e9\u05dc\u05d5\u05dd" + separator, 50, 50, {
          ...options,
          flow: true,
          textBox: { width: 300 },
        });
        if (movedown) recipe.movedown(0);
        recipe.text("\u05e2\u05d5\u05dc\u05dd", { ...options, flow: false });
      });
    for (const movedown of [false, true]) {
      const expected = (await draw("\n", movedown)).map((run) => [
        run.text,
        run.y,
      ]);
      for (const separator of [
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
          (await draw(separator, movedown)).map((run) => [run.text, run.y]),
          expected,
          JSON.stringify(separator) + (movedown ? " with movedown(0)" : ""),
        );
      }
      assert.notEqual(expected[0][1], expected[1][1]);
    }
  });

  it("moves the cursor below a flow that ends with any paragraph separator", async function () {
    const options = { font: "arial", size: 12, direction: "auto" };
    /**
     * Draw a flow ending with a separator, then text after it.
     *
     * @param {string} separator The paragraph separator ending the flow.
     * @returns {Promise<Array<{text: string, x: number, y: number}>>|Array<{text: string, x: number, y: number}>} The runs.
     */
    const draw = (separator) =>
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
    const expected = (await draw("\n")).map((run) => [run.text, run.y]);
    for (const separator of ["\u2029", "\u2028", "\r", "\v", "\f", "\u0085"]) {
      assert.deepEqual(
        (await draw(separator)).map((run) => [run.text, run.y]),
        expected,
        JSON.stringify(separator),
      );
    }
    // "after" starts the line below "abc".
    assert.ok(expected[2][1] < expected[1][1]);
  });

  it("keeps the space a flowed run starts with on a line movedown() ends", async function () {
    const options = { font: "arial", size: 12, direction: "auto" };
    for (const ending of ["movedown", "\n"]) {
      const runs = await drawPage(
        "text-direction-flow-ended-space",
        (recipe) => {
          recipe.text("x", 50, 50, { ...options, flow: true });
          if (ending === "movedown") {
            recipe.text(" \u05e2\u05d5\u05dc\u05dd", options).movedown();
          } else {
            recipe.text(" \u05e2\u05d5\u05dc\u05dd" + ending, options);
          }
          recipe.text("def", { ...options, flow: false });
        },
      );
      // The space keeps "x" and the Hebrew word apart.
      assert.deepEqual(
        runs.map((run) => run.text),
        ["x", " \u05dd\u05dc\u05d5\u05e2", "def"],
        ending,
      );
    }
  });

  it("moves the cursor below a flow whose break a run of spaces follows", async function () {
    const options = { font: "arial", size: 12, direction: "auto" };
    for (const separator of ["\n", "\u2029", "\r\n", "\u0085"]) {
      const runs = await drawPage(
        "text-direction-flow-cursor-spaces",
        (recipe) => {
          recipe
            .text("abc", 50, 150, { ...options, flow: true })
            .text("\u05d0" + separator, options)
            .text(" ", options)
            .text("", { ...options, flow: false })
            .text("after", options);
        },
      );
      const after = runs.find((run) => run.text === "after");
      // The next text starts below the flow, not over its line.
      assert.ok(after.y < runs[0].y - 5, JSON.stringify(separator));
    }
  });

  it("keeps the spaces a flowed line starts with when movedown() ends it", async function () {
    const options = { font: "arial", size: 12, direction: "auto" };
    const box = { width: 200, textAlign: "right" };
    for (const first of ["", null]) {
      const runs = await drawPage(
        "text-direction-flow-leading-space",
        (recipe) => {
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
        },
      );
      // The space is kept as the indent of the line's start, on its right.
      assert.deepEqual(
        lineRuns(runs).map((run) => run.text),
        ["\u05dd\u05dc\u05d5\u05e2", " "],
        JSON.stringify(first),
      );
    }
  });

  it("keeps the space a flowed HTML run starts with inside its first element", async function () {
    const options = { font: "arial", size: 12, direction: "auto" };
    const runs = await drawPage("text-direction-flow-html-space", (recipe) => {
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
    const inner = await drawPage(
      "text-direction-flow-html-inner-space",
      (recipe) => {
        recipe
          .text("abc", 50, 50, { ...options, html: true, flow: true })
          .text("<span> <u>def</u></span>", { html: true })
          .text("", { flow: false });
      },
    );
    assert.deepEqual(
      lineRuns(inner).map((run) => run.text),
      ["abc", " ", "def"],
    );
  });

  it("keeps words joined by any non-breaking space on one line", async function () {
    for (const space of ["\u00a0", "\u2007", "\u202f"]) {
      const runs = await drawPage("text-direction-nbsp", (recipe) => {
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
      const leading = await drawPage("text-direction-nbsp-start", (recipe) => {
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

  it("starts a paragraph at a line break inside HTML text", async function () {
    for (const html of [
      "abc\n123 \u05e9\u05dc\u05d5\u05dd",
      "<p>abc\n123 \u05e9\u05dc\u05d5\u05dd</p>",
      "abc\u2029123 \u05e9\u05dc\u05d5\u05dd",
    ]) {
      const runs = await drawPage("text-direction-html-break", (recipe) => {
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
    const recipe = new Recipe(
      "new",
      path.join(__dirname, "../output/text-direction-reject.pdf"),
    );
    recipe.createPage(200, 200);
    assert.throws(() => recipe.text("abc", 10, 10, { direction: "up" }), {
      name: "TypeError",
    });
  });
});
