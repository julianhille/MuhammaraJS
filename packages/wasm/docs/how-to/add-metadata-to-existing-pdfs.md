# Add Metadata To An Existing PDF

Open the document bytes with Recipe, set standard fields with `info(options)`,
and add your own Info dictionary keys with `custom(key, value)`. Both are written
when `endPDF()` returns the finished document.

```javascript
import { createRecipe } from "@muhammara/wasm";

var Recipe = await createRecipe();
var pdf = new Recipe(inputBytes);

var outputBytes = pdf
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

`info()` with no arguments returns the current metadata, which is how you read
the values back:

```javascript
var metadata = new Recipe(outputBytes).info();

console.log(metadata["2.16.76.1.4.2.2.1"]); // "oid-professional"
```

`info` covers `author`, `title`, `subject`, and `keywords`; an array of keywords
is joined into a single Info value. Every other key is added as a custom Info
entry, so `custom(key, value)` is shorthand for `info({ [key]: value })`. Any
name the PDF Info dictionary accepts works, including dotted OID strings, so
identifiers such as `2.16.76.1.4.2.2.1` need no escaping.

## What The Round Trip Changes

Three behaviours are worth knowing before you rely on custom entries.

**Keys come back lower-cased from a reopened document.** While the Recipe is
open, `info()` reports the names you supplied. Read back from the produced bytes
they are normalized, so `ReportId` returns as `reportid`. Numeric OID keys are
unaffected because they contain no letters.

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

See [`tests/recipe/info-composition.test.mjs`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/wasm/tests/recipe/info-composition.test.mjs)
for the verified workflow.
