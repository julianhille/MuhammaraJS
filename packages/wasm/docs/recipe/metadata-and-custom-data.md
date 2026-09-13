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
source bytes, Recipe preserves CreationDate, updates ModDate, and writes
MuhammaraJS Producer/Creator values. Existing ModDate, Creator, and Producer
values are retained as `source-ModDate`, `source-Creator`, and
`source-Producer` entries. Read-back through the underlying PDF Info dictionary
can normalize key casing and does not preserve every arbitrary source entry.

Use `info()` to read the document metadata currently known to Recipe.
`getPageInfo()` is the native-compatible accessor; during source editing it
returns the writable output Info dictionary rather than parsed source values.
For page geometry use `pageInfo(pageNumber)` or `getCurrentPageInfo()`. See [Add
Metadata To An Existing PDF](../how-to/add-metadata-to-existing-pdfs.md) for a
byte-input workflow.
