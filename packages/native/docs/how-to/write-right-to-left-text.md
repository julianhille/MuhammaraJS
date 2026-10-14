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
as without; `"rtl"` still moves punctuation at its edges, and spaces at its
start, to the other end, so `"Hello world!"` draws as `"!Hello world"`.

Use a font that has Hebrew glyphs and, for numbers and Latin words inside
Hebrew, Latin glyphs too, such as Arial. Recipe's default Helvetica has no
Hebrew. Its bundled `"Arial"` has them in its regular
face only: bold and italic text, such as HTML `<b>` and table headers, falls
back to Helvetica, so register bold and italic Hebrew faces for it with
`registerFont()` and a `Recipe.FontStyle`.

## Low Level

```javascript
var muhammara = require("@muhammara/native");
var writer = muhammara.createWriter("hebrew.pdf");
var page = writer.createPage(0, 0, 595, 842);
var font = writer.getFontForFile("./fonts/arial.ttf");
var context = writer.startPageContentContext(page);
var options = {
  font: font,
  size: 14,
  direction: muhammara.TextDirection.AUTO,
};

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
writer.end();
```

`calculateTextDimensions()` measures the string as given, in the order it is
typed, so leave invisible direction marks out of the text you measure. The
drawn text can end a fraction of a point from that measure, as its last glyph
is another one, and points drawn before their letters reach a little further.
To end lines exactly at an edge, use Recipe with `textAlign: "right"`, which
measures the text as it is drawn.

## Recipe

Recipe wraps text in logical order and then reorders each line with the
levels of its whole paragraph, as the Unicode Bidirectional Algorithm does: the
first words of a paragraph stay on its first line, and a comma or bracket at a
wrap stays with the text it belongs to. Set `textAlign` to `right`
for right-to-left paragraphs; alignment is not changed automatically.

```javascript
var muhammara = require("@muhammara/native");

new muhammara.Recipe("new", "recipe-hebrew.pdf")
  .createPage(595, 842)
  .text("השועל החום המהיר קפץ מעל הכלב העצלן", 72, 72, {
    font: "Arial",
    size: 14,
    direction: muhammara.Recipe.TextDirection.AUTO,
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
- A line made of several styled runs, from HTML or from flowed `text()`
  calls, is reordered as one line, so `<p>שלום <b>עולם</b></p>` reads in the
  right order. Every line of an HTML paragraph takes that paragraph's
  direction, even a line inside one styled run; a `<br>` starts a paragraph
  of its own.
- A flowed `text()` call keeps the `direction` it asks for. A call whose
  direction differs from its line's is placed in the line as one block, like
  a word: an `"rtl"` or `"ltr"` call is reordered on its own, and a `"none"`
  call is drawn exactly as given. An `"auto"` call continues its paragraph,
  whose direction comes from its first letter, even when an earlier call of
  it asked for `"rtl"` or `"ltr"`: give each call of a right-to-left
  paragraph that starts with a Latin word `"rtl"`.
  A call without a `direction` keeps the one before it, as it keeps the font
  and size, so pass `"none"` for a run you already wrote in visual order.
- `onClip` receives the text that did not fit as `remainder`, with a line
  break between each two of its lines. With `"auto"`, each of those lines takes the
  direction of its own first letter, so one whose first letter is Latin
  turns left to right; write the remainder with the paragraph's
  direction, such as `"rtl"`, instead.
- A table's cells and headers take the `direction` of their column, or of
  the table; a header or cell option of its own wins.
- `textDimensions()` takes the same `direction` option and then measures the
  text as `text()` draws it, in visual order and without invisible direction
  marks, which can change `xMin` and `xMax`.

## Choose the Paragraph Direction

The `direction` option of `writeText()` and `text()` takes a `TextDirection`
value, also available as `Recipe.TextDirection`:

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
- A line of HTML or flowed `text()` calls, even of one styled run, is
  wrapped by its width as typed, so it can end a fraction of a point past
  the edge of its box.
- A line is measured for wrapping on its own, while it is drawn with the
  levels of its whole paragraph, so a line whose order the rest of its
  paragraph changes can end a fraction of a point past the edge of its box.
  A box that clips its text with `clipIfExceedsBox` reorders the lines it
  draws with the part of the paragraph it keeps.
- HTML direction markup, such as `dir="rtl"`, `<bdi>` and `<bdo>`, is not
  read; set `direction` on the `text()` call instead.
- Every line break ends a paragraph, U+2028, U+000B and U+000C included, so
  `"auto"` takes the direction again after each of them. The Unicode
  Bidirectional Algorithm continues a paragraph across those three.
- The PDF stores the text in visual order, so copying or extracting it, for
  example with `extractPageText()`, returns the visual order. `replaceText()`
  also matches and writes text in the order it is stored.
