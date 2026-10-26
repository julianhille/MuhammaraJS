import assert from "node:assert/strict";
import { describeEnds, writeOutput } from "../support/ends.mjs";
import { info } from "../support/pdf.mjs";

describeEnds("Recipe info custom keys", function (end) {
  ["new", "existing"].forEach(function (mode) {
    /**
     * A Recipe for a new PDF with one page, or for a blank source.
     * @param {object} [options] - The Recipe options.
     * @returns {object} The Recipe.
     */
    function makeRecipe(options = {}) {
      if (mode === "existing")
        return end.openRecipe("recipe/blank.pdf", options);
      return end.newRecipe(options).createPage(100, 100).endPage();
    }

    /**
     * Finish the Recipe, write it for manual review, and read its Info.
     * @param {object} recipe - The Recipe to finish.
     * @param {string} name - The output name suffix for this case.
     * @returns {Object<string, *>} The Info entries.
     */
    function readInfo(recipe, name) {
      var bytes = recipe.endPDF();
      writeOutput(end, `info-custom-keys-${mode}-${name}`, bytes);
      return info(end, bytes);
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
          creator: "lower-case custom",
        }),
        recipe,
      );
      recipe
        .info({ Extra: "another call" })
        .custom("Explicit", "X-123")
        .custom("Listed", ["one", "two"]);
      var entries = readInfo(recipe, "standard-and-custom");
      assert.equal(entries.Author, "A");
      assert.equal(entries.Title, "Report");
      assert.equal(entries.Subject, "Metadata parity");
      assert.equal(entries.Keywords, "one, two");
      assert.equal(entries.ReportId, "X-123");
      assert.equal(entries.ReportId, entries.Explicit);
      assert.equal(entries["2.16.76.1.4.2.2.1"], "oid-professional");
      assert.equal(entries.Labels, "one, two");
      assert.equal(entries.Empty, "");
      assert.equal(entries.Unicode, "Résumé 日本語");
      assert.equal(entries.creator, "lower-case custom");
      assert.match(entries.Creator, /^Muhammara-Recipe/);
      assert.equal(entries.Extra, "another call");
      assert.equal(entries.Listed, "one, two");
      assert.equal(entries.reportid, undefined);
    });

    it(`uses the last custom-key call in ${mode} PDFs`, function () {
      var recipe = makeRecipe();
      recipe
        .info({ InfoThenCustom: "old", Repeated: "old" })
        .custom("InfoThenCustom", "new")
        .custom("CustomThenInfo", "old")
        .info({ CustomThenInfo: "new", Repeated: "new" });
      var entries = readInfo(recipe, "last-call-wins");
      assert.equal(entries.InfoThenCustom, "new");
      assert.equal(entries.CustomThenInfo, "new");
      assert.equal(entries.Repeated, "new");
    });

    it(`keeps custom entries with annotations in ${mode} PDFs`, function () {
      var recipe = makeRecipe();
      (mode === "new" ? recipe.createPage(100, 100) : recipe.editPage(1))
        .comment("A comment", 10, 10)
        .endPage();
      recipe.info({ ReportId: "X-1" }).custom("Dept", "Y");
      var entries = readInfo(recipe, "annotations");
      assert.equal(entries.ReportId, "X-1");
      assert.equal(entries.Dept, "Y");
    });

    it(`reads the values set on ${mode} PDFs`, function () {
      var recipe = makeRecipe({ author: "Constructor author" });
      recipe.info({ title: "N", Custom: ["a", "b"] });
      var read = recipe.info();
      assert.equal(read.author, "Constructor author");
      assert.equal(read.title, "N");
      assert.equal(read.Custom, "a, b");
      recipe.endPDF();
    });

    it(`leaves out values that are null in ${mode} PDFs`, function () {
      var recipe = makeRecipe();
      assert.throws(() => recipe.custom("A", null), TypeError);
      assert.throws(() => recipe.custom(undefined, "B"), TypeError);
      recipe.info({ title: null, Custom: null, Kept: "k" });
      var entries = readInfo(recipe, "null-values");
      assert.equal(entries.Custom, undefined);
      assert.equal(entries.Kept, "k");
      assert.notEqual(entries.Title, "null");
    });

    it(`keeps constructor settings out of ${mode} PDF metadata`, function () {
      var entries = readInfo(
        makeRecipe({
          author: "Constructor author",
          version: 1.7,
          compress: false,
          ReportId: "not constructor metadata",
        }),
        "constructor-settings",
      );
      assert.equal(entries.Author, "Constructor author");
      ["version", "compress", "ReportId"].forEach(function (key) {
        assert.equal(Object.hasOwn(entries, key), false);
      });
    });
  });

  describe("when a PDF is edited", function () {
    var source;

    /**
     * Edit PDF bytes with a Recipe and read the Info dictionary.
     * @param {Uint8Array|string} bytes - The PDF to edit, or a fixture name.
     * @param {function(object): void} [change] - Changes to make on the Recipe.
     * @returns {{bytes: Uint8Array, info: Object<string, *>}} The result.
     */
    function edit(bytes, change) {
      var recipe = end.openRecipe(bytes);
      if (change) change(recipe);
      var out = recipe.endPDF();
      return { bytes: out, info: info(end, out) };
    }

    before(function () {
      source = end
        .newRecipe()
        .createPage(100, 100)
        .endPage()
        .info({
          title: "TT",
          ReportId: "X-1",
          "Mixed Case": "y",
          "2.16.76.1.4.2.2.1": "oid",
          Empty: "",
          Hex: "abcd",
        })
        .endPDF();
    });

    it("keeps custom entries in their own spelling", function () {
      var entries = edit(source).info;
      assert.equal(entries.ReportId, "X-1");
      assert.equal(entries["Mixed Case"], "y");
      assert.equal(entries["2.16.76.1.4.2.2.1"], "oid");
      assert.equal(entries.Empty, "");
      assert.equal(entries.Title, "TT");
      assert.equal(entries.reportid, undefined);
    });

    it("keeps standard and custom entries written as hex strings", function () {
      // the same length, so the cross-reference offsets stay valid
      var entries = edit(
        Buffer.from(
          Buffer.from(source)
            .toString("latin1")
            .replace("(abcd)", "<6162>")
            .replace("(TT)", "<54>"),
          "latin1",
        ),
      ).info;
      assert.equal(entries.Hex, "ab");
      assert.equal(entries.Title, "T");
    });

    it("keeps them over several edits", function () {
      var entries = edit(edit(edit(source).bytes).bytes).info;
      assert.equal(entries.ReportId, "X-1");
      assert.equal(entries["Mixed Case"], "y");
    });

    it("lets the edit replace a value", function () {
      var entries = edit(source, function (recipe) {
        recipe.info({ ReportId: "NEW" }).custom("Mixed Case", "z");
      }).info;
      assert.equal(entries.ReportId, "NEW");
      assert.equal(entries["Mixed Case"], "z");
    });

    it("lets the edit set an empty value", function () {
      var entries = edit(source, function (recipe) {
        recipe.custom("ReportId", "");
      }).info;
      assert.equal(entries.ReportId, "");
    });

    it("sets the field for the Info name of a standard field", function () {
      var entries = edit(source, function (recipe) {
        recipe.info({ Title: "New" }).custom("Author", "A");
      }).info;
      assert.equal(entries.Title, "New");
      assert.equal(entries.Author, "A");
      var lower = edit(source, function (recipe) {
        recipe.custom("title", "Lower");
      }).info;
      assert.equal(lower.Title, "Lower");
      assert.equal(lower.title, undefined);
      var recipe = end.openRecipe(source);
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
      assert.equal(edit("recipe/info-cycle.pdf").info.Title, "Cycle");
    });

    it("lets low-level changes to the Info dictionary stick", function () {
      var entries = edit(source, function (recipe) {
        var dictionary = recipe.writer.getDocumentContext().getInfoDictionary();
        dictionary.removeAdditionalInfoEntry("ReportId");
        dictionary.addAdditionalInfoEntry("Mixed Case", "low-level");
        dictionary.title = "Low title";
        // also through the annotation pass
        recipe.editPage(1).comment("note", 10, 10).endPage();
      }).info;
      assert.equal(entries.ReportId, undefined);
      assert.equal(entries["Mixed Case"], "low-level");
      assert.equal(entries.Title, "Low title");
      assert.equal(entries["2.16.76.1.4.2.2.1"], "oid");
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
      var recipe = end.openRecipe(source);
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
      var recipe = end.openRecipe("recipe/info-mixed.pdf");
      var read = recipe.info();
      recipe.endPDF();
      assert.equal(read.title, "Indirect title");
      assert.equal(read.creator, "OldTool");
      assert.equal(read.Ref, "Indirect title");
    });

    it("keeps indirect entries and custom entries named like Recipe's own", function () {
      var first = edit("recipe/info-mixed.pdf");
      var entries = first.info;
      assert.equal(entries.Title, "Indirect title");
      assert.equal(entries.Ref, "Indirect title");
      assert.equal(entries.title, "lower");
      assert.equal(entries.creator, "MyApp");
      assert.equal(entries.modDate, "m");
      assert.equal(entries.trapped, "x");
      assert.equal(entries["source-Creator"], "OldTool");
      assert.equal(entries["source-Producer"], "OldProducer");
      assert.match(entries.Creator, /^Muhammara-Recipe/);
      // a second edit records the provenance of the first
      var again = edit(first.bytes).info;
      assert.match(again["source-Creator"], /^Muhammara-Recipe/);
      assert.match(again["source-Producer"], /^MuhammaraJS/);
      assert.equal(again.creator, "MyApp");
    });

    it("reads an empty Info of a source without one after endPDF", function () {
      var recipe = end.openRecipe("BasicJPGImagesTest.PDF");
      assert.deepEqual(recipe.info(), {});
      recipe.endPDF();
      assert.deepEqual(recipe.info(), {});
    });

    it("reads names in their own spelling and the values set", function () {
      var recipe = end.openRecipe(source);
      recipe.info({ title: "U", keywords: ["a", "b"], Added: 1 });
      var read = recipe.info();
      assert.equal(read.ReportId, "X-1");
      assert.equal(read["Mixed Case"], "y");
      assert.equal(read.reportid, undefined);
      assert.equal(read.title, "U");
      assert.equal(read.keywords, "a, b");
      assert.equal(read.Added, "1");
      // a copy
      read.title = "Changed";
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
