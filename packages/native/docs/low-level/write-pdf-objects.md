# Write PDF Objects

`pdfWriter.getObjectsContext()` exposes the low-level object writer for PDF
features not covered by the higher-level APIs. Use it only when you understand
the relevant PDF object structure.

Start an indirect object with `startNewIndirectObject()`, write primitives,
dictionaries, or arrays, then finish it with `endIndirectObject()`. To refer to
an object before writing it, allocate an ID with `allocateNewObjectID()` and
pass that ID to `startNewIndirectObject(id)` later.

PDF streams require a dictionary context and an indirect object. Start a
dictionary, pass it to `startPDFStream`, write to the returned stream, and end
it with `endPDFStream`. `endPDFStream` completes the surrounding object.

`pdfWriter.getEvents()` provides writer events. The supported, tested events
are `OnPageWrite` and `OnCatalogWrite`; their handlers can add entries to the
respective dictionary contexts. See [`tests/ModifyingExistingFileContent.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/ModifyingExistingFileContent.js) and
[`tests/WriterEvents.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/WriterEvents.js) for low-level object and event usage.
