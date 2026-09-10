import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createMuhammaraWasm, createRecipe } from "../../index.js";

describe("Recipe info custom keys", function () {
  var muhammara;
  var Recipe;

  before(async function () {
    muhammara = await createMuhammaraWasm();
    Recipe = await createRecipe();
  });

  ["new", "existing"].forEach(function (mode) {
    function makeRecipe(options = {}) {
      var recipe =
        mode === "new"
          ? new Recipe(options)
          : new Recipe(
              readFileSync(
                new URL(
                  "../../../native-with-source/tests/TestMaterials/recipe/blank.pdf",
                  import.meta.url,
                ),
              ),
              options,
            );
      if (mode === "new") recipe.createPage(100, 100).endPage();
      return recipe;
    }

    function readInfo(recipe) {
      var reader = muhammara.createReader(recipe.endPDF());
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
      var recipe = makeRecipe();
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
      var recipe = makeRecipe();
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
        makeRecipe({
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
