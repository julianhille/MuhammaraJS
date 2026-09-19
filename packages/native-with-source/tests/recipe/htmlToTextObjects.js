const fs = require("fs");
const path = require("path");
const assert = require("chai").assert;
const muhammara = require("@muhammara/native-with-source");
const {
  htmlToTextObjects,
} = require("@muhammara/native-core/lib/recipe/htmlToTextObjects");
const htmlCodes = fs.readFileSync(
  path.join(__dirname, "../TestMaterials/recipe/text.html"),
  "utf8",
);
/** Renders HTML and returns its visual lines; blank lines appear as "". */
function renderLines(html, options = {}) {
  const recipe = new muhammara.Recipe(Buffer.from("new"));
  recipe.registerFont(
    "arial",
    path.join(__dirname, "../TestMaterials/fonts/arial.ttf"),
  );
  const bytes = recipe
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
    .endPDF((output) => output);
  const reader = muhammara.createReader(
    new muhammara.PDFRStreamForBuffer(bytes),
  );
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
  const rows = (entries) => {
    const grouped = [];
    entries.forEach((item) => {
      const y = item.textMatrix[5];
      const row = grouped.find((candidate) => Math.abs(candidate.y - y) < 1);
      if (row) row.parts.push(item);
      else grouped.push({ y, parts: [item] });
    });
    return grouped.sort((a, b) => b.y - a.y);
  };
  const [first, second] = rows(reference);
  const pitch = first.y - second.y;
  const lines = [];
  let previous = first.y + pitch;
  rows(items).forEach((row) => {
    const skipped = Math.round((previous - row.y) / pitch) - 1;
    for (let blank = 0; blank < skipped; blank++) lines.push("");
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

describe("HTML to TextObjects", () => {
  it("parse HTML", (done) => {
    const textObjects = htmlToTextObjects(htmlCodes);
    assert.isArray(textObjects);
    done();
  });

  it("preserves unordered, ordered, nested, and formatted list structure", () => {
    const objects = htmlToTextObjects(
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

  it("renders list prefixes, scoped counters, and nesting", () => {
    const recipe = new muhammara.Recipe(Buffer.from("new"));
    recipe.registerFont(
      "arial",
      path.join(__dirname, "../TestMaterials/fonts/arial.ttf"),
    );
    const bytes = recipe
      .createPage(300, 300)
      .text(
        "<ul><li>plain<ol><li>nested</li></ol></li></ul>" +
          "<ol><li>one</li><li>two</li></ol>",
        20,
        20,
        { font: "arial", size: 12, html: true, textBox: { width: 200 } },
      )
      .endPage()
      .endPDF((output) => output);
    const reader = muhammara.createReader(
      new muhammara.PDFRStreamForBuffer(bytes),
    );
    try {
      const extracted = reader.extractPageText(0);
      assert.deepEqual(
        extracted.map((item) => item.content.trim()),
        ["* plain", "1. nested", "1. one", "2. two"],
      );
      assert.equal(
        extracted.find((item) => item.content.includes("nested")).content,
        "          1. nested",
      );
    } finally {
      reader.end();
    }
  });

  it("requires well-formed list markup", () => {
    // The native parser is XML-strict, so an omitted </li> throws here. The
    // Wasm parser is DOM-free and recovers instead; see packages/wasm/DIFFERENCES.md.
    assert.throws(() => htmlToTextObjects("<ul><li>one<li>two</ul>"));
  });

  it("keeps block children inside their list item", () => {
    const objects = htmlToTextObjects("<ul><li><p>para one</p></li></ul>");

    // The renderer propagates the item's prependValue onto this block child,
    // which is why the marker and the paragraph share a line.
    assert.equal(objects[0].childs[0].tag, "li");
    assert.equal(objects[0].childs[0].childs[0].tag, "p");
  });

  it("renders nested-only and pretty-printed list items without empty markers", () => {
    const recipe = new muhammara.Recipe(Buffer.from("new"));
    recipe.registerFont(
      "arial",
      path.join(__dirname, "../TestMaterials/fonts/arial.ttf"),
    );
    const bytes = recipe
      .createPage(300, 300)
      .text(
        "<ul><li><ol><li>x</li></ol></li></ul>" + "<ul><li>\n  one</li></ul>",
        20,
        20,
        { font: "arial", size: 12, html: true, textBox: { width: 200 } },
      )
      .endPage()
      .endPDF((output) => output);
    const reader = muhammara.createReader(
      new muhammara.PDFRStreamForBuffer(bytes),
    );
    try {
      assert.deepEqual(
        reader.extractPageText(0).map((item) => item.content.trim()),
        ["1. x", "* one"],
      );
    } finally {
      reader.end();
    }
  });

  it("renders one marker across formatted runs and hides line breaks", () => {
    const recipe = new muhammara.Recipe(Buffer.from("new"));
    recipe.registerFont(
      "arial",
      path.join(__dirname, "../TestMaterials/fonts/arial.ttf"),
    );
    const bytes = recipe
      .createPage(300, 300)
      .text(
        "<ul><li><b>bold</b> and plain</li><li><br>after</li>" +
          "<li>before<ol><li>nested</li></ol>after nested</li></ul>",
        20,
        20,
        { font: "arial", size: 12, html: true, textBox: { width: 200 } },
      )
      .endPage()
      .endPDF((output) => output);
    const reader = muhammara.createReader(
      new muhammara.PDFRStreamForBuffer(bytes),
    );
    try {
      const extracted = reader.extractPageText(0);
      const content = extracted.map((item) => item.content).join("");
      const normalized = content.replace(/\s+/g, " ").trim();
      assert.equal((content.match(/\*/g) || []).length, 3);
      assert.notInclude(content, "[@@DONOT_RENDER_THIS@@]");
      assert.include(normalized, "* bold and plain");
      assert.include(normalized, "* after");
      assert.include(normalized, "1. nested");
      assert.include(normalized, "after nested");
      assert.notInclude(normalized, "* after nested");
      assert.equal(
        extracted.find((item) => item.content.includes("bold")).content,
        "      * bold",
      );
    } finally {
      reader.end();
    }
  });

  it("matches first-line and hanging indentation at narrow widths", () => {
    const recipe = new muhammara.Recipe(Buffer.from("new"));
    recipe.registerFont(
      "arial",
      path.join(__dirname, "../TestMaterials/fonts/arial.ttf"),
    );
    const bytes = recipe
      .createPage(300, 300)
      .text("<ul><li>alpha bravo charlie</li></ul>", 20, 20, {
        font: "arial",
        size: 12,
        html: true,
        textBox: { width: 63, wrap: "auto" },
      })
      .endPage()
      .endPDF((output) => output);
    const reader = muhammara.createReader(
      new muhammara.PDFRStreamForBuffer(bytes),
    );
    try {
      assert.deepEqual(
        reader.extractPageText(0).map((item) => item.content),
        ["      * alpha", "         bravo", "         charlie"],
      );
    } finally {
      reader.end();
    }
  });

  it("hides indented line breaks inside list items", () => {
    let listClipped;
    const recipe = new muhammara.Recipe(Buffer.from("new"));
    recipe.registerFont(
      "arial",
      path.join(__dirname, "../TestMaterials/fonts/arial.ttf"),
    );
    const bytes = recipe
      .createPage(300, 300)
      .text("<ul><li>before<br>after</li></ul>", 20, 20, {
        font: "arial",
        size: 12,
        html: true,
        textBox: {
          width: 200,
          height: 24,
          lineHeight: 12,
          clipIfExceedsBox: true,
          onClip: (_recipe, result) => {
            listClipped = result;
          },
        },
      })
      .endPage()
      .endPDF((output) => output);
    const reader = muhammara.createReader(
      new muhammara.PDFRStreamForBuffer(bytes),
    );
    try {
      assert.deepEqual(
        reader.extractPageText(0).map((item) => item.content),
        ["      * before", "      after"],
      );
      assert.equal(listClipped, undefined);
    } finally {
      reader.end();
    }

    let clipped;
    const clippedBytes = new muhammara.Recipe(Buffer.from("new"))
      .createPage(300, 300)
      .text("a<br>b", 20, 20, {
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
      })
      .endPage()
      .endPDF((output) => output);
    const clippedReader = muhammara.createReader(
      new muhammara.PDFRStreamForBuffer(clippedBytes),
    );
    try {
      assert.deepEqual(
        clippedReader.extractPageText(0).map((item) => item.content),
        ["a", "b"],
      );
      assert.equal(clipped, undefined);
    } finally {
      clippedReader.end();
    }

    let doubleBreakClip;
    new muhammara.Recipe(Buffer.from("new"))
      .createPage(300, 300)
      .text("a<br><br>b", 20, 20, {
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
      })
      .endPage()
      .endPDF();
    assert.equal(doubleBreakClip.linesWritten, 2);
    assert.equal(doubleBreakClip.remainder, "b");

    let trailingBreakClip;
    new muhammara.Recipe(Buffer.from("new"))
      .createPage(300, 300)
      .text("a<br><br>", 20, 20, {
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
      })
      .endPage()
      .endPDF();
    assert.equal(trailingBreakClip.clipped, true);
    assert.equal(trailingBreakClip.linesWritten, 1);
  });

  it("keeps break boundaries across inline runs and text flow", () => {
    const recipe = new muhammara.Recipe(Buffer.from("new"));
    recipe.registerFont(
      "arial",
      path.join(__dirname, "../TestMaterials/fonts/arial.ttf"),
    );
    const bytes = recipe
      .createPage(300, 300)
      .text("<p>a<br><b>b</b>c</p>", 20, 20, {
        font: "arial",
        size: 12,
        html: true,
      })
      .text("a<br><br>", 20, 100, {
        font: "arial",
        size: 12,
        html: true,
        flow: true,
      })
      .text("b", { font: "arial", size: 12, flow: false })
      .text("<br>", 20, 200, { font: "arial", size: 12, html: true })
      .endPage()
      .endPDF((output) => output);
    const reader = muhammara.createReader(
      new muhammara.PDFRStreamForBuffer(bytes),
    );
    try {
      const lines = new Map();
      reader.extractPageText(0).forEach((item) => {
        const y = item.textMatrix[5];
        lines.set(y, (lines.get(y) || "") + item.content);
      });
      assert.deepEqual(Array.from(lines.values()).slice(0, 2), ["a", "bc"]);
    } finally {
      reader.end();
    }

    const trailingRecipe = new muhammara.Recipe(Buffer.from("new"));
    trailingRecipe.registerFont(
      "arial",
      path.join(__dirname, "../TestMaterials/fonts/arial.ttf"),
    );
    const trailingBytes = trailingRecipe
      .createPage(300, 300)
      .text("a<br>", 20, 20, {
        font: "arial",
        size: 12,
        html: true,
        flow: true,
      })
      .text("FOLLOW", { font: "arial", size: 12, flow: false })
      .endPage()
      .endPDF((output) => output);
    const trailingReader = muhammara.createReader(
      new muhammara.PDFRStreamForBuffer(trailingBytes),
    );
    try {
      const [first, following] = trailingReader.extractPageText(0);
      assert.notEqual(first.textMatrix[5], following.textMatrix[5]);
    } finally {
      trailingReader.end();
    }
  });

  it("renders one marker for block children in one list item", () => {
    const recipe = new muhammara.Recipe(Buffer.from("new"));
    recipe.registerFont(
      "arial",
      path.join(__dirname, "../TestMaterials/fonts/arial.ttf"),
    );
    const bytes = recipe
      .createPage(300, 300)
      .text("<ol><li><p>one</p><p>two</p></li></ol>", 20, 20, {
        font: "arial",
        size: 12,
        html: true,
      })
      .endPage()
      .endPDF((output) => output);
    const reader = muhammara.createReader(
      new muhammara.PDFRStreamForBuffer(bytes),
    );
    try {
      assert.deepEqual(
        reader.extractPageText(0).map((item) => item.content.trim()),
        ["1. one", "two"],
      );
    } finally {
      reader.end();
    }
  });

  it("sizes text outside HTML elements like element text", () => {
    const cases = [
      ["Decorated", {}, 14],
      ["a <u>b</u>", {}, 14],
      ["a <u>b</u>", { size: 20 }, 20],
    ];
    for (const [html, options, size] of cases) {
      const recipe = new muhammara.Recipe(Buffer.from("new"));
      recipe.registerFont(
        "arial",
        path.join(__dirname, "../TestMaterials/fonts/arial.ttf"),
      );
      const bytes = recipe
        .createPage(300, 300)
        .text(html, 20, 20, {
          font: "arial",
          html: true,
          textBox: { width: 200 },
          ...options,
        })
        .endPage()
        .endPDF((output) => output);
      const reader = muhammara.createReader(
        new muhammara.PDFRStreamForBuffer(bytes),
      );
      try {
        const extracted = reader.extractPageText(0);
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

  it("lays out explicit line breaks without placeholder text", () => {
    const objects = htmlToTextObjects("a<br/>b");
    assert.deepEqual(
      objects.map((object) => [object.value, object.lineBreak]),
      [
        ["a", false],
        [null, true],
        ["b", false],
      ],
    );
    const cases = [
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
    for (const [html, lines] of cases) {
      assert.deepEqual(renderLines(html), lines, html);
    }
  });

  it("keeps line breaks in links, table cells, and clipped text", () => {
    const recipe = new muhammara.Recipe(Buffer.from("new"));
    recipe.registerFont(
      "arial",
      path.join(__dirname, "../TestMaterials/fonts/arial.ttf"),
    );
    let remainder;
    const options = { font: "arial", size: 12, html: true };
    const bytes = recipe
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
      .endPDF((output) => output);
    const reader = muhammara.createReader(
      new muhammara.PDFRStreamForBuffer(bytes),
    );
    try {
      const page = reader.parsePage(0).getDictionary();
      const links = reader
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
      const text = reader.extractPageText(1);
      const y = (content) =>
        text.find((item) => item.content.trim() === content).textMatrix[5];
      assert.ok(y("one") > y("two") && y("two") > y("three"));
      assert.equal(remainder, "\nb\nc");
    } finally {
      reader.end();
    }
  });
});
