# Encrypt PDFs

Set encryption in constructor options for a new PDF, or call `encrypt()` before
`endPDF()`. Recipe applies encryption to the final byte output, including after
deferred page insertion.

```js
import { createRecipe } from "@muhammara/wasm";

var Recipe = await createRecipe();
var pdfBytes = new Recipe({
  userPassword: "open-password",
  ownerPassword: "owner-password",
  userProtectionFlag: Recipe.permission("print, copy"),
})
  .createPage("letter")
  .text("Protected document", 72, 72, { size: 24 })
  .endPage()
  .endPDF();
```

`userPassword` controls opening the document. `ownerPassword` (or its
`password` alias) controls owner access, and `userProtectionFlag` is a numeric
permission mask. `Recipe.permission()` combines the supported names `print`,
`modify`, `copy`, `edit`, `fillform`, `extract`, `assemble`, and `printbest`.
The instance method `recipe.permission()` performs the same conversion.

Byte-first encryption supports RC4 and AES-128 through PDF 1.7. It does not
support PDF 2.0/AES-256. Recipe also cannot directly open a password-protected
source; use the low-level `recrypt()` API to decrypt bytes first, modify the
plain bytes, then configure output encryption.

```js
import { createMuhammaraWasm, createRecipe } from "@muhammara/wasm";

var [muhammara, Recipe] = await Promise.all([
  createMuhammaraWasm(),
  createRecipe(),
]);
var encryptedInputBytes = new Recipe({ userPassword: "current-password" })
  .createPage(300, 180)
  .text("Original protected PDF", 36, 48)
  .endPage()
  .endPDF();
var plainBytes = muhammara.recrypt(encryptedInputBytes, {
  password: "current-password",
});
var outputBytes = new Recipe(plainBytes)
  .editPage(1)
  .text("Updated", 72, 72)
  .endPage()
  .encrypt({ ownerPassword: "new-owner-password" })
  .endPDF();
```

See [Change PDF Passwords](../how-to/change-pdf-passwords.md) for a complete
browser workflow and [Differences And Restrictions](../differences.md) for the
security boundary.
