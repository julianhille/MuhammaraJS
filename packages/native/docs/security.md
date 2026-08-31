# Security And Vendored Dependencies

MuhammaraJS compiles the native code under
`packages/native-with-source/src/deps/` into its addon. Every
directory in that location is vendored source code; none is installed or kept
current automatically by npm or another package manager. The versions below
describe the source currently in this repository.

## Vendor Inventory

| Vendored directory | Upstream baseline                                                        | Source and tracking                                                                                                                               |
| ------------------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PDFWriter`        | [PDF-Writer v4.9.0](https://github.com/galkahana/PDF-Writer/tree/v4.9.0) | [Source](https://github.com/galkahana/PDF-Writer) and [issues](https://github.com/galkahana/PDF-Writer/issues)                                    |
| `FreeType`         | [2.13.0](https://github.com/freetype/freetype/tree/VER-2-13-0)           | [Source](https://github.com/freetype/freetype) and [issues](https://gitlab.freedesktop.org/freetype/freetype/-/issues)                            |
| `LibAesgm`         | Unversioned Brian Gladman AES snapshot (copyright 1998-2013)             | [Source](https://github.com/BrianGladman/AES)                                                                                                     |
| `LibJpeg`          | [IJG JPEG 9d](https://ijg.org/files/jpegsrc.v9d.tar.gz)                  | [Source](https://ijg.org/)                                                                                                                        |
| `LibPng`           | [1.6.37](https://github.com/pnggroup/libpng/tree/v1.6.37)                | [Source](https://github.com/pnggroup/libpng) and [issues](https://github.com/pnggroup/libpng/issues)                                              |
| `LibTiff`          | [4.6.0](https://gitlab.com/libtiff/libtiff/-/tree/v4.6.0)                | [Source](https://gitlab.com/libtiff/libtiff) and [issues](https://gitlab.com/libtiff/libtiff/-/issues)                                            |
| `OpenSSL`          | [3.5.4](https://github.com/openssl/openssl/releases/tag/openssl-3.5.4)   | Downloaded by native CI builds and extracted to ignored `src/deps/openssl/`, then statically linked; [source](https://github.com/openssl/openssl) |
| `Zlib`             | [1.2.11](https://github.com/madler/zlib/tree/v1.2.11)                    | [Source](https://github.com/madler/zlib) and [issues](https://github.com/madler/zlib/issues)                                                      |

The PDFWriter tag is the vendored tree's upstream baseline. MuhammaraJS carries
changes on top of it, so `packages/native-with-source/src/deps/PDFWriter` is not necessarily byte-for-byte
identical to that tag. The other version identifiers come from the vendored
source headers; `LibAesgm` does not declare an upstream release version.
OpenSSL is downloaded from its pinned release archive and cached by CI rather
than committed, to avoid adding its 50 MiB source archive to this repository.
Official native prebuilts statically link OpenSSL libcrypto and therefore do
not require a system OpenSSL installation at runtime.

## Reporting A Defect

For a suspected defect in the PDF processing engine, first check the
[PDF-Writer issue tracker](https://github.com/galkahana/PDF-Writer/issues) and
report it upstream when it belongs there. Include a minimal input and expected
behavior, and link the upstream report from the corresponding MuhammaraJS
issue when the integration, packaging, or local patches are relevant.

Use the same approach for FreeType, libpng, libtiff, zlib, and the other
vendored libraries: report a library defect to its upstream project where it
can be maintained, and use a MuhammaraJS issue for effects specific to this
addon.

## Updating A Vendor

An available newer upstream version is useful information. Open a MuhammaraJS
issue requesting a dependency update when it includes a relevant security fix,
bug fix, or compatibility improvement. Include the current inventory version,
the proposed upstream version or immutable revision, the upstream release or
advisory link, and any expected build or behavior impact. Maintainers can then
evaluate, test, and review the vendor update independently.
