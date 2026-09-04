# Stream Interfaces

MuhammaraJS uses synchronous byte-stream interfaces rather than Node.js
`Readable` and `Writable` streams for its native APIs.

- `ByteReader`: `read(amount)` and `notEnded()`.
- `ByteReaderWithPosition`: adds `setPosition`, `setPositionFromEnd`, `skip`,
  and `getCurrentPosition`.
- `ByteWriter`: `write(bytes)`.
- `ByteWriterWithPosition`: adds `getCurrentPosition`.

Custom writer and reader input objects must implement the matching interfaces.
Reader inputs are synchronous and random access, so all input bytes must be
available before the native operation begins. Writer `write(bytes)` methods must
return the number of bytes written.

```javascript
var input = new muhammara.PDFRStreamForBuffer(pdfBuffer);
var reader = muhammara.createReader(input);
```

See [Custom Streams](../low-level/custom-streams.md) for usage examples.
