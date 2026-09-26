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
