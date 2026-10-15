# Metadata And Custom Data

Set standard document information in constructor options or with `info()`.
Custom Info dictionary values use either `info({ ReportId: "Q1-2026" })` or
`custom("ReportId", "Q1-2026")`; the last value for a key wins.

```js
import { createRecipe } from "@muhammara/wasm";

var Recipe = await createRecipe();
var recipe = new Recipe({
  author: "Example Co.",
  title: "Quarterly report",
  subject: "Q1",
  keywords: ["q1", "report"],
})
  .custom("ReportId", "Q1-2026")
  .createPage("letter")
  .text("Quarterly report", 72, 72, { size: 24 })
  .endPage();

console.log(recipe.info());
var pdfBytes = recipe.endPDF();
```

Custom keys belong in `info()` or `custom()`, not constructor options. Array
values are written as comma-and-space-separated text. Dotted OID keys are
accepted.

New documents receive canonical creation and modification dates. When modifying
source bytes, Recipe updates ModDate and writes MuhammaraJS Producer/Creator
values. Existing ModDate, Creator, and Producer values are retained as
`source-ModDate`, `source-Creator`, and `source-Producer` entries. Custom
entries of the source are kept with their spelling, and `info()` reports them
with it.

Pass `xmp: true` to also write an XMP metadata packet that mirrors these Info
values, and use `xmp()` to read the packet of a source PDF.

Use `info()` to read the Info entries of the source overlaid with the values set
on the Recipe, as text. `info({ Title: "..." })` sets the title like `title` does. Creator, Producer,
CreationDate, ModDate, Trapped and the `source-*` entries are written by Recipe,
and they and an empty key throw a `TypeError`; a source's own `source-*` entries
are reported by `info()` as custom entries.
`getPageInfo()` is the native-compatible accessor; during source editing it
returns the writable output Info dictionary rather than parsed source values.
For page geometry use `pageInfo(pageNumber)` or `getCurrentPageInfo()`. See [Add
Metadata To An Existing PDF](../how-to/add-metadata-to-existing-pdfs.md) for a
byte-input workflow.
