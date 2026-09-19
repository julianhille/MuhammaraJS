# Create Multi-Page Tables

Pass records and column definitions to `table`. Define an `overflow` callback
to start a new page when the table needs more space.

Font registration is optional: native Recipe uses bundled Helvetica by default.
Select `{ font: "Roboto" }` to use the same regular face bundled by Wasm Recipe.
See [Text And Fonts](../recipe/text-and-fonts.md) for custom families and styles.

```javascript
var columns = [
  { text: "Name", name: "name", width: 180 },
  { text: "City", name: "city", width: 160 },
];
var nextPage = function (recipe) {
  recipe.endPage().createPage("letter");
  return { position: [50, 52] };
};

pdfDoc.createPage("letter").table(50, 52, people, {
  columns: columns,
  header: true,
  border: true,
  overflow: nextPage,
});
```

Columns come from `order` when it is set, otherwise from `columns`, otherwise
from every field found in any record, in first-seen order. Columns that a record
lacks, and `null` or `undefined` values, render as empty cells. A column
`renderer` runs once per cell, and the options it returns also size the row. A
continuation reserves room for its repeated header and uses the bounds of the
position and page it continues on. Empty `contents` draw nothing. After a table,
`movedown(0, true)` returns the table's left edge and bottom.

Array-form `order` preserves exact keys, including surrounding whitespace and
empty-string keys; comma-separated string entries are trimmed. If no columns
are selected or discovered, the call draws nothing and preserves the cursor.
Header and row measurements include vertical padding, `minHeight`, fixed
`height`, and HTML line breaks. Set these through column `cell`/`hcell`,
header/row `cell`, or a renderer's `textBox` options.

An `overflow` callback receives the Recipe as both `this` and its first
argument. It is called once for a pending row: return `true` to stop, or
continue in an area that fits the entire row plus its repeated header. The
destination is bounded by `options.height` and the page's bottom margin. If it
is too small, `table()` throws `RangeError` before drawing that header or row.
Move the continuation upward, use a taller page/table area, reduce the cell
heights, or split a large record into multiple rows. Tables do not split a row
automatically.

Columns can set widths, alignment, and renderers; table options support header,
border, row styling, field ordering, and overflow behavior. TypeScript users can use
`Recipe.TableOptions` and `Recipe.TableColumnOptions` for these options.
