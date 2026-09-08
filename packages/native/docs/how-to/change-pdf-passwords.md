# Change PDF Passwords

Use `recrypt` to encrypt, re-encrypt, or remove encryption from a PDF. Supply
`password` when opening an already encrypted input; set output passwords with
`userPassword` and `ownerPassword`.

```javascript
muhammara.recrypt("input.pdf", "output.pdf", {
  password: "current-password",
  userPassword: "new-open-password",
  ownerPassword: "new-owner-password",
  userProtectionFlag: 4,
});
```

To remove encryption, provide the input `password` without new output password
options. File and stream scenarios are exercised in [`tests/Xcryption.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/Xcryption.js).

## Without Blocking the Event Loop

`recrypt` does all of its work on the main thread, so a server serves no other
request while a document is re-encrypted. `recryptAsync` takes the same
arguments and the same options, runs the re-encryption on a background thread,
and returns a promise.

```javascript
await muhammara.recryptAsync("input.pdf", "output.pdf", {
  password: "current-password",
  userPassword: "new-open-password",
});
```

Stream objects work the same way as with `recrypt`:

```javascript
var target = new muhammara.PDFWStreamForFile("output.pdf");

await muhammara.recryptAsync(
  new muhammara.PDFRStreamForBuffer(sourceBuffer),
  target,
  { userPassword: "new-open-password" },
);

await new Promise((resolve) => target.close(resolve));
```

Argument errors — a missing second argument, or mixing a path with a stream —
still throw synchronously, exactly as `recrypt` does. Everything that happens
once the work has started, including a wrong input password or an unreadable
source, comes back as a rejection with the same message `recrypt` throws.

Recipe has a matching `endPDFAsync()`:

```javascript
var recipe = new muhammara.Recipe("new", "output.pdf");
recipe.createPage(595, 842).text("hello", 50, 50).endPage();
recipe.encrypt({ userPassword: "user" });

await recipe.endPDFAsync();
```

### Concurrency and Limitations

!!! warning "What `recryptAsync` does and does not promise"

    - **Independent calls can run in parallel.** `Promise.all()` submits jobs to
      Node's shared libuv thread pool; PDF processing no longer takes a global
      recrypt lock. Available pool threads bound execution, not queue size.
      Limit outstanding jobs in a server to control memory and I/O pressure.
    - **Keep job resources independent.** Use distinct output paths and stream
      instances, and do not overwrite inputs another job is reading. Normal
      synchronous writers can run on the main thread while recrypt jobs execute;
      this does not make individual writer/reader objects safe to share across
      threads. Main-thread work still blocks the event loop while it runs.
    - **Logging is thread-local.** Pass `log` for each recrypt job rather than
      relying on another writer's configuration. It covers early input failures
      and is cleared before a pool thread is reused. Shared log files serialize
      complete log records only, not PDF processing.
    - **Stream input is held in memory.** The source is read into a buffer
      before the work starts and the result is buffered until it finishes, so
      peak memory is roughly input plus output. Use the path form for very
      large documents.
    - **`endPDFAsync()` only moves the encryption step off-thread.** Writing the
      document and inserting pages remain synchronous, and encryption in buffer
      mode is still unsupported, exactly as with `endPDF()`.

Native builds apply checked concurrency overrides to generated build copies of
PDFWriter and AES sources. Vendored files in `src/deps` remain unchanged. These
overrides isolate tracing and AES capability caches and use reentrant date/time
conversion. The Wasm build does not use the native libuv pool and does not support
encryption/recrypt, so these native-only overrides do not apply there.

The tested workflows cover the library's current password and PDF-version
options. The encryption algorithm is selected automatically from the PDF
`version`; there is no separate algorithm option.

| PDF version     | Encryption algorithm | Key size |
| --------------- | -------------------- | -------- |
| 1.0 through 1.3 | RC4                  | 40-bit   |
| 1.4 through 1.5 | RC4                  | 128-bit  |
| 1.6 through 1.7 | AESV2 (AES-128)      | 128-bit  |
| 2.0             | AESV3 (AES-256)      | 256-bit  |

PDF 2.0 encryption requires an OpenSSL-enabled build. The version ranges are
verified by [`tests/EncryptionAlgorithms.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/EncryptionAlgorithms.js); password, stream, re-encryption,
and encrypted-modification workflows are covered by [`tests/Xcryption.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/Xcryption.js).
