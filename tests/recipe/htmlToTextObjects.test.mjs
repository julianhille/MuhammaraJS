import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { htmlToTextObjects } from "@muhammara/shared/recipe/htmlToTextObjects.js";
import { describeEnds, fixture, writeOutput } from "../support/ends.mjs";
import { annotations, drawnContent } from "../support/pdf.mjs";
import { drawn, drawnRuns, renderLines, rows } from "../support/flow.mjs";

var ARIAL_12 = { font: "arial", size: 12, html: true };

/**
 * The number of spaces a line starts with.
 * @param {string} line - A rendered line.
 * @returns {number} Its indentation.
 */
function indent(line) {
  return line.length - line.trimStart().length;
}

// The parser is one platform-free function shared by both ends, so its
// object tree is tested once.
describe("HTML to TextObjects parser", function () {
  it("parses HTML", function () {
    var textObjects = htmlToTextObjects(
      readFileSync(fixture("recipe/text.html"), "utf8"),
    );
    assert.ok(Array.isArray(textObjects));
  });

  it("preserves unordered, ordered, nested, and formatted list structure", function () {
    var objects = htmlToTextObjects(
      '<ul><li>plain</li><li><b>bold</b><ol><li><a href="https://example.test">nested</a></li></ol></li></ul>',
    );
    assert.equal(objects[0].tag, "ul");
    assert.deepEqual(
      objects[0].childs.filter((child) => child.tag).map((child) => child.tag),
      ["li", "li"],
    );
    assert.equal(objects[0].childs[1].childs[0].tag, "b");
    assert.equal(objects[0].childs[1].childs[1].tag, "ol");
    assert.equal(
      objects[0].childs[1].childs[1].childs[0].childs[0].link,
      "https://example.test",
    );
  });

  it("keeps block children inside their list item", function () {
    var objects = htmlToTextObjects("<ul><li><p>para one</p></li></ul>");
    // The renderer propagates the item's prependValue onto this block child,
    // which is why the marker and the paragraph share a line.
    assert.equal(objects[0].childs[0].tag, "li");
    assert.equal(objects[0].childs[0].childs[0].tag, "p");
  });

  it("parses explicit line breaks without placeholder text", function () {
    assert.deepEqual(
      htmlToTextObjects("a<br/>b").map((object) => [
        object.value,
        object.lineBreak,
      ]),
      [
        ["a", false],
        [null, true],
        ["b", false],
      ],
    );
  });

  it("matches tags case-insensitively and links to href", function () {
    var [paragraph] = htmlToTextObjects(
      '<p><a class="x" href="https://h.test">l</a><a>none</a><B>b</B><U>u</U><DEL>d</DEL><I>i</I></p>',
    );
    var [link, bare, bold, underline, strikeOut, italic] = paragraph.childs;
    assert.equal(link.link, "https://h.test");
    assert.equal(bare.link, null);
    assert.equal(bold.isBold, true);
    assert.equal(underline.underline, true);
    assert.equal(strikeOut.strikeOut, true);
    assert.equal(italic.isItalic, true);
  });

  it("strikes out s, strike and del text", function () {
    var [paragraph] = htmlToTextObjects(
      "<p><s>a</s><strike>b</strike><del>c</del>d</p>",
    );
    assert.deepEqual(
      paragraph.childs.map((child) => child.strikeOut),
      [true, true, true, false],
    );
  });
});

