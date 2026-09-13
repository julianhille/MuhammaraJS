# Text And Fonts

Wasm Recipe bundles Apache-2.0 **Roboto Regular** as its zero-setup default, so
text, text measurement, and tables need no font upload or registration.
`text()` and `textDimensions()` use 14 points when neither `size` nor `fontSize`
is supplied. The two option names are aliases; `{ fontSize: 12 }` and
`{ size: 12 }` both select 12 points.

```js
import { createRecipe } from "@muhammara/wasm";

var Recipe = await createRecipe();
var recipe = new Recipe().createPage("letter");
var heading = recipe.textDimensions("Browser report", { size: 26 });

var pdfBytes = recipe
  .text("Browser report", (612 - heading.width) / 2, 60, {
    size: 26,
    color: "#0f3d5e",
  })
  .text(
    "Recipe wraps this paragraph within a fixed width and keeps all work in memory.",
    72,
    112,
    {
      size: 12,
      textBox: {
        width: 468,
        padding: 12,
        style: { fill: "#edf6ff", stroke: "#9cc5e3" },
      },
    },
  )
  .endPage()
  .endPDF();
```

Roboto is dynamically imported by `createRecipe()` and registered on the first
text or measurement use in each loaded runtime. The complete regular face adds
about 145 KB of font data before encoding and compression. Preserve dynamic
import splitting in your bundler to keep that data out of the main JavaScript
bundle. The low-level `createMuhammaraWasm()` API never imports it, so low-level
writers require explicit font registration before drawing text.

Only Roboto's regular face is bundled. Bold and italic requests fall back to
regular until matching faces are registered, and Recipe does not synthesize
styles. Register fonts that cover glyphs outside Roboto; font registration does
not add complex-script shaping or right-to-left layout. Native Recipe defaults
to Helvetica and bundles more faces, so select the same face on both platforms
when matching metrics, wrapping, or layout matters.

## Custom Fonts

Use `registerFont()` for `Uint8Array` or `ArrayBuffer`, and
`registerFontAsync()` for `Blob` or `File`. Register styles under one family
name, then select them through text options.

```js
import { createRecipe } from "@muhammara/wasm";

var regularFontFile = await (await fetch("/fonts/Report-Regular.ttf")).blob();
var boldFontFile = await (await fetch("/fonts/Report-Bold.ttf")).blob();
var Recipe = await createRecipe({ defaultFont: false });
await Recipe.registerFontAsync("report", regularFontFile);
await Recipe.registerFontAsync("report", boldFontFile, "bold");

var pdfBytes = new Recipe()
  .createPage("letter")
  .text("Custom heading", 72, 72, {
    font: "report",
    bold: true,
    size: 24,
  })
  .text("Custom body", 72, 112, { font: "report", size: 12 })
  .endPage()
  .endPDF();
```

Passing `defaultFont: false` avoids downloading Roboto and requires every text
call to name a registered font; omitting `font` throws `Unknown font: (none)`.
Font family names are case-insensitive, and other unknown explicit names throw
`Unknown font: <name>`. A registered `Roboto` family overrides the bundled
default.

Finish and dispose active documents before unregistering fonts or calling
`Recipe.disposeAssets()`. After bundled Roboto is removed, the next default-font
text or measurement call restores it automatically.

## Custom Default Font

Pass your own `Uint8Array`, `ArrayBuffer`, `Blob`, or `File` as `defaultFont` to
skip importing Roboto and install that face as the `default` family:

```js
import { createRecipe } from "@muhammara/wasm";

var fontFile = await (await fetch("/fonts/Report-Regular.ttf")).blob();
var Recipe = await createRecipe({ defaultFont: fontFile });
var pdfBytes = new Recipe()
  .createPage("letter")
  .text("Uses my default font", 72, 72)
  .endPage()
  .endPDF();
```

Initialization copies the supplied bytes and enforces `limits.maxInputBytes`.
Additional styles can be registered under the `default` family. The configured
bytes remain available to restore that family after `Recipe.disposeAssets()`.
These choices happen in `createRecipe()` because text drawing and measurement
are synchronous; registering a font later cannot undo the initialization-time
font download. See [Byte Assets](../byte-assets.md) for registration and
lifecycle details.

## Wrapping And HTML

`textBox` supports wrapping, alignment, padding, background, border, fixed-height
clipping, and continuation callbacks. Its `clip`, `trim`, and `ellipsis` modes
have different output semantics; Wasm's ellipsis is three ASCII periods
(`...`). `html: true` enables a DOM-free subset for text runs, paragraphs,
simple emphasis, decoration, inline color, URL links through `<a href>`, and
visual unordered and ordered lists through `ul`, `ol`, and `li`. Lists use `* `
or one-based numeric prefixes and native-compatible nesting indentation. Inline
formatting and links remain active inside each item. This is not browser
HTML/CSS layout or semantic tagged-PDF output; arbitrary DOM, general CSS
inheritance, and plugin handlers are unavailable.

```js
recipe.text(
  "<ul><li>First</li><li><b>Important</b><ol><li>Nested</li></ol></li></ul>",
  36,
  72,
  { html: true, textBox: { width: 240 } },
);
```

```js
import { createRecipe } from "@muhammara/wasm";

var Recipe = await createRecipe();
var remainder = "";
var pdfBytes = new Recipe()
  .createPage(300, 180)
  .text("First line fits. The remaining words are reported.", 24, 24, {
    size: 12,
    textBox: {
      width: 180,
      height: 18,
      clipIfExceedsBox: true,
      onClip: function (_recipe, result) {
        remainder = result.remainder;
      },
    },
  })
  .endPage()
  .endPDF();

console.log(remainder, pdfBytes.byteLength);
```
