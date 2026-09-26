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
and `getEvents` for page and catalog write events. Writer events are native-only;
the WebAssembly writer has no `getEvents()` equivalent. `createFormXObject`
starts a reusable drawing form; finish it with `endFormXObject` before placement.
Image and form creation must not occur while a page content context is active.

## Lifecycle

Create an active writer with `createWriter()`, `createWriterToModify()`, or
`createWriterToContinue()`. Stateful methods, including page creation, page
writing, and context getters, throw `Error("PDF writer has ended")` after
`end()` or `shutdown()`. A failed finalization or shutdown also retires the
writer. Repeated `end()` calls return the writer without finalizing again.

Complete all drawing and consume borrowed contexts, fonts, parsers, and file
wrappers before ending their writer. Start a new writer for further work, or
use `createWriterToContinue()` with successfully saved continuation state.
The independent `createPDFDate()` and `createPDFTextString()` value factories
remain usable after cleanup. Recipe uses this low-level guard internally;
there is no additional Recipe method for it.

## Continuation State

`shutdown(restartStateFile)` saves an unfinished writer's state and closes it.
Later, `createWriterToContinue(pdfPath, restartStateFile, options)` resumes that
document. This path-based workflow is specific to the native package; it is not
available in Wasm. `options.modifiedFilePath` writes the resumed output to a
different path, and `options.log` configures writer logging. For continuation,
`log` accepts a log file path or a synchronous object whose
`write(bytes: Buffer): number` method returns the number of bytes written.
The log writer does not need `getCurrentPosition()`. A `PDFWStreamForBuffer`
can capture the log in memory; a Node.js `Writable` must be adapted to the
[synchronous byte-stream contract](streams.md). Logging uses the process-global
trace while the resumed writer is active and is detached when it is retired.

```javascript
var writer = muhammara.createWriter("output.pdf");
var page = writer.createPage(0, 0, 595, 842);
writer.writePage(page);
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
code.

`createPDFDate()` returns a mutable PDF date. Call `setToCurrentTime()` or use
the initial value, then pass its `toString()` result to a PDF date field. The
method is intended for low-level dictionary writing; Recipe metadata accepts
JavaScript `Date` values directly.

For task-focused usage, see the [Low-Level API](../low-level/index.md) section.
