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
      assert.deepEqual(
        reader.extractPageText(0).map((item) => item.content.trim()),
        ["* plain", "1. nested", "1. one", "2. two"],
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

  it("renders one marker across formatted runs and hides break sentinels", () => {
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

  it("hides indented break sentinels inside list items", () => {
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
});
