# Create Multi-Page Tables

Pass records and column definitions to `table()` and use a synchronous overflow
callback to continue on another page. Bundled Roboto Regular makes this work
without loading or registering a font.

```javascript
import { createRecipe } from "@muhammara/wasm";

var Recipe = await createRecipe();
var people = [
  { name: "Alex", city: "Berlin" },
  { name: "Sam", city: "Paris" },
];

var pdf = new Recipe().createPage("letter");
pdf.table(50, 52, people, {
  fontSize: 11,
  columns: [
    { text: "Name", name: "name", width: 180 },
    { text: "City", name: "city", width: 160 },
  ],
  header: true,
  border: true,
  // Continue on a new page at the same position.
  overflow: (recipe) => {
    recipe.endPage().createPage("letter");
    return { position: [50, 52] };
  },
});
var outputBytes = pdf.endPage().endPDF();

pdf.dispose();
Recipe.disposeAssets();
```

Columns come from `order` when it is set, otherwise from `columns`, otherwise
from every field found in any record, in first-seen order. Columns that a record
lacks, and `null` or `undefined` values, render as empty cells. A column
`renderer` runs once per cell, and the options it returns also size the row. A
continuation reserves room for its repeated header and uses the bounds of the
position and page it continues on. Empty `contents` draw nothing. After a table,
`movedown(0, true)` returns the table's left edge and bottom.

Cell values come from each record's own properties. Inherited properties,
including built-ins such as `constructor` and `toString`, are treated as
missing and passed to renderers as `""` unless the record defines them itself.

Array-form `order` preserves exact keys, including surrounding whitespace and
empty-string keys; comma-separated string entries are trimmed. If no columns
are selected or discovered, the call draws nothing and preserves the cursor.
Header and row measurements include vertical padding, `minHeight`, fixed
`height`, and HTML line breaks. Set these through column `cell`/`hcell`,
header/row `cell`, or a renderer's `textBox` options. A column's `cell` is its
only body text box, so a column-level `textBox` is ignored. A row or header
`cell` replaces that style's `textBox`, and nested box styles such as `style`
merge across column, row, and renderer options. A table-level `cell` is
ignored; style cells through each column's `cell` or the table's `row.cell`.

Header text styles are independent of table/body text styles. Recipe resolves
them in this order:

1. Start with the column's `header` object, or the default bold, centered header
   with 2pt padding when that option is omitted or boolean. A column-level
   `header: false` selects the default style; it does not hide the header.
2. Apply table-level `header` options, including `header.cell` box styling.
3. If `header.alignToData` is true, copy the column's `cell.textAlign`.
4. Apply the column's `hcell` box overrides, merging nested styles.

The table-level `header` option controls whether headers are drawn. Set header
`font`, `size`, and `color` explicitly when they should match the body; body
column styling cannot override an explicit header style. Measurement and every
repeated header use the same resolved options.

An `overflow` callback receives the Recipe as both `this` and its first
argument. It is called once for a pending row: return `true` to stop, or
continue in an area that fits the entire row plus its repeated header. The
destination is bounded by `options.height` and the page's bottom margin. If it
is too small, `table()` throws `RangeError` before drawing that header or row. A
callback that ends the page must start another one before continuing;
otherwise `table()` throws an `Error`.
Move the continuation upward, use a taller page/table area, reduce the cell
heights, or split a large record into multiple rows. Tables do not split a row
automatically.

Columns can define widths, cell styles, header styles, and renderers. Table
options also support borders, row styling, bounded height, and repeated headers.
Keep overflow callbacks synchronous; load every font and asset before starting
layout.

A normal overflow function receives the Recipe as `this` as well as its first
argument. TypeScript callers can use `RecipeTableOptions<Row>` and
`RecipeTableColumnOptions<Row>` to check stored options against their record
fields; inline options infer the record type from the table contents.

To use your own face and skip loading Roboto, initialize with
`var Recipe = await createRecipe({ defaultFont: fontFile })`. The rest of the
example stays the same. You can also use `defaultFont: false`, register it with
`await Recipe.registerFontAsync("table-font", fontFile)` before layout, and set
`font: "table-font"` in the table options. See
[Custom Fonts](../recipe/text-and-fonts.md#custom-fonts). The browser
example's **Tables** tab runs with no uploads and accepts an optional custom font.
