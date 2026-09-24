# Annotate Existing Text

Add an Underline or StrikeOut annotation to text already present in an
unrotated PDF by extracting its text-showing operations, converting the PDF
bottom-left origin to Recipe's top-left coordinates, then editing the page.

This example marks every exact `Draft` operation. `width` must describe the
known visual bounds in the source template; use a separate region for each
different width.

```javascript
import { createMuhammaraWasm, createRecipe } from "@muhammara/wasm";

var muhammara = await createMuhammaraWasm();
var Recipe = await createRecipe();
var inputBytes = new Uint8Array(await inputFile.arrayBuffer());
var reader = await muhammara.createReaderAsync(inputFile);
var pageNumber = 1; // Recipe pages are one-based.
var pageIndex = pageNumber - 1; // Reader pages are zero-based.
var matches;

try {
  matches = reader.extractPageText(pageIndex).filter(function (element) {
    return element.content === "Draft";
  });
} finally {
  reader.end();
}

var pdf = new Recipe(inputBytes);
var page = pdf.pageInfo(pageNumber);

pdf.editPage(pageNumber);
matches.forEach(function (match) {
  pdf.annot(
    match.textMatrix[4],
    page.height - match.textMatrix[5] - match.fontSize,
    "Underline",
    {
      width: 28,
      height: match.fontSize,
      color: "#008000",
      text: "Reviewed",
    },
  );
});
var outputBytes = pdf.endPage().endPDF();
```

Change `"Underline"` to `"StrikeOut"` to create strikeout annotations. The
reader's `textMatrix` uses PDF's bottom-left coordinates, while Recipe uses a
top-left origin; the `page.height - y - fontSize` conversion above applies to
unrotated pages only.

`extractPageText()` reports a text operation's content, origin, font resource,
and font size. It does not decode every font character map or calculate glyph
bounds, so it cannot accurately derive `width` for arbitrary PDFs. This pattern
is appropriate for a controlled template where the target text and its bounds
are known. For arbitrary documents, obtain glyph bounds from another layout or
text-analysis tool before creating the annotation. See [Find Text Positions In
A PDF](find-text-positions.md) for the extractor's complete limitations, and
[Add Review Annotations](add-review-annotations.md) for annotation options.
