# Modify Existing PDFs

Use `createWriterToModify` to add pages or content to an existing PDF. For a
separate output file, provide `modifiedFilePath` in the options object.

```javascript
var writer = muhammara.createWriterToModify("input.pdf", {
  modifiedFilePath: "output.pdf",
});
```

To add content to an existing page, use `PDFPageModifier`, start its context,
draw content, end the context, and write the page. Passing `true` as the third
constructor argument isolates new graphics from the existing graphics state.

The modified PDF keeps the Info dictionary of the source.
`writer.getDocumentContext().getInfoDictionary()` starts with its text entries,
such as the title, author and custom entries, its creation date and its
`trapped` state, and `ModDate` is set to the time of the edit. Values set there
replace those of the source, as on Wasm; a custom entry added under the key of
a field, such as `Title`, takes that field's place. Entries the Info dictionary
cannot hold are left out: values that are not text strings, such as numbers,
names and arrays, apart from the `Trapped` name; a `Trapped` that is not a name,
or is `Unknown`, which is the default anyway; and a `CreationDate` that is not a
PDF date.

## Replace an Indirect Object

`replaceObject(pageIndex, sourceObjectId, replacementObjectId, options)` rewrites
a page dictionary so every direct reference to `sourceObjectId` points at
`replacementObjectId` instead. `pageIndex` is zero-based, and the method is
available only on a writer created with `createWriterToModify`.

```javascript
var reader = muhammara.createReader("input.pdf");
var contentsId = reader
  .parsePage(0)
  .getDictionary()
  .queryObject("Contents")
  .toPDFIndirectObjectReference()
  .getObjectID();

reader.end();

var writer = muhammara.createWriterToModify("input.pdf", {
  modifiedFilePath: "output.pdf",
});
var objectsContext = writer.getObjectsContext();
var replacementId = objectsContext.startNewIndirectObject();
var replacement = objectsContext.startPDFStream();

replacement.getWriteStream().write(Buffer.from("BT ET"));
objectsContext.endPDFStream(replacement).endIndirectObject();
writer.replaceObject(0, contentsId, replacementId);
```

Only the named page is rewritten, so an object shared by several pages keeps its
old reference elsewhere. Pass `{ scope: "global" }` to apply the same
replacement to every page instead:

```javascript
writer.replaceObject(0, contentsId, replacementId, { scope: "global" });
writer.end();
```

Modification uses incremental PDF updates, but this documentation does not make
signature-preservation guarantees.
