var fs = require("fs");
var path = require("path");
var assert = require("chai").assert;
var muhammara = require("@muhammara/native-with-source");
var Recipe = muhammara.Recipe;

/**
 * @param {string} name - The fixture name without extension.
 * @returns {string} The path of a form fixture in TestMaterials/recipe.
 */
function fixture(name) {
  return path.join(__dirname, "../TestMaterials/recipe/" + name + ".pdf");
}

/**
 * Fill a fixture and write it to tests/output.
 * @param {string} name - The fixture name without extension.
 * @param {string} outputName - The output name, unique per test.
 * @param {Object} values - The fillForm() values.
 * @param {Object} [options] - The fillForm() options.
 * @param {function(Recipe): void} [prepare] - Edits made before filling.
 * @returns {string} The output path.
 */
function fill(name, outputName, values, options, prepare) {
  var output = path.join(
    __dirname,
    "../output/fillForm " + outputName + ".pdf",
  );
  var recipe = new Recipe(fixture(name), output);
  if (prepare) prepare(recipe);
  recipe.fillForm(values, options).endPDF();
  return output;
}

/**
 * @param {string} file - A PDF path.
 * @returns {Object<string, *>} The field values by name.
 */
function valuesOf(file) {
  return Object.fromEntries(
    new Recipe(file).formFields().map((field) => [field.name, field.value]),
  );
}

/**
 * @param {string} file - A PDF path.
 * @returns {Object} A reader of the PDF.
 */
function readerOf(file) {
  return muhammara.createReader(file);
}

/**
 * @param {Object} reader - A PDF reader.
 * @param {number} objectID - A widget object ID.
 * @returns {{state: string|null, normal: Object|null}} The widget's `/AS`
 *   and normal appearance.
 */
function appearanceOf(reader, objectID) {
  var widget = reader.parseNewObject(objectID);
  var state = widget.toJSObject().AS;
  var ap = reader.queryDictionaryObject(widget, "AP");
  return {
    state: state ? state.value : null,
    normal: ap ? ap.toJSObject().N : null,
  };
}

/**
 * @param {Object} reader - A PDF reader.
 * @param {number} objectID - A stream object ID.
 * @returns {string} The decoded stream content.
 */
function streamText(reader, objectID) {
  var stream = reader.startReadingFromStream(
    reader.parseNewObject(objectID).toPDFStream(),
  );
  var bytes = [];
  while (stream.notEnded()) bytes.push(...stream.read(4096));
  return Buffer.from(bytes).toString("latin1");
}

/**
 * @param {Object} reader - A PDF reader.
 * @param {string} key - An `/AcroForm` key.
 * @returns {Object|undefined} The value of the key in the AcroForm.
 */
function acroFormEntry(reader, key) {
  var catalog = reader.queryDictionaryObject(reader.getTrailer(), "Root");
  var acroForm = reader.queryDictionaryObject(catalog, "AcroForm");
  return reader.queryDictionaryObject(acroForm, key);
}

/**
 * @param {Object} reader - A PDF reader.
 * @returns {boolean|null} `/NeedAppearances` of the AcroForm, or null.
 */
function needAppearances(reader) {
  var value = acroFormEntry(reader, "NeedAppearances");
  return value ? value.value : null;
}

