# Text And Fonts

Register fonts under a family name, then select the appropriate variant through
text options. Recipe coordinates use a top-left origin and accept `center` for
either coordinate.

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
tested HTML input with `html: true`, but it is a limited markup parser rather
than a browser layout engine. Font and text behavior is covered by
[`tests/recipe/font.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/recipe/font.js), [`tests/recipe/text.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/recipe/text.js), and
[`tests/recipe/htmlToTextObjects.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/recipe/htmlToTextObjects.js).

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
library warns when `onClip` is configured without `clipIfExceedsBox`. See
[`tests/recipe/text-clip.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/recipe/text-clip.js).
