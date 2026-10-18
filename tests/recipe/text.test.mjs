// Merges packages/native-with-source/tests/recipe/text.js, the Wasm
// tests/recipe/text.test.mjs and the text cases of the Wasm
// text-layout-table.test.mjs.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describeEnds, fixture, writeOutput } from "../support/ends.mjs";
import {
  annotations,
  drawnContent,
  textRuns,
  withReader,
} from "../support/pdf.mjs";
import {
  BUNDLED_FONTS,
  arialFont,
  placedRuns,
  registerFont,
  runFonts,
  strokedSegments,
} from "../support/text.mjs";

var htmlCodes = readFileSync(fixture("recipe/text.html"), "utf8");

// Each text-box and HTML test lays out a full page and takes about 1 s; on
// slow runners, such as Electron on Intel macOS, that exceeds the default.
var TEXT_BOX_TIMEOUT = 60000;

/**
 * Lorem ipsum with a marked word and a marked sentence.
 * @param {string} [tag] - The HTML element that marks them; none for plain.
 * @returns {string} The text.
 */
function lorem(tag) {
  /**
   * Wrap text in the element.
   * @param {string} text - The text.
   * @returns {string} The marked text.
   */
  var mark = (text) => (tag ? `<${tag}>${text}</${tag}>` : text);
  return (
    `Lorem Ipsum is simply dummy text of the printing and typesetting industry. This ${mark("word")} is marked. ` +
    "Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. " +
    `It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. ${mark("This entire sentence is marked.")} ` +
    "It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum. " +
    "It is a long established fact that a reader will be distracted by the readable content of a page when looking at its layout."
  );
}

/**
 * Register the bundled Helvetica faces as the "sans" family, so bold and
 * italic have their own faces on both ends.
 * @param {object} end - The end.
 * @param {object} recipe - The Recipe.
 * @returns {object} The Recipe.
 */
function registerSans(end, recipe) {
  [
    ["Helvetica.ttf", "regular"],
    ["Helvetica-bold.ttf", "bold"],
    ["Helvetica-italic.ttf", "italic"],
    ["Helvetica-bold-italic.ttf", "bold-italic"],
  ].forEach(([file, style]) =>
    registerFont(end, recipe, "sans", path.join(BUNDLED_FONTS, file), style),
  );
  return recipe;
}

/**
 * Draw the three text boxes of the text-box samples on a letter page: a
 * centered box, a right-aligned one and one of fixed height.
 * @param {object} recipe - The Recipe with an open page.
 * @param {string} content - The text of the first two boxes.
 * @param {object} [options] - Extra options for the first two boxes.
 * @returns {object} The Recipe.
 */
function textBoxes(recipe, content, options = {}) {
  var dot = { stroke: "#3b7721", fill: "#0e0e0e", opacity: 0.4 };
  return recipe
    .circle("center", 400, 10, dot)
    .text(content, "center", 400, {
      textBox: {
        width: 500,
        lineHeight: 16,
        minHeight: 300,
        textAlign: "center",
        padding: [15, 30, 30],
        style: {
          lineWidth: 5,
          fill: "#813b00",
          stroke: "#ff0000",
          opacity: 0.3,
        },
      },
      font: "sans",
      size: 14,
      color: "#813b00",
      align: "center bottom",
      ...options,
    })
    .circle(500, 550, 10, dot)
    .text(content, 500, 550, {
      font: "Roboto",
      color: "#000000",
      align: "right",
      size: 12,
      textBox: {
        width: 400,
        lineHeight: 30,
        minHeight: 300,
        padding: 15,
        textAlign: "right",
        style: {
          lineWidth: 1,
          stroke: "#0000ff",
          fill: "#ffff00",
          dash: [10, 10],
          opacity: 0.3,
        },
      },
      ...options,
    })
    .circle(350, 450, 10, dot)
    .text("Fix height 200", 350, 450, {
      textBox: {
        width: 200,
        lineHeight: 16,
        height: 200,
        padding: [5, 15],
        textAlign: "left",
        style: {
          lineWidth: 1,
          stroke: "#00ff00",
          fill: "#ff0000",
          dash: [20, 20],
          opacity: 0.1,
        },
      },
      font: "Roboto",
      size: 30,
      color: "#000000",
    });
}

