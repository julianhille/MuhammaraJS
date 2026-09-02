# Change PDF Passwords

!!! warning "Unavailable in WebAssembly"

    `@muhammara/wasm` cannot open encrypted PDFs, encrypt output, remove a
    password, or re-encrypt a document. Recipe `encrypt()` throws and `recrypt`
    is not exported.

The WebAssembly build intentionally excludes OpenSSL and the native encryption
pipeline. Browser Web Crypto is not a drop-in replacement for PDF-standard
encryption because the PDF object and security-handler integration would still
be required.

Process password-protected documents in a trusted server or native environment
with the `muhammara` package. Do not send document passwords to an untrusted
browser application or attempt to bypass encryption by manipulating PDF bytes.

See [Differences and Restrictions](../differences.md) for the complete platform
boundary.
