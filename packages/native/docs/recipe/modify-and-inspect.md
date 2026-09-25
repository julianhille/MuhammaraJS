# Modify And Inspect PDFs

Open an input PDF with an output path, select a one-based page number, add
content, and finalize the page before ending the document.

```javascript
var Recipe = require("@muhammara/native").Recipe;
var pdfDoc = new Recipe("input.pdf", "output.pdf");

pdfDoc
  .editPage(1)
  .text("Added text", 150, 300)
  .rectangle(20, 20, 40, 100)
  .endPage()
  .endPDF();
```

Use `pageInfo(pageNumber)` to inspect page geometry, or
`getCurrentPageInfo()` while editing the active page. `getPageInfo()` has a
similar name but returns document Info metadata, not page geometry. To write a
textual PDF structure, call `structure` on the Recipe instance:

```javascript
pdfDoc.structure("pdf-structure.txt").endPDF();
```

## Delete Pages

`deletePage(pageNumber)` and `deletePage(pageNumbers)` remove one or more
one-based pages from an existing PDF. Multiple calls and duplicate selections
are combined against the original source numbering. At least one page must
remain.

```javascript
new Recipe("input.pdf", "without-drafts.pdf").deletePage([2, 4]).endPDF();
```

Deletion preserves retained page objects and their content, annotations, and
inherited page-tree data. It writes an incremental PDF update, so removed page
bytes may remain unreachable in the file; do not use it to erase sensitive
data. Page deletion cannot be combined with `createPage()`, `appendPage()`, or
`insertPage()` in the same Recipe.

## Replace Literal Text

`replaceText(text, replacement, pageNumber)` rewrites literal text-showing
operands in a page's content stream, leaving the surrounding text position and
font untouched. `pageNumber` is a required one-based page number.

```javascript
new Recipe("input.pdf", "output.pdf")
  .replaceText("Before", "After", 1)
  .endPDF();
```

The match is on the literal string as it appears in the content stream, so text
split across several show operations, or encoded through a font that does not
map to the source characters, is not replaced. Pages with more than one content
stream are rejected with an error. When nothing matches, the page is left
unchanged.

## Remove Text

`removeText(pageNumber, options)` drops every text-showing operator (`Tj`,
`TJ`, `'`, `"`) from an existing page, for example before placing a fresh OCR
text layer. Graphics, images, and marked content stay in place, and all of the
page's content streams are handled. `pageNumber` is a required one-based page
number.

```javascript
new Recipe("scan.pdf", "no-text.pdf").removeText(1, { forms: true }).endPDF();
```

With `{ forms: true }`, text inside the Form XObjects the page paints is removed
too, including text that an earlier `editPage()` added. Without it, only the
page's own content streams change. Annotation appearances, such as form field
values, are never changed.

The source streams are rewritten in place: a content stream or form shared with
another page loses its text there as well. Text added with `editPage()` in the
same Recipe is kept, whichever call comes first. Like page deletion, removal is
an incremental update, so the old text bytes can remain in the file; do not use
it to redact sensitive content.
