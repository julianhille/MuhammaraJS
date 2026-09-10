var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var muhammara = require("@muhammara/native-with-source");
var Recipe = muhammara.Recipe;

describe("Recipe info custom keys", function () {
  ["new", "existing"].forEach(function (mode) {
    function createRecipe(options) {
      var source =
        mode === "new"
          ? Buffer.from("new")
          : fs.readFileSync(
              path.join(__dirname, "../TestMaterials/recipe/blank.pdf"),
            );
      var recipe = new Recipe(source, undefined, options);
      if (mode === "new") recipe.createPage(100, 100).endPage();
      return recipe;
    }

    function readInfo(recipe) {
      var bytes = recipe.endPDF(function (output) {
        return output;
      });
      var reader = muhammara.createReader(
        new muhammara.PDFRStreamForBuffer(bytes),
      );
      try {
        var dictionary = reader
          .queryDictionaryObject(reader.getTrailer(), "Info")
          .toJSObject();
        return Object.fromEntries(
          Object.entries(dictionary).map(function ([key, value]) {
            return [key, value.toText ? value.toText() : value.value];
          }),
        );
      } finally {
        reader.end();
      }
    }

    it(`writes standard and custom Info entries in ${mode} PDFs`, function () {
      var recipe = createRecipe();
      assert.equal(
        recipe.info({
          author: "A",
          title: "Report",
          subject: "Metadata parity",
          keywords: ["one", "two"],
          ReportId: "X-123",
          "2.16.76.1.4.2.2.1": "oid-professional",
          Labels: ["one", "two"],
          Empty: "",
          Unicode: "Résumé 日本語",
        }),
        recipe,
      );
      recipe.info({ Extra: "another call" }).custom("Explicit", "X-123");
      var info = readInfo(recipe);
      assert.equal(info.Author, "A");
      assert.equal(info.Title, "Report");
      assert.equal(info.Subject, "Metadata parity");
      assert.deepEqual(info.Keywords.split(/,\s*/), ["one", "two"]);
      assert.equal(info.ReportId, "X-123");
      assert.equal(info.ReportId, info.Explicit);
      assert.equal(info["2.16.76.1.4.2.2.1"], "oid-professional");
      assert.equal(info.Labels, "one, two");
      assert.equal(info.Empty, "");
      assert.equal(info.Unicode, "Résumé 日本語");
      assert.equal(info.Extra, "another call");
      assert.equal(info.reportid, undefined);
    });

    it(`uses the last custom-key call in ${mode} PDFs`, function () {
      var recipe = createRecipe();
      recipe
        .info({ InfoThenCustom: "old", Repeated: "old" })
        .custom("InfoThenCustom", "new")
        .custom("CustomThenInfo", "old")
        .info({ CustomThenInfo: "new", Repeated: "new" });
      var info = readInfo(recipe);
      assert.equal(info.InfoThenCustom, "new");
      assert.equal(info.CustomThenInfo, "new");
      assert.equal(info.Repeated, "new");
    });

    it(`keeps constructor settings out of ${mode} PDF metadata`, function () {
      var info = readInfo(
        createRecipe({
          author: "Constructor author",
          version: 1.7,
          compress: false,
          ReportId: "not constructor metadata",
        }),
      );
      assert.equal(info.Author, "Constructor author");
      ["version", "compress", "ReportId"].forEach(function (key) {
        assert.equal(Object.hasOwn(info, key), false);
      });
    });
  });
});
