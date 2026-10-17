# Read Form Fields

List the fields of a fillable PDF form, with their values and the pages they
are on.

```javascript
var Recipe = require("@muhammara/native").Recipe;

function readFormFields(inputPath) {
  return new Recipe(inputPath).formFields().map(function (field) {
    return {
      id: field.id,
      name: field.name,
      kind: field.kind,
      value: field.value,
      readOnly: Boolean(field.flags & Recipe.FormFieldFlag.READ_ONLY),
      pages: field.widgets.map(function (widget) {
        return widget.pageNumber;
      }),
    };
  });
}

console.log(readFormFields("form.pdf"));
```

`formFields()` reads the interactive form (AcroForm) of the source document
and returns one entry per terminal field, in field tree order. A new document,
or a source without a form, returns `[]`. Call it before `endPDF()`; afterwards
the source is released and the call throws.

Each entry has these properties:

| Property       | Meaning                                                                                                  |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| `id`           | The object number of the field dictionary: unique within the file, unlike `name`.                        |
| `name`         | The fully qualified name: the partial names `/T` of the field and its ancestors joined with `.`.         |
| `kind`         | A `Recipe.FormFieldKind` value, derived from `/FT` and the flags; `null` for an unknown field type.      |
| `value`        | `/V`: the text of a text or choice field, an array for a multi-select list, the state name of a button.  |
| `defaultValue` | `/DV`, decoded like `value`.                                                                             |
| `flags`        | `/Ff`; test single bits with `Recipe.FormFieldFlag`, for example `READ_ONLY`, `REQUIRED` or `MULTILINE`. |
| `maxLength`    | `/MaxLen` of a text field, or `null`.                                                                    |
| `options`      | `{ value, label }` choices of a choice field, or the on-states of a checkbox or radio.                   |
| `widgets`      | `{ id, pageNumber, rect }` for each widget annotation that shows the field.                              |

`id` tells fields apart when `name` does not. A field shown in several places
is one entry with several widgets, but a PDF can also hold two separate fields
with the same fully qualified name, for example after documents were merged;
they are two entries with the same `name` and different `id`s. Recipe edits
append an incremental update and keep object numbers, so an `id` read from a
source is still valid in the PDF Recipe writes from it. Encrypting, with
`encrypt()` or another tool, and any tool that rewrites the whole file can
renumber the objects. A widget's `id` is the field's `id` when the field and
its widget are one object.

`kind`, `flags`, `value`, `defaultValue` and `maxLength` are inherited from
parent fields when a field does not set them itself.

Checkbox and radio values are appearance state names, not booleans. `Off`
means unchecked; the on-state is whatever name the PDF uses, which is often
not `Yes`. `options` lists the on-states found in the widgets' appearances.
`value` is the raw `/V` and does not always match one of them; LibreOffice,
for example, writes `/V /Yes` for a checkbox whose on-state is its export
value. Test a checkbox with `value !== null && value !== "Off"`.
When the field has an `/Opt` array, as pdf-lib writes it, each state's
`label` is the matching `/Opt` entry: a radio with states `0`, `1` and `2` can
carry the labels `red`, `green` and `blue`.

`widgets[].rect` is the raw `/Rect` as `[llx, lly, urx, ury]` in PDF user
space, with the origin at the bottom left of the page and before any page
rotation. It is not converted to Recipe coordinates. `pageNumber` is the
one-based page whose `/Annots` lists the widget, or `null` for a widget that
is on no page.

An encrypted source is read once Recipe opens it with its user password as
the `password` option.

Only the source document is read: XFA forms are not read, and malformed field
entries, such as references to missing objects or a `/Kids` cycle, are
skipped. Filling, creating and flattening fields are not supported yet.
