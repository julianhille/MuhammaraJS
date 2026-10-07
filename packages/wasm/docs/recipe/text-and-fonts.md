# Text And Fonts

Wasm Recipe bundles Apache-2.0 **Roboto Regular** as its zero-setup default, so
text, text measurement, and tables need no font upload or registration.
`text()` and `textDimensions()` use 14 points when neither `size` nor `fontSize`
is supplied. The two option names are aliases; `{ fontSize: 12 }` and
`{ size: 12 }` both select 12 points. A size that is not a finite number greater
than zero, including zero, a negative number, `NaN`, and `Infinity`, throws a `RangeError` naming the
option and the value, as it does on native, because such a size draws nothing
readable and measures to nonsensical metrics. Pass `null`, `undefined`, or
neither option to select the default.
Character-spacing measurements include retained leading and trailing whitespace
and count each Unicode code point once, so non-BMP characters do not add an
extra spacing interval.

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

## Per-Recipe Defaults

The `defaultFontFamily` and `defaultFontSize` Recipe options set the family and
size that text and `textDimensions()` use when a call names no `font` or gives
neither `size` nor `fontSize`. They apply to one Recipe only, take the same
values as on native, and default to the `createRecipe()` default font and 14
points:

```js
var Recipe = await createRecipe();
await Recipe.registerFontAsync("report", fontFile);

var pdfBytes = new Recipe({ defaultFontFamily: "report", defaultFontSize: 11 })
  .createPage("letter")
  .text("Report body at 11 points", 72, 72)
  .endPage()
  .endPDF();
```

`registerFont()` and `registerFontAsync()` take an `isDefault` boolean after
the style that also makes the registered family the default. On a Recipe it
sets that Recipe's default, as the option does. On the `Recipe` constructor it
sets the default of every Recipe from that `createRecipe()` runtime, including
ones already created. The latest default set applies: a static registration
overrides the option of earlier Recipes, a Recipe created later or a later
instance registration overrides the static one for that Recipe, and
`Recipe.disposeAssets()`, or `Recipe.unregisterFont()` removing the family's
last style, removes the static default with the fonts.

```js
await Recipe.registerFontAsync("report", fontFile, "regular", true);
var recipe = new Recipe(); // uses "report"
```

The family name is case-insensitive and is resolved when text is drawn or
measured, so it can be registered after the Recipe is created; text throws
`Unknown font: <name>` while it is not registered. A `defaultFontFamily` that
is not a non-empty string throws a `TypeError`, and a `defaultFontSize` that is
not a finite number greater than zero throws a `RangeError`, when the Recipe
is created.

## Wrapping And HTML

`textBox` supports wrapping, alignment, padding, background, border, fixed-height
clipping, and continuation callbacks. Its `clip`, `trim`, and `ellipsis` modes
have different output semantics; `ellipsis` ends the line with `…`, as native
does. `html: true` enables a DOM-free subset for text runs, paragraphs,
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

## Continue Text Across Calls

Pass `flow: true` to build one text box from several `text()` calls, for
example to style a single word in a sentence. The first call sets the
position; later calls without coordinates continue the line where the previous
run ended and wrap together inside the shared text box. A call without
coordinates flows unless it passes `flow: false`: it continues the open flow
and inherits the options of the runs before it, or starts a flow at the text
cursor.

Flowed text is laid out when the flow ends, so `textBox` alignment,
justification, and styling apply to the whole box. End it with
`flow: false`, which adds that call's text first; `text("", { flow: false })`
ends it without adding any. Inside a flow, `movedown()` ends the current line.
Because the flow is drawn when it ends, shapes or images drawn between its
calls end up beneath its text, and `movedown(lines, true)` reports the flow's
starting position until then.

```js
var pdfBytes = new Recipe()
  .createPage("letter")
  .text("Only ", 72, 72, { flow: true, textBox: { width: 300 } })
  .text("this", { color: "#c62828", hilite: true })
  .text(" word is marked.", { color: "#000000", hilite: false })
  .text("", { flow: false })
  .endPage()
  .endPDF();
```

A flow that is not ended explicitly is drawn by the next `text()` call with
coordinates, `table()`, or `endPage()`.