describe("fillForm", function () {
  it("fills each kind of field of AcroFormPdfLib", function () {
    var output = fill("AcroFormPdfLib", "pdf-lib", {
      // Outside ASCII, so written as a Unicode text string.
      "person.name": "Jürgen Œuvre €",
      notes: "First line\nSecond line",
      agree: false,
      color: "blue",
      country: "Spain",
      // A repeated option is selected once.
      langs: ["Rust", "C", "C"],
    });
    assert.deepEqual(valuesOf(output), {
      "person.name": "Jürgen Œuvre €",
      notes: "First line\nSecond line",
      agree: "Off",
      color: "2",
      country: "Spain",
      langs: ["C", "Rust"],
      submit: null,
    });
    var reader = readerOf(output);
    assert.deepEqual(
      [17, 23, 28, 33].map((id) => appearanceOf(reader, id).state),
      ["Off", "Off", "Off", "2"],
    );
    var langs = reader.parseNewObject(41).toJSObject().I.toJSArray();
    assert.deepEqual(
      langs.map((index) => index.value),
      [0, 2],
    );
    // The field's /DA is left as it is.
    var da = (pdf) => pdf.parseNewObject(9).toJSObject().DA.toText();
    assert.equal(da(reader), da(readerOf(fixture("AcroFormPdfLib"))));
  });

  it("fills AcroFormLibreOffice by on-state, label and export value", function () {
    var output = fill("AcroFormLibreOffice", "LibreOffice", {
      city: "Genève",
      newsletter: true,
      size: "small",
      fruit: "Apple",
      pets: ["Dog", "Fish"],
      comment: "One\nTwo",
    });
    assert.deepEqual(valuesOf(output), {
      city: "Genève",
      newsletter: "subscribed",
      size: "small",
      fruit: "Apple",
      pets: ["Dog", "Fish"],
      comment: "One\nTwo",
    });
    var reader = readerOf(output);
    assert.deepEqual(
      [7, 8, 10].map((id) => appearanceOf(reader, id).state),
      ["subscribed", "small", "Off"],
    );
  });

  it("picks a radio by its /Opt label and a choice by its display text", function () {
    var output = fill("AcroFormPdfLib", "labels", { color: "green" });
    assert.equal(valuesOf(output).color, "1");
    // /I and /TI count the /Opt entries formFields() skips.
    var reader = readerOf(fill("AcroFormFillCases", "opt", { skips: "b" }));
    var selected = reader.queryDictionaryObject(reader.parseNewObject(23), "I");
    assert.deepEqual(
      selected.toJSArray().map((index) => index.value),
      [2],
    );
    var content = streamText(
      reader,
      appearanceOf(reader, 23).normal.getObjectID(),
    );
    assert.deepEqual(content.match(/\((\w*)\) ?Tj/g), ["(b) Tj"]);
    // The selected option is highlighted.
    assert.match(content, /^0\.6 0\.75 0\.86 rg\r?$/m);
  });

  it("takes free text in an editable combo box and a number in a text field", function () {
    var values = valuesOf(
      fill("AcroFormLibreOffice", "editable", { fruit: "Kiwi", city: 12.5 }),
    );
    assert.equal(values.fruit, "Kiwi");
    assert.strictEqual(values.city, "12.5");
  });

  it("draws a new appearance stream for each changed text and choice widget", function () {
    var source = readerOf(fixture("AcroFormPdfLib"));
    var output = fill("AcroFormPdfLib", "appearances", {
      "person.name": "Ada",
      country: "Spain",
    });
    var reader = readerOf(output);
    [10, 39].forEach((id) => {
      var normal = appearanceOf(reader, id).normal;
      assert.notEqual(
        normal.getObjectID(),
        appearanceOf(source, id).normal.getObjectID(),
      );
      var content = streamText(reader, normal.getObjectID());
      assert.match(content, /^\/Tx BMC\r?$/m);
      assert.match(content, / Tf\r?$/m);
      assert.match(content, /^EMC\r?$/m);
    });
    // The untouched notes widget keeps its appearance.
    assert.equal(
      appearanceOf(reader, 14).normal.getObjectID(),
      appearanceOf(source, 14).normal.getObjectID(),
    );
    assert.equal(needAppearances(reader), null);
    // The font option draws with that font.
    output = fill(
      "AcroFormPdfLib",
      "arial",
      { "person.name": "Ada" },
      { font: "arial" },
      (recipe) =>
        recipe.registerFont(
          "arial",
          path.join(__dirname, "../TestMaterials/fonts/arial.ttf"),
        ),
    );
    assert.match(
      fs.readFileSync(output, "latin1"),
      /\/BaseFont \/\w+\+ArialMT/,
    );
  });

  it("draws every widget of a field shown on several pages", function () {
    var output = fill("AcroFormEdgeCases", "several widgets", {
      "address.street": "Elm St",
      // /MaxLen counts characters, not UTF-16 units.
      "address.zip": "\u{1F600}".repeat(5),
    });
    assert.equal(valuesOf(output)["address.zip"], "\u{1F600}".repeat(5));
    var reader = readerOf(output);
    [10, 12].forEach((id) =>
      assert.match(
        streamText(reader, appearanceOf(reader, id).normal.getObjectID()),
        /^\/Tx BMC\r?$/m,
      ),
    );
  });

  it("draws a check mark for a checkbox without appearances, not a radio", function () {
    var output = fill("AcroFormFillCases", "bare checkbox", { bare: true });
    assert.equal(valuesOf(output).bare, "Yes");
    var reader = readerOf(output);
    var { state, normal } = appearanceOf(reader, 7);
    assert.equal(state, "Yes");
    var states = normal.toJSObject();
    assert.deepEqual(Object.keys(states).sort(), ["Off", "Yes"]);
    assert.match(streamText(reader, states.Yes.getObjectID()), / l\r?\nS\r?\n/);
    // Any state name, escaped in the name and the appearance key.
    reader = readerOf(
      fill("AcroFormFillCases", "bare state", { bare: "Ja bitte" }),
    );
    assert.equal(appearanceOf(reader, 7).state, "Ja bitte");
    assert.deepEqual(
      Object.keys(appearanceOf(reader, 7).normal.toJSObject()).sort(),
      ["Ja bitte", "Off"],
    );
    // A state the caller gives may hold U+FFFD; only lossy source names fail.
    reader = readerOf(
      fill("AcroFormFillCases", "bare replacement", { bare: "A\uFFFD" }),
    );
    assert.equal(appearanceOf(reader, 7).state, "A\uFFFD");
    reader = readerOf(
      fill("AcroFormFillCases", "radio widgets", { pick: "a" }),
    );
    assert.deepEqual(
      [16, 17].map((id) => appearanceOf(reader, id).state),
      ["a", "Off"],
    );
    assert.equal(appearanceOf(reader, 17).normal, null);
  });

  it("fills fields that share a name by id, and rejects the name", function () {
    var output = fill("AcroFormFillCases", "ids", { 5: "one", 6: "two" });
    var fields = new Recipe(output).formFields();
    assert.deepEqual(
      fields
        .filter((field) => field.name === "dup")
        .map((field) => [field.id, field.value]),
      [
        [5, "one"],
        [6, "two"],
      ],
    );
    assert.throws(
      () => new Recipe(fixture("AcroFormFillCases")).fillForm({ dup: "x" }),
      'Form field name "dup" is ambiguous; fill it by one of its ids: 5, 6',
    );
  });

  it("draws rotated, comb, password, widget-styled and hidden text fields", function () {
    var output = fill("AcroFormFillCases", "text layouts", {
      rotated: "Turned",
      code: "AB12",
      pin: "secret",
      styled: "Big",
      hidden: "x",
      short: "x",
    });
    var reader = readerOf(output);
    var values = valuesOf(output);
    var content = (id) =>
      streamText(reader, appearanceOf(reader, id).normal.getObjectID());
    assert.match(content(8), /^0 1 -1 0 30 0 cm\r?$/m);
    assert.match(content(8), /^0 0 1 rg\r?$/m);
    // One text position per comb cell.
    assert.lengthOf(content(9).match(/ Td\r?$/gm), 4);
    assert.notInclude(content(10), "secret");
    assert.equal(values.pin, "secret");
    // The widget's own /DA and /Q: 20pt red, right-aligned.
    assert.match(content(14), /^1 0 0 rg\r?$/m);
    assert.match(content(14), / 20 Tf\r?$/m);
    assert.isAbove(Number(content(14).match(/^([\d.]+) [\d.]+ Td/m)[1]), 20);
    assert.equal(values.hidden, "x");
    // A /Rect without four numbers gets no appearance.
    assert.equal(appearanceOf(reader, 22).normal, null);
  });

  it("clears fields filled with null", function () {
    var output = fill("AcroFormPdfLib", "cleared", {
      "person.name": null,
      agree: null,
      country: null,
      langs: null,
    });
    var values = valuesOf(output);
    assert.equal(values["person.name"], "");
    assert.equal(values.agree, "Off");
    assert.isNull(values.country);
    assert.isNull(values.langs);
    assert.isUndefined(readerOf(output).parseNewObject(41).toJSObject().I);
  });

  it("merges the values of several fillForm() calls", function () {
    var output = path.join(__dirname, "../output/fillForm merged.pdf");
    new Recipe(fixture("AcroFormPdfLib"), output)
      .fillForm({ "person.name": "First", notes: "Kept" })
      .fillForm({ "person.name": "Second" })
      .endPDF();
    var values = valuesOf(output);
    assert.equal(values["person.name"], "Second");
    assert.equal(values.notes, "Kept");
  });

  it("lets the viewer draw the appearances", function () {
    [
      ["AcroFormPdfLib", { "person.name": "Viewer" }, 10],
      // Its /AcroForm has generation 1.
      ["AcroFormFillCases", { code: "AB" }, 9],
    ].forEach(([name, values, widgetID]) => {
      var source = readerOf(fixture(name));
      var output = fill(name, "viewer " + name, values, {
        appearances: Recipe.FormAppearances.VIEWER,
      });
      var reader = readerOf(output);
      assert.equal(needAppearances(reader), true);
      var [fieldName, fieldValue] = Object.entries(values)[0];
      assert.equal(valuesOf(output)[fieldName], fieldValue);
      var before = appearanceOf(source, widgetID).normal;
      var after = appearanceOf(reader, widgetID).normal;
      assert.equal(after?.getObjectID(), before?.getObjectID());
    });
  });

  it("removes the XFA of a hybrid form", function () {
    assert.exists(acroFormEntry(readerOf(fixture("AcroFormFillCases")), "XFA"));
    var output = fill("AcroFormFillCases", "xfa", { code: "AB" });
    assert.notExists(acroFormEntry(readerOf(output), "XFA"));
    assert.equal(valuesOf(output).code, "AB");
  });

  it("fills the fields left when pages are deleted", function () {
    var output = fill(
      "AcroFormPdfLib",
      "deleted page",
      { "person.name": "Kept", color: "blue", langs: "JS" },
      undefined,
      (recipe) => recipe.deletePage(2, { pruneReferences: true }),
    );
    var values = valuesOf(output);
    assert.equal(values["person.name"], "Kept");
    assert.equal(values.color, "2");
    assert.strictEqual(values.langs, "JS");
    var reader = readerOf(
      fill("AcroFormFillCases", "pruned", { jump: true }, undefined, (recipe) =>
        recipe.deletePage(2, { pruneReferences: true }),
      ),
    );
    assert.equal(appearanceOf(reader, 20).state, "Yes");
    var action = reader.queryDictionaryObject(reader.parseNewObject(20), "A");
    assert.notExists(reader.queryDictionaryObject(action, "D"));
  });

  it("fills a form on a page that gets annotations", function () {
    var output = fill(
      "AcroFormPdfLib",
      "annotated",
      { "person.name": "Annotated" },
      undefined,
      (recipe) =>
        recipe.editPage(1).annot(50, 50, "Text", { text: "Note" }).endPage(),
    );
    assert.equal(valuesOf(output)["person.name"], "Annotated");
    var reader = readerOf(output);
    var annots = reader
      .queryDictionaryObject(reader.parsePageDictionary(0), "Annots")
      .toPDFArray()
      .toJSArray();
    assert.include(
      annots.map((reference) => reference.getObjectID()),
      10,
    );
    assert.lengthOf(annots, 6);
  });

  it("rejects values a field does not take", function () {
    var recipe = new Recipe(fixture("AcroFormPdfLib"));
    [
      [{ missing: "x" }, 'No form field "missing"'],
      [
        { "person.name": {} },
        'Form field "person.name" takes text or a finite number, not object',
      ],
      [
        { "person.name": NaN },
        'Form field "person.name" takes text or a finite number, not NaN',
      ],
      [
        { "person.name": "a\nb" },
        'Form field "person.name" is a single line; remove the line breaks',
      ],
      [
        { agree: "Maybe" },
        'Form field "agree" has no state "Maybe"; use one of: Yes',
      ],
      [{ color: true }, 'Form field "color" takes the name of an on-state'],
      [
        { color: "purple" },
        'Form field "color" has no state "purple"; use one of: 0, 1, 2',
      ],
      [
        { country: "Italy" },
        'Form field "country" has no option "Italy"; use one of: Germany, France, Spain',
      ],
      [
        { langs: ["C", "Go"] },
        'Form field "langs" has no option "Go"; use one of: C, JS, Rust',
      ],
      [
        { submit: "x" },
        'Form field "submit" is a pushbutton field, which fillForm() cannot fill',
      ],
    ].forEach(([values, message]) =>
      assert.throws(() => recipe.fillForm(values), message),
    );
    var fillCases = new Recipe(fixture("AcroFormFillCases"));
    [
      [
        { multi: true },
        'Form field "multi" has several on-states (a, b); fill it with one of them',
      ],
      [
        { skips: ["a", "b"] },
        'Form field "skips" takes one option, not several',
      ],
      [
        { lossy: true },
        'Form field "lossy" has a state name that is not UTF-8',
      ],
    ].forEach(([values, message]) =>
      assert.throws(() => fillCases.fillForm(values), message),
    );
    var edgeCases = new Recipe(fixture("AcroFormEdgeCases"));
    [
      [
        { "address.zip": "123456" },
        'Form field "address.zip" takes at most 5 characters',
      ],
      [{ choice: null }, 'Form field "choice" cannot be turned off'],
      [{ choice: "Off" }, 'Form field "choice" cannot be turned off'],
      [
        { sig: "x" },
        'Form field "sig" is a signature field, which fillForm() cannot fill',
      ],
      [
        { mystery: "x" },
        'Form field "mystery" is a field of an unknown type, which fillForm() cannot fill',
      ],
    ].forEach(([values, message]) =>
      assert.throws(() => edgeCases.fillForm(values), message),
    );
  });

  it("rejects invalid arguments", function () {
    var recipe = new Recipe(fixture("AcroFormPdfLib"));
    assert.throws(() => recipe.fillForm(null), TypeError);
    assert.throws(() => recipe.fillForm([]), TypeError);
    assert.throws(
      () => recipe.fillForm({}, { appearances: "auto" }),
      TypeError,
      "fillForm appearances must be one of: generate, viewer",
    );
    assert.throws(() => recipe.fillForm({}, { font: 1 }), TypeError);
  });

  it("cannot be combined with insertPage()", function () {
    var message = "insertPage() cannot be combined with fillForm()";
    var recipe = new Recipe(fixture("AcroFormPdfLib")).fillForm({
      agree: true,
    });
    assert.throws(
      () => recipe.insertPage(1, fixture("AcroFormPdfLib"), 1),
      message,
    );
    recipe = new Recipe(fixture("AcroFormPdfLib")).insertPage(
      1,
      fixture("AcroFormPdfLib"),
      1,
    );
    assert.throws(() => recipe.fillForm({ agree: true }), message);
  });

  it("does not fill a new document, an ended Recipe or a protected source", function () {
    assert.throws(
      () =>
        new Recipe(
          "new",
          path.join(__dirname, "../output/fillForm new.pdf"),
        ).fillForm({}),
      "fillForm() needs a source PDF with a form",
    );
    var ended = new Recipe(
      fixture("AcroFormPdfLib"),
      path.join(__dirname, "../output/fillForm ended.pdf"),
    );
    ended.endPDF();
    assert.throws(() => ended.fillForm({}), "Cannot fill a form after endPDF");
    assert.throws(
      () =>
        new Recipe(
          fixture("AcroFormEncrypted"),
          path.join(__dirname, "../output/fillForm encrypted.pdf"),
          { password: "user" },
        ).fillForm({ "person.name": "x" }),
      "Editing a password-protected source is unsupported; decrypt it with recrypt() first",
    );
  });

  it("does not rewrite objects with a nonzero generation or keys that are not UTF-8", function () {
    var recipe = new Recipe(fixture("AcroFormFillCases"));
    // A nonzero generation, then a lossy key in a merged field and widget, a
    // parent field and a kid widget.
    ["old", "keys", "lossyParent", "lossyKid"].forEach((name) =>
      assert.throws(
        () => recipe.fillForm({ [name]: "x" }),
        `Form field "${name}" cannot be rewritten: its field or widget object has a nonzero generation or a dictionary key that is not UTF-8`,
      ),
    );
  });
});
