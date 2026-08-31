# Create Multi-Page Tables

Register a font from bytes, pass records and column definitions to `table()`,
and use a synchronous overflow callback to continue on another page.

```javascript
import { createRecipe } from "@muhammara/wasm";

var Recipe = await createRecipe();
await Recipe.registerFontAsync("table-font", fontFile);

var columns = [
  { text: "Name", name: "name", width: 180 },
  { text: "City", name: "city", width: 160 },
];
var nextPage = function (recipe) {
  recipe.endPage().createPage("letter");
  return { position: [50, 52] };
};

var pdf = new Recipe().createPage("letter");
pdf.table(50, 52, people, {
  font: "table-font",
  fontSize: 11,
  columns,
  header: true,
  border: true,
  overflow: nextPage,
});
var outputBytes = pdf.endPage().endPDF();

Recipe.unregisterFont("table-font");
```

Columns can define widths, cell styles, header styles, and renderers. Table
options also support borders, row styling, bounded height, and repeated headers.
Keep overflow callbacks synchronous; load every font and asset before starting
layout.
