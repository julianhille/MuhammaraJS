import assert from "node:assert/strict";
import { createMuhammaraWasm } from "../../index.js";
import { getRecipe, recipeFixture } from "./recipe.mjs";

// Expected fields per fixture, kept identical to the Wasm test.
var EXPECTED = {
  // Written by LibreOffice Writer: its checkbox /V is Yes, the on-state is
  // the export value.
  AcroFormLibreOffice: [
    {
      id: 4,
      name: "city",
      kind: "text",
      value: "Zürich",
      defaultValue: "Zürich",
      flags: 0,
      maxLength: 30,
      options: [],
      widgets: [
        { id: 4, pageNumber: 1, rect: [30.349, 742.901, 168.151, 761.649] },
      ],
    },
    {
      id: 7,
      name: "newsletter",
      kind: "checkbox",
      value: "Yes",
      defaultValue: "Yes",
      flags: 0,
      maxLength: null,
      options: [{ value: "subscribed", label: "subscribed" }],
      widgets: [
        { id: 7, pageNumber: 1, rect: [29.149, 705.751, 37.201, 713.799] },
      ],
    },
    {
      id: 9,
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
        { id: 8, pageNumber: 1, rect: [29.149, 663.201, 37.201, 671.249] },
        { id: 10, pageNumber: 1, rect: [142.549, 663.201, 150.601, 671.249] },
      ],
    },
    {
      id: 11,
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
      widgets: [
        { id: 11, pageNumber: 1, rect: [30.349, 615.351, 168.151, 634.099] },
      ],
    },
    {
      id: 12,
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
      widgets: [
        { id: 12, pageNumber: 1, rect: [30.349, 538.801, 168.151, 591.549] },
      ],
    },
    {
      id: 13,
      name: "comment",
      kind: "text",
      value: "Line one\r\nLine two",
      defaultValue: "Line one\r\nLine two",
      flags: 4096,
      maxLength: null,
      options: [],
      widgets: [
        { id: 13, pageNumber: 1, rect: [30.349, 467.951, 253.151, 520.699] },
      ],
    },
  ],
  // Written by pdf-lib: the radio states are indices labelled by /Opt.
  AcroFormPdfLib: [
    {
      id: 9,
      name: "person.name",
      kind: "text",
      value: "Ada Lovelace",
      defaultValue: null,
      flags: 0,
      maxLength: 40,
      options: [],
      widgets: [{ id: 10, pageNumber: 1, rect: [19.5, 339.5, 220.5, 364.5] }],
    },
    {
      id: 13,
      name: "notes",
      kind: "text",
      value: null,
      defaultValue: null,
      flags: 4098,
      maxLength: null,
      options: [],
      widgets: [{ id: 14, pageNumber: 1, rect: [19.5, 259.5, 220.5, 320.5] }],
    },
    {
      id: 16,
      name: "agree",
      kind: "checkbox",
      value: "Yes",
      defaultValue: null,
      flags: 0,
      maxLength: null,
      options: [{ value: "Yes", label: "Yes" }],
      widgets: [{ id: 17, pageNumber: 1, rect: [19.5, 219.5, 36.5, 236.5] }],
    },
    {
      id: 22,
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
        { id: 23, pageNumber: 1, rect: [19.5, 179.5, 36.5, 196.5] },
        { id: 28, pageNumber: 1, rect: [49.5, 179.5, 66.5, 196.5] },
        { id: 33, pageNumber: 2, rect: [19.5, 179.5, 36.5, 196.5] },
      ],
    },
    {
      id: 38,
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
      widgets: [{ id: 39, pageNumber: 2, rect: [19.5, 299.5, 140.5, 324.5] }],
    },
    {
      id: 41,
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
      widgets: [{ id: 42, pageNumber: 2, rect: [19.5, 219.5, 140.5, 280.5] }],
    },
    {
      id: 44,
      name: "submit",
      kind: "pushbutton",
      value: null,
      defaultValue: null,
      flags: 65536,
      maxLength: null,
      options: [],
      widgets: [{ id: 45, pageNumber: 2, rect: [160, 300, 240, 324] }],
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
      id: 7,
      name: "address.street",
      kind: "text",
      value: "Main St",
      defaultValue: null,
      flags: 4096,
      maxLength: 40,
      options: [],
      widgets: [
        { id: 10, pageNumber: 1, rect: [20, 350, 220, 370] },
        { id: 12, pageNumber: 2, rect: [20, 50, 220, 70] },
      ],
    },
    {
      id: 8,
      name: "address.zip",
      kind: "text",
      value: "12345",
      defaultValue: null,
      flags: 0,
      maxLength: 5,
      options: [],
      widgets: [{ id: 8, pageNumber: 1, rect: [20, 300, 120, 320] }],
    },
    {
      id: 20,
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
        { id: 21, pageNumber: 1, rect: [20, 250, 36, 266] },
        { id: 22, pageNumber: 1, rect: [50, 250, 66, 266] },
      ],
    },
    {
      id: 15,
      name: "café",
      kind: "checkbox",
      value: "On",
      defaultValue: null,
      flags: 0,
      maxLength: null,
      options: [{ value: "On", label: "On" }],
      widgets: [{ id: 15, pageNumber: null, rect: [20, 200, 36, 216] }],
    },
    {
      id: 16,
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
      widgets: [{ id: 16, pageNumber: 2, rect: [20, 300, 120, 360] }],
    },
    {
      id: 17,
      name: "sig",
      kind: "signature",
      value: null,
      defaultValue: null,
      flags: 0,
      maxLength: null,
      options: [],
      widgets: [{ id: 17, pageNumber: 2, rect: [150, 50, 250, 90] }],
    },
    {
      id: 18,
      name: "mystery",
      kind: null,
      value: "x",
      defaultValue: null,
      flags: 4096,
      maxLength: null,
      options: [],
      widgets: [{ id: 18, pageNumber: null, rect: null }],
    },
  ],
};

