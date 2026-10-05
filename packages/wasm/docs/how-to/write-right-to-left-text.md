# Write Right-to-Left Text

Hebrew is typed in logical order, the order it is read, but a PDF draws the
glyphs of a text run from left to right in the order they are written. Pass
`direction: "auto"` to `writeText()` or Recipe `text()` and right-to-left text
is reordered into visual order before it is drawn, with the Unicode
Bidirectional Algorithm:

- Hebrew runs are reversed, while numbers and Latin words inside them keep
  their order: `מחיר 120 ש״ח` draws as `ח״ש 120 ריחמ`.
- Brackets inside Hebrew runs are mirrored, so `(עולם)` keeps its parentheses
  facing the right way.
- Points (niqqud) and other combining marks stay on their letter.
- Invisible direction marks, such as U+200F RIGHT-TO-LEFT MARK, steer the
  order and are neither drawn nor measured.

Without a `direction`, text is drawn exactly as given, as in earlier versions.
With `"auto"` or `"ltr"`, text without right-to-left characters draws the same
as without; `"rtl"` still moves punctuation and spaces at its edges to the
other end, so `"Hello world!"` draws as `"!Hello world"`.

Use a font that has Hebrew glyphs, such as Arial or Noto Sans Hebrew, and
register its bytes; the bundled Roboto default has none.

## Low Level

```javascript
import { TextDirection, createMuhammaraWasm } from "@muhammara/wasm";

var muhammara = await createMuhammaraWasm();
muhammara.registerFont("hebrew", hebrewFontBytes);
var writer = muhammara.createWriter();
var page = writer.createPage(0, 0, 595, 842);
var font = writer.getFontForBytes("hebrew");
var context = writer.startPageContentContext(page);
var options = { font: font, size: 14, direction: TextDirection.AUTO };

context
  .writeText("שלום עולם", 72, 760, options)
  .writeText("מחיר 120 ש״ח", 72, 730, options);
```

`x` is still the left edge of the drawn text. To end a right-to-left line at a
right margin, subtract where its glyphs end, `xMax`:

```javascript
var text = "שלום עולם";
var width = font.calculateTextDimensions(text, 14).xMax;
context.writeText(text, 523 - width, 700, options);

writer.writePage(page);
var outputBytes = writer.end();
```

`calculateTextDimensions()` measures the string as given, so leave invisible
direction marks out of the text you measure.

## Recipe

Recipe wraps text in logical order and reorders each line on its own, so the
first words of a paragraph stay on its first line. Set `textAlign` to `right`
for right-to-left paragraphs; alignment is not changed automatically.

```javascript
import { createRecipe } from "@muhammara/wasm";

var Recipe = await createRecipe();
Recipe.registerFont("hebrew", hebrewFontBytes);

var outputBytes = new Recipe()
  .createPage(595, 842)
  .text("השועל החום המהיר קפץ מעל הכלב העצלן", 72, 72, {
    font: "hebrew",
    size: 14,
    direction: Recipe.TextDirection.AUTO,
    textBox: { width: 200, textAlign: "right" },
  })
  .endPage()
  .endPDF();
```

- Justified lines place their words from right to left, and the last line of
  a right-to-left paragraph ends at the right edge.
- An indent, such as that of a list item, stays at the start of the line:
  the right edge of a right-to-left line.
- With `wrap: "clip"`, a right-to-left line that overflows its box keeps
  its start and loses its end, on the left.
- A line made of several styled HTML runs is reordered as one line, so
  `<p>שלום <b>עולם</b></p>` reads in the right order. Every line of an HTML
  paragraph takes that paragraph's direction, even a line inside one styled
  run.
- `textDimensions()` takes the same `direction` option and then leaves out
  invisible direction marks, as `text()` does.

## Choose the Paragraph Direction

The `direction` option of `writeText()` and `text()` takes a `TextDirection`
value, exported as `TextDirection` and also available as
`Recipe.TextDirection`:

| Value    | Paragraph direction                                                            |
| -------- | ------------------------------------------------------------------------------ |
| `"none"` | Default. No reordering: the text is drawn exactly as given.                    |
| `"auto"` | Each paragraph takes the direction of its first strong letter.                 |
| `"rtl"`  | Right to left, for Hebrew paragraphs that start with a Latin word or a number. |
| `"ltr"`  | Left to right; Hebrew words inside are still reordered.                        |

The paragraph direction decides where Latin words and punctuation at the
edges go: `"abc שלום"` draws as `abc םולש` in a left-to-right paragraph and as
`םולש abc` in a right-to-left one. Any other value throws a `TypeError` before
anything is drawn.

Text you already reverse yourself before calling `writeText()` or `text()`
draws correctly with the default. Either keep it that way or drop your own
reversal and pass `"auto"`; doing both reverses the text twice.

## Limits

- Arabic and other scripts that join their letters are reordered but not
  shaped, so their letters do not connect. Only Hebrew is supported.
- Points (niqqud) are drawn before their letter, where most Hebrew fonts,
  such as Arial and Noto Sans Hebrew, expect them, but they are not positioned
  by the font's shaping rules. In fonts that rely on those rules some points
  sit slightly off.
- The PDF stores the text in visual order, so copying or extracting it, for
  example with `extractPageText()`, returns the visual order. `replaceText()`
  also matches and writes text in the order it is stored.
