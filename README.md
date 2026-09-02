# Welcome to MuhammaraJS

[![NPM version](https://img.shields.io/npm/v/%40muhammara%2Fnative.svg?style=flat)](https://www.npmjs.org/package/@muhammara/native)
[![Native CI status](https://github.com/julianhille/MuhammaraJS/actions/workflows/ci-native.yml/badge.svg?branch=develop)](https://github.com/julianhille/MuhammaraJS/actions/workflows/ci-native.yml)

MuhammaraJS is a fast Node.js module for creating, parsing, and manipulating
PDF files and streams.

Use `npm install @muhammara/native` for a small native package with matching
prebuilt binaries. Use `npm install @muhammara/native-with-source` when a local
source build or Electron rebuild is needed. The unscoped `muhammara` package is
deprecated and receives no further releases.

Original Project (C++ base version): <http://www.pdfhummus.com>

For the C++ library, see <https://github.com/galkahana/PDF-Writer>.

## Documentation

[Read the native Node.js documentation on Read the Docs](https://muhammarajs.readthedocs.io/).
[Read the browser and Worker documentation on Read the Docs](https://muhammarajs-wasm.readthedocs.io/).
Native documentation is in [packages/native/docs/](packages/native/docs/);
Wasm documentation is in [packages/wasm/docs/](packages/wasm/docs/). Build the
native site with `npm run docs:build` after installing
`packages/native/docs/requirements.txt`.

## HummusJS Is The Base

This is a drop-in replacement for HummusJS, originally made by Galkahana.
HummusJS is discontinued.

## Recipe

MuhammaraJS includes the high-level Recipe API, formerly available as
hummus-recipe. Use `require("@muhammara/native").Recipe`; its generated API reference
is included in the [Read the Docs site](https://muhammarajs.readthedocs.io/).
