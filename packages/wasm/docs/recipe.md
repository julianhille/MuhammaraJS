# Recipe

Load `Recipe` asynchronously. It is the high-level API for byte-backed PDF
creation and editing, and uses top-left coordinates for high-level drawing.

```js
import { createRecipe } from "@muhammara/wasm";

var Recipe = await createRecipe();
var bytes = new Recipe()
  .createPage(595, 842)
  .text("Hello", 72, 72)
  .rectangle(72, 110, 120, 24, { fill: "#dbeafe" })
  .endPage()
  .endPDF();
```

Recipe bundles **Roboto Regular** (Apache-2.0), so text, text measurement, and
tables work without registering a font, uploading a file, or fetching a font URL.
The same code works in a browser, module Worker, and Node.

Register custom fonts, images, and source PDFs from bytes. `new Recipe(sourceBytes)`
edits an existing PDF; `read(bytes)` only inspects metadata and does not replace
the Recipe output state. `endPDF()` is idempotent and returns the same cached
`Uint8Array` on subsequent calls.

Recipe provides pages, text, shapes, images, tables, composition, annotations,
metadata, and byte-safe splitting. `setPageBox()` uses PDF bottom-left
coordinates even though the high-level drawing API uses top-left coordinates.
The rotation argument to `createPage("letter", 90)` swaps named-page dimensions;
`rotate(degrees)` sets `/Rotate` on the current page, including explicitly sized
pages. When both are used, `rotate()` is the last rotation setting and wins,
while the named size's swapped dimensions remain unchanged.
`pageInfo(pageNumber)` returns page geometry for a specific one-based page, and
`getCurrentPageInfo()` returns the same geometry for the active page.
`getPageInfo()` has a similar name but returns document Info metadata, not page
geometry.

Recipe `text()` and `textDimensions()` default to 14 points when both `size`
and `fontSize` are omitted, matching native Recipe. Pass `{ size: 12 }` (or
`{ fontSize: 12 }`) to render and measure at 12 points instead; explicit sizes
remain unchanged.

Use `opacity(value)` to set both fill and stroke alpha for subsequent drawing.
`value` must be a finite number from `0` (transparent) through `1` (opaque).
It remains active for later vector drawing; call `opacity(1)` to restore opaque
output.

## Default And Custom Fonts

Omitting `font` selects `Roboto`; `{ font: "Roboto" }` selects it explicitly
(family names are case-insensitive). By default, `await createRecipe()` dynamically
imports its separate font-data module. The complete regular face adds about
145 KB of font data before encoding/compression. Its bytes are decoded and
registered on the first text or measurement call in each Recipe runtime.
After `Recipe.disposeAssets()` or `Recipe.unregisterFont("Roboto")`,
the next default-font call restores the bundled face automatically. Finish and
dispose active documents before removing their assets.

Only the regular face is included. Bold/italic requests fall back to regular
until you register matching faces; Recipe does not synthesize those styles.
Register fonts covering your text for glyphs outside Roboto's coverage. A font
does not add complex-script shaping or right-to-left layout support.

```js
await Recipe.registerFontAsync("body", fontFile);
await Recipe.registerFontAsync("body", boldFontFile, "bold");
var pdf = new Recipe().createPage("letter");
pdf.text("Custom heading", 72, 72, { font: "body", bold: true });
var bytes = pdf.endPage().endPDF();
pdf.dispose();
Recipe.disposeAssets();
```

A registered `Roboto` family overrides the bundled default. Other explicit
unregistered names still throw `Unknown font: <name>`. Native Recipe also works
without font setup, but defaults to Helvetica; the faces have different metrics
and line wrapping. Select/register the same face on both ends when matching
layout matters. The low-level writer still requires explicit font registration.

See [Byte Assets](byte-assets.md) for custom fonts and
[Create Multi-Page Tables](how-to/create-tables.md) for a zero-setup table.

### Skip Downloading The Bundled Font

Pass your own default font to the async factory to skip importing Roboto entirely.
`defaultFont` accepts `Uint8Array`, `ArrayBuffer`, `Blob`, or `File`:

```js
var Recipe = await createRecipe({ defaultFont: fontFile });
var bytes = new Recipe()
  .createPage("letter")
  .text("Uses my font", 72, 72)
  .endPage()
  .endPDF();
```

Your supplied face becomes the `default` family and is used whenever `font` is
omitted. You can register additional styles under `"default"`. Its bytes are
copied during initialization, respect `limits.maxInputBytes`, and remain
available to restore the configured default after `Recipe.disposeAssets()`.

For an existing named-font registration workflow, disable the automatic default:

```js
var Recipe = await createRecipe({ defaultFont: false });
await Recipe.registerFontAsync("body", fontFile);
var bytes = new Recipe()
  .createPage("letter")
  .text("Uses a named font", 72, 72, { font: "body" })
  .endPage()
  .endPDF();
```

With `defaultFont: false`, text needs an explicitly registered family; omitting
`font` throws `Unknown font: (none)`. The low-level `createMuhammaraWasm()` API
also never imports the bundled font. These choices happen in `createRecipe()`
because text drawing and measurement are synchronous: registering a font later
cannot undo a download already made during initialization.

The separate module is fetched on demand with native ESM or a code-splitting
bundler. Preserve dynamic-import splitting to keep its data out of your main
JavaScript bundle.

## Replace Literal Text

`replaceText(text, replacement, pageNumber)` rewrites literal text-showing
operands in an existing page's content stream, leaving the surrounding text
position and font untouched. Construct Recipe with the source `Uint8Array`;
`pageNumber` is a required one-based page number.

```js
var output = new Recipe(inputBytes).replaceText("Before", "After", 1).endPDF();
```

The match is on the literal string as it appears in the content stream, so text
split across several show operations, or encoded through a font that does not
map to the source characters, is not replaced. Pages with more than one content
stream are rejected with an error. When nothing matches, the page is left
unchanged.

Use `lineStyle({ width, lineWidth, cap, join, miterLimit, dash, dashPhase })`
to set PDF stroke style operators for the current page context. `lineWidth` is
an alias for `width`; omitted properties leave the existing style unchanged:

```javascript
pdfDoc
  .createPage("letter")
  .lineStyle({ width: 2, dash: [6, 3] })
  .line([
    [72, 72],
    [360, 72],
  ])
  .endPage()
  .endPDF();
```

## PDF Version

`version` sets the PDF level written into the byte output. Recipe accepts the
canonical decimal levels `1.0` through `1.7` and `2.0`, and the equivalent
integer enums `10` through `17` and `20` (the `ePDFVersion*` constants on a
loaded runtime). Any other value falls back to `1.7` without an error.

```js
var Recipe = await createRecipe();
var bytes = new Recipe({ version: 2.0 })
  .createPage(595, 842)
  .endPage()
  .endPDF();
// bytes now start with %PDF-2.0; new Recipe({ version: 20 }) is equivalent
```

Read [Differences And Restrictions](differences.md) before relying on HTML,
plugins, password-protected source editing, composition annotations, or Node
Recipe behavior.

Task-oriented Recipe guides:

- [Add Review Annotations](how-to/add-review-annotations.md)
- [Create Multi-Page Tables](how-to/create-tables.md)
- [Flow Text Into Columns](how-to/flow-text-into-columns.md)
- [Watermark Every Page](how-to/watermark-pdfs.md)
- [Add Clickable URL Links](how-to/add-url-links.md)
- [Add Content To Rotated Pages](how-to/add-content-to-rotated-pages.md)
- [Change PDF Passwords](how-to/change-pdf-passwords.md)
- [Place And Transform Images](how-to/place-and-transform-images.md)
