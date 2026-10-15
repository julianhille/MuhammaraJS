# Add Metadata To An Existing PDF

Open the document with Recipe and set standard fields and custom Info dictionary
keys with `info(options)`, or use `custom(key, value)` for an explicit custom
entry. Both are written to the PDF when `endPDF()` finishes it.

```javascript
var Recipe = require("@muhammara/native").Recipe;
var pdfDoc = new Recipe("input.pdf", "output.pdf");

pdfDoc
  .info({
    author: "Example Clinic",
    title: "Prescription",
    subject: "Issued 2026-03-01",
    keywords: ["prescription", "signed"],
    ReportId: "X-123",
  })
  .custom("2.16.76.1.4.2.2.1", "oid-professional")
  .custom("2.16.76.1.4.2.2.2", "oid-uf-professional")
  .custom("2.16.76.1.12.1.1", "oid-document")
  .endPDF();
```

Omit the output path to write back over the source. `info()` with no arguments
returns the Info entries of the source overlaid with the values set on the
Recipe, as text: the standard fields as `title`, `author`, `subject` and
`keywords`, and custom entries as spelled. The Creator, Producer and ModDate
Recipe writes itself are not included. That is how you read the values back:

```javascript
var metadata = new Recipe("output.pdf").info();

console.log(metadata["2.16.76.1.4.2.2.1"]); // "oid-professional"
```

`info` handles `author`, `title`, `subject`, and `keywords` as standard fields;
`keywords` accepts an array and a single value alike. Other keys are written as
custom Info entries, matching Wasm: `info({ ReportId: "X-123" })` and
`custom("ReportId", "X-123")` write the same entry. Custom array values passed to
`info` are joined with `", "`; other values are converted to strings. When both
methods set the same custom key, the last call wins. Constructor options still
only initialize standard metadata; pass custom keys to `info` or `custom`.
Any other name works, including dotted OID strings, so identifiers such as
`2.16.76.1.4.2.2.1` need no escaping. Info names of the standard fields, such
as `Title`, set those fields; Creator, Producer, CreationDate, ModDate, Trapped
and the `source-*` entries, which Recipe writes itself, and an empty key throw a
`TypeError`.

## What The Round Trip Changes

Two behaviours are worth knowing before you rely on custom entries.

**Custom entries survive the next modification.** Recipe carries the custom Info
entries of a source document into its output with their original spelling, so
`ReportId` is still `ReportId` after any number of editing passes, and `info()`
reports it as `ReportId`. Setting the same key again with `info` or `custom`
replaces the value from the source.

**Recipe stamps its own provenance.** `Producer` and `Creator` are always set to
MuhammaraJS values, and the source document's originals are preserved as
`source-Producer`, `source-Creator`, and `source-ModDate`. `ModDate` is set to
the time of the edit.

These entries live in the document Info dictionary. `recipe.xmp()` returns the
XMP packet of the source PDF as text, or `undefined` when there is none.

An edit leaves the existing XMP packet as it is, so after the edit it can differ
from the new Info values. To make the packet follow the Info dictionary, pass
`xmp: true`:

```javascript
var recipe = new Recipe("in.pdf", "out.pdf", { xmp: true });
recipe.info({ title: "New title" });
recipe.endPDF();
```

The packet is then rebuilt from the Info values the PDF is written with
(title, author, subject, keywords, creator, producer and the two dates), in
place of the old one. Rebuilding replaces everything in the old packet,
including properties that have no Info counterpart (such as rights or custom
schemas) and a PDF/A identification, so a PDF/A document is no longer marked as
one afterwards. A new PDF gets a packet that mirrors its Info values with
`new Recipe("new", output, { xmp: true })`.

An encrypted PDF that keeps its metadata unencrypted (`/EncryptMetadata false`)
is not supported: `recipe.xmp()` and `endPDF()` with `xmp: true` throw for it,
since the packet would be decrypted and encrypted like any other stream.

See [Metadata And Custom Data](../recipe/metadata-and-custom-data.md) for metadata on
newly created documents.
