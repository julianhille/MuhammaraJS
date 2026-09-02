# MuhammaraJS

[![NPM version](https://img.shields.io/npm/v/%40muhammara%2Fnative.svg?style=flat)](https://www.npmjs.org/package/@muhammara/native)
[![Native CI status](https://github.com/julianhille/MuhammaraJS/actions/workflows/ci-native.yml/badge.svg?branch=develop)](https://github.com/julianhille/MuhammaraJS/actions/workflows/ci-native.yml)

MuhammaraJS is a fast library for creating, reading, and modifying PDF files.
It is available as a native Node.js addon and as a browser-safe WebAssembly
package.

## Choose A Package

| Package                                                                                        | Use it for                                                                              |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| [`@muhammara/native`](https://www.npmjs.com/package/@muhammara/native)                         | Node.js applications using a small package with a matching prebuilt native binary       |
| [`@muhammara/native-with-source`](https://www.npmjs.com/package/@muhammara/native-with-source) | Local native builds, Electron rebuilds, or platforms without a matching prebuilt binary |
| [`@muhammara/wasm`](https://www.npmjs.com/package/@muhammara/wasm)                             | Browsers, Web Workers, and other byte-oriented WebAssembly environments                 |

For most Node.js applications, install the prebuilt native package:

```sh
npm install @muhammara/native
```

Use the Wasm package when native addons or Node.js filesystem APIs are not
available:

```sh
npm install @muhammara/wasm
```

The native and Wasm packages use the same PDFWriter C++ foundation, but their
JavaScript APIs are intentionally different. Native works with Node.js paths,
streams, and buffers. Wasm is byte-first and uses values such as `Uint8Array`,
`ArrayBuffer`, `Blob`, and `File`.

## Version 6

MuhammaraJS v6 remains available under the unscoped package name `muhammara`.
It is not the same package as `@muhammara/native` or another `@muhammara/*`
package. The scoped packages are the new package line; existing v6 projects can
continue to install `muhammara`.

## Documentation

### Native

The [native documentation](https://muhammarajs.readthedocs.io/) covers the
low-level Node.js API, the included Recipe API, installation, and migration.
Install `@muhammara/native` when a prebuilt binary is suitable. The documentation
also covers `@muhammara/native-with-source`, including local compilation,
Electron rebuilds, build requirements, and source cleanup.

The native documentation source is in
[`packages/native/docs/`](packages/native/docs/). Build it with
`npm run docs:build` after installing
`packages/native/docs/requirements.txt`.

### WebAssembly

The [WebAssembly documentation](https://muhammarajs-wasm.readthedocs.io/)
covers `@muhammara/wasm` in browsers, Web Workers, and Node.js, including its
byte-first low-level and Recipe APIs.

The Wasm documentation source is in
[`packages/wasm/docs/`](packages/wasm/docs/).

## HummusJS Is The Base

MuhammaraJS is a drop-in replacement for HummusJS, originally created by
Galkahana. HummusJS is discontinued.

The original C++ project is documented at <http://www.pdfhummus.com>. The C++
library is maintained at <https://github.com/galkahana/PDF-Writer>.

## Recipe

MuhammaraJS includes the high-level Recipe functionality formerly distributed
as `hummus-recipe` and `muhammara-recipe`. Those separate packages are not
needed.
