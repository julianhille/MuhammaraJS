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

A writer created with a password writes strings and streams only inside an
indirect object, as each is encrypted for the object that holds it. Outside
one, `writeLiteralString()`, `writeHexString()`, `startPDFStream()`,
`startUnfilteredPDFStream()`, a dictionary's `writeLiteralStringValue()` and a
copying context's `copyDirectObjectAsIs()` and
`copyDirectObjectWithDeepCopy()` throw an `Error`.

`pdfWriter.getEvents()` provides writer events. The supported, tested events
are `OnPageWrite` and `OnCatalogWrite`; their handlers can add entries to the
respective dictionary contexts.
