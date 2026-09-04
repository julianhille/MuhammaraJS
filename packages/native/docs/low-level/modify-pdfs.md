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

replacement.getWriteStream().write(Array.from(Buffer.from("BT ET")));
objectsContext.endPDFStream(replacement).endIndirectObject();
writer.replaceObject(0, contentsId, replacementId);
writer.end();
```

Only the named page is rewritten, so an object shared by several pages keeps its
old reference elsewhere. Pass `{ scope: "global" }` to apply the same
replacement to every page instead.

```javascript
writer.replaceObject(0, contentsId, replacementId, { scope: "global" });
```

See [`tests/ObjectReplacementTest.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/ObjectReplacementTest.js) for verified examples.

Modification uses incremental PDF updates, but this documentation does not make
signature-preservation guarantees. See [`tests/BasicModification2.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/BasicModification2.js),
[`tests/ModifyExistingPageContent.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/ModifyExistingPageContent.js), and [`tests/BasicModificationWithStreams.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/BasicModificationWithStreams.js).
