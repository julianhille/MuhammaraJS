# Fill Form Fields

Fill the fields of a fillable PDF form and save the result.

```javascript
var Recipe = require("@muhammara/native").Recipe;

new Recipe("form.pdf", "filled.pdf")
  .fillForm({
    "person.name": "Ada Lovelace", // text field
    agree: true, // checkbox
    color: "green", // radio, by on-state name or /Opt label
    country: "France", // combo box
    langs: ["C", "Rust"], // list box with MULTI_SELECT
  })
  .endPDF();
```

`fillForm()` takes the values keyed by the fully qualified names that
[`formFields()`](read-form-fields.md) returns, checks each value against its
field right away, and writes them when `endPDF()` runs. Calling it again adds
more values; a later value for the same field replaces the earlier one.

| Field kind | Value                                                                                                                                    |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `text`     | Text. Longer than `maxLength`, or with line breaks in a field without `MULTILINE`, throws.                                               |
| `checkbox` | `true`, `false`, or an on-state name. `true` picks the field's only on-state and throws when it has several.                             |
| `radio`    | An on-state name, or the `label` `formFields()` lists for it from `/Opt`. `false` turns it off, unless the field has `NO_TOGGLE_TO_OFF`. |
| `combobox` | An option's value or label. Any text when the field has `EDIT`.                                                                          |
| `listbox`  | An option's value or label, or an array of them when the field has `MULTI_SELECT`.                                                       |

A finite number is converted to text wherever a value takes text. `null`
clears a field: text becomes empty, a checkbox or radio turns off and a choice
field loses its selection. Push buttons, signature fields and fields of an
unknown type throw. `READ_ONLY` fields are filled: the flag stops the person
using the viewer, not the program.

## Fields with the same name

A PDF can hold separate fields with the same fully qualified name. Such a name
throws, listing the fields' `id`s; fill each one by its `id` instead:

```javascript
var recipe = new Recipe("merged.pdf", "filled.pdf");
var [first, second] = recipe
  .formFields()
  .filter((field) => field.name === "name");
recipe.fillForm({ [first.id]: "Ada", [second.id]: "Grace" }).endPDF();
```

A key made of digits is a field name when a field has that name, and an `id`
otherwise.

## Appearances

A viewer shows a field through the appearance stream of each of its widgets,
not through its value. `fillForm()` therefore draws a new appearance for each
widget of a filled text, combo box or list box field, with the font size,
colour and alignment of the widget's `/DA` and `/Q`, or else the field's, and
the widget's rotation, background and border. Comb fields get one character
per cell, password fields show `*` for each character, and list boxes
highlight their selected options. Checkboxes and radios switch to the
appearance state the PDF already has for the value; a checkbox without
appearances gets a drawn check mark.

The text is drawn with a font Recipe embeds: the default font, or the
[registered font](../recipe/text-and-fonts.md) the `font` option names,
so it shows any script that font covers. The field's `/DA` and `/DR` are left
as they are, so a viewer that redraws the field on editing uses the form's own
font.

With `appearances: Recipe.FormAppearances.VIEWER`, `fillForm()` writes the
values and the checkbox and radio states only, and sets `/NeedAppearances` so
the viewer draws the text appearances itself. Some viewers ignore that flag,
and PDF/A forbids it, so drawing the appearances is the default.

```javascript
new Recipe("form.pdf", "filled.pdf")
  .fillForm(
    { "person.name": "Ada Lovelace" },
    { appearances: Recipe.FormAppearances.VIEWER },
  )
  .endPDF();
```

## Limits

- Values are written as an incremental update; the field and widget objects
  keep their `id`s.
- A source that needs its password cannot be edited, so it cannot be filled
  either; decrypt it with `recrypt()` first.
- `fillForm()` throws for a field whose field or widget object has a nonzero
  generation or a key that is not UTF-8, and for a checkbox or radio state name
  that is not UTF-8: these could not be written back unchanged.
- `insertPage()` cannot be combined with `fillForm()`: the inserted pages' new
  PDF would lose the form.
- Fields are not created, and filled fields are not flattened into the page.
- XFA forms are not filled. A form with both XFA and fields loses its `/XFA`,
  so viewers show the filled fields instead of the old XFA data.
- A source whose `/AcroForm` sets `/NeedAppearances`, as LibreOffice exports
  do, keeps it, so viewers redraw its fields from `/DA` instead of showing the
  drawn appearances.
