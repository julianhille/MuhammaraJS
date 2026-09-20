# Text And Fonts

Recipe ships fonts in `@muhammara/native-core/fonts` and loads them automatically.
You can call `.createPage("letter").text("Hello", 72, 72)` without registering
anything. The default family is **Helvetica**, with regular, bold, italic, and
bold-italic faces. Arial, Courier New, Georgia, and Roboto Regular are also
bundled; select one with `{ font: "Roboto" }`, for example.

Wasm Recipe also provides zero-setup text, using openly licensed **Roboto
Regular** rather than Helvetica. The default faces have different metrics and
can wrap differently. Select Roboto explicitly on native, or register the same
font on both ends, when you need matching font metrics. Wasm bundles only regular;
register additional styles or glyph coverage as needed.

For custom fonts, register a family name and select the appropriate variant
through text options. Recipe coordinates use a top-left origin and accept
`center` for either coordinate.

Recipe `text()` and `textDimensions()` default to 14 points when `size` is
omitted. Pass `{ size: 12 }` to render and measure at 12 points instead; the
`fontSize` alias selects the same size for both. Zero and `NaN` keep the 14pt
default, while a negative size throws a `RangeError` naming the option and the
value, because a negative size can only produce nonsensical metrics.
Character spacing ignores leading and trailing breakable whitespace but counts
non-breaking spaces, including U+00A0 at either boundary.

```javascript
var pdfDoc = new Recipe("new", "output.pdf", { fontSrcPath: ["./fonts"] });

pdfDoc
  .registerFont("body", "./fonts/body.ttf")
  .registerFont("body", "./fonts/body-bold.ttf", "bold")
  .createPage("letter")
  .text("Heading", "center", 72, {
    font: "body",
    bold: true,
    size: 24,
    align: "center top",
  })
  .endPage()
  .endPDF();
```

Use `textBox` for wrapping, alignment, padding, and styling. `text` also accepts
HTML input with `html: true`, but it is a limited markup parser rather
than a browser layout engine.

Complex-script shaping and right-to-left layout do not have focused coverage and
are not documented as supported behavior.

## Clip Text To A Fixed-Height Box

Set `textBox.clipIfExceedsBox` with an explicit `height` to render only complete
lines that fit. `onClip` receives the current Recipe and a result with the
unrendered `remainder`, `linesWritten`, `clipped`, and the text-box `bounds`.

```javascript
pdfDoc
  .createPage("letter")
  .text("First line fits. Second line is clipped.", 50, 50, {
    size: 12,
    textBox: {
      width: 200,
      height: 15,
      clipIfExceedsBox: true,
      onClip: function (recipe, result) {
        console.log(result.remainder);
      },
    },
  })
  .endPage()
  .endPDF();
```

`onClip` is called only when clipping is enabled and leaves text unrendered. The
library warns when `onClip` is configured without `clipIfExceedsBox`.
