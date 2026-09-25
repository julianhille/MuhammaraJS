# @muhammara/native-core

[![npm version](https://img.shields.io/npm/v/%40muhammara%2Fnative-core.svg)](https://www.npmjs.com/package/@muhammara/native)
[![License](https://img.shields.io/npm/l/%40muhammara%2Fnative-core.svg)](https://github.com/julianhille/MuhammaraJS/blob/develop/LICENSE)
[![Documentation](https://img.shields.io/badge/docs-readthedocs-blue.svg)](https://muhammarajs.readthedocs.io/)

**This is an internal package. Do not install it directly.**

`@muhammara/native-core` holds the JavaScript half of the MuhammaraJS native
packages: the low-level API wrapper, the Recipe API, and the TypeScript
declarations. It contains no native binary and does nothing on its own. Both
user-facing native packages depend on it and install it for you:

```sh
npm install @muhammara/native              # prebuilt binary
npm install @muhammara/native-with-source  # prebuilt or local source build
```

Its version always matches the native package that depends on it, so do not
pin or upgrade it separately.

## How The Packages Fit Together

MuhammaraJS is one PDF engine shipped in two ways. The same C++ library,
[PDF-Writer](https://github.com/galkahana/PDF-Writer), sits at the bottom of
every package; what differs is how it reaches your JavaScript.

```text
                      PDF-Writer (C++)
                 ┌────────────┴────────────┐
      Node.js native addon         WebAssembly build
                 │                         │
     @muhammara/native-core         @muhammara/wasm
      (shared JS, internal)     (browsers, Workers, Node.js)
         ┌───────┴────────┐
@muhammara/native  @muhammara/native-with-source
  (prebuilt only)    (prebuilt or source build)
```

| Package                                                                                        | Install it when                                                                                           |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| [`@muhammara/native`](https://www.npmjs.com/package/@muhammara/native)                         | You run Node.js on a platform with a prebuilt binary. This is the default choice.                         |
| [`@muhammara/native-with-source`](https://www.npmjs.com/package/@muhammara/native-with-source) | No prebuilt matches your platform, or Electron must rebuild the addon.                                    |
| [`@muhammara/wasm`](https://www.npmjs.com/package/@muhammara/wasm)                             | You work in a browser or Web Worker, or cannot load native addons (for example some serverless runtimes). |
| [`@muhammara/native-core`](https://www.npmjs.com/package/@muhammara/native-core)               | Never directly. Both native packages depend on it and install it for you.                                 |

Both native packages expose the identical API, so switching between them is a
dependency change, not a code change. The Wasm package produces the same PDFs,
but it is byte-first (`Uint8Array`, `ArrayBuffer`, `Blob`, `File`) instead of
path-, stream-, and `Buffer`-oriented, so its JavaScript API is separate.

## Links

- [Documentation](https://muhammarajs.readthedocs.io/)
- [Recipe API invariants](https://muhammarajs.readthedocs.io/en/latest/recipe/invariants.html) —
  behavior not obvious from the method signatures, such as the direct-write
  behavior of file-backed `endPDF()`
- [Changelog](https://github.com/julianhille/MuhammaraJS/blob/develop/CHANGELOG.md)
- [Issues](https://github.com/julianhille/MuhammaraJS/issues)
