# Write PDF/A Documents

PDF/A (ISO 19005) is the archival profile of PDF: a document carries what it
needs to look the same later, and leaves out what could change or hide its
content. Recipe writes a new PDF as PDF/A when it is given the `pdfa` option:

```javascript
import { createRecipe } from "@muhammara/wasm";

var Recipe = await createRecipe();
var pdf = new Recipe({
  title: "Annual Report",
  author: "Example Co.",
  pdfa: {
    level: Recipe.PdfA.A2B,
    iccProfile: profileBytes,
    outputCondition: "sRGB IEC61966-2.1",
  },
});

var pdfBytes = pdf
  .createPage("a4")
  .text("Annual Report", 72, 72, { size: 24 })
  .endPage()
  .endPDF();
```

## Choose The Level

| `Recipe.PdfA` | Level      | PDF | What it adds                                         |
| ------------- | ---------- | --- | ---------------------------------------------------- |
| `A1B`         | PDF/A-1b   | 1.4 | The oldest level; no transparency, no attached files |
| `A2B`, `A2U`  | PDF/A-2b/u | 1.7 | Transparency                                         |
| `A3B`, `A3U`  | PDF/A-3b/u | 1.7 | Attached files of any type                           |
| `A4`, `A4E`   | PDF/A-4/4e | 2.0 | Document information in XMP only                     |
| `A4F`         | PDF/A-4f   | 2.0 | At least one attached file of any type               |

`U` levels also require text to map to Unicode, which Recipe's embedded fonts
always do. Recipe writes the PDF version of the level; a `version` option that
asks for another one throws. The accessible levels (PDF/A-1a, 2a and 3a) need
tagged PDF, which Recipe does not write yet.

## Supply The Output Intent Profile

PDF/A describes the colors of a document through an output intent: an ICC
profile of the device or color space the document is made for. Recipe does
not bundle one, so pass the bytes of the profile your organization uses, as a
`Uint8Array` or `ArrayBuffer`, with the identifier of its output condition
(`Custom` when omitted).

The profile's color space decides which colors the document may use:

- an RGB profile allows RGB and gray colors and images;
- a CMYK profile allows CMYK and gray;
- a gray profile allows gray only.

Text and shapes without a color of their own take the default color of the
profile's color space. Recipe converts no colors: give the others in that
color space or in gray.

It must be a monitor or printer (output) profile, of ICC version 2 or earlier
for PDF/A-1 and 4 or earlier for the other levels.

## What Recipe Rejects

Recipe checks each call against the level and throws instead of writing a
document that does not conform:

- **Transparency** in PDF/A-1: an opacity below 1, and PNG images with an alpha
  channel or a transparent color.
- **Colors and images** the output intent does not describe, such as a CMYK
  JPEG with an RGB profile, and annotation colors in PDF/A-1 without an RGB
  profile.
- **Hidden annotations**: annotations are flagged for printing, and the
  `hidden`, `invisible`, `noview` and `togglenoview` flags throw.
- **Annotation subtypes** other than those PDF/A-1 allows: text, link, free
  text, line, square, circle, text markup, stamp, ink and popup.
- **Annotations without an appearance stream** from PDF/A-2 on: links, popups
  and comments without a size are allowed; highlights and other annotations
  with an area are not, because Recipe writes no appearance for them.
- **Custom Info entries** in PDF/A-4, which keeps the document information in
  XMP only; Recipe writes no Info dictionary there.
- **Encryption**, and editing an existing PDF: the option applies to new PDFs.
- **`insertPage()`**, which copies the pages into a new PDF without the PDF/A
  settings or attached files.

Recipe does not check:

- TIFF images, and the pages it takes from other PDFs with `image()`,
  `appendPage()` or `overlay()`.
- Text the font has no glyph for, which PDF/A-2 and later forbid, and
  control characters such as tabs and soft hyphens: pick a font that covers
  the text and pass printable characters only.
- The implementation limits: page sizes from 3 to 14400 units in PDF/A-2 and
  3, strings of at most 32767 bytes (65535 in PDF/A-1), and numbers up to
  32767 in PDF/A-1.

The title, author, subject, keywords and dates are written to XMP metadata
that identifies the PDF/A level; read it back with `xmp()` on a Recipe of
the written PDF.

## Attach Files

PDF/A-3 and PDF/A-4f carry attached files, such as the XML of an e-invoice.
`attach()` adds one to a new PDF, with how it relates to the document:

```javascript
var invoice = new Recipe({
  pdfa: {
    level: Recipe.PdfA.A3B,
    iccProfile: profileBytes,
    outputCondition: "sRGB IEC61966-2.1",
  },
});

var invoiceBytes = invoice
  .createPage("a4")
  .text("Invoice 2026-001", 72, 72)
  .endPage()
  .attach("factur-x.xml", xmlBytes, {
    mimeType: "text/xml",
    description: "Invoice data",
    relationship: Recipe.AFRelationship.DATA,
  })
  .endPDF();
```

`attach()` works without `pdfa` too. PDF/A-1 allows no attached files, and
PDF/A-2, 4 and 4e only files that are PDF/A themselves, which Recipe does not
check, so it throws there. PDF/A-4f throws at `endPDF()` without one.

## Check The Result

Validate archival documents with a PDF/A validator such as
[veraPDF](https://verapdf.org/). The repository validates the PDF/A samples
of its tests with `npm run test:pdfa`.
