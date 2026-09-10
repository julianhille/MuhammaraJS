# PDF Writer

`muhammara.createWriter(output, options)` creates a `PDFWriter` for a file path
or a compatible write stream. The writer creates pages, content contexts, fonts,
forms, images, copying contexts, and low-level object contexts.

Core lifecycle methods are `createPage`, `startPageContentContext`, `writePage`,
and `end`. `createPage(left, bottom, right, top)` returns a page with a PDF
bottom-left coordinate system. Add content before `writePage`; the page context
cannot be used to alter that page afterward. `writePageAndReturnID` returns the
written page object ID.

```javascript
var writer = muhammara.createWriter("output.pdf");
var page = writer.createPage(0, 0, 595, 842);
writer.writePage(page);
writer.end();
```

Use `getFontForFile` to load a font, `getImageDimensions` to inspect an image,
and `getEvents` for page and catalog write events. `createFormXObject` starts a
reusable drawing form; finish it with `endFormXObject` before placement. Image
and form creation must not occur while a page content context is active.

## Continuation State

`shutdown(restartStateFile)` saves an unfinished writer's state and closes it.
Later, `createWriterToContinue(pdfPath, restartStateFile, options)` resumes that
document. This path-based workflow is specific to the native package; it is not
available in Wasm. `options.modifiedFilePath` writes the resumed output to a
different path, and `options.log` configures writer logging.

```javascript
writer.shutdown("writer-state.txt");

var resumedWriter = muhammara.createWriterToContinue(
  "output.pdf",
  "writer-state.txt",
);
```

`InputFile` and `OutputFile` are native file wrappers returned by
`getModifiedInputFile()` and `getOutputFile()` while modifying a PDF. They expose
`openFile`, `closeFile`, the file path, and their synchronous byte stream; prefer
`createReader`, `createWriter`, and the stream classes for normal application
code. The continuation lifecycle is exercised in [`tests/ShutdownRestartTest.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/ShutdownRestartTest.js).

`createPDFDate()` returns a mutable PDF date. Call `setToCurrentTime()` or use
the initial value, then pass its `toString()` result to a PDF date field. The
method is intended for low-level dictionary writing; Recipe metadata accepts
JavaScript `Date` values directly.

[`tests/EmptyPagesPDF.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/EmptyPagesPDF.js), [`tests/FormXObjectTest.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/FormXObjectTest.js), and
[`tests/WriterEvents.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/WriterEvents.js) cover these lifecycles.

For task-focused usage, see the [Low-Level API](../low-level/index.md) section.
