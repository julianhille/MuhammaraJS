# Custom Streams

`createWriter` can write to an object with `write(bytes)` and
`getCurrentPosition()` methods. `write` must return the number of bytes written.

Reader inputs require random access: `read`, `notEnded`, `setPosition`,
`setPositionFromEnd`, `skip`, and `getCurrentPosition`. Ensure the entire input
is available before passing it to a synchronous reader, image, or PDF-copying
operation.

`PDFRStreamForFile` and `PDFWStreamForFile` are file-backed implementations.
`PDFStreamForResponse` adapts a writable HTTP response; see
[Serve A PDF Response](../how-to/serve-a-pdf-response.md) for its lifecycle.
