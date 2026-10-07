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
A later `encrypt()` call replaces them: its passwords are used instead, and
`encrypt()` without a password or `userProtectionFlag` leaves the PDF
unencrypted. A `userProtectionFlag` alone still encrypts, with an empty user
password. See
[Change PDF Passwords](../how-to/change-pdf-passwords.md) for password
replacement and encryption removal.
