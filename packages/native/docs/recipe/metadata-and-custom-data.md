# Metadata And Custom Data

Set standard metadata in the constructor or with `info`, and add custom Info
dictionary values with `info({ ReportId: "Q1-2026" })` or
`custom("ReportId", "Q1-2026")`. Both custom-entry spellings match Wasm; the last
call for a given custom key wins. Custom keys belong in method calls, not
constructor options.

```javascript
var pdfDoc = new Recipe("new", "output.pdf", {
  author: "Example Co.",
  title: "Quarterly Report",
  subject: "Q1",
  keywords: ["q1", "report"],
});

pdfDoc.custom("ReportId", "Q1-2026").createPage().endPage().endPDF();
```

Pass `xmp: true` to also write an XMP metadata packet that mirrors the Info
values, and use `xmp()` to read the packet of a source PDF.

`info()` without arguments reads the Info entries of the source overlaid with
the values set on the Recipe, as text, with custom keys in their own spelling.
`info({ Title: "..." })` sets the title like `title` does. Creator, Producer,
CreationDate, ModDate, Trapped and the `source-*` entries are written by Recipe,
and they and an empty key throw a `TypeError`; a source's own `source-*` entries
are reported by `info()` as custom entries. `info(options)` sets the values that `endPDF()` writes. `structure(path)` writes a
debugging view of an opened source PDF.

To add metadata to a document that already exists, including dotted OID keys,
see [Add Metadata to an Existing PDF](../how-to/add-metadata-to-existing-pdfs.md).
