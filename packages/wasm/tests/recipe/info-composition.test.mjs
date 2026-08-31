import assert from "node:assert/strict";
import { createMuhammaraWasm } from "../../index.js";
import { getRecipe } from "./recipe.mjs";

describe("Recipe byte metadata and composition", function () {
  it("queues rich comments, markup, replies, and rotated coordinates", async function () {
    var Recipe = await getRecipe();
    var bytes = new Recipe({ compress: false })
      .createPage(200, 300)
      .rotate(90)
      .comment("comment", "center", 20, {
        title: "author",
        subject: "subject",
        date: "2024-01-02T03:04:05Z",
        richText: true,
        open: true,
        flag: "locked",
        replies: [{ text: "reply", title: "reviewer" }],
      })
      .annot(20, 120, "Highlight", { width: 80, height: 12 })
      .annot(30, 180, "Square", { width: 40, height: 20, border: 2 })
      .endPage()
      .endPDF();
    var output = new TextDecoder().decode(bytes);
    assert.match(output, /\/RC \(/);
    assert.match(output, /\/IRT \d+ 0 R/);
    assert.match(output, /\/QuadPoints \[/);
    assert.match(output, /\/Subtype \/Square/);
  });

  it("keeps byte composition and metadata in memory", async function () {
    var Recipe = await getRecipe();
    var source = new Recipe({ compress: false })
      .createPage(100, 100)
      .endPage()
      .createPage(120, 100)
      .endPage()
      .endPDF();
    Recipe.registerPdf("composition-source", source);
    var recipe = new Recipe({ compress: false })
      .info({ author: "browser", title: "metadata", keywords: ["one", "two"] })
      .custom("custom", "value")
      .appendPage("composition-source", 1)
      .createPage(100, 100)
      .overlay("composition-source", { page: 2, fitWidth: true })
      .endPage()
      .insertPage(0, "composition-source", 2);
    assert.deepEqual(recipe.info(), {
      author: "browser",
      title: "metadata",
      keywords: ["one", "two"],
      custom: "value",
    });
    var bytes = recipe.endPDF();
    var reader = (await createMuhammaraWasm()).createReader(bytes);
    assert.equal(reader.getPagesCount(), 3);
    reader.end();
    assert.equal(recipe.split("part").length, 3);
    assert.deepEqual(recipe.structure("json"), {
      pages: 3,
      encrypted: false,
      objects: recipe.structure("json").objects,
    });
  });

  it("exposes permission bits and rejects unavailable encryption", async function () {
    var Recipe = await getRecipe();
    assert.equal(Recipe.permission("print, copy"), 20);
    assert.throws(() => new Recipe().encrypt(), /excludes OpenSSL/);
  });
});
