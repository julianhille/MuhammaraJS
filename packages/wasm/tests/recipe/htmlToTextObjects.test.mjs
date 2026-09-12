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
      var extracted = reader.extractPageText(0);
      var lines = new Map();
      extracted.slice(0, 14).forEach((item) => {
        var y = item.textMatrix[5];
        lines.set(y, (lines.get(y) || "") + item.content);
      });
      assert.deepEqual(
        Array.from(lines.values(), (line) => line.trimStart()),
        [
          "* plain",
          "* bold and linked",
          "1. nested",
          "* after",
          "1. one",
          "2. two",
        ],
      );
      var wrapped = extracted.slice(14);
      assert.equal(wrapped[0].content, "      * ");
      assert.equal(
        wrapped.find((item) => item.content.trim() === "bravo").content,
        "         bravo ",
      );
    } finally {
      reader.end();
      muhammara.disposeAssets();
    }
  });
});
