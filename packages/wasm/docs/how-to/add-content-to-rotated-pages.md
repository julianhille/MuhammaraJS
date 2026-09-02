# Add Content To Rotated Pages

Recipe normalizes its top-left coordinate system when editing pages rotated by
0, 90, 180, or 270 degrees. Read the visual dimensions before placing
size-dependent content.

```javascript
import { createRecipe } from "@muhammara/wasm";

var Recipe = await createRecipe();
await Recipe.registerFontAsync("body-font", fontFile);
var pdf = new Recipe(inputBytes);
var page = pdf.pageInfo(1);

var outputBytes = pdf
  .editPage(1)
  .text("[0,0] is here", 0, 0, {
    font: "body-font",
    fontSize: 36,
  })
  .rectangle(0, 0, page.width / 2, page.height / 2, {
    fill: "#60a5fa",
    opacity: 0.2,
  })
  .endPage()
  .endPDF();

Recipe.unregisterFont("body-font");
```

For 90- and 270-degree pages, `pageInfo()` reports the swapped visual width and
height. Recipe also accounts for non-zero MediaBox origins when transforming
drawing and annotation coordinates.
