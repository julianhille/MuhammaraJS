# Edit Or Remove An Existing Annotation

Recipe creates annotations, but changing one that is already in a document is a
low-level operation: find the annotation object, then rewrite it through the
objects context of a modifying writer.

## Find The Annotation

A page dictionary's `Annots` entry is an array of indirect references, one per
annotation. Resolve it with `queryDictionaryObject` so the lookup also works when
`Annots` is itself an indirect reference:

```javascript
var muhammara = require("@muhammara/native");
var reader = muhammara.createReader("input.pdf");
var page = reader.parsePage(0).getDictionary();
var annotations = reader.queryDictionaryObject(page, "Annots");
var annotationIds = annotations
  ? annotations
      .toPDFArray()
      .toJSArray()
      .map(function (annotation) {
        return annotation.toPDFIndirectObjectReference().getObjectID();
      })
  : [];

var annotationId = annotationIds.find(function (id) {
  var contents = reader
    .parseNewObject(id)
    .toPDFDictionary()
    .toJSObject().Contents;
  return contents && contents.toText() === "Original comment";
});

reader.end();
```

A page without annotations has no `Annots` key, so `queryDictionaryObject`
returns nothing rather than an empty array. Page indexes here are zero-based.
The example selects a comment by its current text; `annotationId` is `undefined`
if no comment matches. Use the selected ID in either workflow below.

## Rewrite It Completely

`startModifiedIndirectObject(id)` replaces the whole object. Whatever you do not
write is gone, so copy every key you are keeping — an annotation that loses
`Type`, `Subtype`, or `Rect` stops rendering, which is the usual cause of an
edit that "disappears" from the viewer.

```javascript
if (annotationId === undefined) {
  throw new Error("Annotation not found");
}

var writer = muhammara.createWriterToModify("input.pdf", {
  modifiedFilePath: "output.pdf",
});
var copyingContext = writer.createPDFCopyingContextForModifiedFile();
var existing = copyingContext
  .getSourceDocumentParser()
  .parseNewObject(annotationId)
  .toPDFDictionary()
  .toJSObject();
var objectsContext = writer.getObjectsContext();

objectsContext.startModifiedIndirectObject(annotationId);
var dictionary = objectsContext.startDictionary();
Object.keys(existing).forEach(function (key) {
  if (key === "Contents" || key === "AP") {
    return;
  }
  dictionary.writeKey(key);
  copyingContext.copyDirectObjectAsIs(existing[key]);
});
dictionary.writeKey("Contents").writeLiteralStringValue("Edited comment");
objectsContext.endDictionary(dictionary);
objectsContext.endIndirectObject();
copyingContext.end();
writer.end();
```

The example iterates the existing dictionary and copies each entry with
`copyDirectObjectAsIs`, replacing only `Contents`. Two details matter:

- **Drop `AP` when the text changes.** The appearance stream caches how the
  annotation was rendered, and a viewer that honours it keeps showing the old
  text. Removing `AP` asks the viewer to build the appearance from `Contents`
  and `DA` instead. Viewers that do not generate appearances will show nothing,
  so write a new `AP` stream yourself when you need one guaranteed.
- **End the copying context before the writer.** `copyingContext.end()` then
  `writer.end()`. The WebAssembly package rejects `end()` outright while a
  copying context is open.

`writeLiteralStringValue` takes the string directly. For text outside the
printable ASCII range, encode it first with
`writer.createPDFTextString(text).toBytesArray()`.

## Remove An Annotation

Removal is a change to the page, not to the annotation: rewrite the page
dictionary with a shortened `Annots` array. `replaceObject` does not help here —
it swaps references that appear directly in the page dictionary, and an
annotation reference sits inside the `Annots` array rather than at the top level.

```javascript
if (annotationId === undefined) {
  throw new Error("Annotation not found");
}

var writer = muhammara.createWriterToModify("input.pdf", {
  modifiedFilePath: "output.pdf",
});
var copyingContext = writer.createPDFCopyingContextForModifiedFile();
var parser = copyingContext.getSourceDocumentParser();
var pageId = parser.getPageObjectID(0);
var page = parser.parsePage(0).getDictionary().toJSObject();
var keptIds = annotationIds.filter(function (id) {
  return id !== annotationId;
});
var objectsContext = writer.getObjectsContext();

objectsContext.startModifiedIndirectObject(pageId);
var dictionary = objectsContext.startDictionary();
Object.keys(page).forEach(function (key) {
  dictionary.writeKey(key);
  if (key !== "Annots") {
    copyingContext.copyDirectObjectAsIs(page[key]);
    return;
  }
  objectsContext.startArray();
  keptIds.forEach(function (id) {
    objectsContext.writeIndirectObjectReference(id);
  });
  objectsContext.endArray(muhammara.eTokenSeparatorEndLine);
});
objectsContext.endDictionary(dictionary);
objectsContext.endIndirectObject();
copyingContext.end();
writer.end();
```

The same rule applies: copy every page key you are keeping, and write the array
with `startArray()`, one `writeIndirectObjectReference(id)` per surviving
annotation, and `endArray()`. The orphaned annotation object stays in the file
but is no longer referenced by the page.

Modification appends an incremental update, so both the original and the
rewritten object remain in the output. See
[Modify PDFs](../low-level/modify-pdfs.md) for the surrounding low-level API and
[Add Review Annotations](add-review-annotations.md) for creating annotations
with Recipe.
