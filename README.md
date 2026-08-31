# Welcome to MuhammaraJS

[![NPM version](https://img.shields.io/npm/v/%40muhammara%2Fnative.svg?style=flat)](https://www.npmjs.org/package/@muhammara/native)
[![Build status](https://github.com/julianhille/MuhammaraJS/actions/workflows/build.yml/badge.svg?branch=develop)](https://github.com/julianhille/MuhammaraJS/actions/workflows/build.yml)

MuhammaraJS is a fast Node.js module for creating, parsing, and manipulating
PDF files and streams.

Use `npm install @muhammara/native` for a small native package with matching
prebuilt binaries. Use `npm install @muhammara/native-with-source` when a local
source build or Electron rebuild is needed. The unscoped `muhammara` package is
deprecated and receives no further releases.

Original Project (C++ base version): <http://www.pdfhummus.com>

For the C++ library, see <https://github.com/galkahana/PDF-Writer>.

## Documentation

[Read the full MuhammaraJS documentation on Read the Docs](https://muhammarajs.readthedocs.io/).
Native Node.js documentation is in [packages/native-core/docs/](packages/native-core/docs/);
browser and worker documentation is in
[packages/wasm/docs/](packages/wasm/docs/). Build the combined site with
`npm run docs:build` after installing `docs/requirements.txt`.

## HummusJS Is The Base

This is a drop-in replacement for HummusJS, originally made by Galkahana.
HummusJS is discontinued.

## Recipe

MuhammaraJS includes the high-level Recipe API, formerly available as
hummus-recipe. Use `require("@muhammara/native").Recipe`; its generated API reference
is included in the [Read the Docs site](https://muhammarajs.readthedocs.io/).
