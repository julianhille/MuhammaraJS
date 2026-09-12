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
});
