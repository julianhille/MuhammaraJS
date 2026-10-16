# Encrypt PDFs

Set encryption options before finalizing the PDF. Use `userPassword` to require
a password to open the file and `ownerPassword` to control edit permissions.

```javascript
var pdfDoc = new Recipe("input.pdf", "output.pdf");

pdfDoc
  .encrypt({
    userPassword: "open-password",
    ownerPassword: "owner-password",
    userProtectionFlag: 4,
  })
  .endPDF();
```

A `Buffer` source is encrypted the same way. `endPDF()` passes the encrypted
PDF to its callback, or writes it to the output path when one was given:

```javascript
var pdfDoc = new Recipe(fs.readFileSync("input.pdf"));

pdfDoc.encrypt({ userPassword: "open-password" }).endPDF(function (pdfBuffer) {
  // pdfBuffer holds the encrypted PDF.
});
```

Encryption options can also be supplied while creating a new Recipe document.
See [Change PDF Passwords](../how-to/change-pdf-passwords.md) for password
replacement and encryption removal.

To read a source that needs a password to open, pass its `password`:
`new Recipe(src, output, { password })` then reports page geometry through
`pageInfo()`. Without the right password the constructor throws
`Unable to read/edit PDF file (pages=0)`. Such a source cannot be edited;
decrypt it with `recrypt()` first and edit the plain PDF. A source protected
only by an owner password opens and edits without one.