describeEnds("Recipe text", function (end) {
  /**
   * Draw the text-box samples with one HTML element marking text.
   * @param {string} name - The output name.
   * @param {string} tag - The element.
   * @returns {Uint8Array} The PDF.
   */
  function markedTextBoxes(name, tag) {
    var recipe = registerSans(end, end.newRecipe()).createPage("letter");
    var bytes = textBoxes(recipe, lorem(tag), { html: true })
      .endPage()
      .endPDF();
    writeOutput(end, name, bytes);
    var runs = textRuns(end, bytes);
    assert.equal(
      runs.filter((run) => run.text === "word").length,
      2,
      "both boxes show the marked word as its own run",
    );
    assert.ok(runs.some((run) => run.text === "Fix height"));
    return bytes;
  }

  /**
   * The stroked segments that run along the marked word's runs.
   * @param {Uint8Array} bytes - The PDF.
   * @returns {Array<{run: object, segment: object}>} Each word run with the
   *   segment that starts at it.
   */
  function wordLines(bytes) {
    var segments = strokedSegments(drawnContent(end, bytes));
    return textRuns(end, bytes)
      .filter((run) => run.text === "word")
      .map((run) => ({
        run,
        segment: segments.find(
          (segment) =>
            Math.abs(segment.x1 - run.x) < 0.01 &&
            segment.y1 === segment.y2 &&
            Math.abs(segment.y1 - run.y) < 10,
        ),
      }));
  }

  it("adds a watermark to every page of an existing PDF", function () {
    var recipe = end.openRecipe("recipe/test.pdf");
    var pages = recipe.metadata.pages;
    for (var i = 1; i <= pages; i++) {
      recipe
        .editPage(i)
        .text("WATERMARK", "center", "center", {
          bold: true,
          size: 60,
          color: "#0000FF",
          align: "center center",
          opacity: 0.3,
        })
        .endPage();
    }
    var bytes = recipe.endPDF();
    writeOutput(end, "text-watermark", bytes);
    for (var index = 0; index < pages; index++) {
      var marks = placedRuns(end, bytes, index).filter(
        (run) => run.text === "WATERMARK",
      );
      assert.equal(marks.length, 1, `page ${index + 1}`);
      assert.equal(marks[0].size, 60);
    }
  });

  it("adds styled, registered-font and multi-line text to an existing page", function () {
    var bytes = end
      .openRecipe("recipe/test.pdf")
      .editPage(1)
      .circle("center", 100, 5, {
        stroke: "#3b7721",
        fill: "#0e0e0e",
        opacity: 0.4,
      })
      .text("Add text", "center", 100, { bold: true })
      .text("Add text", "center", 120, { italic: true })
      .text("Add text", "center", 160, {
        bold: true,
        italic: true,
        size: 20,
        color: "#ff0000",
      })
      // Font names match case-insensitively.
      .text("Add text", "center", 250, {
        font: "Arial",
        size: 20,
        color: "#ff0000",
      })
      .text("Add text", "center", 250, {
        font: "Arial",
        size: 20,
        color: "#ff0000",
      })
      .text(
        "Add text\nsecond line\nnext line\n\n\n\nlast line",
        "center",
        310,
        { font: "Roboto", size: 20, color: "#ff0000" },
      )
      .endPage()
      .endPDF();
    writeOutput(end, "text-add", bytes);
    var runs = placedRuns(end, bytes);
    assert.equal(runs.filter((run) => run.text === "Add text").length, 6);
    /**
     * The baseline of a run.
     * @param {string} text - The run's text.
     * @returns {number} Its PDF y.
     */
    var y = (text) => runs.find((run) => run.text === text).y;
    // Three empty lines keep their height between "next line" and
    // "last line".
    var line = y("second line") - y("next line");
    assert.ok(line > 0);
    assert.ok(Math.abs(y("next line") - y("last line") - 4 * line) < 0.01);
  });

  it("lays out HTML", function () {
    var bytes = end
      .newRecipe()
      .createPage("letter")
      .text(htmlCodes, 0, 0, { html: true })
      .endPage()
      .endPDF();
    writeOutput(end, "text-html", bytes);
    var texts = textRuns(end, bytes).map((run) => run.text);
    ["first line", "H1 Header", "Some bold text", "Hyperlink", "123"].forEach(
      (text) => assert.ok(texts.includes(text), text),
    );
    var links = annotations(end, bytes);
    assert.equal(links.length, 1);
    assert.equal(links[0].Subtype, "Link");
    assert.equal(links[0].A.URI, "http://google.com");
  }).timeout(TEXT_BOX_TIMEOUT);

  it("lays out HTML inside a text box", function () {
    var bytes = end
      .newRecipe()
      .createPage(600, 1200)
      .text(htmlCodes, 10, 10, {
        html: true,
        textBox: {
          width: 450,
          padding: [15, 20],
          lineHeight: 10,
          style: {
            lineWidth: 1,
            stroke: "#0000ff",
            fill: "#ffff00",
            dash: [10, 10],
            opacity: 0.3,
          },
        },
      })
      .endPage()
      .endPDF();
    writeOutput(end, "text-html-textbox", bytes);
    var runs = textRuns(end, bytes);
    assert.ok(runs.some((run) => run.text === "H1 Header"));
    // The left padding moves every line in from the box edge at x 10.
    runs.forEach((run) => assert.ok(run.x >= 30 - 0.01, JSON.stringify(run)));
  }).timeout(TEXT_BOX_TIMEOUT);

  it("lays out text inside text boxes", function () {
    var recipe = registerSans(end, end.newRecipe()).createPage("letter");
    var bytes = textBoxes(recipe, lorem()).endPage().endPDF();
    writeOutput(end, "text-textbox", bytes);
    var runs = textRuns(end, bytes);
    assert.ok(runs.some((run) => run.text === "Fix height"));
    // The right-aligned Roboto box, anchored by its right edge at x 500,
    // ends every line at that edge less its 15 point padding.
    var measure = end.newRecipe().createPage("letter");
    var ends = runs
      .filter((run) => run.x > 90 && run.y < 300 && run.text !== "200")
      .map(
        (run) =>
          run.x +
          measure.textDimensions(run.text.trimEnd(), {
            font: "Roboto",
            size: 12,
          }).xMax,
      );
    assert.ok(ends.length > 3, "the right-aligned box wraps");
    ends.forEach((edge) =>
      assert.ok(Math.abs(edge - 485) < 0.5, JSON.stringify(ends)),
    );
  }).timeout(TEXT_BOX_TIMEOUT);

  it("draws HTML bold text in the family's bold face inside text boxes", function () {
    var bytes = markedTextBoxes("text-textbox-bold", "b");
    var fonts = runFonts(end, bytes);
    var word = fonts.find((run) => run.text === "word");
    assert.match(word.font, /Bold/);
    assert.doesNotMatch(fonts[0].font, /Bold/);
  }).timeout(TEXT_BOX_TIMEOUT);

  it("draws HTML italic text in the family's italic face inside text boxes", function () {
    var bytes = markedTextBoxes("text-textbox-italic", "i");
    var fonts = runFonts(end, bytes);
    var word = fonts.find((run) => run.text === "word");
    assert.match(word.font, /Italic|Oblique/);
    assert.doesNotMatch(fonts[0].font, /Italic|Oblique/);
  }).timeout(TEXT_BOX_TIMEOUT);

  it("underlines HTML text inside text boxes", function () {
    var lines = wordLines(markedTextBoxes("text-textbox-underline", "u"));
    lines.forEach(({ run, segment }) => {
      assert.ok(segment, "a line starts at the underlined word");
      assert.ok(segment.y1 < run.y, "the line is below the baseline");
    });
  }).timeout(TEXT_BOX_TIMEOUT);

  it("strikes HTML text through inside text boxes", function () {
    var lines = wordLines(markedTextBoxes("text-textbox-strikethrough", "del"));
    lines.forEach(({ run, segment }) => {
      assert.ok(segment, "a line starts at the struck word");
      assert.ok(segment.y1 > run.y, "the line is above the baseline");
    });
  }).timeout(TEXT_BOX_TIMEOUT);

  it("keeps the text of HTML mark elements inside text boxes", function () {
    // <mark> is no supported element; its text is drawn like plain text.
    markedTextBoxes("text-textbox-highlight", "mark");
  }).timeout(TEXT_BOX_TIMEOUT);

  it("writes decorated text with descender-aware highlights", function () {
    var bytes = end
      .newRecipe()
      .createPage(595, 842)
      .text("Browser Recipe", 50, 300, {
        font: "arial",
        fontSize: 24,
        highlight: { color: "#fde68a" },
        underline: true,
        strikeOut: true,
      })
      .text("gypqj descenders", 50, 340, {
        font: "arial",
        fontSize: 30,
        highlight: { color: "#bbf7d0" },
      })
      .endPage()
      .endPDF();
    writeOutput(end, "text-decorated-highlights", bytes);
    var markup = annotations(end, bytes);
    assert.deepEqual(
      markup.map((annotation) => annotation.Subtype),
      ["Highlight", "Underline", "StrikeOut", "Highlight"],
    );
    markup.forEach((annotation) =>
      assert.equal(annotation.QuadPoints.length, 8),
    );
    // The highlight reaches below the baseline, down to the descenders.
    var baseline = textRuns(end, bytes).find(
      (run) => run.text === "gypqj descenders",
    ).y;
    assert.ok(markup[3].Rect[1] < baseline - 5, JSON.stringify(markup[3]));
  });

  it("keeps hilited text on edited pages", function () {
    var source = end.newRecipe().createPage(200, 200).endPage().endPDF();
    // The hilite rectangle pauses the edited page, which resumes into a new
    // content context; the text must be written to that one.
    var bytes = end
      .openRecipe(source)
      .editPage(1)
      .text("Hilited", 10, 10, { hilite: true })
      .endPage()
      .endPDF();
    writeOutput(end, "text-hilite-edit", bytes);
    assert.deepEqual(
      placedRuns(end, bytes).map((run) => run.text),
      ["Hilited"],
    );
  });

  it("starts text without coordinates at the margins of a new page", function () {
    var recipe = end
      .newRecipe()
      .createPage(400, 400)
      .text("first", 20, 20, { flow: true, size: 30 })
      .endPage()
      .createPage(400, 400);
    // Before any text, movedown() starts from the page origin.
    assert.deepEqual(recipe.movedown(0, true), [0, 0]);
    var bytes = recipe
      .text("second", { flow: true })
      .text("", { flow: false })
      .endPage()
      .endPDF();
    writeOutput(end, "text-new-page-origin", bytes);
    var [second] = withReader(end, bytes, (reader) =>
      reader.extractPageText(1),
    );
    assert.equal(second.content, "second");
    assert.equal(Math.round(second.textMatrix[4]), 72);
    // Flow options from the previous page do not carry over.
    assert.equal(second.fontSize, 14);
  });

  it("starts text without coordinates at the margins of an edited page", function () {
    var source = end
      .newRecipe()
      .createPage(400, 400)
      .endPage()
      .createPage(400, 400)
      .endPage()
      .endPDF();
    var recipe = end
      .openRecipe(source)
      .editPage(1)
      .text("first", 20, 20)
      .endPage()
      .editPage(2);
    assert.deepEqual(recipe.movedown(0, true), [72, 72]);
    recipe.text("second", { flow: false });
    assert.equal(recipe.movedown(0, true)[0], 72);
    writeOutput(end, "text-edit-origin", recipe.endPage().endPDF());
  });

  it("lays out a long line without a text box in linear time", function () {
    // Measuring the whole line for every word took about 25 s for 3 000
    // characters; the mocha timeout catches a regression.
    this.timeout(10000);
    var bytes = end
      .newRecipe()
      .createPage("A4")
      .text("word ".repeat(600), 10, 10, { size: 8 })
      .endPage()
      .endPDF();
    writeOutput(end, "text-long-line", bytes);
    assert.ok(textRuns(end, bytes).length > 0);
  });

  it("ends ellipsized text with the ellipsis glyph", function () {
    var bytes = end
      .newRecipe()
      .createPage(220, 120)
      .text("alpha bravo charlie", 10, 10, {
        font: "arial",
        size: 12,
        textBox: { width: 70, wrap: "ellipsis" },
      })
      .endPage()
      .endPDF();
    writeOutput(end, "text-ellipsis", bytes);
    // U+2026, not three full stops.
    assert.deepEqual(
      textRuns(end, bytes).map((run) => run.text),
      ["alpha brav…"],
    );
  });

  it("keeps the space before the word that clip or ellipsis cuts", function () {
    /**
     * The lines a wrap mode keeps.
     * @param {string} wrap - The wrap mode.
     * @returns {string[]} The texts of the drawn runs.
     */
    var texts = (wrap) => {
      var bytes = end
        .newRecipe()
        .createPage(220, 120)
        .text("one two three\nfour five six seven", 10, 10, {
          font: "arial",
          size: 12,
          textBox: { width: 60, wrap },
        })
        .endPage()
        .endPDF();
      writeOutput(end, `text-${wrap}-space`, bytes);
      return textRuns(end, bytes).map((run) => run.text);
    };
    // A clipped line keeps the first word that does not fit, cut at the box
    // edge, and drops the rest of its paragraph.
    assert.deepEqual(texts("clip"), ["one two three", "four five six "]);
    assert.equal(texts("ellipsis")[0], "one two t…");
  });

  it("keeps clipped, trimmed and ellipsized text distinct", function () {
    var bytes = end
      .newRecipe()
      .createPage(220, 120)
      .text("alpha bravo charlie", 10, 10, {
        font: "arial",
        size: 12,
        textBox: { width: 45, wrap: "clip" },
      })
      .text("alpha bravo charlie", 10, 35, {
        font: "arial",
        size: 12,
        textBox: { width: 45, wrap: "trim" },
      })
      .text("alpha bravo charlie", 10, 60, {
        font: "arial",
        size: 12,
        textBox: { width: 45, wrap: "ellipsis" },
      })
      .endPage()
      .endPDF();
    writeOutput(end, "text-wrap-modes", bytes);
    var output = textRuns(end, bytes).map((run) => run.text);
    // Clip keeps "bravo", which overflows and is clipped, and drops
    // "charlie"; trim drops the word that does not fit.
    assert.equal(output[0].trim(), "alpha bravo");
    assert.equal(output[1], "alpha");
    assert.match(output[2], /…$/);
    assert.ok(output[2].length < output[0].length);
  });

  it("rejects a miterLimit below 1 before drawing", function () {
    var error = {
      name: "RangeError",
      message: "miterLimit must be a number of at least 1",
    };
    var recipe = end.newRecipe().createPage(200, 200);
    assert.throws(
      () => recipe.text("alpha", 20, 20, { font: "arial", miterLimit: 0 }),
      error,
    );
    recipe.text("bravo", 20, 20, { flow: true });
    assert.throws(() => recipe.text("charlie", { miterLimit: 0.5 }), error);
    assert.throws(() => recipe.text("delta", 20, 60, { miterLimit: 0 }), error);
    recipe.text("", { flow: false }).text("echo", 20, 100, { miterLimit: 1 });
    var bytes = recipe.endPage().endPDF();
    writeOutput(end, "text-miter-limit", bytes);
    assert.deepEqual(
      textRuns(end, bytes).map((run) => run.text),
      ["bravo", "echo"],
    );
  });

  it("ends right-aligned text at the padded right edge", function () {
    var bytes = end
      .newRecipe()
      .createPage(400, 400)
      .text("hello world", 20, 20, {
        font: "arial",
        size: 12,
        textBox: { width: 200, textAlign: "right", padding: [0, 10, 0, 30] },
      })
      .text("hello world", 20, 60, {
        font: "arial",
        size: 12,
        textBox: { width: 200, textAlign: "center" },
      })
      .endPage()
      .endPDF();
    writeOutput(end, "text-right-padding", bytes);
    var [rightRun, centerRun] = textRuns(end, bytes);
    var glyphsEnd = arialFont(end).calculateTextDimensions(
      "hello world",
      12,
    ).xMax;
    var right = rightRun.x + glyphsEnd;
    assert.ok(Math.abs(right - 210) < 0.5, String(right));
    // Centered between the text's start and where its glyphs end.
    var center = centerRun.x + glyphsEnd / 2;
    assert.ok(Math.abs(center - 120) < 0.5, String(center));
  });

  it("drops the leading spaces of a justified line", function () {
    var firstWords = ["   ", ""].map((prefix) => {
      var bytes = end
        .newRecipe()
        .createPage(400, 400)
        .text(prefix + "leading spaces here and more words to wrap", 20, 20, {
          font: "arial",
          size: 12,
          textBox: { width: 200, textAlign: "justify" },
        })
        .endPage()
        .endPDF();
      var [first] = textRuns(end, bytes);
      return { text: first.text, x: first.x };
    });
    assert.deepEqual(firstWords[0], firstWords[1]);
  });

  it("starts a new line at every mandatory line break", function () {
    var bytes = end
      .newRecipe()
      .createPage(400, 400)
      .text(
        "one\ntwo\r\nthree\rfour five six\u000bseven\feight\u0085nine",
        20,
        20,
        { textBox: { width: 300 } },
      )
      .endPage()
      .endPDF();
    writeOutput(end, "text-line-breaks", bytes);
    assert.deepEqual(
      textRuns(end, bytes).map((run) => run.text),
      ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine"],
    );
  });

  it("keeps a blank line between two line breaks", function () {
    /**
     * The distance between the first two lines of a text.
     * @param {string} text - The text.
     * @returns {number} The distance in points.
     */
    var gap = (text) => {
      var bytes = end
        .newRecipe()
        .createPage(400, 400)
        .text(text, 20, 20, { textBox: { width: 300 } })
        .endPage()
        .endPDF();
      var [first, second] = textRuns(end, bytes);
      return first.y - second.y;
    };
    var single = gap("a\nb");
    for (var text of ["a\r\n\r\nb", "a\n\nb"]) {
      assert.ok(Math.abs(gap(text) - 2 * single) < 0.01, JSON.stringify(text));
    }
  });

  it("keeps non-breaking spaces inside justified words", function () {
    var bytes = end
      .newRecipe()
      .createPage(400, 400)
      .text("aa bb cc dd ee ff gg hh ii jj kk ll mm nn", 20, 20, {
        font: "arial",
        size: 12,
        textBox: { width: 100, textAlign: "justify" },
      })
      .endPage()
      .endPDF();
    writeOutput(end, "text-justify-nbsp", bytes);
    var runs = textRuns(end, bytes).map((run) => run.text);
    assert.ok(
      runs.some((text) => text.trim() === "bb cc"),
      JSON.stringify(runs),
    );
  });

  it("ends the text markup of a right-aligned HTML line at the box edge", function () {
    var bytes = end
      .newRecipe()
      .createPage(400, 400)
      .text("<p>WqWq Hello WqWq</p>", 20, 20, {
        font: "arial",
        size: 14,
        html: true,
        underline: true,
        textBox: { width: 300, textAlign: "right" },
      })
      .endPage()
      .endPDF();
    writeOutput(end, "text-html-markup-edge", bytes);
    var rects = annotations(end, bytes).map((annotation) => annotation.Rect);
    assert.equal(rects.length, 1);
    assert.ok(Math.abs(rects[0][2] - 320) < 0.05, JSON.stringify(rects));
  });

  it("keeps the padding when aligning text to the bottom or center", function () {
    /**
     * The baseline of text aligned in a padded box.
     * @param {string} name - The output name.
     * @param {string} textAlign - The box alignment.
     * @param {number|number[]} padding - The box padding.
     * @returns {number} The first run's PDF y.
     */
    var baseline = (name, textAlign, padding) => {
      var bytes = end
        .newRecipe()
        .createPage(400, 400)
        .text("alpha", 20, 20, {
          font: "arial",
          textBox: { width: 200, height: 100, padding, textAlign },
        })
        .endPage()
        .endPDF();
      writeOutput(end, name, bytes);
      return textRuns(end, bytes)[0].y;
    };
    // Bottom padding lifts the last line by its own size, not by none.
    var bottom =
      baseline("text-bottom-padding", "left bottom", 10) -
      baseline("text-bottom-plain", "left bottom", 0);
    assert.ok(Math.abs(bottom - 10) < 0.01, String(bottom));
    // Unequal padding moves centered text by half the difference.
    var center =
      baseline("text-center-padding", "left center", [30, 0, 0, 0]) -
      baseline("text-center-plain", "left center", 0);
    assert.ok(Math.abs(center + 15) < 0.01, String(center));
  });

  it("right-aligns inside the padded box", function () {
    /**
     * The start of right-aligned text in a padded box.
     * @param {string} name - The output name.
     * @param {number} padding - The box padding.
     * @returns {number} The first run's PDF x.
     */
    var x = (name, padding) => {
      var bytes = end
        .newRecipe()
        .createPage(400, 400)
        .text("charlie delta", 20, 20, {
          font: "arial",
          textBox: { width: 150, padding, textAlign: "right" },
        })
        .endPage()
        .endPDF();
      writeOutput(end, name, bytes);
      return textRuns(end, bytes)[0].x;
    };
    // Only the right padding moves right-aligned text.
    var moved = x("text-right-plain", 0) - x("text-right-padded", 4);
    assert.ok(Math.abs(moved - 4) < 0.01, String(moved));
  });

  it("rounds a text-box border of borderRadius true by 5", function () {
    var style = { stroke: "#000000", borderRadius: true };
    /**
     * The drawn content of a text box with a border radius.
     * @param {boolean|number} borderRadius - The radius.
     * @returns {string} The drawn content.
     */
    var boxed = (borderRadius) => {
      var bytes = end
        .newRecipe()
        .createPage(220, 120)
        .text("boxed", 10, 20, {
          font: "arial",
          size: 12,
          textBox: { width: 100, style: { ...style, borderRadius } },
        })
        .endPage()
        .endPDF();
      writeOutput(end, `text-border-radius-${borderRadius}`, bytes);
      return drawnContent(end, bytes);
    };
    var rounded = boxed(true);
    assert.equal(rounded, boxed(5));
    assert.notEqual(rounded, boxed(0), "the corners are rounded");
    var caller = { ...style };
    end
      .newRecipe()
      .createPage(220, 120)
      .text("boxed", 10, 20, { textBox: { width: 100, style: caller } });
    assert.equal(caller.borderRadius, true, "the caller's style is unchanged");
  });

  it("takes a numeric string as the font size", function () {
    var bytes = end
      .newRecipe({ compress: false })
      .createPage(200, 200)
      .text("a", 10, 10, { size: "12" })
      .endPage()
      .endPDF();
    writeOutput(end, "text-string-size", bytes);
    assert.match(drawnContent(end, bytes), /\b12 Tf\b/);
  });

  it("measures a number as the text text() draws for it", function () {
    var recipe = end.newRecipe().createPage(200, 200);
    assert.deepEqual(recipe.textDimensions(123), recipe.textDimensions("123"));
    recipe.endPage().endPDF();
  });
});
