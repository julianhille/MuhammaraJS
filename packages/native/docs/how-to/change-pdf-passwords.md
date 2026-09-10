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
