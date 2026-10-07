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
`fontSize` alias selects the same size for both. A size that is not a finite
number greater than zero, including zero, a negative number, `NaN`, and
`Infinity`, throws a `RangeError`
naming the option and the value, because such a size draws nothing readable and
measures to nonsensical metrics. Pass `null`, `undefined`, or neither option to
select the default.

The `defaultFontFamily` and `defaultFontSize` Recipe options change those
defaults for one Recipe. Text that names no `font` uses `defaultFontFamily`,
Helvetica unless set, matched case-insensitively; an unknown `font`, or a style
the family lacks, falls back to the default family in that style and then to
its regular face. Text that gives neither `size` nor `fontSize` uses
`defaultFontSize`, 14 unless set. Wasm Recipe accepts the same options.

```javascript
var pdfDoc = new Recipe("new", "output.pdf", {
  defaultFontFamily: "Roboto",
  defaultFontSize: 11,
});
```

The family is resolved when text is drawn or measured, so it can come from
`fontSrcPath` or a later `registerFont()`; text throws `Unknown font: <name>`
while it is not registered. A `defaultFontFamily` that is not a non-empty
string throws a `TypeError`, and a `defaultFontSize` that is not a finite number
greater than zero throws a `RangeError`, when the Recipe is created.

Character-spacing measurements include retained leading and trailing whitespace
and count each Unicode code point once, so non-BMP characters do not add an
extra spacing interval.

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

## Continue Text Across Calls

Pass `flow: true` to build one text box from several `text()` calls, for
example to style a single word in a sentence. The first call sets the
position; later calls without coordinates continue the line where the previous
run ended and wrap together inside the shared text box. A call without
coordinates flows unless it passes `flow: false`: it continues the open flow
and inherits the options of the runs before it, or starts a flow at the text
cursor.

Flowed text is laid out when the flow ends, so `textBox` justification and
styling apply to the whole box. Set `textBox.textAlign` on the call that
starts the flow, and later runs inherit it; a run that sets a different
alignment is placed by its own, so the runs of one line can overlap. End it with
`flow: false`, which adds that call's text first; `text("", { flow: false })`
ends it without adding any. Inside a flow, `movedown()` ends the current line.
Because the flow is drawn when it ends, shapes or images drawn between its
calls end up beneath its text, and `movedown(lines, true)` reports the flow's
starting position until then.

```javascript
pdfDoc
  .createPage("letter")
  .text("Only ", 72, 72, { flow: true, textBox: { width: 300 } })
  .text("this", { color: "#c62828", bold: true })
  .text(" word is red.", { color: "#000000", bold: false })
  .text("", { flow: false })
  .endPage()
  .endPDF();
```

A flow that is not ended explicitly is drawn by the next `text()` call with
coordinates, `table()`, or `endPage()`.

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
