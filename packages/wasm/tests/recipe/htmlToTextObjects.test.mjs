import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createMuhammaraWasm } from "../../index.js";
import { getRecipe } from "./recipe.mjs";

/** Renders HTML and returns its visual lines; blank lines appear as "". */
async function renderLines(html, options = {}) {
  var Recipe = await getRecipe();
  var muhammara = await createMuhammaraWasm();
  var bytes = new Recipe()
    .createPage(400, 400)
    .text("x<br>x", 20, 20, {
      font: "arial",
      size: 12,
      html: true,
      textBox: { width: 300 },
    })
    .endPage()
    .createPage(400, 400)
    .text(html, 20, 20, {
      font: "arial",
      size: 12,
      html: true,
      textBox: { width: 300 },
      ...options,
    })
    .endPage()
    .endPDF();
  var reader = muhammara.createReader(bytes);
  try {
    return visualLines(reader.extractPageText(0), reader.extractPageText(1));
  } finally {
    reader.end();
  }
}

/**
 * Groups extracted text into lines, top to bottom. The reference page holds
 * "x<br>x", which gives the first line's position and the line pitch, so
 * skipped pitches, including leading ones, become blank "" lines.
 */
function visualLines(reference, items) {
  var rows = (entries) => {
    var grouped = [];
    entries.forEach((item) => {
      var y = item.textMatrix[5];
      var row = grouped.find((candidate) => Math.abs(candidate.y - y) < 1);
      if (row) row.parts.push(item);
      else grouped.push({ y, parts: [item] });
    });
    return grouped.sort((a, b) => b.y - a.y);
  };
  var [first, second] = rows(reference);
  var pitch = first.y - second.y;
  var lines = [];
  var previous = first.y + pitch;
  rows(items).forEach((row) => {
    var skipped = Math.round((previous - row.y) / pitch) - 1;
    for (var blank = 0; blank < skipped; blank++) lines.push("");
    row.parts.sort((a, b) => a.textMatrix[4] - b.textMatrix[4]);
    lines.push(
      row.parts
        .map((part) => part.content)
        .join("")
        .trim(),
    );
    previous = row.y;
  });
  return lines;
}

