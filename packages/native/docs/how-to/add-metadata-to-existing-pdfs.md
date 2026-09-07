# Add Metadata To An Existing PDF

Open the document with Recipe, set standard fields with `info(options)`, and add
your own Info dictionary keys with `custom(key, value)`. Both queue values that
are written when the document is finalized.

```javascript
var Recipe = require("@muhammara/native").Recipe;
var pdfDoc = new Recipe("input.pdf", "output.pdf");

pdfDoc
  .info({
    author: "Example Clinic",
    title: "Prescription",
    subject: "Issued 2026-03-01",
    keywords: ["prescription", "signed"],
  })
  .custom("2.16.76.1.4.2.2.1", "oid-professional")
  .custom("2.16.76.1.4.2.2.2", "oid-uf-professional")
  .custom("2.16.76.1.12.1.1", "oid-document")
  .endPDF();
```

Omit the output path to write back over the source. `info()` with no arguments
returns the current metadata, which is how you read the values back:

```javascript
var metadata = new Recipe("output.pdf").info();

console.log(metadata["2.16.76.1.4.2.2.1"]); // "oid-professional"
```

`info` covers `author`, `title`, `subject`, and `keywords`; `keywords` accepts an
array and a single value alike. Every other key belongs to `custom`, whose key
and value are both coerced with `toString()`. Any name the PDF Info dictionary
accepts works, including dotted OID strings, so identifiers such as
`2.16.76.1.4.2.2.1` need no escaping.

## What The Round Trip Changes

Three behaviours are worth knowing before you rely on custom entries.

**Keys come back lower-cased.** When `info()` reads a reopened document, custom
names are normalized, so `ReportId` returns as `reportid`. Numeric OID keys are
unaffected because they contain no letters. Read custom values by their
lower-cased name, or use keys that are already lower-case.

**Custom entries do not survive the next modification.** Recipe carries the
standard fields of a source document into its output, but not custom Info
entries, so a second editing pass drops them. Re-apply every `custom` call each
time you rewrite a document that must keep them.

**Recipe stamps its own provenance.** `Producer` and `Creator` are always set to
MuhammaraJS values, and the source document's originals are preserved as
`source-Producer`, `source-Creator`, and `source-ModDate`. `ModDate` is set to
the time of the edit.

These entries live in the document Info dictionary. Writing XMP metadata is a
separate mechanism and is not exposed by Recipe.

See [`tests/recipe/info.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/recipe/info.js)
for the verified workflow, and
[Metadata And Custom Data](../recipe/metadata-and-custom-data.md) for metadata on
newly created documents.
