# OpenSSL shim

PDF 2.0 (AES-256) encryption in PDFWriter calls OpenSSL for two things:
SHA-256/384/512 in `XCryptionCommon2_0.cpp` and `RAND_bytes` in
`RandomGenerator.cpp`. AES itself comes from the bundled LibAesgm. Linking
real OpenSSL into the Wasm build would add about 500 KB brotli, mostly for
the machinery behind `RAND_bytes`, so this folder provides those calls
instead:

- `include/openssl/sha.h` and `sha.c`: the `SHA{256,384,512}_{Init,Update,Final}`
  calls, backed by the vendored, formally verified HACL\* in `deps/hacl`.
- `include/openssl/rand.h` and `rand.c`: `RAND_bytes`, backed by
  `getentropy()`, which Emscripten implements with `crypto.getRandomValues()`
  in browsers and workers and `node:crypto` in Node.

`CMakeLists.txt` builds them as the `OpenSSL::Crypto` target that PDFWriter
links when `PDFHUMMUS_NO_OPENSSL` is off. The headers declare only what
PDFWriter calls, so a PDFWriter update that needs more fails to build.
