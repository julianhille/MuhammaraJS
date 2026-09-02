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

Encryption options can also be supplied while creating a new Recipe document.
See [`tests/recipe/encryption.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/recipe/encryption.js) for the supported creation and modification
cases.
