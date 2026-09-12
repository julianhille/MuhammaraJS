# Delete Pages From A PDF

Construct Recipe from PDF bytes and select one or more one-based source page
numbers. Duplicate selections are ignored, and all numbers refer to the
original document even across multiple `deletePage()` calls.

```javascript
import { createRecipe } from "@muhammara/wasm";

var Recipe = await createRecipe();
var inputBytes = new Uint8Array(await inputFile.arrayBuffer());
var outputBytes = new Recipe(inputBytes).deletePage([2, 4]).endPDF();
var outputBlob = new Blob([outputBytes], { type: "application/pdf" });
```

At least one page must remain. Page deletion cannot be combined with page
creation, appending, or insertion in the same Recipe. Retained page content,
annotations, and page-tree metadata remain attached to their pages, and the
result is renumbered contiguously.

Deletion is an incremental update, not secure erasure. Removed pages are no
longer reachable through the page tree, but their old object bytes may remain in
the returned data. Page-label number trees are renumbered whether `/PageLabels`
uses a direct dictionary or an indirect object.
