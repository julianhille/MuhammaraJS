# Flow Text Into Columns

Create a named layout, then direct text into it. Register the font before
creating the Recipe because Worker-safe layout is synchronous once it begins.

```javascript
import { createRecipe } from "@muhammara/wasm";

var Recipe = await createRecipe();
await Recipe.registerFontAsync("body-font", fontFile);

var nextPage = function (recipe) {
  recipe.endPage().createPage("letter");
  recipe.layout("article", 72, 72, 468, 600, {
    columns: 2,
    gap: 18,
  });
  return { layout: "article" };
};

var pdf = new Recipe()
  .createPage("letter")
  .layout("article", 72, 72, 468, 600, { columns: 2, gap: 18 })
  .text(article, {
    font: "body-font",
    fontSize: 11,
    layout: "article",
    overflow: nextPage,
    textBox: { textAlign: "justify" },
  });

var outputBytes = pdf.endPage().endPDF();
Recipe.unregisterFont("body-font");
```

Layouts can use a column count or explicit column definitions. Text boxes also
support clipping, trimming, ellipsis, alignment, and measured continuation.
