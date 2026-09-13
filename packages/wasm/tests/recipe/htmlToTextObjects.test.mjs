import assert from "node:assert/strict";
import { createMuhammaraWasm } from "../../index.js";
import { getRecipe } from "./recipe.mjs";

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
      "* plain\n* bold and linked\n1. nested\n* after\n1. one\n2. two",
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
    assert.equal(
      recipe
        .htmlToTextObjects(
          "<ul><li>before<ol><li>nested</li></ol>after</li></ul>outside",
        )
        .map((object) => object.value)
        .join(""),
      "* before\n1. nested\n* after\noutside",
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
          "* before\n1. nested\n* after",
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
          "* after",
          "1. one",
          "2. two",
        ],
      );
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
    assert.equal(
      values("<ul><li>x<ul><li>y</ul><li>z</ul>end"),
      "* x\n* y\n* z\nend",
    );
    assert.equal(values("<ul><li><ol><li>x</li></ol></li></ul>"), "1. x");
    assert.equal(values(" \n <b> </b><ul><li>x</li></ul>"), "* x");
    assert.equal(values("<ul><li>a<ul></ul>b</li></ul>"), "* ab");
    assert.equal(values("<ul><li>a<p></p>b</li></ul>"), "* ab");
    assert.equal(values("<ol><li>a<ul><li>b</ol>tail"), "1. a\n* b\ntail");

    // Native propagates the marker into block children, so an opening block
    // right after a marker must not break the line.
    assert.equal(values("<ul><li><p>para one</p></li></ul>"), "* para one");
    assert.equal(values("<ul><li> <p>para one</p></li></ul>"), "* para one");
    assert.equal(values("<ul><li><p>a</p><p>b</p></li></ul>"), "* a\n* b");
    assert.equal(values("<ul><li>a<p>b</p>c</li></ul>"), "* a\n* b\n* c");

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
    var spacedBytes = spacedRecipe.endPage().endPDF();
    assert.deepEqual(
      (() => {
        var reader = muhammara.createReader(spacedBytes);
        try {
          return reader.extractPageText(0).map((item) => item.content);
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
      ["      *", "         alpha", "         bravo", "         charlie"],
    );

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
});
