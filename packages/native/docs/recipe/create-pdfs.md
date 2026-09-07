# Create PDFs With Recipe

Import `Recipe` from MuhammaraJS and create a new document with an output path.
Recipe coordinates use a top-left origin, unlike the low-level API's PDF-native
bottom-left origin.

```javascript
var Recipe = require("@muhammara/native").Recipe;
var pdfDoc = new Recipe("new", "output.pdf", {
  version: 1.6,
  author: "John Doe",
  title: "A brand new PDF",
});

pdfDoc.createPage("letter").endPage().endPDF();
```

Pages accept named sizes such as `letter` and `A4`. Within a page, use chainable
methods such as `text`, `circle`, `polygon`, `rectangle`, `image`, and `comment`.
Call `endPage()` before creating or editing another page.

## PDF Version

`version` sets the PDF level written into the file header. Recipe accepts the
canonical decimal levels `1.0` through `1.7` and `2.0`. Any other value falls
back to `1.7` without an error, so check the header when a specific level
matters.

```javascript
var pdfDoc = new Recipe("new", "output.pdf", { version: 2.0 });

pdfDoc.createPage("letter").endPage().endPDF();
// output.pdf now starts with %PDF-2.0
```

The low-level `createWriter` API takes the integer enums instead; see
[Create A PDF](../low-level/create-a-pdf.md). Version handling is exercised in
[`tests/recipe/version.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/recipe/version.js).

## Buffer Output

Pass `Buffer.from("new")` as the input and omit the output path to receive the
completed PDF through the `endPDF` callback.

```javascript
var pdfDoc = new Recipe(Buffer.from("new"));

pdfDoc
  .createPage("letter")
  .endPage()
  .endPDF(function (pdfBuffer) {
    // pdfBuffer is a Buffer containing the PDF.
  });
```

`endPDF()` does not return the Buffer. Buffer mode is exercised in
[`tests/recipe/createWithBuffer.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/recipe/createWithBuffer.js); general creation examples are in
[`tests/recipe/create.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/recipe/create.js).
