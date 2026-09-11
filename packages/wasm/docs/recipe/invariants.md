# Recipe API Invariants

- Load the class with `await createRecipe()`; Recipe is an ESM, byte-first API.
- The constructor accepts PDF `Uint8Array` or `ArrayBuffer` input. Await
  `blob.arrayBuffer()` before constructing from a `Blob` or `File`.
- Recipe drawing uses a top-left origin. `setPageBox()` and `rectangle()` with
  `useGivenCoords: true` use PDF-native bottom-left coordinates.
- Recipe page numbers are one-based, including `editPage()`, `pageInfo()`,
  `replaceText()`, and composition source pages. Only `insertPage()` uses zero
  to mean before the first output page.
- Call `endPage()` before selecting, creating, or editing another page and before
  `endPDF()`.
- `pauseContext()` and `resumeContext()` are chainable for valid created-page
  and edited-page transitions. They throw when there is no matching active or
  paused page content context.
- `endPDF()` returns an owned `Uint8Array`; repeated calls return the cached
  result. It never writes a path or stream.
- `read()` and `readAsync()` inspect their argument without replacing Recipe's
  output state.
- `info()` returns the document metadata known to Recipe. `getPageInfo()` is the
  native-compatible Info accessor and returns the writable output dictionary
  during source editing. `pageInfo()` and `getCurrentPageInfo()` return page
  geometry.
- Static font, image, and PDF registrations are shared by Recipe instances in a
  loaded runtime. Unregister assets only after active documents finish.
- `dispose()` releases one Recipe's Emscripten allocations. `disposeAssets()`
  releases registered static assets; JavaScript garbage collection cannot do
  either job deterministically.
- Fixed-height clipping requires `textBox.height` and
  `textBox.clipIfExceedsBox: true`; `onClip` runs only when text remains.
- Synchronous callbacks such as text overflow and table cell renderers cannot
  await work or use Node streams and plugin loading.

```js
import { createRecipe } from "@muhammara/wasm";

var Recipe = await createRecipe();
var recipe = new Recipe().createPage(200, 120).text("Complete page", 20, 30);
var pdfBytes = recipe.endPage().endPDF();

recipe.dispose();
Recipe.disposeAssets();
console.log(pdfBytes instanceof Uint8Array); // true
```

Review [Differences And Restrictions](../differences.md) for composition,
encryption, HTML, fonts, filesystem, and plugin boundaries.
