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
PDF version, and `compress` defaults to `true`.

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
