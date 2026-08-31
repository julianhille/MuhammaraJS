# Add Review Annotations

Use Recipe annotations to add comments, markup, and review regions to a new or
existing byte-backed page. Recipe page numbers are one-based and drawing
coordinates use a top-left origin.

```javascript
import { createRecipe } from "@muhammara/wasm";

var Recipe = await createRecipe();
var pdf = new Recipe(inputBytes);

var outputBytes = pdf
  .editPage(1)
  .comment("Please review this section.", 300, 100, {
    title: "Review",
    richText: true,
    replies: [{ text: "Confirmed." }],
  })
  .annot(100, 200, "Highlight", {
    width: 200,
    height: 14,
    color: "#ffff00",
    opacity: 0.45,
  })
  .annot(90, 180, "Square", {
    width: 230,
    height: 60,
    color: "#ff0000",
    borderWidth: 2,
  })
  .endPage()
  .endPDF();
```

Annotations are queued until `endPage()`. Supported markup subtypes include
`Highlight`, `Underline`, `StrikeOut`, and `Squiggly`. Recipe's rich-text form
is a Worker-safe XML subset, not arbitrary browser HTML.

Editing a source page can add annotations. Appending or rebuilding a source page
does not deep-copy its existing `/Annots` graph. The runnable implementation is
the [Annotations browser example](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/wasm/examples/browser/how-tos.mjs).
