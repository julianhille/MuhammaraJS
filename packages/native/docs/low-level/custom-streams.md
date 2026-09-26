# Custom Streams

`createWriter` can write to an object with `write(bytes)` and
`getCurrentPosition()` methods. `write` receives each chunk as a `Buffer` and
must return the number of bytes written. The chunk is a copy the stream owns, so
it can be kept or queued after `write` returns. Small writes are batched into
chunks of up to 64 KiB, and the last chunk arrives when the writer ends, so a
stream observed mid-way may not yet hold every byte written so far. An error
thrown by `write` surfaces from the call that flushes that chunk. Returning
fewer bytes than the chunk holds is a failure, not a partial write to retry:
creating the writer, later writes, `end()`, and `shutdown()` then throw:

```javascript
var muhammara = require("@muhammara/native");
var chunks = [];
var position = 0;
var writer = muhammara.createWriter({
  write: function (bytes) {
    chunks.push(bytes);
    position += bytes.length;
    return bytes.length;
  },
  getCurrentPosition: function () {
    return position;
  },
});
writer.writePage(writer.createPage(0, 0, 595, 842));
writer.end();
var pdfBuffer = Buffer.concat(chunks);
```

Reader inputs require random access: `read`, `notEnded`, `setPosition`,
`setPositionFromEnd`, `skip`, and `getCurrentPosition`. `read(amount)` returns
at most `amount` bytes as a `Uint8Array` (a `Buffer` qualifies) or as an array
of byte values; typed arrays are copied in one step and are the faster choice.
Ensure the entire input is available before passing it to a synchronous
reader, image, or PDF-copying operation.

`getCurrentPosition` must report a finite number. Values are converted with
JavaScript number semantics, so a numeric string works, but `NaN`, infinities,
and offsets outside the signed 64-bit range `[-2^63, 2^63)` throw a `TypeError` instead of
writing a corrupt offset into the PDF.

`PDFRStreamForFile` and `PDFWStreamForFile` are file-backed implementations.
`PDFStreamForResponse` adapts a writable HTTP response; see
[Serve A PDF Response](../how-to/serve-a-pdf-response.md) for its lifecycle.

The built-in `PDFRStreamForFile` and `PDFRStreamForBuffer` return `Buffer`
chunks from `read`.

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