describeEnds("HTML to TextObjects", function (end) {
  /**
   * Draw HTML on one page, write the PDF for review and return the PDF.
   * @param {string} name - Output name suffix.
   * @param {function(object): object} draw - Draws on the page.
   * @param {Array<number>} [size=[300, 300]] - The page size.
   * @returns {Uint8Array} The PDF.
   */
  function page(name, draw, size = [300, 300]) {
    var recipe = end.newRecipe().createPage(...size);
    draw(recipe);
    var bytes = recipe.endPage().endPDF();
    writeOutput(end, `htmlToTextObjects-${name}`, bytes);
    return bytes;
  }

  /**
   * The rendered lines of one HTML text, untrimmed, top to bottom.
   * @param {string} name - Output name suffix.
   * @param {string} html - The HTML.
   * @param {object} [options] - Extra text options.
   * @returns {string[]} The lines.
   */
  function rawLines(name, html, options = {}) {
    var bytes = page(name, (recipe) =>
      recipe.text(html, 20, 20, {
        ...ARIAL_12,
        textBox: { width: 200 },
        ...options,
      }),
    );
    return rows(drawnRuns(end, bytes)).map((row) => row.text);
  }

  /**
   * The rendered lines of one HTML text, trimmed, as renderLines() gives
   * them.
   * @param {string} name - Output name suffix.
   * @param {string} html - The HTML.
   * @returns {string[]} The lines.
   */
  function lines(name, html) {
    return renderLines(end, html, `htmlToTextObjects-${name}`);
  }

  /**
   * The first link annotation rectangle of a page.
   * @param {Uint8Array} bytes - The PDF.
   * @returns {number[]} The rectangle.
   */
  function linkRect(bytes) {
    var link = annotations(end, bytes).find(
      (annotation) => annotation.Subtype === "Link",
    );
    assert.ok(link, "the text is linked");
    return link.Rect;
  }

  it("renders list prefixes, scoped counters, and nesting", function () {
    var bytes = page("list-prefixes", (recipe) =>
      recipe.text(
        "<ul><li>plain<ol><li>nested</li></ol></li></ul>" +
          "<ol><li>one</li><li>two</li></ol>",
        20,
        20,
        { ...ARIAL_12, textBox: { width: 200 } },
      ),
    );
    var runs = drawnRuns(end, bytes);
    assert.deepEqual(
      runs.map((run) => run.text.trim()),
      ["* plain", "1. nested", "1. one", "2. two"],
    );
    assert.equal(
      runs.find((run) => run.text.includes("nested")).text,
      "          1. nested",
    );
  });

  it("renders unordered, ordered, nested, formatted and linked list items", function () {
    var html =
      "<ul><li>plain</li><li><b>bold</b> and " +
      '<a href="https://example.test">linked</a><ol><li>nested</li></ol>' +
      "after</li></ul><ol><li>one</li><li>two</li></ol>";
    var bytes = page("lists", (recipe) =>
      recipe
        .text(html, 20, 20, { ...ARIAL_12, textBox: { width: 200 } })
        .text("<ul><li>alpha bravo charlie delta</li></ul>", 20, 150, {
          ...ARIAL_12,
          textBox: { width: 70, wrap: "auto" },
        }),
    );
    var link = annotations(end, bytes).find(
      (annotation) => annotation.Subtype === "Link",
    );
    assert.equal(link.A.URI, "https://example.test");
    // Both texts share the page; higher y is the first, upper block.
    var rendered = rows(drawnRuns(end, bytes)).map((row) => row.text);
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
    assert.deepEqual(rendered.slice(0, 6).map(indent), [6, 6, 10, 6, 6, 6]);
    assert.equal(rendered[2], "          1. nested");
    assert.equal(rendered[3], "      after");
    // Wrapped continuations hang under the item text and carry no trailing
    // space.
    assert.deepEqual(rendered.slice(6), [
      "      * alpha",
      "         bravo",
      "         charlie",
      "         delta",
    ]);
  });

  it("continues a list item after its nested list", function () {
    assert.deepEqual(
      lines(
        "nested-continuation",
        "<ul><li>before<ol><li>nested</li></ol>after</li></ul>outside",
      ),
      ["* before", "1. nested", "after", "outside"],
    );
    ["<br>after", "<p>after</p>", "<div>after</div>"].forEach(
      (continuation, index) => {
        assert.deepEqual(
          lines(
            `nested-continuation-${index + 1}`,
            `<ul><li>before<ol><li>nested</li></ol>${continuation}</li></ul>`,
          ),
          ["* before", "1. nested", "after"],
          continuation,
        );
      },
    );
  });

  it("does not leak the styles of void elements", function () {
    var runs = drawnRuns(
      end,
      page("void-element", (recipe) =>
        recipe.text('<img style="color:red">plain', 20, 20, ARIAL_12),
      ),
    );
    assert.deepEqual(
      runs.map((run) => run.text),
      ["plain"],
    );
    assert.notEqual(runs[0].color, "1 0 0");
  });

  it("keeps item context, spaces and indentation across well-formed markup", function () {
    var cases = [
      ["<ul>\n  <li>one</li>\n  <li>two</li>\n</ul>", ["* one", "* two"]],
      ["<ul><li>\n  one</li></ul>", ["* one"]],
      ["<ul><li>one</li></ul>\ntext", ["* one", "text"]],
      ["a <b> b</b>", ["a  b"]],
      ["a\nb", ["a", "b"]],
      ["a   b", ["a   b"]],
      ["a&nbsp;&nbsp;b", ["a\u00a0\u00a0b"]],
      ["<ul><li><ol><li>x</li></ol></li></ul>", ["1. x"]],
      ["<ul><li>a<ul></ul>b</li></ul>", ["* ab"]],
      ["<ul><li>a<p></p>b</li></ul>", ["* ab"]],
      // The marker propagates into block children, so an opening block
      // right after a marker does not break the line.
      ["<ul><li><p>para one</p></li></ul>", ["* para one"]],
      ["<ul><li> <p>para one</p></li></ul>", ["* para one"]],
      ["<ul><li><p>a</p><p>b</p></li></ul>", ["* a", "b"]],
      ["<ul><li>a<p>b</p>c</li></ul>", ["* a", "b", "c"]],
      ["<ul></ul>\n<ul><li>x</li></ul>", ["* x"]],
    ];
    cases.forEach(([html, expected], index) => {
      assert.deepEqual(
        lines(`item-context-${index + 1}`, html),
        expected,
        JSON.stringify(html),
      );
    });
    assert.deepEqual(
      rawLines(
        "nested-indents",
        "<ul><li>one<ul><li>two<ul><li>three</li></ul></li></ul></li></ul>",
      ).map(indent),
      [6, 10, 14],
    );
    // Content after the list is no longer indented by it.
    assert.deepEqual(
      rawLines("after-list-indent", "<ul><li>one</li></ul>tail").map(indent),
      [6, 0],
    );
    assert.deepEqual(
      rawLines("empty-list-indent", "<ul></ul><ul><li>x</li></ul>").map(indent),
      [6],
    );
  });

  it("keeps non-breaking and em spaces as content", function () {
    // Unlike collapsible whitespace, they are drawn: a list item holding
    // only one keeps its marker, and one before a list is a line of its own.
    // The item and its marker are kept; which blank glyph an otherwise
    // empty item draws is not asserted.
    ["\u00a0", "\u2003"].forEach((space, index) => {
      var lines = rawLines(
        `item-space-${index + 1}`,
        `<ul><li>${space}</li></ul>`,
      ).map((line) => line.trimStart());
      assert.equal(lines.length, 1);
      assert.match(lines[0], /^\*/);
    });
    // A no-break space before a list is a (blank) line of its own.
    var before = rawLines("nbsp-before-list", "\u00a0<ul><li>x</li></ul>");
    assert.equal(before.length, 2);
    assert.equal(before[0].trim(), "");
    assert.equal(before[1].trimStart().replace(/\s+/gu, " "), "* x");
  });

  it("draws no blank line for whitespace-only inline content before a list", function () {
    assert.deepEqual(
      lines("whitespace-before-list", " \n <b> </b><ul><li>x</li></ul>"),
      ["* x"],
    );
  });

  // HTML5 makes </li> optional and browsers recover from misnested lists:
  // an item ends at its sibling or at its list, on both ends.
  it("ends items without </li> and recovers misnested lists", function () {
    [
      ["<ul><li>one<li>two</ul>tail", ["* one", "* two", "tail"]],
      ["<ol><li>one<li>two</ol>", ["1. one", "2. two"]],
      ["<ul><li>x<ul><li>y</ul><li>z</ul>end", ["* x", "* y", "* z", "end"]],
      ["<ol><li>a<ul><li>b</ol>tail", ["1. a", "* b", "tail"]],
      ["<ul><li><ol><li>a</li></li></ol><li>b</li></ul>", ["1. a", "* b"]],
    ].forEach(([html, expected], index) => {
      assert.deepEqual(
        lines(`recover-${index + 1}`, html),
        expected,
        JSON.stringify(html),
      );
    });
  });

  it("renders nested-only and pretty-printed list items without empty markers", function () {
    var bytes = page("nested-only-items", (recipe) =>
      recipe.text(
        "<ul><li><ol><li>x</li></ol></li></ul>" + "<ul><li>\n  one</li></ul>",
        20,
        20,
        { ...ARIAL_12, textBox: { width: 200 } },
      ),
    );
    assert.deepEqual(
      drawnRuns(end, bytes).map((run) => run.text.trim()),
      ["1. x", "* one"],
    );
  });

  it("renders one marker across formatted runs and hides line breaks", function () {
    var bytes = page("formatted-runs", (recipe) =>
      recipe.text(
        "<ul><li><b>bold</b> and plain</li><li><br>after</li>" +
          "<li>before<ol><li>nested</li></ol>after nested</li></ul>",
        20,
        20,
        { ...ARIAL_12, textBox: { width: 200 } },
      ),
    );
    var runs = drawnRuns(end, bytes);
    var content = runs.map((run) => run.text).join("");
    var normalized = content.replace(/\s+/g, " ").trim();
    assert.equal((content.match(/\*/g) || []).length, 3);
    assert.ok(!content.includes("[@@DONOT_RENDER_THIS@@]"));
    assert.ok(normalized.includes("* bold and plain"));
    assert.ok(normalized.includes("* after"));
    assert.ok(normalized.includes("1. nested"));
    assert.ok(normalized.includes("after nested"));
    assert.ok(!normalized.includes("* after nested"));
    assert.equal(
      runs.find((run) => run.text.includes("bold")).text,
      "      * bold",
    );
  });

  it("matches first-line and hanging indentation at narrow widths", function () {
    var bytes = page("hanging-indent", (recipe) =>
      recipe.text("<ul><li>alpha bravo charlie</li></ul>", 20, 20, {
        ...ARIAL_12,
        textBox: { width: 63, wrap: "auto" },
      }),
    );
    assert.deepEqual(
      drawnRuns(end, bytes).map((run) => run.text),
      ["      * alpha", "         bravo", "         charlie"],
    );
  });

  it("indents continuation lines and never starts a line with a space", function () {
    var bytes = page("continuation-indent", (recipe) =>
      recipe
        .text("<ul><li>a<br>b</li><li>c</li></ul>", 20, 20, {
          ...ARIAL_12,
          textBox: { width: 200 },
        })
        .text("aaaa <b>bbbb</b> cccc", 20, 150, {
          ...ARIAL_12,
          textBox: { width: 40, wrap: "auto" },
        }),
    );
    var rendered = rows(drawnRuns(end, bytes)).map((row) => row.text);
    // A <br> inside an item keeps the item indentation; the extra hanging
    // space only comes with an automatic wrap, not with a hard break.
    assert.deepEqual(rendered.slice(0, 3), [
      "      * a",
      "      b",
      "      * c",
    ]);
    // Wrapping at an inline boundary does not push the space onto the next
    // line, and no line keeps a trailing space.
    rendered.slice(3).forEach((line) => {
      assert.equal(
        line,
        line.trim(),
        `unexpected padding in ${JSON.stringify(line)}`,
      );
    });
    assert.equal(rendered.slice(3).join(" "), "aaaa bbbb cccc");
  });

  it("hides indented line breaks inside list items", function () {
    var listClipped;
    var bytes = page("list-line-breaks", (recipe) =>
      recipe.text("<ul><li>before<br>after</li></ul>", 20, 20, {
        ...ARIAL_12,
        textBox: {
          width: 200,
          height: 24,
          lineHeight: 12,
          clipIfExceedsBox: true,
          onClip: (_recipe, result) => {
            listClipped = result;
          },
        },
      }),
    );
    assert.deepEqual(
      drawnRuns(end, bytes).map((run) => run.text),
      ["      * before", "      after"],
    );
    assert.equal(listClipped, undefined);

    var clipped;
    var clippedBytes = page("break-clip", (recipe) =>
      recipe.text("a<br>b", 20, 20, {
        size: 12,
        html: true,
        textBox: {
          width: 200,
          height: 30,
          lineHeight: 12,
          clipIfExceedsBox: true,
          onClip: (_recipe, result) => {
            clipped = result;
          },
        },
      }),
    );
    assert.deepEqual(
      drawnRuns(end, clippedBytes).map((run) => run.text),
      ["a", "b"],
    );
    assert.equal(clipped, undefined);

    var doubleBreakClip;
    page("double-break-clip", (recipe) =>
      recipe.text("a<br><br>b", 20, 20, {
        size: 12,
        html: true,
        textBox: {
          width: 200,
          height: 24,
          lineHeight: 12,
          clipIfExceedsBox: true,
          onClip: (_recipe, result) => {
            doubleBreakClip = result;
          },
        },
      }),
    );
    assert.equal(doubleBreakClip.linesWritten, 2);
    assert.equal(doubleBreakClip.remainder, "b");

    var trailingBreakClip;
    page("trailing-break-clip", (recipe) =>
      recipe.text("a<br><br>", 20, 20, {
        size: 12,
        html: true,
        textBox: {
          width: 200,
          height: 12,
          lineHeight: 12,
          clipIfExceedsBox: true,
          onClip: (_recipe, result) => {
            trailingBreakClip = result;
          },
        },
      }),
    );
    assert.equal(trailingBreakClip.clipped, true);
    assert.equal(trailingBreakClip.linesWritten, 1);
  });

  it("keeps break boundaries across inline runs and text flow", function () {
    var bytes = page("break-boundaries", (recipe) =>
      recipe
        .text("<p>a<br><b>b</b>c</p>", 20, 20, ARIAL_12)
        .text("a<br><br>", 20, 100, { ...ARIAL_12, flow: true })
        .text("b", { font: "arial", size: 12, flow: false })
        .text("<br>", 20, 200, ARIAL_12),
    );
    // Lines in drawing order, joined by baseline.
    var byLine = new Map();
    drawnRuns(end, bytes).forEach((run) => {
      byLine.set(run.y, (byLine.get(run.y) || "") + run.text);
    });
    assert.deepEqual(Array.from(byLine.values()).slice(0, 2), ["a", "bc"]);

    var trailing = drawnRuns(
      end,
      page("trailing-break-flow", (recipe) =>
        recipe
          .text("a<br>", 20, 20, { ...ARIAL_12, flow: true })
          .text("FOLLOW", { font: "arial", size: 12, flow: false }),
      ),
    );
    assert.notEqual(trailing[0].y, trailing[1].y);
  });

  it("renders one marker for block children in one list item", function () {
    var bytes = page("block-children-marker", (recipe) =>
      recipe.text("<ol><li><p>one</p><p>two</p></li></ol>", 20, 20, ARIAL_12),
    );
    assert.deepEqual(
      drawnRuns(end, bytes).map((run) => run.text.trim()),
      ["1. one", "two"],
    );
  });

  it("sizes text outside HTML elements like element text", function () {
    var cases = [
      ["Decorated", {}, 14],
      ["a <u>b</u>", {}, 14],
      ["a <u>b</u>", { size: 20 }, 20],
    ];
    cases.forEach(([html, options, size], index) => {
      var runs = drawnRuns(
        end,
        page(`element-size-${index + 1}`, (recipe) =>
          recipe.text(html, 20, 20, {
            font: "arial",
            html: true,
            textBox: { width: 200 },
            ...options,
          }),
        ),
      );
      assert.deepEqual(
        runs.map((run) => run.text.trim()).filter(Boolean),
        html.replace(/<[^>]+>/g, "").split(" "),
      );
      runs.forEach((run) => assert.equal(run.size, size));
    });
  });

  it("lays out explicit line breaks without placeholder text", function () {
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
    cases.forEach(([html, expected], index) => {
      assert.deepEqual(lines(`line-breaks-${index + 1}`, html), expected, html);
    });
  });

  it("keeps line breaks in links, table cells, and clipped text", function () {
    var remainder;
    var bytes = end
      .newRecipe()
      .createPage(400, 400)
      .text('<a href="https://example.test">a<br>b</a>', 20, 20, {
        ...ARIAL_12,
        textBox: { width: 300 },
      })
      .endPage()
      .createPage(400, 400)
      .table(20, 100, [{ cell: "one<br>two" }, { cell: "three" }], {
        ...ARIAL_12,
        columns: [{ name: "cell", width: 150 }],
      })
      .text("a<br><br>b<br>c", 20, 250, {
        ...ARIAL_12,
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
    writeOutput(end, "htmlToTextObjects-links-tables-clipped", bytes);
    var links = annotations(end, bytes).map((annotation) => annotation.Rect[1]);
    assert.equal(links.length, 2, "one link per line");
    assert.ok(links[0] > links[1], "the second link is on the next line");
    var runs = drawnRuns(end, bytes, 1);
    /**
     * The baseline of the run with a text.
     * @param {string} text - The trimmed run text.
     * @returns {number} Its y.
     */
    var y = (text) => runs.find((run) => run.text.trim() === text).y;
    assert.ok(y("one") > y("two") && y("two") > y("three"));
    assert.equal(remainder, "\nb\nc");
  });

  it("lays out upper-case lists with bullets and numbers", function () {
    var bytes = page("upper-case-lists", (recipe) =>
      recipe.text("<UL><LI>dot</LI></UL><OL><LI>one</LI></OL>", 10, 10, {
        html: true,
        size: 10,
        textBox: { width: 200 },
      }),
    );
    var text = drawnRuns(end, bytes)
      .map((run) => run.text)
      .join("|");
    assert.ok(text.includes("* dot"));
    assert.ok(text.includes("1. one"));
  });

  describe("word spacing through wrapping and justification", function () {
    it("wraps styled words without clipping them", function () {
      var clipped;
      var bytes = page(
        "spacing-clipped",
        (recipe) => {
          var narrowWidth = recipe.textDimensions("aaaa", {
            font: "arial",
            size: 12,
          }).width;
          recipe.text("<b>WWWW</b> WWWW", 20, 20, {
            ...ARIAL_12,
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
        },
        [300, 200],
      );
      assert.deepEqual(
        drawnRuns(end, bytes).map((run) => run.text),
        ["WWWW", "WWWW"],
      );
      assert.equal(clipped, undefined);
    });

    it("keeps character spacing and the space between styled runs", function () {
      var bravoStart;
      var bytes = page(
        "spacing-charspace",
        (recipe) => {
          var spaced = { font: "arial", size: 12, charSpace: 5 };
          // "bravo" starts at the right edge of "alpha ", with its character
          // spacing, plus the width of an "o" for the space that ends it.
          bravoStart =
            20 +
            recipe.textDimensions("alpha ", spaced).xMax +
            recipe.textDimensions("o", spaced).width;
          recipe.text("alpha <b>bravo</b> charlie", 20, 20, {
            ...spaced,
            html: true,
          });
        },
        [300, 200],
      );
      var runs = drawnRuns(end, bytes);
      assert.deepEqual(
        runs.map((run) => run.text),
        ["alpha ", "bravo", " charlie"],
      );
      assert.match(
        drawnContent(end, bytes),
        /\b5 Tc\b/,
        "character spacing is drawn for styled HTML runs",
      );
      assert.ok(Math.abs(runs[1].x - bravoStart) < 0.001);
    });

    it("rotates every styled run of one text about one origin", function () {
      var runs = drawnRuns(
        end,
        page(
          "spacing-rotated",
          (recipe) =>
            recipe.text("<b>ab</b>cd", 20, 20, {
              ...ARIAL_12,
              rotation: 90,
            }),
          [300, 200],
        ),
      );
      assert.equal(runs.length, 2);
      // Turned a quarter, both runs share one baseline: one x, rising y.
      runs.forEach((run) =>
        assert.deepEqual(run.matrix.slice(0, 4), runs[0].matrix.slice(0, 4)),
      );
      assert.equal(Math.abs(runs[0].matrix[1]), 1);
      assert.equal(runs[1].x, runs[0].x);
      assert.notEqual(runs[1].y, runs[0].y);
    });

    /**
     * Assert that a 90 degree linked and hilited text is turned as a whole:
     * its link, its hilites and its runs.
     * @param {Uint8Array} bytes - The PDF.
     * @returns {void}
     */
    function assertTurnedLink(bytes) {
      var rect = linkRect(bytes);
      assert.ok(
        rect[3] - rect[1] > rect[2] - rect[0],
        "a 90-degree link rectangle is taller than it is wide",
      );
      var { runs, rects } = drawn(end, bytes);
      assert.ok(runs.length > 0);
      runs.forEach((run) => {
        assert.equal(run.x, runs[0].x, "the runs share one baseline");
        assert.equal(Math.abs(run.matrix[1]), 1, "the runs are turned");
      });
      assert.equal(rects.length, runs.length, "every run is hilited");
      var top = Math.max(...rects.map((r) => r.y + r.height));
      var bottom = Math.min(...rects.map((r) => r.y));
      assert.ok(
        top - bottom > rects[0].width,
        "the hilites are turned with the text",
      );
    }

    it("turns links and hilites with rotated styled text", function () {
      assertTurnedLink(
        page(
          "spacing-rotated-link",
          (recipe) =>
            recipe.text(
              '<a href="https://example.test"><b>linked value</b></a>',
              20,
              20,
              { ...ARIAL_12, rotation: 90, hilite: true },
            ),
          [300, 200],
        ),
      );
    });

    it("turns links and hilites with rotated styled text on an edited page", function () {
      var source = end.newRecipe().createPage(300, 200).endPage().endPDF();
      writeOutput(end, "htmlToTextObjects-spacing-edit-source", source);
      var bytes = end
        .openRecipe(source)
        .editPage(1)
        .text('<a href="https://example.test"><b>ab</b>cd</a>', 20, 20, {
          ...ARIAL_12,
          rotation: 90,
          hilite: true,
        })
        .endPage()
        .endPDF();
      writeOutput(end, "htmlToTextObjects-spacing-edited-rotated-link", bytes);
      assertTurnedLink(bytes);
    });

    it("places links with the text on rotated pages", function () {
      var source = end
        .newRecipe()
        .createPage(300, 200)
        .rotate(90)
        .endPage()
        .endPDF();
      writeOutput(end, "htmlToTextObjects-spacing-rotated-edit-source", source);
      var edited = end
        .openRecipe(source)
        .editPage(1)
        .text('<a href="https://example.test">linked</a>', 20, 20, {
          ...ARIAL_12,
          skewX: 10,
        })
        .endPage()
        .endPDF();
      writeOutput(end, "htmlToTextObjects-spacing-rotated-edit", edited);
      var editedRect = linkRect(edited);
      assert.ok(
        editedRect[2] < 50 && editedRect[1] < 120,
        `transformed links follow the source page rotation: ${editedRect}`,
      );

      var created = page(
        "spacing-rotated-created",
        (recipe) =>
          recipe
            .rotate(90)
            .text('<a href="https://example.test">linked</a>', 20, 20, {
              ...ARIAL_12,
              skewX: 10,
            }),
        [300, 200],
      );
      assert.ok(
        linkRect(created)[1] > 150,
        "created-page rotation does not transform the link without its text",
      );
    });

    it("hilites every run of a justified line", function () {
      var { rects } = drawn(
        end,
        page(
          "spacing-justified-hilite",
          (recipe) =>
            recipe.text("<b>alpha</b> bravo charlie delta", 20, 20, {
              ...ARIAL_12,
              hilite: true,
              textBox: { width: 120, textAlign: "justify top" },
            }),
          [300, 200],
        ),
      );
      assert.ok(rects.length > 1);
      rects.forEach((rect) => {
        assert.ok(rect.width > 0);
        assert.ok(rect.height > 0);
      });
    });

    it("breaks at breakable spaces only", function () {
      var narrow;
      var nonBreaking = drawnRuns(
        end,
        page(
          "spacing-non-breaking",
          (recipe) => {
            narrow =
              recipe.textDimensions("a", { font: "arial", size: 12 }).width +
              0.1;
            recipe.text("a&nbsp;b", 20, 20, {
              ...ARIAL_12,
              textBox: { width: narrow, wrap: "auto" },
            });
          },
          [300, 200],
        ),
      );
      assert.equal(nonBreaking.length, 1);
      var breakable = drawnRuns(
        end,
        page(
          "spacing-breakable-unicode",
          (recipe) =>
            recipe.text("a\u2003b", 20, 20, {
              ...ARIAL_12,
              textBox: { width: narrow, wrap: "auto" },
            }),
          [300, 200],
        ),
      );
      assert.equal(new Set(breakable.map((run) => run.y)).size, 2);
    });

    it("hangs the continuation of an item after its nested list", function () {
      var texts = drawnRuns(
        end,
        page(
          "spacing-nested-continuation",
          (recipe) =>
            recipe.text(
              "<ul><li>a<ol><li>b</li></ol>d alpha bravo charlie</li></ul>",
              20,
              20,
              { ...ARIAL_12, textBox: { width: 55, wrap: "auto" } },
            ),
          [300, 200],
        ),
      ).map((run) => run.text);
      var continuationStart = texts.findIndex((line) => line.includes("d"));
      assert.ok(continuationStart > 0);
      texts.slice(continuationStart).forEach((line) => {
        assert.match(line, /^ {6}\S/);
      });
    });

    it("does not justify a gap inside a styled word", function () {
      var helAdvance;
      var runs = drawnRuns(
        end,
        page(
          "spacing-justified",
          (recipe) => {
            // "lo" starts at the right edge of "hel".
            helAdvance = recipe.textDimensions("hel", {
              font: "arial",
              size: 12,
              bold: true,
            }).xMax;
            recipe.text("<b>hel</b>lo xx yy", 20, 20, {
              ...ARIAL_12,
              textBox: { width: 45, textAlign: "justify top" },
            });
          },
          [300, 200],
        ),
      );
      // How the rest of the line is split into runs is the end's choice.
      assert.equal(runs[0].text, "hel");
      assert.match(runs[1].text, /^lo /);
      assert.ok(Math.abs(runs[1].x - (20 + helAdvance)) < 0.001);
    });

    it("links a linked list item together with its marker", function () {
      var bytes = page(
        "spacing-linked-marker",
        (recipe) =>
          recipe.text(
            '<ul><li><a href="https://example.test"><b>linked</b></a></li></ul>',
            20,
            20,
            ARIAL_12,
          ),
        [300, 200],
      );
      assert.equal(
        linkRect(bytes)[0],
        20,
        "the marker and the item text share one clickable rectangle",
      );
    });

    it("cuts the link of clipped text at the box edge", function () {
      var bytes = page(
        "spacing-clipped-link",
        (recipe) =>
          recipe.text(
            '<a href="https://example.test">a very long linked value</a>',
            20,
            20,
            { ...ARIAL_12, textBox: { width: 30, wrap: "clip" } },
          ),
        [300, 200],
      );
      assert.ok(linkRect(bytes)[2] <= 50.001);
    });
  });
});
