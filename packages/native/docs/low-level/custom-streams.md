# Custom Streams

`createWriter` can write to an object with `write(bytes)` and
`getCurrentPosition()` methods. `write` must return the number of bytes written.

Reader inputs require random access: `read`, `notEnded`, `setPosition`,
`setPositionFromEnd`, `skip`, and `getCurrentPosition`. Ensure the entire input
is available before passing it to a synchronous reader, image, or PDF-copying
operation.

`getCurrentPosition` must report a finite number. Values are converted with
JavaScript number semantics, so a numeric string works, but `NaN`, infinities,
and offsets outside the signed 64-bit range `[-2^63, 2^63)` throw a `TypeError` instead of
writing a corrupt offset into the PDF.

`PDFRStreamForFile` and `PDFWStreamForFile` are file-backed implementations.
`PDFStreamForResponse` adapts a writable HTTP response; see
[Serve A PDF Response](../how-to/serve-a-pdf-response.md) for its lifecycle.

`PDFRStreamForBuffer` accepts an in-memory `Buffer` for reader and copying
inputs. Its `setPosition()` and `setPositionFromEnd()` methods, and those on
`PDFRStreamForFile`, clamp the resulting position to the available byte range.
`PDFWStreamForBuffer` accumulates writer output in its `buffer` field:

```javascript
var muhammara = require("@muhammara/native");
var output = new muhammara.PDFWStreamForBuffer();
var writer = muhammara.createWriter(output);
// Create and write pages, then finish the writer.
writer.end();
var pdfBuffer = output.buffer;
```
