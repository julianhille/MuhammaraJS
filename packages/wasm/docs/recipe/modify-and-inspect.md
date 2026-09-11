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

## Replace Literal Text

`replaceText(text, replacement, pageNumber)` rewrites complete literal
`(...) Tj` text-showing operands in an existing page's single content stream.
It leaves text position and font unchanged.

```js
import { createRecipe } from "@muhammara/wasm";

var Recipe = await createRecipe();
var sourceBytes = new Recipe({ compress: false })
  .createPage(300, 160)
  .text("Before", 30, 50)
  .endPage()
  .endPDF();

var outputBytes = new Recipe(sourceBytes)
  .replaceText("Before", "After", 1)
  .endPDF();
```

Matching operates on literal content-stream strings. Text split across show
operations or encoded without a direct character mapping is not replaced.
Pages with multiple content streams are rejected; no match leaves the page
unchanged.
