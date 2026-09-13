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
      assert.equal((content.match(/\*/g) || []).length, 4);
      assert.notInclude(content, "[@@DONOT_RENDER_THIS@@]");
      assert.include(normalized, "* bold and plain");
      assert.include(normalized, "* after");
      assert.include(normalized, "1. nested");
      assert.include(normalized, "* after nested");
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
        ["      *", "         alpha", "         bravo", "         charlie"],
      );
    } finally {
      reader.end();
    }
  });
});
