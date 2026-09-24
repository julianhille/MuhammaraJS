# Read PDF Bookmarks

PDF bookmarks are outline dictionaries rooted at the catalog's `Outlines`
entry. Traverse `First` for children and `Next` for siblings. This example
returns bookmark titles and one-based page numbers for direct array
destinations.

```javascript
var muhammara = require("@muhammara/native");

function entry(reader, dictionary, key) {
  return dictionary.exists(key)
    ? reader.queryDictionaryObject(dictionary, key)
    : undefined;
}

function destinationPage(reader, item, pageNumbers) {
  var destination = entry(reader, item, "Dest");
  var array = destination && destination.toPDFArray();
  var page = array && array.queryObject(0).toPDFIndirectObjectReference();

  return page ? pageNumbers[page.getObjectID()] || null : null;
}

function readItems(reader, item, pageNumbers) {
  var items = [];

  while (item) {
    var title = entry(reader, item, "Title");
    var first = entry(reader, item, "First");

    items.push({
      title: title ? title.toText() : "",
      page: destinationPage(reader, item, pageNumbers),
      children: first
        ? readItems(reader, first.toPDFDictionary(), pageNumbers)
        : [],
    });

    var next = entry(reader, item, "Next");
    item = next ? next.toPDFDictionary() : undefined;
  }

  return items;
}

function readBookmarks(inputPath) {
  var reader = muhammara.createReader(inputPath);

  try {
    var pageNumbers = {};
    for (var index = 0; index < reader.getPagesCount(); ++index) {
      pageNumbers[reader.getPageObjectID(index)] = index + 1;
    }

    var catalog = entry(reader, reader.getTrailer(), "Root").toPDFDictionary();
    var outlines = entry(reader, catalog, "Outlines");
    var first = outlines && entry(reader, outlines.toPDFDictionary(), "First");

    return first ? readItems(reader, first.toPDFDictionary(), pageNumbers) : [];
  } finally {
    reader.end();
  }
}

console.log(JSON.stringify(readBookmarks("input.pdf"), null, 2));
```

The direct destination array begins with an indirect reference to a page; the
example maps that object ID to a one-based page number. A bookmark can instead
use a named destination or an `A` action such as `GoToR`, `URI`, or `Launch`.
Those cases intentionally return `null` here and need application-specific
handling. A PDF without an `Outlines` entry has no bookmarks and returns `[]`.

This uses the low-level reader rather than Recipe. See [Inspect PDF
Objects](inspect-pdf-objects.md) for dictionary and indirect-object traversal.
