# HACL\* SHA-2

SHA-256, SHA-384 and SHA-512 from [HACL\*](https://github.com/hacl-star/hacl-star),
a formally verified C cryptography library. The Wasm build uses it in place
of OpenSSL for PDF 2.0 (AES-256) encryption; see
`packages/wasm/src/crypto/README.md`.

The files are copied unchanged from CPython's trimmed copy in
[`Modules/_hacl`](https://github.com/python/cpython/tree/v3.14.0/Modules/_hacl)
at tag `v3.14.0`, which pins HACL\* revision
`4ef25b547b377dcef855db4289c6a00580e7221c`. Only the SHA-2 sources and the
headers they include are kept. CPython's `python_hacl_namespaces.h` is not
copied: `src/crypto/include/python_hacl_namespaces.h` replaces it.

Do not edit these files. To update, copy the same list from a newer CPython
tag and update the revision above and in `scripts/third-party-licenses.mjs`.
