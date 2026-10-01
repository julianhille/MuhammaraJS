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
options.

## Without Blocking the Event Loop

`recrypt` does all of its work on the JavaScript thread, so a server answers no
other request while a document is re-encrypted. `recryptAsync` takes the same
arguments and options, re-encrypts on libuv's thread pool, and returns a
promise.

```javascript
await muhammara.recryptAsync("input.pdf", "output.pdf", {
  password: "current-password",
  userPassword: "new-open-password",
});
```

Stream objects work as with `recrypt`:

```javascript
var target = new muhammara.PDFWStreamForFile("output.pdf");
await muhammara.recryptAsync(
  new muhammara.PDFRStreamForBuffer(sourceBuffer),
  target,
  { userPassword: "new-open-password" },
);
await new Promise((resolve) => target.close(resolve));
```

Wrong arguments, such as a missing destination or a path mixed with a stream,
throw synchronously, as with `recrypt`. A failure once the work has started,
such as a wrong input password or an unreadable source, rejects the promise
with the message `recrypt` throws. An error thrown by the output stream rejects
the promise with that error.

`Recipe.encrypt()` encrypts with the synchronous `recrypt` when `endPDF()`
runs. To keep that step off the event loop, leave out `encrypt()` and recrypt
the finished file instead:

```javascript
var recipe = new muhammara.Recipe("new", "plain.pdf");
recipe.createPage(595, 842).text("hello", 50, 50).endPage();
recipe.endPDF();

await muhammara.recryptAsync("plain.pdf", "output.pdf", {
  userPassword: "user",
  ownerPassword: "owner",
  userProtectionFlag: 4,
});
```

!!! note "One recrypt at a time"

    - **Jobs run one after another**, in the order they were started, and
      never in parallel. The bundled PDF library is not yet audited for
      concurrent recrypts, so one lock covers every recrypt in the process:
      `recryptAsync` jobs from all threads and the synchronous `recrypt`. A
      `recrypt` call waits for a running job, blocking its thread meanwhile.
    - **Waiting jobs stay off the thread pool.** Each thread passes one job at
      a time to libuv's pool, so file system, DNS and zlib work keeps running.
      When several worker threads each have a job waiting, each of those jobs
      holds a pool thread while it waits for the lock. Raise
      `UV_THREADPOOL_SIZE` or recrypt from one thread if that matters.
    - **Stream jobs read and write on the calling thread.** The source stream
      is read into memory when `recryptAsync` is called, and the output is
      written to the target stream when the work is done. Both block the event
      loop while they run, and every waiting stream job keeps its source in
      memory. Use paths for large documents or many jobs.
    - **Do not write to the target stream while a job runs.** The output's
      offsets are computed from the stream position at the call. If the
      position changed when the job finishes, the promise rejects and nothing
      is written.
    - **Relative paths are resolved when `recryptAsync` is called**,
      including `log`, so a later change of the working directory does not
      affect a waiting job.
    - **Use a separate output for each job,** and do not change a source file
      while a job that reads it is waiting.
    - **Pass `log` to each call.** Each thread has its own log settings, so a
      writer's `log` on the JavaScript thread does not apply to a job, and a
      job's `log` does not apply to anything else.

To measure the difference in a server, see
[Benchmark Sync And Async Recrypt](benchmark-recrypt.md).

## Encrypt A New PDF

Pass `userPassword`, `ownerPassword`, and optionally `userProtectionFlag` to
`createWriter` when creating an encrypted PDF. A user password opens the PDF;
the owner password controls permission changes. `userProtectionFlag` is the PDF
permission bit field passed to the encryption dictionary.

```javascript
var writer = muhammara.createWriter("encrypted.pdf", {
  version: muhammara.ePDFVersion17,
  userPassword: "open-password",
  ownerPassword: "owner-password",
  userProtectionFlag: 4,
});
```

Use the same version rules below to choose the encryption algorithm. To open
this document with a low-level reader, pass the user or owner password as the
reader's `password` option.

The encryption algorithm is selected automatically from the PDF
`version`; there is no separate algorithm option.

| PDF version     | Encryption algorithm | Key size |
| --------------- | -------------------- | -------- |
| 1.0 through 1.3 | RC4                  | 40-bit   |
| 1.4 through 1.5 | RC4                  | 128-bit  |
| 1.6 through 1.7 | AESV2 (AES-128)      | 128-bit  |
| 2.0             | AESV3 (AES-256)      | 256-bit  |

PDF 2.0 encryption requires an OpenSSL-enabled build.
