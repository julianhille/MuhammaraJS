var path = require("path");
var assert = require("chai").assert;
var Recipe = require("@muhammara/native-with-source").Recipe;

// Expected fields per fixture, kept identical to the Wasm test.
var EXPECTED = {
  // Written by LibreOffice Writer: its checkbox /V is Yes, the on-state is
  // the export value.
  AcroFormLibreOffice: [
    {
      name: "city",
      kind: "text",
      value: "Zürich",
      defaultValue: "Zürich",
      flags: 0,
      maxLength: 30,
      options: [],
      widgets: [{ pageNumber: 1, rect: [30.349, 742.901, 168.151, 761.649] }],
    },
    {
      name: "newsletter",
      kind: "checkbox",
      value: "Yes",
      defaultValue: "Yes",
      flags: 0,
      maxLength: null,
      options: [{ value: "subscribed", label: "subscribed" }],
      widgets: [{ pageNumber: 1, rect: [29.149, 705.751, 37.201, 713.799] }],
    },
    {
      name: "size",
      kind: "radio",
      value: "large",
      defaultValue: "large",
      flags: 49152,
      maxLength: null,
      options: [
        { value: "small", label: "small" },
        { value: "large", label: "large" },
      ],
      widgets: [
        { pageNumber: 1, rect: [29.149, 663.201, 37.201, 671.249] },
        { pageNumber: 1, rect: [142.549, 663.201, 150.601, 671.249] },
      ],
    },
    {
      name: "fruit",
      kind: "combobox",
      value: "Pear",
      defaultValue: "Pear",
      flags: 393216,
      maxLength: null,
      options: [
        { value: "Apple", label: "Apple" },
        { value: "Pear", label: "Pear" },
      ],
      widgets: [{ pageNumber: 1, rect: [30.349, 615.351, 168.151, 634.099] }],
    },
    {
      name: "pets",
      kind: "listbox",
      value: ["Cat", "Fish"],
      defaultValue: ["Cat", "Fish"],
      flags: 2097152,
      maxLength: null,
      options: [
        { value: "Cat", label: "Cat" },
        { value: "Dog", label: "Dog" },
        { value: "Fish", label: "Fish" },
      ],
      widgets: [{ pageNumber: 1, rect: [30.349, 538.801, 168.151, 591.549] }],
    },
    {
      name: "comment",
      kind: "text",
      value: "Line one\r\nLine two",
      defaultValue: "Line one\r\nLine two",
      flags: 4096,
      maxLength: null,
      options: [],
      widgets: [{ pageNumber: 1, rect: [30.349, 467.951, 253.151, 520.699] }],
    },
  ],
  // Written by pdf-lib: the radio states are indices labelled by /Opt.
  AcroFormPdfLib: [
    {
      name: "person.name",
      kind: "text",
      value: "Ada Lovelace",
      defaultValue: null,
      flags: 0,
      maxLength: 40,
      options: [],
      widgets: [{ pageNumber: 1, rect: [19.5, 339.5, 220.5, 364.5] }],
    },
    {
      name: "notes",
      kind: "text",
      value: null,
      defaultValue: null,
      flags: 4098,
      maxLength: null,
      options: [],
      widgets: [{ pageNumber: 1, rect: [19.5, 259.5, 220.5, 320.5] }],
    },
    {
      name: "agree",
      kind: "checkbox",
      value: "Yes",
      defaultValue: null,
      flags: 0,
      maxLength: null,
      options: [{ value: "Yes", label: "Yes" }],
      widgets: [{ pageNumber: 1, rect: [19.5, 219.5, 36.5, 236.5] }],
    },
    {
      name: "color",
      kind: "radio",
      value: "1",
      defaultValue: null,
      flags: 32768,
      maxLength: null,
      options: [
        { value: "0", label: "red" },
        { value: "1", label: "green" },
        { value: "2", label: "blue" },
      ],
      widgets: [
        { pageNumber: 1, rect: [19.5, 179.5, 36.5, 196.5] },
        { pageNumber: 1, rect: [49.5, 179.5, 66.5, 196.5] },
        { pageNumber: 2, rect: [19.5, 179.5, 36.5, 196.5] },
      ],
    },
    {
      name: "country",
      kind: "combobox",
      value: "France",
      defaultValue: null,
      flags: 131072,
      maxLength: null,
      options: [
        { value: "Germany", label: "Germany" },
        { value: "France", label: "France" },
        { value: "Spain", label: "Spain" },
      ],
      widgets: [{ pageNumber: 2, rect: [19.5, 299.5, 140.5, 324.5] }],
    },
    {
      name: "langs",
      kind: "listbox",
      value: ["JS", "Rust"],
      defaultValue: null,
      flags: 2097152,
      maxLength: null,
      options: [
        { value: "C", label: "C" },
        { value: "JS", label: "JS" },
        { value: "Rust", label: "Rust" },
      ],
      widgets: [{ pageNumber: 2, rect: [19.5, 219.5, 140.5, 280.5] }],
    },
    {
      name: "submit",
      kind: "pushbutton",
      value: null,
      defaultValue: null,
      flags: 65536,
      maxLength: null,
      options: [],
      widgets: [{ pageNumber: 2, rect: [160, 300, 240, 324] }],
    },
  ],
  // Hand-written: inheritance (including /MaxLen), merged field and widget, a
  // field on two pages, non-Yes on-states, UTF-16 names, an orphan widget, a
  // signature, a field without /FT, with a fractional /Ff and a malformed
  // /Rect, /Opt and /V
  // entries without text, a dangling
  // /Fields entry, a kid that /Fields lists again, and a /Kids cycle that
  // yields no field.
  AcroFormEdgeCases: [
    {
      name: "address.street",
      kind: "text",
      value: "Main St",
      defaultValue: null,
      flags: 4096,
      maxLength: 40,
      options: [],
      widgets: [
        { pageNumber: 1, rect: [20, 350, 220, 370] },
        { pageNumber: 2, rect: [20, 50, 220, 70] },
      ],
    },
    {
      name: "address.zip",
      kind: "text",
      value: "12345",
      defaultValue: null,
      flags: 0,
      maxLength: 5,
      options: [],
      widgets: [{ pageNumber: 1, rect: [20, 300, 120, 320] }],
    },
    {
      name: "choice",
      kind: "radio",
      value: "Ja",
      defaultValue: null,
      flags: 49152,
      maxLength: null,
      options: [
        { value: "Ja", label: "Ja" },
        { value: "Nein", label: "Nein" },
      ],
      widgets: [
        { pageNumber: 1, rect: [20, 250, 36, 266] },
        { pageNumber: 1, rect: [50, 250, 66, 266] },
      ],
    },
    {
      name: "café",
      kind: "checkbox",
      value: "On",
      defaultValue: null,
      flags: 0,
      maxLength: null,
      options: [{ value: "On", label: "On" }],
      widgets: [{ pageNumber: null, rect: [20, 200, 36, 216] }],
    },
    {
      name: "tags",
      kind: "listbox",
      value: ["a", "bx"],
      defaultValue: "c",
      flags: 2097152,
      maxLength: null,
      options: [
        { value: "a", label: "a" },
        { value: "bx", label: "Bée" },
        { value: "c", label: "c" },
      ],
      widgets: [{ pageNumber: 2, rect: [20, 300, 120, 360] }],
    },
    {
      name: "sig",
      kind: "signature",
      value: null,
      defaultValue: null,
      flags: 0,
      maxLength: null,
      options: [],
      widgets: [{ pageNumber: 2, rect: [150, 50, 250, 90] }],
    },
    {
      name: "mystery",
      kind: null,
      value: "x",
      defaultValue: null,
      flags: 4096,
      maxLength: null,
      options: [],
      widgets: [{ pageNumber: null, rect: null }],
    },
  ],
};

