# Modify And Inspect PDFs

Construct Recipe with a `Uint8Array` or `ArrayBuffer` to modify an existing PDF.
For a `Blob` or `File`, await `arrayBuffer()` first. Select a one-based page,
finish its editing context with `endPage()`, and receive new bytes from
`endPDF()`; the input object is never overwritten.

```js
import { createRecipe } from "@muhammara/wasm";

var Recipe = await createRecipe();
var inputBytes = new Recipe()
  .createPage(420, 300)
  .text("Original", 40, 50)
  .endPage()
  .endPDF();

var recipe = new Recipe(inputBytes);
var geometry = recipe.pageInfo(1);
var outputBytes = recipe
  .editPage(1)
  .rectangle(24, 24, geometry.width - 48, geometry.height - 48, {
    stroke: "#2563eb",
    lineWidth: 2,
  })
  .text("Added to existing bytes", 40, 90)
  .endPage()
  .endPDF();
```

Editing uses a byte-backed modifier, including for rotated pages and pages with
non-zero MediaBox origins. `pauseContext()` and `resumeContext()` split an edit
into separate appended content contexts. Both return the Recipe for valid
transitions and throw for unmatched calls. Password-protected source editing
is not available; decrypt first with the low-level byte-first `recrypt()` API.

## Delete Source Pages

`deletePage(pageNumber)` and `deletePage([pageNumbers])` remove one or more
one-based pages from the original source when `endPDF()` finalizes the Recipe.
At least one page must remain. Deletion cannot be combined with `createPage()`,
`appendPage()`, or `insertPage()` in the same Recipe.

Deletion preserves retained page objects and adjusts page labels, but it is an
incremental update rather than secure erasure of the removed content. See
[Delete Pages](../how-to/delete-pages.md) for a complete byte-input example.

## Inspect Without Replacing Output State

`read(bytes)` and `readAsync(blob)` report page count and geometry without
turning those bytes into the Recipe's output document. `info()` returns the
document Info metadata currently known to Recipe. `getPageInfo()` is the
native-compatible accessor; during source editing it returns the writable
output Info dictionary rather than the parsed source values. `pageInfo()` and
`getCurrentPageInfo()` return page geometry.

`structure("json")` returns a browser-safe summary rather than writing a
diagnostic file. Calling `structure()` finalizes the Recipe through `endPDF()`,
so perform all page and document operations first.

```js
import { createRecipe } from "@muhammara/wasm";

var Recipe = await createRecipe();
var sourceBytes = new Recipe()
  .createPage(240, 160)
  .text("Inspect these bytes", 24, 36)
  .endPage()
  .endPDF();
var inspector = new Recipe();
var metadata = await inspector.readAsync(
  new Blob([sourceBytes], { type: "application/pdf" }),
);

console.log(metadata.pages, metadata[1].mediaBox);
console.log(new Recipe(sourceBytes).structure("json"));
```

## Replace Text

`replaceText(text, replacement, pageNumber)` rewrites text-showing operands in
an existing page's single content stream. It leaves text position and font
unchanged.

```js
import { createRecipe } from "@muhammara/wasm";

var Recipe = await createRecipe();
// The embedded font is subset, so the page must already use the
// replacement's glyphs.
var sourceBytes = new Recipe({ compress: false })
  .createPage(300, 160)
  .text("Before", 30, 50)
  .text("After", 30, 90)
  .endPage()
  .endPDF();

var outputBytes = new Recipe(sourceBytes)
  .replaceText("Before", "After", 1)
  .endPDF();
```

`text` is compared with each `Tj` operand decoded through the font selected by
`Tf`: the font's `/ToUnicode` CMap first, then a simple font's `/Encoding` and
`/Differences`. This matches text written with composite (Type0) fonts, such as
the hex glyph IDs Muhammara writes, as well as simple fonts. `text` and
`replacement` can be any Unicode strings. The replacement is encoded through
the same font and written back as a literal or hex string, like the original
operand. Content outside the replaced operands keeps its exact bytes.

The replacement can only use glyphs the font already has. Embedded fonts are
usually subset to the glyphs of their original text, so a replacement with any
other character throws an error that names the missing characters, for example
`font FN1 has no glyph for "A", "t"`. Replacing text with a new font is not
supported.

Only whole `Tj` operands match. Text split across several show operations, and
`TJ`, `'`, and `"` operands, are not replaced. Pages with more than one content
stream are rejected with an error. When nothing matches, the page is left
unchanged.

## Remove Text

`removeText(pageNumber, options)` drops every text-showing operator (`Tj`,
`TJ`, `'`, `"`) from an existing page, for example before placing a fresh OCR
text layer. Graphics, images, and marked content stay in place, and all of the
page's content streams are handled. `pageNumber` is a required one-based page
number.

```js
var outputBytes = new Recipe(sourceBytes)
  .removeText(1, { forms: true })
  .endPDF();
```

With `{ forms: true }`, text inside the Form XObjects the page paints is removed
too, including text that an earlier `editPage()` added. Without it, only the
page's own content streams change. Annotation appearances, such as form field
values, are never changed.

The source streams are rewritten in place: a content stream or form shared with
another page loses its text there as well. Text added with `editPage()` in the
same Recipe is kept, whichever call comes first. Like page deletion, removal is
an incremental update, so the old text bytes can remain in the returned data;
do not use it to redact sensitive content.
