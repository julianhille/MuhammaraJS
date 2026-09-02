# Breaking Changes

This page collects the compatibility changes formerly maintained in the README.
For release-by-release changes, see the [Changelog](https://github.com/julianhille/MuhammaraJS/blob/develop/CHANGELOG.md).

## Version 7.x

- The unscoped `muhammara` package is deprecated and receives no further
  releases. Install `@muhammara/native` instead, or use an npm alias when an
  existing `require("muhammara")` import must remain unchanged.
- `@muhammara/native` is prebuilt-only. When a matching prebuilt is unavailable,
  installation fails instead of compiling locally; install
  `@muhammara/native-with-source` for bundled source and fallback builds.
- Windows win32 (32-bit) prebuilds and build tooling were removed. Windows x64
  is the current prebuilt target; Windows arm64 is not part of the prebuilt
  matrix.

## Version 5.x

- Node.js 16 and earlier prebuilds were removed.
- Electron 23 and earlier prebuilds were removed.
- Building from source requires GCC 13 and C++20 support.
- Official Docker builds use a GCC Bookworm environment, lowering the required
  `GLIBCXX` version to 3.4.30.

## Version 4.x

- Node.js 15 and earlier and Electron 15 and earlier prebuilds were removed.
- Ubuntu 18.04 was removed from GitHub Actions. Its older glibc can affect use
  of prebuilt binaries; building from source remains an option.

## Version 3.x

- Node.js 11 and earlier and Electron 11 and earlier prebuilds were removed.
- The misspelled `eTokenSeprator` export was renamed to `eTokenSeparator`.

## Version 2.x

- Older Node.js and Electron versions may be incompatible because of the
  node-pre-gyp upgrade.
