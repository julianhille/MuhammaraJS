# Welcome to MuhammaraJS
[![NPM version](http://img.shields.io/npm/v/muhammara.svg?style=flat)](https://www.npmjs.org/package/muhammara)
[![Build status](https://github.com/julianhille/MuhammaraJS/actions/workflows/build.yml/badge.svg?branch=develop)](https://github.com/julianhille/MuhammaraJS/actions/workflows/build.yml)

This is a drop in replacement for hummusJS originally made by Galkahana.
He did an awesome job, but discontinued hummusjs.

The documentation for MuhammaraJS / HummusJS is still located at the
hummusJS github wiki: available [here](https://github.com/galkahana/HummusJS/wiki)

Welcome to HummusJS.
A Fast NodeJS Module for Creating, Parsing an Manipulating PDF Files and Streams.


Original Project
Project site is [here](http://www.pdfhummus.com).

If you are looking for a C++ Library go [here](https://github.com/galkahana/PDF-Writer).

# Caution

Version 2.0 will be incompatible with some older node and
electron versions because we needed to upgrade node-pre-gyp.

# Installation

```
npm install muhammara

```

## Installation on AWS Lambda

As AWS Lambda is somewhat special we compile the binary on a specific
aws lambda docker machine and supply it as a special target.
The normal [target](https://github.com/mapbox/node-pre-gyp) names are:
`linux`, `darwin`, `win32`, `sunos`, `freebsd`, `openbsd`, and `aix`.

Muhammara adds `amz-lambda-linux`.
There are several ways to install muhammara on amazon linux:

1. There is an [environment variable](./package.json?plain=1#L14) which alters the behaviour of an
installation. It is called `EXTRA_NODE_PRE_GYP_FLAGS`.
This could be used like this:
```
EXTRA_NODE_PRE_GYP_FLAGS="--target_platform=amz-lambda-linux" npm install
```

2. When packaging locally and using at least npm 5.2 you could also do

```
npx node-pre-gyp install --fallback-to-build --update-binary --target-platform=amz-lambda-linux
```

If you do not use npm you could install npx through your package manager of choice.

3. Get your download link from the release assets and download and unpack the `tar.gz` to
the correct location. (I would not recommend that.)

# Replace hummusJS with MuhammaraJS

Replace:

```
let hummus = require('hummus')
```

With:

```
let muhammara = require('muhammara')
```

# Documentation

You can find samples and documentation [here](./docs/Home.md)
