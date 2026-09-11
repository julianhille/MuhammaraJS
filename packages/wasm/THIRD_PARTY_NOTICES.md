# Third-Party Notices

## Roboto Regular

- Copyright 2012 Google Inc. All Rights Reserved.
- Licensed under the [Apache License, Version 2.0](fonts/LICENSE.txt).
- Upstream: <https://github.com/googlefonts/roboto>.
- Bundled as `fonts/Roboto-Regular.js`, a lossless base64 encoding of the
  repository's `packages/native-core/fonts/Roboto.ttf`. The font itself is
  unmodified; its name-table copyright and licence notices are preserved.

Recipe uses this openly licensed face as its automatic default. No proprietary
native font faces are included in the Wasm package.
`@muhammara/wasm` statically links the following libraries from the vendored
source tree at `packages/native-with-source/src/deps/`. OpenSSL is not linked
into the WebAssembly target.

| Library   | Version or baseline                                                    | License                          |
| --------- | ---------------------------------------------------------------------- | -------------------------------- |
| PDFWriter | [v4.9.0](https://github.com/galkahana/PDF-Writer/tree/v4.9.0) baseline | Apache License 2.0               |
| FreeType  | 2.13.0                                                                 | FreeType License                 |
| LibAesgm  | Brian Gladman AES snapshot, copyright 1998-2013                        | Brian Gladman permissive license |
| LibJpeg   | IJG JPEG 9d                                                            | Independent JPEG Group license   |
| LibPng    | 1.6.37                                                                 | libpng License                   |
| LibTiff   | 4.6.0                                                                  | libtiff license                  |
| Zlib      | 1.2.11                                                                 | zlib License                     |

## PDFWriter

Copyright 2011-2025 Gal Kahana and PDFWriter contributors.

Licensed under the Apache License, Version 2.0. You may obtain a copy of the
license at <https://www.apache.org/licenses/LICENSE-2.0>. Unless required by
applicable law or agreed to in writing, software distributed under the license
is distributed on an "AS IS" BASIS, without warranties or conditions of any
kind, either express or implied.

## FreeType

Copyright 1996-2023 by David Turner, Robert Wilhelm, and Werner Lemberg.

FreeType is distributed under the FreeType License, a BSD-style permissive
license. The full license is available from the
[FreeType project](https://freetype.org/license.html).

## LibAesgm

Copyright (c) 1998-2013, Brian Gladman, Worcester, UK. All rights reserved.

Redistribution and use of this software, with or without changes, is allowed
without payment of fees or royalties provided that source distributions retain
this copyright notice, conditions, and disclaimer, and binary distributions
include them in their documentation. This software is provided "as is" with no
explicit or implied warranties, including correctness and fitness for purpose.

## LibJpeg

Copyright (C) 1991-1998, Thomas G. Lane. Modified 2002-2019 by Guido
Vollbeding. This software is part of the Independent JPEG Group's software.

The Independent JPEG Group license permits use, copying, modification, and
distribution for any purpose, with these conditions: do not misrepresent the
origin of the software; plainly mark altered source versions; and do not alter
or remove this notice from source distributions. The software is provided
"AS IS", without warranty of any kind.

## LibPng

Copyright (c) 1995-2019 The PNG Reference Library Authors, Cosmin Truta, Glenn
Randers-Pehrson, Andreas Dilger, and Guy Eric Schalnat, Group 42, Inc.

libpng is supplied "as is", without warranty of any kind. Permission is
granted to use, copy, modify, and distribute it for any purpose without fee,
provided that its origin is not misrepresented, altered versions are plainly
marked, and its copyright notice is retained. See the
[libpng License](http://www.libpng.org/pub/png/libpng-licenses.html).

## LibTiff

Copyright (c) 1988-1997 Sam Leffler. Copyright (c) 1991-1997 Silicon Graphics,
Inc.

Permission to use, copy, modify, distribute, and sell this software and its
documentation for any purpose is granted without fee, provided that the above
copyright notices and permission notice appear in all copies and related
documentation. The names Sam Leffler and Silicon Graphics may not be used in
advertising or publicity without prior written permission. The software is
provided "AS-IS" without warranty of any kind.

## Zlib

Copyright (C) 1995-2017 Jean-loup Gailly and Mark Adler.

zlib is provided "as-is", without any express or implied warranty. Permission
is granted to use it for any purpose, including commercial applications, and to
alter and redistribute it freely, provided that its origin is not
misrepresented, altered source versions are plainly marked, and this notice is
not removed or altered from source distributions.