describe("HTML to TextObjects", function () {
  it("renders unordered, ordered, nested, and formatted list items", async function () {
    var Recipe = await getRecipe();
    var recipe = new Recipe({ compress: false });
    var html =
      "<ul><li>plain</li><li><b>bold</b> and " +
      '<a href="https://example.test">linked</a><ol><li>nested</li></ol>' +
      "after</li></ul><ol><li>one</li><li>two</li></ol>";
    var objects = recipe.htmlToTextObjects(html);

    assert.equal(
      objects.map((object) => object.value).join(""),
      "* plain\n* bold and linked\n1. nested\nafter\n1. one\n2. two",
    );
    assert.deepEqual(
      objects.filter((object) => object.indent).map((object) => object.indent),
      [6, 6, 10, 6, 6, 6],
    );
    assert.equal(
      objects.find((object) => object.value === "bold").styles.bold,
      true,
    );
    assert.equal(
      objects.find((object) => object.value === "linked").styles.link,
      "https://example.test",
    );
    assert.equal(
      recipe
        .htmlToTextObjects("a<br><br>b")
        .map((object) => object.value)
        .join(""),
      "a\n\nb",
    );
    assert.deepEqual(
      recipe.htmlToTextObjects('<img style="color:red">plain'),
      [{ value: "plain", styles: {} }],
      "void elements must not leak styles or accumulate parser frames",
    );
    assert.equal(
      recipe
        .htmlToTextObjects("<ol><li><p>one</p><p>two</p></li></ol>")
        .map((object) => object.value)
        .join(""),
      "1. one\ntwo",
    );
    assert.equal(
      recipe
        .htmlToTextObjects(
          "<ul><li>before<ol><li>nested</li></ol>after</li></ul>outside",
        )
        .map((object) => object.value)
        .join(""),
      "* before\n1. nested\nafter\noutside",
    );
    ["<br>after", "<p>after</p>", "<div>after</div>"].forEach(
      (continuation) => {
        assert.equal(
          recipe
            .htmlToTextObjects(
              `<ul><li>before<ol><li>nested</li></ol>${continuation}</li></ul>`,
            )
            .map((object) => object.value)
            .join(""),
          "* before\n1. nested\nafter",
        );
      },
    );

    recipe
      .createPage(300, 300)
      .text(html, 20, 20, {
        font: "arial",
        size: 12,
        html: true,
        textBox: { width: 200 },
      })
      .text("<ul><li>alpha bravo charlie delta</li></ul>", 20, 150, {
        font: "arial",
        size: 12,
        html: true,
        textBox: { width: 70, wrap: "auto" },
      })
      .endPage();
    var bytes = recipe.endPDF();
    assert.match(
      new TextDecoder().decode(bytes),
      /\/URI \(https:\/\/example\.test\)/,
    );
    var muhammara = await createMuhammaraWasm();
    var reader = muhammara.createReader(bytes);
    try {
      var lines = new Map();
      reader.extractPageText(0).forEach((item) => {
        var y = item.textMatrix[5];
        lines.set(y, (lines.get(y) || "") + item.content);
      });
      // Both text runs share the page; higher y is the first, upper block.
      var rendered = Array.from(lines.entries())
        .sort((left, right) => right[0] - left[0])
        .map((entry) => entry[1]);
      assert.deepEqual(
        rendered.slice(0, 6).map((line) => line.trimStart()),
        [
          "* plain",
          "* bold and linked",
          "1. nested",
          "after",
          "1. one",
          "2. two",
        ],
      );
      assert.equal(rendered[2], "          1. nested");
      assert.equal(rendered[3], "      after");
      // Wrapped continuations hang under the item text and carry no trailing
      // space, matching native list layout.
      assert.deepEqual(rendered.slice(6), [
        "      * alpha",
        "         bravo",
        "         charlie",
        "         delta",
      ]);
    } finally {
      reader.end();
      muhammara.disposeAssets();
    }
  });

  it("ends items without </li> and keeps item context across breaks", async function () {
    var Recipe = await getRecipe();
    var recipe = new Recipe({ compress: false });
    /**
     * Flattens parsed text objects so recovery cases can assert their text flow.
     *
     * @param {string} html HTML fragment to parse.
     * @returns {string} Concatenated text object values.
     */
    var values = (html) =>
      recipe
        .htmlToTextObjects(html)
        .map((object) => object.value)
        .join("");

    // HTML5 makes </li> optional. Native's XML parser rejects the markup, so
    // Wasm recovers instead: the item ends at its sibling or at its list.
    assert.equal(values("<ul><li>one<li>two</ul>tail"), "* one\n* two\ntail");
    assert.equal(values("<ol><li>one<li>two</ol>"), "1. one\n2. two");
    assert.equal(
      values("<ul>\n  <li>one</li>\n  <li>two</li>\n</ul>"),
      "* one\n* two",
    );
    assert.equal(values("<ul><li>\n  one</li></ul>"), "* one");
    assert.equal(values("<ul><li>one</li></ul>\ntext"), "* one\ntext");
    assert.equal(values("a <b> b</b>"), "a  b");
    assert.equal(values("a\nb"), "a\nb");
    assert.equal(values("a   b"), "a   b");
    assert.equal(values("a&nbsp;&nbsp;b"), "a\u00a0\u00a0b");
    assert.equal(values("\u00a0<ul><li>x</li></ul>"), "\u00a0\n* x");
    assert.equal(values("<ul><li>\u00a0</li></ul>"), "* \u00a0");
    assert.equal(values("<ul><li>\u2003</li></ul>"), "* \u2003");
    assert.equal(
      values("<ul><li>x<ul><li>y</ul><li>z</ul>end"),
      "* x\n* y\n* z\nend",
    );
    assert.equal(values("<ul><li><ol><li>x</li></ol></li></ul>"), "1. x");
    assert.deepEqual(
      recipe
        .htmlToTextObjects(
          "<ul><li>one<ul><li>two<ul><li>three</li></ul></li></ul></li></ul>",
        )
        .filter((object) => object.indent !== undefined)
        .map((object) => object.indent),
      [6, 10, 14],
    );
    assert.equal(values(" \n <b> </b><ul><li>x</li></ul>"), "* x");
    assert.equal(values("<ul><li>a<ul></ul>b</li></ul>"), "* ab");
    assert.equal(values("<ul><li>a<p></p>b</li></ul>"), "* ab");
    assert.equal(values("<ol><li>a<ul><li>b</ol>tail"), "1. a\n* b\ntail");
    assert.equal(
      values("<ul><li><ol><li>a</li></li></ol><li>b</li></ul>"),
      "1. a\n* b",
    );

    // Native propagates the marker into block children, so an opening block
    // right after a marker must not break the line.
    assert.equal(values("<ul><li><p>para one</p></li></ul>"), "* para one");
    assert.equal(values("<ul><li> <p>para one</p></li></ul>"), "* para one");
    assert.equal(values("<ul><li><p>a</p><p>b</p></li></ul>"), "* a\nb");
    assert.equal(values("<ul><li>a<p>b</p>c</li></ul>"), "* a\nb\nc");

    var linked = recipe.htmlToTextObjects(
      '<ul><li><a href="https://example.test"><b>linked</b></a></li></ul>',
    );
    assert.equal(linked[0].value, "* ");
    assert.equal(linked[0].styles.bold, true);
    assert.equal(linked[0].styles.link, "https://example.test");

    // Content after the list is no longer indented by it.
    assert.deepEqual(
      recipe
        .htmlToTextObjects("<ul><li>one</li></ul>tail")
        .filter((object) => object.indent !== undefined)
        .map((object) => object.indent),
      [6, 0],
    );
    assert.equal(
      recipe.htmlToTextObjects("<ul></ul><ul><li>x</li></ul>")[0].indent,
      6,
    );
    assert.equal(values("<ul></ul>\n<ul><li>x</li></ul>"), "* x");
  });

  it("indents continuation lines and never starts a line with a space", async function () {
    var Recipe = await getRecipe();
    var recipe = new Recipe({ compress: false });
    recipe
      .createPage(300, 300)
      .text("<ul><li>a<br>b</li><li>c</li></ul>", 20, 20, {
        font: "arial",
        size: 12,
        html: true,
        textBox: { width: 200 },
      })
      .text("aaaa <b>bbbb</b> cccc", 20, 150, {
        font: "arial",
        size: 12,
        html: true,
        textBox: { width: 40, wrap: "auto" },
      })
      .endPage();
    var bytes = recipe.endPDF();
    var muhammara = await createMuhammaraWasm();
    var reader = muhammara.createReader(bytes);
    try {
      var lines = new Map();
      reader.extractPageText(0).forEach((item) => {
        var y = item.textMatrix[5];
        lines.set(y, (lines.get(y) || "") + item.content);
      });
      var rendered = Array.from(lines.entries())
        .sort((left, right) => right[0] - left[0])
        .map((entry) => entry[1]);
      // A <br> inside an item keeps the item indentation. Native only adds the
      // extra hanging space when it auto-wraps, not on a hard break.
      assert.deepEqual(rendered.slice(0, 3), [
        "      * a",
        "      b",
        "      * c",
      ]);
      // Wrapping at an inline boundary must not push the space onto the next
      // line, and no line may keep a trailing space.
      rendered.slice(3).forEach((line) => {
        assert.equal(
          line,
          line.trim(),
          `unexpected padding in ${JSON.stringify(line)}`,
        );
      });
      assert.equal(rendered.slice(3).join(" "), "aaaa bbbb cccc");
    } finally {
      reader.end();
      muhammara.disposeAssets();
    }
  });

  it("preserves HTML word spacing through wrapping and justification", async function () {
    var Recipe = await getRecipe();
    var muhammara = await createMuhammaraWasm();
    /**
     * Finalizes a recipe and extracts its first page for spacing assertions.
     *
     * @param {Recipe} recipe Recipe containing the page under test.
     * @returns {Array<object>} Extracted text items from the first page.
     */
    var extract = (recipe) => {
      var reader = muhammara.createReader(recipe.endPage().endPDF());
      try {
        return reader.extractPageText(0);
      } finally {
        reader.end();
      }
    };

    var clipped;
    var clippedRecipe = new Recipe({ compress: false }).createPage(300, 200);
    var narrowWidth = clippedRecipe.textDimensions("aaaa", {
      font: "arial",
      size: 12,
    }).width;
    clippedRecipe.text("<b>WWWW</b> WWWW", 20, 20, {
      font: "arial",
      size: 12,
      html: true,
      textBox: {
        width: narrowWidth,
        height: 24,
        lineHeight: 12,
        clipIfExceedsBox: true,
        onClip: (_recipe, result) => {
          clipped = result;
        },
      },
    });
    assert.deepEqual(
      extract(clippedRecipe).map((item) => item.content),
      ["WWWW", "WWWW"],
    );
    assert.equal(clipped, undefined);

    var spacedRecipe = new Recipe({ compress: false })
      .createPage(300, 200)
      .text("alpha <b>bravo</b> charlie", 20, 20, {
        font: "arial",
        size: 12,
        charSpace: 5,
        html: true,
      });
    var alphaWidth = spacedRecipe.textDimensions("alpha ", {
      font: "arial",
      size: 12,
      charSpace: 5,
    }).width;
    var spacedBytes = spacedRecipe.endPage().endPDF();
    var spacedRuns;
    assert.deepEqual(
      (() => {
        var reader = muhammara.createReader(spacedBytes);
        try {
          spacedRuns = reader.extractPageText(0);
          return spacedRuns.map((item) => item.content);
        } finally {
          reader.end();
        }
      })(),
      ["alpha ", "bravo", " charlie"],
    );
    assert.match(
      new TextDecoder().decode(spacedBytes),
      /5 Tc/,
      "character spacing must be emitted for styled HTML runs",
    );
    assert.ok(
      Math.abs(spacedRuns[1].textMatrix[4] - (20 + alphaWidth + 5)) < 0.001,
      "styled whitespace boundaries must retain every character-space interval",
    );

    var rotatedBytes = new Recipe({ compress: false })
      .createPage(300, 200)
      .text("<b>ab</b>cd", 20, 20, {
        font: "arial",
        size: 12,
        html: true,
        rotation: 90,
      })
      .endPage()
      .endPDF();
    var rotationPivots = Array.from(
      new TextDecoder()
        .decode(rotatedBytes)
        .matchAll(/1 0 0 1 ([\d.-]+) [\d.-]+ cm\s+0 1 -1 0 0 0 cm/g),
      (match) => Number(match[1]),
    );
    assert.ok(rotationPivots.length >= 2);
    assert.deepEqual(new Set(rotationPivots), new Set([20]));

    var transformedLinkBytes = new Recipe({ compress: false })
      .createPage(300, 200)
      .text('<a href="https://example.test"><b>linked value</b></a>', 20, 20, {
        font: "arial",
        size: 12,
        html: true,
        rotation: 90,
        hilite: true,
      })
      .endPage()
      .endPDF();
    var transformedSource = new TextDecoder().decode(transformedLinkBytes);
    var transformedRect = transformedSource.match(
      /\/Rect \[\s*([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)/,
    );
    assert.ok(transformedRect);
    assert.ok(
      Number(transformedRect[4]) - Number(transformedRect[2]) >
        Number(transformedRect[3]) - Number(transformedRect[1]),
      "a 90-degree link rectangle must be taller than it is wide",
    );
    assert.ok(
      Array.from(
        transformedSource.matchAll(/1 0 0 1 20 [\d.-]+ cm\s+0 1 -1 0 0 0 cm/g),
      ).length >= 2,
      "the visual highlight and text must use the same rotation",
    );

    var editSource = new Recipe({ compress: false })
      .createPage(300, 200)
      .endPage()
      .endPDF();
    var editedTransformSource = new TextDecoder().decode(
      new Recipe(editSource, { compress: false })
        .editPage(1)
        .text('<a href="https://example.test"><b>ab</b>cd</a>', 20, 20, {
          font: "arial",
          size: 12,
          html: true,
          rotation: 90,
          hilite: true,
        })
        .endPage()
        .endPDF(),
    );
    assert.ok(
      Array.from(
        editedTransformSource.matchAll(
          /1 0 0 1 20 [\d.-]+ cm\s+0 1 -1 0 0 0 cm/g,
        ),
      ).length >= 2,
      "edited styled text must retain the shared rotation",
    );
    var editedLinkRect = editedTransformSource.match(
      /\/Rect \[\s*([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)/,
    );
    assert.ok(editedLinkRect);
    assert.ok(
      Number(editedLinkRect[4]) - Number(editedLinkRect[2]) >
        Number(editedLinkRect[3]) - Number(editedLinkRect[1]),
    );

    var rotatedEditSource = new Recipe({ compress: false })
      .createPage(300, 200)
      .rotate(90)
      .endPage()
      .endPDF();
    var rotatedEditOutput = new TextDecoder().decode(
      new Recipe(rotatedEditSource, { compress: false })
        .editPage(1)
        .text('<a href="https://example.test">linked</a>', 20, 20, {
          font: "arial",
          size: 12,
          html: true,
          skewX: 10,
        })
        .endPage()
        .endPDF(),
    );
    var rotatedEditRect = rotatedEditOutput.match(
      /\/Rect \[\s*([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)/,
    );
    assert.ok(rotatedEditRect);
    assert.ok(
      Number(rotatedEditRect[3]) < 50 && Number(rotatedEditRect[2]) < 120,
      "transformed links must follow the source page rotation",
    );

    var rotatedCreatedOutput = new TextDecoder().decode(
      new Recipe({ compress: false })
        .createPage(300, 200)
        .rotate(90)
        .text('<a href="https://example.test">linked</a>', 20, 20, {
          font: "arial",
          size: 12,
          html: true,
          skewX: 10,
        })
        .endPage()
        .endPDF(),
    );
    var rotatedCreatedRect = rotatedCreatedOutput.match(
      /\/Rect \[\s*([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)/,
    );
    assert.ok(rotatedCreatedRect);
    assert.ok(
      Number(rotatedCreatedRect[2]) > 150,
      "created-page rotation must not transform the link without its text",
    );

    var justifiedHiliteBytes = new Recipe({ compress: false })
      .createPage(300, 200)
      .text("<b>alpha</b> bravo charlie delta", 20, 20, {
        font: "arial",
        size: 12,
        html: true,
        hilite: true,
        textBox: { width: 120, textAlign: "justify top" },
      })
      .endPage()
      .endPDF();
    var hiliteRectangles = Array.from(
      new TextDecoder()
        .decode(justifiedHiliteBytes)
        .matchAll(/[\d.-]+ [\d.-]+ ([\d.-]+) ([\d.-]+) re/g),
      (match) => [Number(match[1]), Number(match[2])],
    );
    assert.ok(hiliteRectangles.length > 1);
    hiliteRectangles.forEach(([rectangleWidth, rectangleHeight]) => {
      assert.ok(rectangleWidth > 0);
      assert.ok(rectangleHeight > 0);
    });

    var nonBreakingRecipe = new Recipe({ compress: false }).createPage(
      300,
      200,
    );
    var narrowNonBreakingWidth =
      nonBreakingRecipe.textDimensions("a", {
        font: "arial",
        size: 12,
      }).width + 0.1;
    nonBreakingRecipe.text("a&nbsp;b", 20, 20, {
      font: "arial",
      size: 12,
      html: true,
      textBox: { width: narrowNonBreakingWidth, wrap: "auto" },
    });
    var nonBreaking = extract(nonBreakingRecipe);
    assert.equal(
      new Set(nonBreaking.map((item) => item.textMatrix[5])).size,
      1,
    );
    assert.equal(nonBreaking.length, 1);

    var breakableUnicodeRecipe = new Recipe({ compress: false })
      .createPage(300, 200)
      .text("a\u2003b", 20, 20, {
        font: "arial",
        size: 12,
        html: true,
        textBox: { width: narrowNonBreakingWidth, wrap: "auto" },
      });
    var breakableUnicode = extract(breakableUnicodeRecipe);
    assert.equal(
      new Set(breakableUnicode.map((item) => item.textMatrix[5])).size,
      2,
    );

    var narrowListRecipe = new Recipe({ compress: false })
      .createPage(300, 200)
      .text("<ul><li>alpha bravo charlie</li></ul>", 20, 20, {
        font: "arial",
        size: 12,
        html: true,
        textBox: { width: 63, wrap: "auto" },
      });
    assert.deepEqual(
      extract(narrowListRecipe).map((item) => item.content),
      ["      * alpha", "         bravo", "         charlie"],
    );

    var nestedContinuationRecipe = new Recipe({ compress: false })
      .createPage(300, 200)
      .text(
        "<ul><li>a<ol><li>b</li></ol>d alpha bravo charlie</li></ul>",
        20,
        20,
        {
          font: "arial",
          size: 12,
          html: true,
          textBox: { width: 55, wrap: "auto" },
        },
      );
    var nestedContinuation = extract(nestedContinuationRecipe).map(
      (item) => item.content,
    );
    var continuationStart = nestedContinuation.findIndex((line) =>
      line.includes("d"),
    );
    assert.ok(continuationStart > 0);
    nestedContinuation.slice(continuationStart).forEach((line) => {
      assert.match(line, /^ {6}\S/);
    });

    var justifiedRecipe = new Recipe({ compress: false }).createPage(300, 200);
    var helWidth = justifiedRecipe.textDimensions("hel", {
      font: "arial",
      size: 12,
      bold: true,
    }).width;
    justifiedRecipe.text("<b>hel</b>lo xx yy", 20, 20, {
      font: "arial",
      size: 12,
      html: true,
      textBox: { width: 45, textAlign: "justify top" },
    });
    var justified = extract(justifiedRecipe);
    assert.equal(justified[0].content, "hel");
    assert.equal(justified[1].content, "lo ");
    assert.ok(
      Math.abs(justified[1].textMatrix[4] - (20 + helWidth)) < 0.001,
      "inline styling must not create a justified gap inside a word",
    );

    var linkedBytes = new Recipe({ compress: false })
      .createPage(300, 200)
      .text(
        '<ul><li><a href="https://example.test"><b>linked</b></a></li></ul>',
        20,
        20,
        { font: "arial", size: 12, html: true },
      )
      .endPage()
      .endPDF();
    assert.match(
      new TextDecoder().decode(linkedBytes),
      /\/Rect \[\s*20 [^\]]+\]/,
      "the linked marker and item text must share one clickable rectangle",
    );

    var clippedLinkBytes = new Recipe({ compress: false })
      .createPage(300, 200)
      .text(
        '<a href="https://example.test">a very long linked value</a>',
        20,
        20,
        {
          font: "arial",
          size: 12,
          html: true,
          textBox: { width: 30, wrap: "clip" },
        },
      )
      .endPage()
      .endPDF();
    var clippedRect = new TextDecoder()
      .decode(clippedLinkBytes)
      .match(/\/Rect \[\s*([\d.-]+)\s+[\d.-]+\s+([\d.-]+)/);
    assert.ok(clippedRect, "the clipped link must create an annotation");
    assert.ok(Number(clippedRect[2]) <= 50.001);

    muhammara.disposeAssets();
  });

  it("sizes text outside HTML elements like element text", async function () {
    var Recipe = await getRecipe();
    var muhammara = await createMuhammaraWasm();
    var cases = [
      ["Decorated", {}, 14],
      ["a <u>b</u>", {}, 14],
      ["a <u>b</u>", { size: 20 }, 20],
    ];
    for (var [html, options, size] of cases) {
      var bytes = new Recipe()
        .createPage(300, 300)
        .text(html, 20, 20, { html: true, textBox: { width: 200 }, ...options })
        .endPage()
        .endPDF();
      var reader = muhammara.createReader(bytes);
      try {
        var extracted = reader.extractPageText(0);
        assert.deepEqual(
          extracted.map((item) => item.content.trim()).filter(Boolean),
          html.replace(/<[^>]+>/g, "").split(" "),
        );
        extracted.forEach((item) => assert.equal(item.fontSize, size));
      } finally {
        reader.end();
      }
    }
  });

  it("lays out explicit line breaks without placeholder text", async function () {
    var Recipe = await getRecipe();
    Recipe.registerFont(
      "arial",
      await readFile("tests/TestMaterials/fonts/arial.ttf"),
    );
    var cases = [
      ["a<br>b", ["a", "b"]],
      ["<br>a", ["", "a"]],
      ["<br><br>a", ["", "", "a"]],
      ["<ul><li><br>a</li></ul>", ["", "* a"]],
      ["a<br>", ["a"]],
      ["a<br><br>b", ["a", "", "b"]],
      ["<br>", []],
      ["a<br/>b", ["a", "b"]],
      ["a<br />b", ["a", "b"]],
      ["a<BR>b", ["a", "b"]],
      ["a <br> b", ["a", "b"]],
      ["x <b>a<br>b</b> y", ["x a", "b y"]],
      ["<p>para<br>line</p><p>next</p>", ["para", "line", "next"]],
      ["<ul><li>a<br>b</li><li>c</li></ul>", ["* a", "b", "* c"]],
      ["<ul><li>a<br><br>b</li></ul>", ["* a", "", "b"]],
      [
        "<ol><li>one<br>two</li><li>three<ul><li>n1<br>n2</li></ul></li></ol>",
        ["1. one", "two", "2. three", "* n1", "n2"],
      ],
    ];
    for (var [html, lines] of cases) {
      assert.deepEqual(await renderLines(html), lines, html);
    }
  });

  it("keeps line breaks in links, table cells, and clipped text", async function () {
    var Recipe = await getRecipe();
    var muhammara = await createMuhammaraWasm();
    Recipe.registerFont(
      "arial",
      await readFile("tests/TestMaterials/fonts/arial.ttf"),
    );
    var remainder;
    var options = { font: "arial", size: 12, html: true };
    var bytes = new Recipe()
      .createPage(400, 400)
      .text('<a href="https://example.test">a<br>b</a>', 20, 20, {
        ...options,
        textBox: { width: 300 },
      })
      // Links get their own page: Wasm writes them as separate objects, and
      // the assertions below only read their rectangles.
      .endPage()
      .createPage(400, 400)
      .table(20, 100, [{ cell: "one<br>two" }, { cell: "three" }], {
        ...options,
        columns: [{ name: "cell", width: 150 }],
      })
      .text("a<br><br>b<br>c", 20, 250, {
        ...options,
        textBox: {
          width: 300,
          height: 20,
          clipIfExceedsBox: true,
          onClip: (_, result) => {
            remainder = result.remainder;
          },
        },
      })
      .endPage()
      .endPDF();
    var reader = muhammara.createReader(bytes);
    try {
      var page = reader.parsePage(0).getDictionary();
      var links = reader
        .queryDictionaryObject(page, "Annots")
        .toPDFArray()
        .toJSArray()
        .map((reference) =>
          reader
            .parseNewObject(
              reference.toPDFIndirectObjectReference().getObjectID(),
            )
            .toPDFDictionary()
            .toJSObject()
            .Rect.toPDFArray()
            .toJSArray()[1]
            .toNumber(),
        );
      assert.equal(links.length, 2, "one link per line");
      assert.ok(links[0] > links[1], "the second link is on the next line");
      var text = reader.extractPageText(1);
      var y = (content) =>
        text.find((item) => item.content.trim() === content).textMatrix[5];
      assert.ok(y("one") > y("two") && y("two") > y("three"));
      assert.equal(remainder, "\nb\nc");
    } finally {
      reader.end();
    }
  });
});
