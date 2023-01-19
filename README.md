# Welcome to MuhammaraJS

[![NPM version](http://img.shields.io/npm/v/muhammara.svg?style=flat)](https://www.npmjs.org/package/muhammara)
[![Build status](https://github.com/julianhille/MuhammaraJS/actions/workflows/build.yml/badge.svg?branch=develop)](https://github.com/julianhille/MuhammaraJS/actions/workflows/build.yml)

Welcome to MuhammaraJS.
A Fast NodeJS Module for Creating, Parsing an Manipulating PDF Files and Streams.

Original Project (CPP base version)
Project site is [here](http://www.pdfhummus.com).

If you are looking for a C++ Library go [here](https://github.com/galkahana/PDF-Writer).

## Hummus JS is the base

This is a drop in replacement for hummusJS originally made by Galkahana.
He did an awesome job, but discontinued hummusjs.

The documentation for MuhammaraJS / HummusJS is still located at the
hummusJS github wiki: available [here](https://github.com/galkahana/HummusJS/wiki)

## muhammara-recipe '(formerly known as hummus-recipe) as been added

Muhammara-recipe and hummus-recipe has been integrated, dependencies updated
and is now shipped along with muhammara itself.

It serves as a drop in replacement.

# Caution

Version 2.0 will be incompatible with some older node and
electron versions because we needed to upgrade node-pre-gyp.

Version 3.x has breaking changes:

- Node < 11 and Electron < 11 removed the prebuilts
- Renamed typo exported value from eTokenSeprator to eTokenSeparator

This wont affect alot of you but still.

# Installation

```
npm install muhammara

```

# Replace hummusJS with MuhammaraJS for hummus

Replace:

```
let hummus = require('hummus')
```

With:

```
let muhammara = require('muhammara')
```

# Replace hummus-recipe or muhammara-recipe with MuhammaraJS

Replace:

`const HummusRecipe = require('hummus-recipe');`

With:

```
const HummusRecipe = require('muhammara').Receipe;
```

# Documentation

## Muhammara

You can find samples and documentation [here](./docs/Home.md)

### Muhammara Recipe:

To generate the documentation you could clone this repo and execute:

`npm run recipe-jsdoc`
