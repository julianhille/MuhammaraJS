# Inspect PDF Objects

Use the low-level reader to inspect PDF dictionaries and their indirect objects.
This is useful when identifying page resources before building a PDF optimizer.
It does not extract or recompress image bytes; that requires handling each
resource's stream and filters yourself.

```javascript
var muhammara = require("@muhammara/native");

function dereference(reader, object) {
  var reference = object.toPDFIndirectObjectReference();
  return reference ? reader.parseNewObject(reference.getObjectID()) : object;
}

function inspectPageXObjects(inputPath, pageIndex) {
  var reader = muhammara.createReader(inputPath);

  try {
    var page = reader.parsePageDictionary(pageIndex);
    var resources = reader.queryDictionaryObject(page, "Resources");
    var xObjects =
      resources &&
      reader.queryDictionaryObject(resources.toPDFDictionary(), "XObject");

    if (!xObjects) {
      return [];
    }

    return Object.keys(xObjects.toPDFDictionary().toJSObject()).map(
      function (name) {
        var entry = xObjects.toPDFDictionary().queryObject(name);
        var reference = entry.toPDFIndirectObjectReference();
        var object = dereference(reader, entry);
        var dictionary = object.toPDFStream().getDictionary();
        var subtype = reader.queryDictionaryObject(dictionary, "Subtype");

        return {
          name: name,
          objectId: reference ? reference.getObjectID() : undefined,
          subtype: subtype ? subtype.toPDFName().value : undefined,
        };
      },
    );
  } finally {
    reader.end();
  }
}

console.log(inspectPageXObjects("input.pdf", 0));
```

Page indexes are zero-based. `queryDictionaryObject` resolves a dictionary entry
when it is an indirect reference; entries returned by `queryObject()` do not,
so resolve those through their object ID before inspecting them. Reader-owned
objects become invalid after `reader.end()`, so convert the properties you need
to plain JavaScript values first.

Not every XObject is an image: `Subtype` can be `Image`, `Form`, or another
PDF-defined type. Inspect stream dictionaries before assuming an object can be
recompressed. See [Read PDFs](../low-level/read-pdfs.md) for reader lifecycle
and [Write PDF Objects](../low-level/write-pdf-objects.md) for low-level output.
