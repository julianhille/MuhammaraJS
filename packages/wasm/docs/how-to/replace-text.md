# Replace Text In An Existing PDF

Use Recipe's `replaceText(text, replacement, pageNumber)` to change a word or
phrase on an existing page while keeping its position and font. The example
reads the page back afterwards to report how many text operations changed.

```javascript
import { createMuhammaraWasm, createRecipe } from "@muhammara/wasm";

var muhammara = await createMuhammaraWasm();
var Recipe = await createRecipe();

/**
 * Reads the decoded text of each text-showing operation on a page.
 *
 * @param {Uint8Array} bytes PDF bytes.
 * @param {number} pageIndex Zero-based page index.
 * @returns {string[]} Decoded texts in drawing order.
 */
function pageTexts(bytes, pageIndex) {
  var reader = muhammara.createReader(bytes);

  try {
    return reader.extractPageText(pageIndex).map(function (element) {
      return element.text;
    });
  } finally {
    reader.end();
  }
}

/**
 * Replaces `text` with `replacement` on one page, keeping its position and
 * font.
 *
 * @param {Uint8Array} inputBytes Source PDF bytes.
 * @param {number} pageNumber One-based page number.
 * @param {string} text Text to replace.
 * @param {string} replacement Replacement text.
 * @returns {{bytes: Uint8Array, changed: number}} The new PDF bytes and the
 * number of text operations that changed.
 * @throws {Error} If the font has no glyph for a character of `replacement`.
 */
function replacePageText(inputBytes, pageNumber, text, replacement) {
  var outputBytes = new Recipe(inputBytes)
    .replaceText(text, replacement, pageNumber)
    .endPDF();

  var pageIndex = pageNumber - 1; // Reader pages are zero-based.
  var after = pageTexts(outputBytes, pageIndex);
  var changed = pageTexts(inputBytes, pageIndex).filter(
    function (before, index) {
      return before === text && after[index] === replacement;
    },
  ).length;
  return { bytes: outputBytes, changed: changed };
}

var inputBytes = new Uint8Array(await inputFile.arrayBuffer());
var result = replacePageText(
  inputBytes,
  1,
  "Status: in Prüfung",
  "Status: geprüft",
);
```

`replaceText()` decodes each text-showing operation through its font, so `text`
and `replacement` are ordinary Unicode strings, including non-ASCII text that
the PDF stores as glyph IDs. The replacement is written back through the same
font, and the rest of the page keeps its exact bytes.

## When Nothing Changes

`replaceText()` matches whole `Tj` operations whose decoded text equals `text`.
When `result.changed` is `0`, list what the page shows with
`extractPageText()` and compare its `text` values with the string you passed.
Common reasons for no match:

- The phrase is split across several operations, for example one per word or
  per kerning adjustment. `TJ`, `'`, and `"` operations are not replaced.
- The font maps a character differently than expected. A Type 1 font without an
  `/Encoding` uses StandardEncoding, where `'` is the right single quotation
  mark, so `(don't)` decodes as `don’t`.
- The text is inside a Form XObject, such as content added with `editPage()`.
  Only the page's own content stream is searched.

Pages with more than one content stream throw an error.

## When A Glyph Is Missing

A replacement can only use glyphs the font already has. Embedded fonts are
usually subset to the characters of their original text, so a replacement with
any other character throws an error that names the missing characters. On a
page that shows only `Draft`, `Status: in Prüfung`, and `Status: geprüft`,
replacing with `Status: abgelehnt` fails with:

```text
replaceText cannot write the replacement: font FN1 has no glyph for "b", "l", "h"
```

No PDF bytes are returned in that case. Build the replacement from characters
the page already shows in that font, or remove the old text and draw new text in
a font of your choice, as in [Replace A PDF's Text
Layer](replace-text-layer.md).

`replaceText()` also throws when the font cannot be read, or when its `/Widths`
array is malformed, so it cannot tell which glyphs the font has:

```text
replaceText cannot write the replacement: font F1 has a malformed /Widths array
```

See [Modify And Inspect PDFs](../recipe/modify-and-inspect.md#replace-text) for
the Recipe reference and [Find Text Positions](find-text-positions.md) for how
text is decoded.
