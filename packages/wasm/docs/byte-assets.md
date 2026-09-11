# Byte Assets And Blob Input

Recipe includes Roboto Regular for text and tables with no font setup. The
registration examples below apply to custom Recipe fonts and to all low-level
writer fonts; see [Custom Fonts](recipe/text-and-fonts.md#custom-fonts).
When supplying your own fonts, `createRecipe({ defaultFont: fontFile })` uses
your file as the default without loading Roboto. Use
`createRecipe({ defaultFont: false })` when registering named families instead.

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
