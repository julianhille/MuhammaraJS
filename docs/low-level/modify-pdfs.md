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

Modification uses incremental PDF updates, but this documentation does not make
signature-preservation guarantees. See `tests/BasicModification2.js`,
`tests/ModifyExistingPageContent.js`, and `tests/BasicModificationWithStreams.js`.
