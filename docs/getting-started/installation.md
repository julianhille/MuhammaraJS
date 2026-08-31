# Installation

Install MuhammaraJS from npm:

```sh
npm install muhammara
```

## pnpm 10 And Later

pnpm 10 and later do not run dependency lifecycle scripts by default. MuhammaraJS
needs its install script to acquire or build its native addon. Add `muhammara` to
`pnpm.onlyBuiltDependencies`, or run `pnpm approve-builds` and approve it.

## Building From Source

Official prebuilds statically link OpenSSL `libcrypto` and do not require a
system OpenSSL installation at runtime.

Building from source requires OpenSSL 3 headers and a static `libcrypto`
library. Set `CPPFLAGS` and `OPENSSL_LIB_DIR` to the same OpenSSL build; on
Windows, `OPENSSL_LIB_DIR` must contain `libcrypto.lib`.

## Prebuilt Support Matrix

Prebuilt binaries are published with release tags for the combinations built by
the release workflow. Install normally with npm when your runtime is listed. For
any other platform, architecture, runtime, or libc combination, npm falls back
to building from source.

| Runtime  | Versions built        | Operating system and architecture | Prebuilt binary   |
| -------- | --------------------- | --------------------------------- | ----------------- |
| Node.js  | 20, 22, 24, 25, 26    | Linux glibc x64 and arm64         | Yes               |
| Node.js  | 20, 22, 24, 25, 26    | Linux musl x64 and arm64          | Yes               |
| Node.js  | 20, 22, 24, 25, 26    | macOS x64 and arm64               | Yes               |
| Node.js  | 20, 22, 24, 25, 26    | Windows x64                       | Yes               |
| Node.js  | Any other combination | Any                               | Build from source |
| Electron | 36.0 through 38.1     | Linux x64                         | Yes               |
| Electron | 36.0 through 38.1     | macOS x64 and arm64               | Yes               |
| Electron | 36.0 through 38.1     | Windows x64                       | Yes               |
| Electron | Any other combination | Any                               | Build from source |

Windows arm64 and Linux arm64 Electron builds are not part of the current
prebuilt matrix. The package `engines` field is the authoritative Node.js
version policy; this table describes the release workflow's binary coverage.

## Electron Support Policy

MuhammaraJS follows Electron's release cycle. Prebuilt Electron support is
limited to current Electron versions in the release matrix. Each new MuhammaraJS
major release removes Electron versions that are no longer supported by Electron
and adds current versions after their build coverage is verified.