/**
 * Drop the object IDs, which differ between a fixture and a rewritten copy.
 * @param {Array<object>} fields - Fields returned by formFields().
 * @returns {Array<object>} The fields without `id`.
 */
function withoutIDs(fields) {
  return fields.map(({ id, ...field }) => ({
    ...field,
    widgets: field.widgets.map(({ id, ...widget }) => widget),
  }));
}

/**
 * Check that each field ID names the field dictionary, and each widget ID a
 * widget annotation on the page it is reported on.
 * @param {object} reader - A reader of the same PDF.
 * @param {Array<object>} fields - Fields returned by formFields().
 * @returns {void}
 */
function assertObjectIDs(reader, fields) {
  var annots = [];
  for (var index = 0; index < reader.getPagesCount(); index++) {
    var array = reader.queryDictionaryObject(
      reader.parsePageDictionary(index),
      "Annots",
    );
    annots.push(
      (array ? array.toPDFArray().toJSArray() : []).map((reference) =>
        reference.toPDFIndirectObjectReference().getObjectID(),
      ),
    );
  }
  var fieldIDs = fields.map((field) => field.id);
  assert.equal(new Set(fieldIDs).size, fieldIDs.length);
  fields.forEach((field) => {
    var partialName = reader.parseNewObject(field.id).toJSObject().T;
    assert.equal(partialName.toText(), field.name.split(".").pop());
    field.widgets.forEach((widget) => {
      var dictionary = reader.parseNewObject(widget.id).toJSObject();
      assert.equal(dictionary.Subtype.value, "Widget");
      if (widget.pageNumber !== null) {
        assert.ok(annots[widget.pageNumber - 1].includes(widget.id));
      }
    });
  });
}

describe("formFields", function () {
  Object.keys(EXPECTED).forEach(function (name) {
    it("reads the fields of " + name, async function () {
      var Recipe = await getRecipe();
      assert.deepEqual(
        new Recipe(recipeFixture(name)).formFields(),
        EXPECTED[name],
      );
    });
  });

  it("reads the fields of an encrypted source opened with its password", async function () {
    // AcroFormPdfLib encrypted with AES-256, user password "user".
    var Recipe = await getRecipe();
    var recipe = new Recipe(recipeFixture("AcroFormEncrypted"), {
      password: "user",
    });
    // Encrypting rewrote the file, so its object IDs differ.
    assert.deepEqual(
      withoutIDs(recipe.formFields()),
      withoutIDs(EXPECTED.AcroFormPdfLib),
    );
  });

  it("identifies each field and widget by its object ID", async function () {
    var Recipe = await getRecipe();
    var muhammara = await createMuhammaraWasm();
    ["AcroFormLibreOffice", "AcroFormPdfLib", "AcroFormEdgeCases"].forEach(
      function (name) {
        var reader = muhammara.createReader(recipeFixture(name));
        try {
          assertObjectIDs(reader, new Recipe(recipeFixture(name)).formFields());
        } finally {
          reader.end();
        }
      },
    );
  });

  it("keeps the object IDs in the PDF a Recipe edit writes", async function () {
    var Recipe = await getRecipe();
    var edited = new Recipe(recipeFixture("AcroFormPdfLib"))
      .info({ title: "Edited" })
      .endPDF();
    assert.deepEqual(new Recipe(edited).formFields(), EXPECTED.AcroFormPdfLib);
  });

  it("reads a /Kids array shared by many fields once", async function () {
    // 200 fields share one indirect /Kids array of 200 widgets; reading it
    // for every field would return 40000 widgets.
    var Recipe = await getRecipe();
    var fields = new Recipe(recipeFixture("AcroFormSharedKids")).formFields();
    assert.equal(fields.length, 200);
    assert.equal(
      fields.reduce((count, field) => count + field.widgets.length, 0),
      200,
    );
  });

  it("derives kinds that compare against FormFieldKind and FormFieldFlag", async function () {
    var Recipe = await getRecipe();
    var fields = new Recipe(recipeFixture("AcroFormLibreOffice")).formFields();
    var comment = fields.find((field) => field.name === "comment");
    assert.equal(comment.kind, Recipe.FormFieldKind.TEXT);
    assert.ok(comment.flags & Recipe.FormFieldFlag.MULTILINE);
    var fruit = fields.find((field) => field.name === "fruit");
    assert.equal(fruit.kind, Recipe.FormFieldKind.COMBO_BOX);
    assert.ok(fruit.flags & Recipe.FormFieldFlag.EDIT);
  });

  it("returns no fields for a new document or a source without a form", async function () {
    var Recipe = await getRecipe();
    assert.deepEqual(new Recipe().formFields(), []);
    assert.deepEqual(new Recipe(recipeFixture("blank")).formFields(), []);
  });

  it("throws after endPDF() released the source", async function () {
    var Recipe = await getRecipe();
    var recipe = new Recipe(recipeFixture("AcroFormPdfLib"));
    recipe.endPDF();
    assert.throws(() => recipe.formFields(), {
      message:
        "The source PDF reader has been released by endPDF(). Read the source before ending the document.",
    });
  });
});
