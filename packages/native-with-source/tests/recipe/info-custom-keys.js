var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var muhammara = require("@muhammara/native-with-source");
var { writeOutput } = require("../helpers/testOutput");
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

    /**
     * Finishes the Recipe, writes it to tests/output, and reads its Info.
     * @param {Recipe} recipe The Recipe to finish.
     * @param {string} name Output name suffix for this case.
     * @returns {Object<string, *>} The Info dictionary entries.
     */
    function readInfo(recipe, name) {
      var bytes = recipe.endPDF(function (output) {
        return output;
      });
      writeOutput(`info-custom-keys-${mode}-${name}`, bytes);
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
          creator: "lower-case custom",
        }),
        recipe,
      );
      recipe
        .info({ Extra: "another call" })
        .custom("Explicit", "X-123")
        .custom("Listed", ["one", "two"]);
      var info = readInfo(recipe, "standard-and-custom");
      assert.equal(info.Author, "A");
      assert.equal(info.Title, "Report");
      assert.equal(info.Subject, "Metadata parity");
      assert.equal(info.Keywords, "one, two");
      assert.equal(info.ReportId, "X-123");
      assert.equal(info.ReportId, info.Explicit);
      assert.equal(info["2.16.76.1.4.2.2.1"], "oid-professional");
      assert.equal(info.Labels, "one, two");
      assert.equal(info.Empty, "");
      assert.equal(info.Unicode, "Résumé 日本語");
      assert.equal(info.creator, "lower-case custom");
      assert.match(info.Creator, /^Muhammara-Recipe/);
      assert.equal(info.Extra, "another call");
      assert.equal(info.Listed, "one, two");
      assert.equal(info.reportid, undefined);
    });

    it(`uses the last custom-key call in ${mode} PDFs`, function () {
      var recipe = createRecipe();
      recipe
        .info({ InfoThenCustom: "old", Repeated: "old" })
        .custom("InfoThenCustom", "new")
        .custom("CustomThenInfo", "old")
        .info({ CustomThenInfo: "new", Repeated: "new" });
      var info = readInfo(recipe, "last-call-wins");
      assert.equal(info.InfoThenCustom, "new");
      assert.equal(info.CustomThenInfo, "new");
      assert.equal(info.Repeated, "new");
    });

    it(`keeps custom entries with annotations in ${mode} PDFs`, function () {
      var recipe = createRecipe();
      (mode === "new" ? recipe.createPage(100, 100) : recipe.editPage(1))
        .comment("A comment", 10, 10)
        .endPage();
      recipe.info({ ReportId: "X-1" }).custom("Dept", "Y");
      var info = readInfo(recipe, "annotations");
      assert.equal(info.ReportId, "X-1");
      assert.equal(info.Dept, "Y");
    });

    it(`reads the values set on ${mode} PDFs`, function () {
      var recipe = createRecipe({ author: "Constructor author" });
      recipe.info({ title: "N", Custom: ["a", "b"] });
      var info = recipe.info();
      assert.equal(info.author, "Constructor author");
      assert.equal(info.title, "N");
      assert.equal(info.Custom, "a, b");
      recipe.endPDF();
    });

    it(`leaves out values that are null in ${mode} PDFs`, function () {
      var recipe = createRecipe();
      assert.throws(() => recipe.custom("A", null), TypeError);
      assert.throws(() => recipe.custom(undefined, "B"), TypeError);
      recipe.info({ title: null, Custom: null, Kept: "k" });
      var info = readInfo(recipe, "null-values");
      assert.equal(info.Custom, undefined);
      assert.equal(info.Kept, "k");
      assert.notEqual(info.Title, "null");
    });

    it(`keeps constructor settings out of ${mode} PDF metadata`, function () {
      var info = readInfo(
        createRecipe({
          author: "Constructor author",
          version: 1.7,
          compress: false,
          ReportId: "not constructor metadata",
        }),
        "constructor-settings",
      );
      assert.equal(info.Author, "Constructor author");
      ["version", "compress", "ReportId"].forEach(function (key) {
        assert.equal(Object.hasOwn(info, key), false);
      });
    });
  });

  describe("when a PDF is edited", function () {
    var source;

    /**
     * Edits the PDF bytes with a Recipe and reads the Info dictionary.
     * @param {Buffer} bytes The PDF to edit.
     * @param {function(Recipe): void} [edit] Changes to make on the Recipe.
     * @returns {{bytes: Buffer, info: Object<string, string>}} The result.
     */
    function edit(bytes, edit) {
      var recipe = new Recipe(bytes);
      if (edit) edit(recipe);
      var out = recipe.endPDF(function (output) {
        return output;
      });
      var reader = muhammara.createReader(
        new muhammara.PDFRStreamForBuffer(out),
      );
      try {
        var dictionary = reader
          .queryDictionaryObject(reader.getTrailer(), "Info")
          .toJSObject();
        return {
          bytes: out,
          info: Object.fromEntries(
            Object.entries(dictionary).map(function ([key, value]) {
              return [key, value.toText ? value.toText() : value.value];
            }),
          ),
        };
      } finally {
        reader.end();
      }
    }

    before(function () {
      var recipe = new Recipe(Buffer.from("new"));
      recipe.createPage(100, 100).endPage();
      recipe.info({
        title: "TT",
        ReportId: "X-1",
        "Mixed Case": "y",
        "2.16.76.1.4.2.2.1": "oid",
        Empty: "",
        Hex: "abcd",
      });
      source = recipe.endPDF(function (output) {
        return output;
      });
    });

    it("keeps custom entries in their own spelling", function () {
      var info = edit(source).info;
      assert.equal(info.ReportId, "X-1");
      assert.equal(info["Mixed Case"], "y");
      assert.equal(info["2.16.76.1.4.2.2.1"], "oid");
      assert.equal(info.Empty, "");
      assert.equal(info.Title, "TT");
      assert.equal(info.reportid, undefined);
    });

    it("keeps standard and custom entries written as hex strings", function () {
      // the same length, so the cross-reference offsets stay valid
      var info = edit(
        Buffer.from(
          Buffer.from(source)
            .toString("latin1")
            .replace("(abcd)", "<6162>")
            .replace("(TT)", "<54>"),
          "latin1",
        ),
      ).info;
      assert.equal(info.Hex, "ab");
      assert.equal(info.Title, "T");
    });

    it("keeps them over several edits", function () {
      var info = edit(edit(edit(source).bytes).bytes).info;
      assert.equal(info.ReportId, "X-1");
      assert.equal(info["Mixed Case"], "y");
    });

    it("lets the edit replace a value", function () {
      var info = edit(source, function (recipe) {
        recipe.info({ ReportId: "NEW" }).custom("Mixed Case", "z");
      }).info;
      assert.equal(info.ReportId, "NEW");
      assert.equal(info["Mixed Case"], "z");
    });

    it("lets the edit set an empty value", function () {
      var info = edit(source, function (recipe) {
        recipe.custom("ReportId", "");
      }).info;
      assert.equal(info.ReportId, "");
    });

    it("sets the field for the Info name of a standard field", function () {
      var info = edit(source, function (recipe) {
        recipe.info({ Title: "New" }).custom("Author", "A");
      }).info;
      assert.equal(info.Title, "New");
      assert.equal(info.Author, "A");
      var lower = edit(source, function (recipe) {
        recipe.custom("title", "Lower");
      }).info;
      assert.equal(lower.Title, "Lower");
      assert.equal(lower.title, undefined);
      var recipe = new Recipe(source);
      ["Creator", "Producer", "CreationDate", "ModDate", "Trapped"].forEach(
        (key) =>
          assert.throws(() => recipe.custom(key, "x"), {
            name: "TypeError",
            message: `Recipe writes the ${key} Info entry itself`,
          }),
      );
      recipe.endPDF();
    });

    it('clears a field set to an empty array, not one set to ""', function () {
      var cleared = edit(source, function (recipe) {
        recipe.info({ title: [] });
      }).info;
      assert.equal(cleared.Title, undefined);
      var kept = edit(source, function (recipe) {
        recipe.info({ title: "" });
        assert.equal(recipe.info().title, "TT");
      }).info;
      assert.equal(kept.Title, "TT");
    });

    it("reads a source whose Info refers to itself", function () {
      var info = edit(
        fs.readFileSync(
          path.join(__dirname, "../TestMaterials/recipe/info-cycle.pdf"),
        ),
      ).info;
      assert.equal(info.Title, "Cycle");
    });

    it("lets low-level changes to the Info dictionary stick", function () {
      var info = edit(source, function (recipe) {
        var dictionary = recipe.writer.getDocumentContext().getInfoDictionary();
        dictionary.removeAdditionalInfoEntry("ReportId");
        dictionary.addAdditionalInfoEntry("Mixed Case", "low-level");
        dictionary.title = "Low title";
        // also through the annotation pass of native
        recipe.editPage(1).comment("note", 10, 10).endPage();
      }).info;
      assert.equal(info.ReportId, undefined);
      assert.equal(info["Mixed Case"], "low-level");
      assert.equal(info.Title, "Low title");
      assert.equal(info["2.16.76.1.4.2.2.1"], "oid");
    });

    it("keeps keys named like Object members", function () {
      var first = edit(source, function (recipe) {
        recipe.info({ constructor: "c", toString: "t" });
      });
      assert.equal(first.info.constructor, "c");
      assert.equal(first.info.toString, "t");
      var again = edit(first.bytes).info;
      assert.equal(again.constructor, "c");
      assert.equal(again.toString, "t");
    });

    it("rejects a key Recipe owns before setting any", function () {
      var recipe = new Recipe(source);
      ["", "source-Creator", "source-Producer", "source-ModDate"].forEach(
        (key) =>
          assert.throws(() => recipe.info({ Fresh: "x", [key]: "y" }), {
            name: "TypeError",
          }),
      );
      assert.equal(recipe.info().Fresh, undefined);
      assert.deepEqual(recipe.info(null), recipe.info());
      recipe.endPDF();
    });

    it("reports the fields over custom entries of the same name", function () {
      var recipe = new Recipe(
        fs.readFileSync(
          path.join(__dirname, "../TestMaterials/recipe/info-mixed.pdf"),
        ),
      );
      var info = recipe.info();
      recipe.endPDF();
      assert.equal(info.title, "Indirect title");
      assert.equal(info.creator, "OldTool");
      assert.equal(info.Ref, "Indirect title");
    });

    it("keeps indirect entries and custom entries named like Recipe's own", function () {
      var first = edit(
        fs.readFileSync(
          path.join(__dirname, "../TestMaterials/recipe/info-mixed.pdf"),
        ),
      );
      var info = first.info;
      assert.equal(info.Title, "Indirect title");
      assert.equal(info.Ref, "Indirect title");
      assert.equal(info.title, "lower");
      assert.equal(info.creator, "MyApp");
      assert.equal(info.modDate, "m");
      assert.equal(info.trapped, "x");
      assert.equal(info["source-Creator"], "OldTool");
      assert.equal(info["source-Producer"], "OldProducer");
      assert.match(info.Creator, /^Muhammara-Recipe/);
      // a second edit records the provenance of the first
      var again = edit(first.bytes).info;
      assert.match(again["source-Creator"], /^Muhammara-Recipe/);
      assert.match(again["source-Producer"], /^MuhammaraJS/);
      assert.equal(again.creator, "MyApp");
    });

    it("reads an empty Info of a source without one after endPDF", function () {
      var stream = new muhammara.PDFWStreamForBuffer();
      var writer = muhammara.createWriter(stream);
      writer.writePage(writer.createPage(0, 0, 100, 100));
      writer.end();
      var recipe = new Recipe(stream.buffer);
      recipe.endPDF();
      assert.deepEqual(recipe.info(), {});
    });

    it("reads names in their own spelling and the values set", function () {
      var recipe = new Recipe(source);
      recipe.info({ title: "U", keywords: ["a", "b"], Added: 1 });
      var info = recipe.info();
      assert.equal(info.ReportId, "X-1");
      assert.equal(info["Mixed Case"], "y");
      assert.equal(info.reportid, undefined);
      assert.equal(info.title, "U");
      assert.equal(info.keywords, "a, b");
      assert.equal(info.Added, "1");
      // a copy
      info.title = "Changed";
      assert.equal(recipe.info().title, "U");
      recipe.endPDF();
      assert.equal(recipe.info().title, "U");
      assert.throws(() => recipe.info({ title: "V" }), {
        message: "PDF writer has ended",
      });
      assert.throws(() => recipe.custom("A", "B"), {
        message: "PDF writer has ended",
      });
    });
  });
});
