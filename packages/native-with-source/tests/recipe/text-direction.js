const assert = require("node:assert/strict");
const muhammara = require("@muhammara/native-with-source");
const fs = require("fs");
const path = require("path");

const Recipe = muhammara.Recipe;
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

  it("justifies the styled runs of an HTML line from right to left", async function () {
    const runs = await drawPage("text-direction-html-justify", (recipe) => {
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
    const line = lineRuns(runs);
    assert.deepEqual(
      line.slice(-3).map((run) => run.text.trim()),
      ["שולש", "םייתש", "תחא"],
    );
    // Justified, the line spans the box from edge to edge.
    const font = muhammara
      .createWriter(new muhammara.PDFWStreamForBuffer())
      .getFontForFile(ARIAL);
    const last = line[line.length - 1];
    assert.ok(Math.abs(line[0].x - 20) < 1, JSON.stringify(line));
    assert.ok(
      Math.abs(
        last.x + font.calculateTextDimensions(last.text.trim(), 12).xMax - 140,
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
      run.x + font.calculateTextDimensions(run.text.trim(), 16).xMax;
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
    // Each word keeps a space before the next one.
    right.slice(1).forEach((run, index) => {
      assert.ok(run.x - inkRight(right[index]) > 3, JSON.stringify(right));
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
          font.calculateTextDimensions(rtlLast.text.trim(), 12).xMax -
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
    const plain = recipe.textDimensions("שלום", options).xMax;
    assert.equal(
      recipe.textDimensions("\u2067שלום\u2069", {
        ...options,
        direction: "auto",
      }).xMax,
      plain,
    );
    assert.ok(recipe.textDimensions("\u2067שלום\u2069", options).xMax > plain);
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
    assert.deepEqual(hilites.rtl, [[20, 80]]);
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
        last.x + font.calculateTextDimensions(last.text.trim(), 12).xMax - 300,
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
      run.x + font.calculateTextDimensions(run.text.trim(), 12).xMax;
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

  it("reorders each line once", async function () {
    const segment = Intl.Segmenter.prototype.segment;
    let calls = 0;
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
    ];
    for (const [index, [texts, expected]] of cases.entries()) {
      const runs = await drawPage("text-direction-run-" + index, (recipe) => {
        texts.forEach(([text, direction], run) => {
          const options = { font: "arial", size: 12, direction };
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
