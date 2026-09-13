# Delete Pages From A PDF

Pass an existing PDF to Recipe and select one or more one-based source page
numbers. Duplicate selections are ignored, and all numbers refer to the
original document even when `deletePage()` is called more than once.

```javascript
var Recipe = require("@muhammara/native").Recipe;

new Recipe("input.pdf", "trimmed.pdf").deletePage([2, 4]).endPDF();
```

At least one page must remain. Page deletion cannot be combined with page
creation, appending, or insertion in the same Recipe. Retained page content,
annotations, and page-tree metadata remain attached to their pages, and the
result is renumbered contiguously.

Deletion fails rather than leaving a dangling reference when a retained page or
catalog-owned structure, such as an outline or open action, refers to a selected
page. Remove or retarget that reference before calling `deletePage()`.

Deletion also rejects page trees and page-label dictionaries that would require
rewriting an indirect object with a nonzero generation number. This preserves a
valid incremental update without changing the vendored PDFWriter implementation.
Deletion also rejects page-tree or page-label objects with nonzero generation
numbers because the bundled PDFWriter cannot safely rewrite those objects.

Recipe writes deletion as an incremental PDF update. The removed pages are no
longer reachable through the page tree, but their old object bytes may remain in
the file. This operation is therefore not suitable for securely erasing
sensitive content. Page-label number trees are renumbered whether `/PageLabels`
uses a direct dictionary or an indirect object.

Buffer input uses the same API and returns the result through the `endPDF()`
callback:

```javascript
new Recipe(inputBuffer).deletePage(2).endPDF(function (outputBuffer) {
  // Store or send outputBuffer.
});
```
