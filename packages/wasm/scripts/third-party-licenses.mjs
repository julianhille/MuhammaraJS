// The third-party components of @muhammara/wasm and where each one's license
// and copyright notice is read from at build time: the verbatim license files
// in packages/native-with-source/src/deps/licenses, the Emscripten
// installation in the pinned emsdk image that linked the wasm, and the bundled
// Roboto font.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export var packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
var repositoryRoot = path.resolve(packageRoot, "../..");
var deps = "packages/native-with-source/src/deps";
var licenses = `${deps}/licenses`;

export var header =
  "MuhammaraJS itself is licensed under the Apache License, Version 2.0 (see LICENSE). The @muhammara/wasm package contains the third-party components below; each one's license and copyright notice follows the table in full.";

export var acknowledgements = [
  "Portions of this software are copyright © 2026 The FreeType Project (www.freetype.org). All rights reserved.",
  "This software is based in part on the work of the Independent JPEG Group.",
];

/**
 * A verbatim license file in packages/native-with-source/src/deps/licenses.
 * @param {string} name - File name.
 * @returns {object} The piece.
 */
function license(name) {
  return { file: `${licenses}/${name}` };
}

/**
 * A whole file in the Emscripten installation the wasm was linked with.
 * @param {string} file - Path inside the installation.
 * @returns {object} The piece.
 */
function emscripten(file) {
  return { file, emscripten: true };
}

