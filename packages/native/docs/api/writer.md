# PDF Writer

`muhammara.createWriter(output, options)` creates a `PDFWriter` for a file path
or a compatible write stream. The writer creates pages, content contexts, fonts,
forms, images, copying contexts, and low-level object contexts.

Core lifecycle methods are `createPage`, `startPageContentContext`, `writePage`,
and `end`. `createPage(left, bottom, right, top)` returns a page with a PDF
bottom-left coordinate system. Add content before `writePage`; the page context
cannot be used to alter that page afterward. `writePageAndReturnID` returns the
written page object ID.

Use `getFontForFile` to load a font, `getImageDimensions` to inspect an image,
and `getEvents` for page and catalog write events. `createFormXObject` starts a
reusable drawing form; finish it with `endFormXObject` before placement. Image
and form creation must not occur while a page content context is active.

[`tests/EmptyPagesPDF.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/EmptyPagesPDF.js), [`tests/FormXObjectTest.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/FormXObjectTest.js), and
[`tests/WriterEvents.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/WriterEvents.js) cover these lifecycles.

For task-focused usage, see the [Low-Level API](../low-level/index.md) section.
