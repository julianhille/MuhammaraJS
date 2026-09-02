# Byte Assets And Blob Input

The synchronous Wasm contract is `Uint8Array | ArrayBuffer`. Register reusable
fonts, images, and PDFs by name before using them:

```js
var fontBytes = new Uint8Array(await fontFile.arrayBuffer());
muhammara.registerFont("inter", fontBytes);
muhammara.registerImage("logo", imageBytes, "png");
muhammara.registerPdf("source", sourcePdfBytes);
```

`Blob` and `File` are asynchronous browser sources. Use the matching `Async`
method instead of reading them synchronously:

```js
await muhammara.registerFontAsync("inter", fontFile);
var reader = await muhammara.createReaderAsync(pdfFile);
var modifier = await muhammara.createWriterToModifyAsync(pdfFile);
```

The low-level API also has async variants for image inspection, TIFF and PDF
form creation, copying contexts, append/merge operations, and
`ContentContext.drawImage`. Recipe has `registerFontAsync`,
`registerImageAsync`, and `registerPdfAsync`.

In Node, `Buffer` works only because it is a `Uint8Array` subclass. It is not a
separate Wasm input type. Filesystem paths, Node streams, and browser-sounding
wrappers around those inputs are not supported.
