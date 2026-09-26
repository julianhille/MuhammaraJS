# Stream Interfaces

MuhammaraJS uses synchronous byte-stream interfaces rather than Node.js
`Readable` and `Writable` streams for its native APIs.

- `ByteReader`: `read(amount)` and `notEnded()`. Readers created by the
  library return each chunk as a `Buffer`.
- `ByteReaderWithPosition`: adds `setPosition`, `setPositionFromEnd`, `skip`,
  and `getCurrentPosition`.
- `ByteWriter`: `write(bytes)`, accepting a `Uint8Array` (a `Buffer` qualifies)
  or an array of byte values.
- `ByteWriterWithPosition`: adds `getCurrentPosition`.

Custom writer and reader input objects must implement the matching interfaces.
Reader inputs are synchronous and random access, so all input bytes must be
available before the native operation begins. Custom writer `write(bytes)`
methods receive a `Buffer` they may keep and must return the number of bytes
written; returning fewer than the chunk holds fails the writer. Custom reader `read(amount)` methods return a `Uint8Array` or an array
of byte values.

```javascript
var input = new muhammara.PDFRStreamForBuffer(pdfBuffer);
var reader = muhammara.createReader(input);
```

See [Custom Streams](../low-level/custom-streams.md) for usage examples.
