# Change PDF Passwords

`recrypt()` is the byte-first equivalent of native `muhammara.recrypt()`. It
adds, changes, or removes a password without writing a temporary file.

```js
import { createMuhammaraWasm, createRecipe } from "@muhammara/wasm";

var muhammara = await createMuhammaraWasm();
var protectedPdf = muhammara.recrypt(pdfBytes, {
  userPassword: "view",
  ownerPassword: "edit",
  userProtectionFlag: 4,
});
var unprotectedPdf = muhammara.recrypt(protectedPdf, { password: "view" });
```

The options match native `recrypt`: `password` opens the input, while
`userPassword`, `ownerPassword`, and `userProtectionFlag` configure output
encryption. Supplying `userPassword`, including `""`, enables encryption;
omitting it removes encryption. `version` defaults to `0`, preserving the source
PDF version, and `compress` defaults to `true`. Encryption supports PDF 1.0
through 1.7; PDF 2.0/AES-256 is unavailable in WebAssembly.

## With A Promise

`recryptAsync()` takes the same options and resolves with the rewritten bytes.
It also accepts a `Blob` or `File`, like the other `*Async` methods, and rejects
instead of throwing.

```js
var protectedPdf = await muhammara.recryptAsync(file, {
  userPassword: "view",
  ownerPassword: "edit",
});
```

Like native, where `recryptAsync()` runs on a thread pool, the Wasm
`recryptAsync()` recrypts off the calling thread, so a page keeps handling input
and drawing while it runs. It starts a worker on its first call and reuses it: a
module `Worker` in browsers, Deno, and Bun, and `worker_threads` in Node.
Instances loaded the same way share one worker; an instance loaded with its own
`wasmBinary` has its own, which stops once the instance is garbage-collected.
The worker loads its own Wasm instance, which adds its startup time to the first
call and holds a second Wasm memory; under Node it does not keep the process
alive between calls. A single recrypt is not faster than `recrypt()`: only the
calling thread is free while it runs.

`recryptAsync()` recrypts on the calling thread instead, as fast and as blocking
as `recrypt()`, when:

- it is called inside a Worker, which needs no second one;
- no worker can start, for example because a Content Security Policy forbids
  it or a bundler did not include `lib/recrypt-worker.js`;
- the module options include anything a worker cannot receive: only
  `wasmBinary`, `locateFile`, and `limits` carry over, and the worker loads the
  binary from where `locateFile` pointed;
- the instance was loaded with `recryptWorker: false`.

```js
var muhammara = await createMuhammaraWasm({ recryptWorker: false });
```

The Benchmark tab of the
[browser example](https://github.com/julianhille/MuhammaraJS/tree/develop/packages/wasm/examples/browser)
measures the difference, running synchronous `recrypt()` and `recryptAsync()`
both on the page and in a Worker. With a generated 2.5 MB PDF and five recrypts
per mode in Chrome:

|                    | sync on the page | async on the page | sync in a Worker | async in a Worker |
| ------------------ | ---------------: | ----------------: | ---------------: | ----------------: |
| Median per recrypt |            55 ms |             55 ms |            56 ms |             54 ms |
| Page blocked       |           256 ms |              3 ms |             4 ms |              3 ms |
| Longest page stall |           110 ms |             <1 ms |            <1 ms |             <1 ms |
| 10 ms timer ticks  |                2 |                32 |               32 |                32 |

`recryptAsync()` on the page keeps it as free as running the recrypt in your own
Worker, while synchronous `recrypt()` blocks it for the whole run. The medians
differ only by run-to-run noise: every mode does the same work.

## Encrypt A New PDF

Pass `userPassword`, `ownerPassword`, and optionally `userProtectionFlag` to
`createWriter` to write an encrypted PDF, as in native. A user password opens
the PDF; the owner password controls permission changes. `userProtectionFlag`
is the PDF permission bit field and defaults to `4`. Without `userPassword` the
PDF is not encrypted, even when `ownerPassword` is set.

```js
var writer = muhammara.createWriter({
  version: muhammara.ePDFVersion17,
  userPassword: "open-password",
  ownerPassword: "owner-password",
  userProtectionFlag: 4,
});
```

To read the document, pass the user or owner password as the reader's
`password` option, as in native:

```js
var reader = muhammara.createReader(encryptedBytes, {
  password: "open-password",
});
```

The PDF `version` selects the algorithm as in `recrypt`; PDF 2.0 throws
because AES-256 is unavailable in WebAssembly. `createWriterToModify` does not
accept these options: modify the bytes first, then encrypt the result with
`recrypt`.

## Recipe

Recipe also follows native's deferred API. Call `encrypt()` before `endPDF()`;
the final composed bytes, including annotations and inserted pages, are then
encrypted.

```js
var Recipe = await createRecipe();
var bytes = new Recipe()
  .createPage()
  .endPage()
  .encrypt({ password: "edit" })
  .endPDF();
```

Wasm accepts and returns bytes rather than native paths or streams, and cannot
write a native `log` file. Password-protected Recipe source editing remains
unavailable; decrypt with `recrypt`, edit the returned bytes, then encrypt the
finished output if needed. Keep document passwords in trusted application code.

See [Differences and Restrictions](../differences.md) for the complete platform
boundary.
