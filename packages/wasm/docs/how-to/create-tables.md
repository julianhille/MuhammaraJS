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
  fontSize: 11,
  columns,
  header: true,
  border: true,
  overflow: nextPage,
});
var outputBytes = pdf.endPage().endPDF();

pdf.dispose();
Recipe.disposeAssets();
```

Columns can define widths, cell styles, header styles, and renderers. Table
options also support borders, row styling, bounded height, and repeated headers.
Keep overflow callbacks synchronous; load every font and asset before starting
layout.

To use your own face and skip loading Roboto, initialize with
`var Recipe = await createRecipe({ defaultFont: fontFile })`. The rest of the
example stays the same. You can also use `defaultFont: false`, register it with
`await Recipe.registerFontAsync("table-font", fontFile)` before layout, and set
`font: "table-font"` in the table options. See
[Custom Fonts](../recipe/text-and-fonts.md#custom-fonts). The browser
example's **Tables** tab runs with no uploads and accepts an optional custom font.