/**
 * Open a form fixture from TestMaterials/recipe.
 * @param {string} name - The fixture name without extension.
 * @returns {Recipe} The Recipe editing the fixture.
 */
function openFixture(name) {
  return new Recipe(
    path.join(__dirname, "../TestMaterials/recipe/" + name + ".pdf"),
    path.join(__dirname, "../output/formFields " + name + ".pdf"),
  );
}

describe("formFields", function () {
  Object.keys(EXPECTED).forEach(function (name) {
    it("reads the fields of " + name, function () {
      assert.deepEqual(openFixture(name).formFields(), EXPECTED[name]);
    });
  });

  it("reads the fields of an encrypted source opened with its password", function () {
    // AcroFormPdfLib encrypted with AES-256, user password "user".
    var recipe = new Recipe(
      path.join(__dirname, "../TestMaterials/recipe/AcroFormEncrypted.pdf"),
      path.join(__dirname, "../output/formFields AcroFormEncrypted.pdf"),
      { password: "user" },
    );
    assert.deepEqual(recipe.formFields(), EXPECTED.AcroFormPdfLib);
  });

  it("reads a /Kids array shared by many fields once", function () {
    // 200 fields share one indirect /Kids array of 200 widgets; reading it
    // for every field would return 40000 widgets.
    var fields = openFixture("AcroFormSharedKids").formFields();
    assert.equal(fields.length, 200);
    assert.equal(
      fields.reduce((count, field) => count + field.widgets.length, 0),
      200,
    );
  });

  it("derives kinds that compare against FormFieldKind and FormFieldFlag", function () {
    var fields = openFixture("AcroFormLibreOffice").formFields();
    var comment = fields.find((field) => field.name === "comment");
    assert.equal(comment.kind, Recipe.FormFieldKind.TEXT);
    assert.ok(comment.flags & Recipe.FormFieldFlag.MULTILINE);
    var fruit = fields.find((field) => field.name === "fruit");
    assert.equal(fruit.kind, Recipe.FormFieldKind.COMBO_BOX);
    assert.ok(fruit.flags & Recipe.FormFieldFlag.EDIT);
  });

  it("returns no fields for a new document or a source without a form", function () {
    assert.deepEqual(
      new Recipe(
        "new",
        path.join(__dirname, "../output/formFields new.pdf"),
      ).formFields(),
      [],
    );
    assert.deepEqual(
      new Recipe(
        path.join(__dirname, "../TestMaterials/recipe/blank.pdf"),
        path.join(__dirname, "../output/formFields blank.pdf"),
      ).formFields(),
      [],
    );
  });

  it("throws after endPDF() released the source", function () {
    var recipe = openFixture("AcroFormPdfLib");
    recipe.endPDF();
    assert.throws(
      () => recipe.formFields(),
      "The source PDF reader has been released by endPDF(). Read the source before ending the document.",
    );
  });
});
