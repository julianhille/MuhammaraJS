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

`deletePage()` validates the selection when you call it. If it throws, the
queued deletions are unchanged and the rest of the Recipe still works; only a
page edited after `deletePage()` is checked again during `endPDF()`.

By default, deletion is refused when retained structures still reference a
selected page: outline items, link annotations and named destinations, form
widgets, tagged-PDF structure elements, or the catalog's open action. Most
real-world PDFs have such references. Pass `pruneReferences: true` to remove
them instead:

```javascript
var outputBytes = new Recipe(inputBytes)
  .deletePage(1, { pruneReferences: true })
  .endPDF();
```

Pruning rewrites each retained object that points at a deleted page:

- A destination that targets a deleted page becomes null. Outline items keep
  their title and children, link annotations and named destinations stop
  going anywhere, and an open action is cleared.
- Every other direct reference to a deleted page, such as a widget's `/P` or a
  structure element's `/Pg`, is removed.
- A changed dictionary nested inside another object is written as its own
  indirect object.

Pruning does not remove form fields whose widgets sat on a deleted page, or
structure elements for its content; they stay as orphans. It is refused when
the reference is held by the page tree, the page labels, a stream dictionary,
or a page edited in the same Recipe. Once any `deletePage()` call enables it,
pruning applies to every queued deletion.

Deletion also rejects edited retained pages, page trees, and page-label
dictionaries that would require rewriting an indirect object with a nonzero
generation number. This preserves a valid incremental update without changing
the vendored PDFWriter implementation.

Deletion is an incremental update, not secure erasure. Removed pages are no
longer reachable through the page tree, but their old object bytes may remain in
the returned data. Page-label number trees are renumbered whether `/PageLabels`
uses a direct dictionary or an indirect object.