export var components = [
  {
    name: "PDFWriter",
    version: "v4.9.1 baseline, patched by MuhammaraJS",
    license: "Apache-2.0 AND RSA-MD AND BSD-3-Clause AND libtiff",
    source: "https://github.com/galkahana/PDF-Writer/tree/v4.9.1",
    shippedIn: "dist/muhammara-wasm.wasm",
    pieces: [
      license("PDFWriter-NOTICE.txt"),
      license("PDFWriter-LICENSE.txt"),
      license("PDFWriter-MD5Generator.txt"),
      license("PDFWriter-ShadingWriter-Skia.txt"),
      license("PDFWriter-TIFFImageHandler-tiff2pdf.txt"),
    ],
  },
  {
    name: "FreeType",
    version: "2.14.3",
    license: "FTL",
    source:
      "https://gitlab.freedesktop.org/freetype/freetype/-/tree/VER-2-14-3",
    shippedIn: "dist/muhammara-wasm.wasm",
    // Dual-licensed FTL OR GPL-2.0-or-later; MuhammaraJS uses the FTL.
    pieces: [license("FreeType-LICENSE.TXT"), license("FreeType-FTL.TXT")],
  },
  {
    name: "FreeType BDF driver",
    version: "bundled with FreeType 2.14.3",
    license: "MIT",
    source:
      "https://gitlab.freedesktop.org/freetype/freetype/-/tree/VER-2-14-3/src/bdf",
    shippedIn: "dist/muhammara-wasm.wasm",
    pieces: [license("FreeType-BDF-README-License.txt")],
  },
  {
    name: "FreeType PCF driver",
    version: "bundled with FreeType 2.14.3",
    license: "MIT AND MIT-open-group",
    source:
      "https://gitlab.freedesktop.org/freetype/freetype/-/tree/VER-2-14-3/src/pcf",
    shippedIn: "dist/muhammara-wasm.wasm",
    pieces: [
      license("FreeType-PCF-README-License.txt"),
      license("FreeType-PCF-pcfutil.txt"),
    ],
  },
  {
    name: "FreeType hash functions (fthash.c)",
    version: "bundled with FreeType 2.14.3",
    license: "MIT",
    source:
      "https://gitlab.freedesktop.org/freetype/freetype/-/blob/VER-2-14-3/src/base/fthash.c",
    shippedIn: "dist/muhammara-wasm.wasm",
    pieces: [license("FreeType-fthash.txt")],
  },
  {
    name: "Zlib",
    version: "1.3.1",
    license: "Zlib",
    source: "https://github.com/madler/zlib/tree/v1.3.1",
    shippedIn: "dist/muhammara-wasm.wasm",
    // FreeType is built with FT_CONFIG_OPTION_SYSTEM_ZLIB and uses this copy,
    // so FreeType's own src/gzip copy of zlib is not compiled.
    pieces: [license("Zlib.txt")],
  },
  {
    name: "LibAesgm",
    version: "Brian Gladman AES, issue date 02/09/2018",
    license: "LicenseRef-Brian-Gladman",
    source: "https://github.com/BrianGladman/aes",
    shippedIn: "dist/muhammara-wasm.wasm",
    pieces: [license("LibAesgm.txt")],
  },
  {
    name: "LibJpeg",
    version: "IJG JPEG 10 (25-Jan-2026)",
    license: "IJG",
    source: "https://www.ijg.org/files/jpegsrc.v10.tar.gz",
    shippedIn: "dist/muhammara-wasm.wasm",
    pieces: [license("LibJpeg.txt")],
  },
  {
    name: "LibPng",
    version: "1.6.59",
    license: "libpng-2.0",
    source: "https://github.com/pnggroup/libpng/tree/v1.6.59",
    shippedIn: "dist/muhammara-wasm.wasm",
    pieces: [license("LibPng-LICENSE.txt")],
  },
  {
    name: "LibTiff",
    version: "4.7.2",
    license: "libtiff AND MIT",
    source: "https://gitlab.com/libtiff/libtiff/-/tree/v4.7.2",
    shippedIn: "dist/muhammara-wasm.wasm",
    pieces: [
      license("LibTiff-LICENSE.md"),
      license("LibTiff-tif_hash_set.txt"),
      license("LibTiff-tif_luv.txt"),
      license("LibTiff-tif_ojpeg.txt"),
      license("LibTiff-tif_pixarlog.txt"),
    ],
  },
  {
    name: "Emscripten runtime",
    version: "3.1.74",
    license: "MIT OR NCSA",
    source: "https://github.com/emscripten-core/emscripten/tree/3.1.74",
    shippedIn: "dist/muhammara-wasm.wasm and dist/muhammara-wasm.js",
    pieces: [emscripten("LICENSE")],
  },
  {
    name: "musl libc",
    version: "as shipped in Emscripten 3.1.74",
    license: "MIT",
    source:
      "https://github.com/emscripten-core/emscripten/tree/3.1.74/system/lib/libc/musl",
    shippedIn: "dist/muhammara-wasm.wasm",
    pieces: [emscripten("system/lib/libc/musl/COPYRIGHT")],
  },
  {
    name: "libc++",
    version: "as shipped in Emscripten 3.1.74",
    license: "Apache-2.0 WITH LLVM-exception",
    source:
      "https://github.com/emscripten-core/emscripten/tree/3.1.74/system/lib/libcxx",
    shippedIn: "dist/muhammara-wasm.wasm",
    pieces: [emscripten("system/lib/libcxx/LICENSE.TXT")],
  },
  {
    name: "libc++abi",
    version: "as shipped in Emscripten 3.1.74",
    license: "Apache-2.0 WITH LLVM-exception",
    source:
      "https://github.com/emscripten-core/emscripten/tree/3.1.74/system/lib/libcxxabi",
    shippedIn: "dist/muhammara-wasm.wasm",
    pieces: [emscripten("system/lib/libcxxabi/LICENSE.TXT")],
  },
  {
    name: "compiler-rt",
    version: "as shipped in Emscripten 3.1.74",
    license: "Apache-2.0 WITH LLVM-exception",
    source:
      "https://github.com/emscripten-core/emscripten/tree/3.1.74/system/lib/compiler-rt",
    shippedIn: "dist/muhammara-wasm.wasm",
    pieces: [emscripten("system/lib/compiler-rt/LICENSE.TXT")],
  },
  {
    name: "dlmalloc",
    version: "2.8.6, as shipped in Emscripten 3.1.74",
    license: "CC0-1.0",
    source:
      "https://github.com/emscripten-core/emscripten/blob/3.1.74/system/lib/dlmalloc.c",
    shippedIn: "dist/muhammara-wasm.wasm",
    // The build does not set -sMALLOC, so Emscripten's default is linked.
    pieces: [
      {
        // dlmalloc.c has no license file; its dedication opens the source.
        ...emscripten("system/lib/dlmalloc.c"),
        start: "This is a version (aka dlmalloc) of malloc/free/realloc",
        end: "comments, complaints, performance data",
        endInclusive: true,
        strip: /^ /,
      },
    ],
  },
  {
    name: "Roboto Regular",
    version: "Roboto.ttf as bundled with @muhammara/native-core",
    license: "Apache-2.0",
    source: "https://github.com/googlefonts/roboto",
    shippedIn: "fonts/Roboto-Regular.js (not in the .wasm)",
    pieces: [
      { font: "packages/native-core/fonts/Roboto.ttf" },
      { file: "packages/wasm/fonts/LICENSE.txt" },
    ],
  },
  {
    name: "Adobe Glyph List",
    version: "2.0 (glyphlist.txt, September 20, 2002)",
    license: "Adobe-Glyph",
    source: "https://github.com/adobe-type-tools/agl-aglfn",
    shippedIn: "lib/glyph-list.js (not in the .wasm)",
    pieces: [license("AdobeGlyphList.txt")],
  },
];

