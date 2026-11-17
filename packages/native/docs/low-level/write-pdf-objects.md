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
it with `endPDFStream`. `endPDFStream` completes the surrounding object; a
following `endIndirectObject()` is ignored. `endIndirectObject()` without
an open object throws `Unable to end indirect object`, and starting an object
while one is open throws `Unable to start indirect object`. A dictionary passed
to `endDictionary()`, `startPDFStream()` or `startUnfilteredPDFStream()` is
finished: its methods throw `Dictionary context is no longer active`, and
starting a stream with it throws `Provide the active dictionary context`.

A writer created with a password writes strings and streams only inside an
indirect object, as each is encrypted for the object that holds it. Outside
one, including after `endPDFStream`, `writeLiteralString()`, `writeHexString()`,
`startPDFStream()`, `startUnfilteredPDFStream()`, a dictionary's
`writeLiteralStringValue()` and a copying context's `copyDirectObjectAsIs()`
and `copyDirectObjectWithDeepCopy()` throw an `Error`.

`pdfWriter.getEvents()` provides writer events. The supported, tested events
are `OnPageWrite` and `OnCatalogWrite`; their handlers can add entries to the
respective dictionary contexts.
