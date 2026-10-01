# Write Right-to-Left Text

Hebrew is typed in logical order, the order it is read, but a PDF draws the
glyphs of a text run from left to right in the order they are written.
`writeText()` and Recipe `text()` therefore reorder right-to-left text into
visual order before drawing it, with the Unicode Bidirectional Algorithm:

- Hebrew runs are reversed, while numbers and Latin words inside them keep
  their order: `מחיר 120 ש״ח` draws as `ח״ש 120 ריחמ`.
- Brackets inside Hebrew runs are mirrored, so `(עולם)` keeps its parentheses
  facing the right way.
- Points (niqqud) and other combining marks stay on their letter.
- Invisible direction marks, such as U+200F RIGHT-TO-LEFT MARK, steer the
  order and are not drawn.

Text without right-to-left characters is drawn exactly as before.

Use a font that has Hebrew glyphs, such as Arial or Noto Sans Hebrew. Recipe's
default Helvetica has none; its bundled `"Arial"` has them.

## Low Level

```javascript
var muhammara = require("@muhammara/native");
var writer = muhammara.createWriter("hebrew.pdf");
var page = writer.createPage(0, 0, 595, 842);
var font = writer.getFontForFile("./fonts/arial.ttf");

writer
  .startPageContentContext(page)
  .writeText("שלום עולם", 72, 760, { font: font, size: 14 })
  .writeText("מחיר 120 ש״ח", 72, 730, { font: font, size: 14 });

writer.writePage(page);
writer.end();
```

`x` is still the left edge of the drawn text. To end a right-to-left line at a
right margin, subtract its width:

```javascript
var text = "שלום עולם";
var width = font.calculateTextDimensions(text, 14).width;
context.writeText(text, 523 - width, 700, { font: font, size: 14 });
```

## Recipe

Recipe wraps text in logical order and reorders each line on its own, so the
first words of a paragraph stay on its first line. Set `textAlign` to `right`
for right-to-left paragraphs; alignment is not changed automatically. Justified
lines place their words from right to left.

```javascript
var muhammara = require("@muhammara/native");

new muhammara.Recipe("new", "recipe-hebrew.pdf")
  .createPage(595, 842)
  .text("השועל החום המהיר קפץ מעל הכלב העצלן", 72, 72, {
    font: "Arial",
    size: 14,
    textBox: { width: 200, textAlign: "right" },
  })
  .endPage()
  .endPDF();
```

## Choose the Paragraph Direction

The `direction` option of `writeText()` and `text()` takes a `TextDirection`
value, also available as `Recipe.TextDirection`:

| Value    | Paragraph direction                                                              |
| -------- | -------------------------------------------------------------------------------- |
| `"auto"` | Default. Each paragraph takes the direction of its first Hebrew or Latin letter. |
| `"rtl"`  | Right to left, for Hebrew paragraphs that start with a Latin word or a number.   |
| `"ltr"`  | Left to right; Hebrew words inside are still reordered.                          |
| `"none"` | No reordering: the text is drawn exactly as given.                               |

The paragraph direction decides where Latin words and punctuation at the
edges go: `"abc שלום"` draws as `abc םולש` in a left-to-right paragraph and as
`םולש abc` in a right-to-left one. Any other value throws a `TypeError` before
anything is drawn.

If your code already reverses Hebrew before calling `writeText()` or `text()`,
pass `direction: "none"`, or remove the reversal, so the text is not reversed
twice.

## Limits

- Arabic and other scripts that join their letters are reordered but not
  shaped, so their letters do not connect. Only Hebrew is supported.
- Points (niqqud) stay on their letter but are not positioned by the font's
  shaping rules, so some sit slightly off, for example the shin dot of `שׁ`
  appears a little to the right of the letter. Plain Hebrew without points is
  unaffected.
- A Recipe text box with `wrap: "clip"` cuts lines at the right edge, which
  is where a right-to-left line starts. Use another `wrap` mode for
  right-to-left text that may overflow.
- The PDF stores the text in visual order, so copying or extracting it, for
  example with `extractPageText()`, returns the visual order.
- In Recipe HTML text and in flowed text spanning several `text()` calls, each
  styled run is reordered on its own, and the runs of a line keep their
  left-to-right placement.
