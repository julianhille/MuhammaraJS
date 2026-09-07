# Edit Or Remove An Existing Annotation

Recipe creates annotations, but changing one that is already in a document is a
low-level operation: find the annotation object, then rewrite it through the
objects context of a modifying writer.

## Find The Annotation

A page dictionary's `Annots` entry is an array of indirect references, one per
annotation. Resolve it with `queryDictionaryObject` so the lookup also works when
`Annots` is itself an indirect reference:

```javascript
import { createMuhammaraWasm } from "@muhammara/wasm";

var muhammara = await createMuhammaraWasm();
var reader = muhammara.createReader(inputBytes);
var page = reader.parsePage(0).getDictionary().toPDFDictionary();
var annotationIds = reader
  .queryDictionaryObject(page, "Annots")
  .toPDFArray()
  .toJSArray()
  .map((annotation) => annotation.toPDFIndirectObjectReference().getObjectID());

reader.end();
```

A page without annotations has no `Annots` key, so `queryDictionaryObject`
returns nothing rather than an empty array. Page indexes here are zero-based.

## Rewrite It Completely

`startModifiedIndirectObject(id)` replaces the whole object. Whatever you do not
write is gone, so copy every key you are keeping — an annotation that loses
`Type`, `Subtype`, or `Rect` stops rendering, which is the usual cause of an
edit that "disappears" from the viewer.

```javascript
var writer = muhammara.createWriterToModify(inputBytes);
var copyingContext = writer.createPDFCopyingContextForModifiedFile();
var existing = copyingContext
  .getSourceDocumentParser()
  .parseNewObject(annotationId)
  .toPDFDictionary()
  .toJSObject();
var objectsContext = writer.getObjectsContext();

objectsContext.startModifiedIndirectObject(annotationId);

var dictionary = objectsContext.startDictionary();

Object.keys(existing).forEach((key) => {
  // Contents is rewritten below; AP caches the rendered look of the old text.
  if (key === "Contents" || key === "AP") return;
  dictionary.writeKey(key);
  copyingContext.copyDirectObjectAsIs(existing[key]);
});
dictionary.writeKey("Contents").writeLiteralStringValue("Edited comment");
objectsContext.endDictionary(dictionary);
objectsContext.endIndirectObject();
copyingContext.end();

var outputBytes = writer.end();
```

Two details matter:

- **Drop `AP` when the text changes.** The appearance stream caches how the
  annotation was rendered, and a viewer that honours it keeps showing the old
  text. Removing `AP` asks the viewer to build the appearance from `Contents`
  and `DA` instead. Viewers that do not generate appearances will show nothing,
  so write a new `AP` stream yourself when you need one guaranteed.
- **End the copying context before the writer.** `writer.end()` throws
  `Write the active page before ending the PDF` while a copying context is still
  open, so call `copyingContext.end()` first.

`writeLiteralStringValue` takes the string directly. For text outside the
printable ASCII range, encode it first with
`writer.createPDFTextString(text).toBytesArray()`.

## Remove An Annotation

Removal is a change to the page, not to the annotation: rewrite the page
dictionary with a shortened `Annots` array. `replaceObject` does not help here —
it swaps references that appear directly in the page dictionary, and an
annotation reference sits inside the `Annots` array rather than at the top level.

```javascript
var parser = copyingContext.getSourceDocumentParser();
var pageId = parser.getPageObjectID(0);
var pageEntries = parser.parsePage(0).getDictionary().toJSObject();
var keptIds = annotationIds.filter((id) => id !== annotationId);

objectsContext.startModifiedIndirectObject(pageId);

var pageDictionary = objectsContext.startDictionary();

Object.keys(pageEntries).forEach((key) => {
  pageDictionary.writeKey(key);
  if (key !== "Annots") {
    copyingContext.copyDirectObjectAsIs(pageEntries[key]);
    return;
  }
  objectsContext.startArray();
  keptIds.forEach((id) => objectsContext.writeIndirectObjectReference(id));
  objectsContext.endArray(muhammara.eTokenSeparatorEndLine);
});
objectsContext.endDictionary(pageDictionary);
objectsContext.endIndirectObject();
```

The orphaned annotation object stays in the file but is no longer referenced by
the page.

Modification appends an incremental update, so both the original and the
rewritten object remain in the output. See [Low-Level API](../low-level.md) for
the surrounding API and [Add Review Annotations](add-review-annotations.md) for
creating annotations with Recipe.

Appending or rebuilding an existing source page does not deep-copy that page's
`Annots` graph; see [Differences and Restrictions](../differences.md).