// Each vendored library's version as its headers state it, so a dependency
// update without a matching component entry fails the build.
export var versionChecks = [
  {
    names: [
      "FreeType",
      "FreeType BDF driver",
      "FreeType PCF driver",
      "FreeType hash functions (fthash.c)",
    ],
    file: `${deps}/FreeType/include/freetype/freetype.h`,
    read: (source) =>
      ["MAJOR", "MINOR", "PATCH"]
        .map(
          (part) =>
            source.match(new RegExp(`#define FREETYPE_${part}\\s+(\\d+)`))?.[1],
        )
        .join("."),
  },
  {
    names: ["Zlib"],
    file: `${deps}/Zlib/zlib.h`,
    read: (source) => source.match(/#define ZLIB_VERSION "([^"]+)"/)?.[1],
  },
  {
    names: ["LibPng"],
    file: `${deps}/LibPng/png.h`,
    read: (source) =>
      source.match(/#define PNG_LIBPNG_VER_STRING "([^"]+)"/)?.[1],
  },
  {
    names: ["LibTiff"],
    file: `${deps}/LibTiff/tiffvers.h`,
    read: (source) =>
      source.match(/#define TIFFLIB_VERSION_STR_MAJ_MIN_MIC "([^"]+)"/)?.[1],
  },
  {
    names: ["LibJpeg"],
    file: `${deps}/LibJpeg/jversion.h`,
    read: (source) => {
      var match = source.match(/#define JVERSION\s+"(\S+)\s+(\S+)"/);
      return match && `${match[1]} (${match[2]})`;
    },
  },
  {
    names: [
      "Emscripten runtime",
      "musl libc",
      "libc++",
      "libc++abi",
      "compiler-rt",
      "dlmalloc",
    ],
    file: "emscripten-version.txt",
    emscripten: true,
    read: (source) => source.match(/\d+\.\d+\.\d+/)?.[0],
  },
];

/**
 * Tells whether a version text names exactly the given version, so that
 * 1.3.1 does not match 1.3.10.
 * @param {string} text - Component version text.
 * @param {string} version - Version read from the sources.
 * @returns {boolean} True when the version appears as a whole token.
 */
export function mentionsVersion(text, version) {
  var escaped = version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\w.])${escaped}(?![\\w]|\\.\\d)`).test(text);
}

/**
 * Resolves a piece's file.
 * @param {object} piece - Piece with `file` and optional `emscripten`.
 * @param {string} [emscriptenRoot] - Emscripten installation directory.
 * @returns {string} Absolute path.
 * @throws {Error} If an Emscripten file is needed but no root was given.
 */
function resolve(piece, emscriptenRoot) {
  if (!piece.emscripten) return path.join(repositoryRoot, piece.file);
  if (!emscriptenRoot) {
    throw new Error(
      `${piece.file} comes from the Emscripten installation; pass --emscripten-root`,
    );
  }
  return path.join(emscriptenRoot, piece.file);
}

/**
 * Reads a file as LF-normalized text.
 * @param {string} file - Absolute path.
 * @returns {Promise<string>} The text.
 */
async function readText(file) {
  return (await readFile(file, "utf8")).replace(/\r\n?/g, "\n");
}

/**
 * Turns a line matcher into a predicate.
 * @param {string|Function} matcher - Substring or predicate.
 * @returns {Function} The predicate.
 */
function matches(matcher) {
  return typeof matcher === "function"
    ? matcher
    : (line) => line.includes(matcher);
}

/**
 * Drops blank lines around the text and, for text cut out of a source
 * comment, trailing spaces on each line.
 * @param {string[]} lines - Lines.
 * @param {boolean} excerpted - Whether the lines come from a comment.
 * @returns {string} The text.
 */
function tidy(lines, excerpted) {
  return lines
    .map((line) => (excerpted ? line.replace(/[ \t]+$/, "") : line))
    .join("\n")
    .replace(/^\n+/, "")
    .replace(/\n+$/, "");
}

/**
 * Reads the copyright string (name ID 0) of a TrueType font.
 * @param {Uint8Array} bytes - Font bytes.
 * @returns {string} The notice.
 * @throws {Error} If the font has no Windows Unicode copyright record.
 */
function fontCopyright(bytes) {
  var view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  var tables = view.getUint16(4);
  for (var index = 0; index < tables; index += 1) {
    var record = 12 + index * 16;
    if (String.fromCharCode(...bytes.subarray(record, record + 4)) !== "name")
      continue;
    var table = view.getUint32(record + 8);
    var count = view.getUint16(table + 2);
    var strings = table + view.getUint16(table + 4);
    for (var entry = 0; entry < count; entry += 1) {
      var at = table + 6 + entry * 12;
      if (
        view.getUint16(at) === 3 &&
        view.getUint16(at + 2) === 1 &&
        view.getUint16(at + 6) === 0
      ) {
        var length = view.getUint16(at + 8);
        var offset = strings + view.getUint16(at + 10);
        var units = [];
        for (var unit = 0; unit < length; unit += 2) {
          units.push(view.getUint16(offset + unit));
        }
        return String.fromCharCode(...units);
      }
    }
  }
  throw new Error("Font has no Windows Unicode copyright name record");
}

/**
 * Extracts one piece of license text.
 * @param {object} piece - A piece from `components`.
 * @param {string} [emscriptenRoot] - Emscripten installation directory.
 * @returns {Promise<string>} The text, without surrounding blank lines.
 * @throws {Error} If the file is missing or a marker is not found.
 */
export async function extractPiece(piece, emscriptenRoot) {
  if (piece.font) {
    return fontCopyright(
      new Uint8Array(await readFile(path.join(repositoryRoot, piece.font))),
    );
  }
  var file = resolve(piece, emscriptenRoot);
  var text = await readText(file).catch((error) => {
    throw new Error(
      `License source ${piece.file} cannot be read: ${error.message}`,
    );
  });
  var lines = text.split("\n");
  if (piece.start) {
    var first = lines.findIndex(matches(piece.start));
    if (first === -1) {
      throw new Error(`Start of the license text not found in ${piece.file}`);
    }
    var isEnd = matches(piece.end);
    var last = lines.findIndex((line, index) => index > first && isEnd(line));
    if (last === -1 && !piece.optionalEnd) {
      throw new Error(`End of the license text not found in ${piece.file}`);
    }
    if (last === -1) last = lines.length;
    else if (piece.endInclusive) last += 1;
    lines = lines.slice(first, last);
    if (piece.strip) lines = lines.map((line) => line.replace(piece.strip, ""));
  }
  var result = tidy(lines, Boolean(piece.start));
  if (!result.trim())
    throw new Error(`License text from ${piece.file} is empty`);
  return result;
}
