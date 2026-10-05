// Seeded byte mutators for the Wasm fuzzer. Every choice draws from the
// generator passed in, so a seed and an input reproduce the same mutation.

/**
 * Returns a xorshift128+ generator over [0, 1).
 * @param {number} seed - Any integer.
 * @returns {{next: () => number, int: (limit: number) => number,
 *   pick: <T>(values: T[]) => T, chance: (p: number) => boolean}} The generator.
 */
export function createRandom(seed) {
  var s0 = (seed ^ 0x9e3779b9) >>> 0 || 1;
  var s1 = (Math.imul(seed, 0x85ebca6b) ^ 0xc2b2ae35) >>> 0 || 2;
  /**
   * Advances the generator.
   * @returns {number} The next float in [0, 1).
   */
  function next() {
    var x = s0;
    var y = s1;
    s0 = y;
    x ^= x << 23;
    x ^= x >>> 17;
    x ^= y ^ (y >>> 26);
    s1 = x >>> 0;
    return ((s0 + s1) >>> 0) / 4294967296;
  }
  for (var i = 0; i < 16; ++i) next();
  return {
    next,
    /**
     * Draws an integer in [0, limit).
     * @param {number} limit - Exclusive upper bound.
     * @returns {number} The integer.
     */
    int: (limit) => Math.floor(next() * limit),
    /**
     * Picks a random element.
     * @param {Array} values - Values to pick from.
     * @returns {*} One of `values`.
     */
    pick: (values) => values[Math.floor(next() * values.length)],
    /**
     * Returns true with probability `p`.
     * @param {number} p - Probability in [0, 1].
     * @returns {boolean} The outcome.
     */
    chance: (p) => next() < p,
  };
}

import { crc32, deflateSync, inflateSync } from "node:zlib";

var encoder = new TextEncoder();
var latin1 = new TextDecoder("latin1");

var interestingBytes = [0x00, 0x01, 0x7f, 0x80, 0xff, 0xfe, 0x20, 0x0a, 0x0d];
var interestingNumbers = [
  "0",
  "-1",
  "1",
  "2",
  "-2147483648",
  "2147483647",
  "2147483648",
  "4294967295",
  "4294967296",
  "9223372036854775807",
  "18446744073709551616",
  "99999999999999999999999999",
  "1e308",
  "-0.0",
  "3.4028235e38",
  ".",
  "-",
  "65535",
  "65536",
  "32768",
  "255",
  "256",
];
var pdfTokens = [
  " R ",
  " obj ",
  " endobj ",
  "stream\n",
  "\nendstream",
  "<<",
  ">>",
  "[",
  "]",
  "(",
  ")",
  "<",
  ">",
  "/",
  "\\",
  "%",
  "/Length 0",
  "/Length -1",
  "/Length 99999999",
  "/Filter /FlateDecode",
  "/Filter /LZWDecode",
  "/Filter /ASCIIHexDecode",
  "/Filter /ASCII85Decode",
  "/Filter /RunLengthDecode",
  "/Filter /DCTDecode",
  "/Filter [/FlateDecode /FlateDecode]",
  "/DecodeParms << /Predictor 15 /Colors 255 /BitsPerComponent 16 /Columns 4294967295 >>",
  "/DecodeParms << /Predictor 2 /Colors 0 /Columns 0 >>",
  "/Type /ObjStm /N 2147483647 /First 0",
  "/Type /XRef /W [4 4 4] /Index [0 2147483647]",
  "/W [0 0 0]",
  "/W [9 9 9]",
  "/Prev 0",
  "/Prev 1",
  "/XRefStm 0",
  "/Kids [1 0 R]",
  "/Parent 2 0 R",
  "/Count -1",
  "/Count 2147483647",
  "/MediaBox [0 0 0 0]",
  "/MediaBox [1e308 -1e308 nan inf]",
  "/Rotate 2147483647",
  "/Contents [4 0 R 4 0 R]",
  "/Resources << /Font << /F1 9999 0 R >> >>",
  "/Encrypt << /Filter /Standard /V 4 /R 4 /Length 128 /O <00> /U <00> /P -1 >>",
  "/ToUnicode 5 0 R",
  "beginbfrange <0000> <FFFF> <0000> endbfrange",
  "beginbfchar <00> <D800> endbfchar",
  "/Differences [0 /a 255 /b 4294967295 /c]",
  "BT /F1 12 Tf (x) Tj ET",
  "[(a) -999999 (b)] TJ",
  "q q q q q q q q",
  "Q Q Q Q Q Q Q Q",
  "1 0 0 1 0 0 cm",
  "BI /W 1 /H 1 /BPC 8 /CS /G ID \x00 EI",
  "startxref\n0\n%%EOF",
  "xref\n0 1\n0000000000 65535 f \n",
  "trailer << /Size 1 /Root 1 0 R >>",
  "%PDF-1.7\n",
  "%%EOF",
];

/**
 * Finds the start and end of every ASCII number in `bytes`, up to `limit`.
 * @param {Uint8Array} bytes - Input.
 * @param {number} limit - Maximum number of spans.
 * @returns {Array<[number, number]>} Spans.
 */
function numberSpans(bytes, limit) {
  var spans = [];
  for (var i = 0; i < bytes.length && spans.length < limit; ++i) {
    var c = bytes[i];
    if ((c >= 0x30 && c <= 0x39) || c === 0x2d) {
      var start = i;
      while (
        i < bytes.length &&
        ((bytes[i] >= 0x30 && bytes[i] <= 0x39) ||
          bytes[i] === 0x2e ||
          bytes[i] === 0x2d)
      ) {
        ++i;
      }
      spans.push([start, i]);
    }
  }
  return spans;
}

/**
 * Replaces `bytes[start, end)` with `replacement`.
 * @param {Uint8Array} bytes - Input.
 * @param {number} start - First replaced byte.
 * @param {number} end - First kept byte after the replacement.
 * @param {Uint8Array} replacement - New bytes.
 * @returns {Uint8Array} A new array.
 */
function splice(bytes, start, end, replacement) {
  var out = new Uint8Array(bytes.length - (end - start) + replacement.length);
  out.set(bytes.subarray(0, start), 0);
  out.set(replacement, start);
  out.set(bytes.subarray(end), start + replacement.length);
  return out;
}

var mutators = {
  /**
   * Flips one random bit.
   * @param {Uint8Array} bytes - Input.
   * @param {ReturnType<typeof createRandom>} random - Generator.
   * @returns {Uint8Array} Mutated copy, or `bytes` when it is empty.
   */
  flipBit(bytes, random) {
    if (!bytes.length) return bytes;
    var out = bytes.slice();
    var at = random.int(out.length);
    out[at] ^= 1 << random.int(8);
    return out;
  },
  /**
   * Sets one byte to an interesting or random value.
   * @param {Uint8Array} bytes - Input.
   * @param {ReturnType<typeof createRandom>} random - Generator.
   * @returns {Uint8Array} Mutated copy, or `bytes` when it is empty.
   */
  setByte(bytes, random) {
    if (!bytes.length) return bytes;
    var out = bytes.slice();
    out[random.int(out.length)] = random.chance(0.5)
      ? random.pick(interestingBytes)
      : random.int(256);
    return out;
  },
  /**
   * Overwrites four bytes with a boundary value, in either byte order.
   * @param {Uint8Array} bytes - Input.
   * @param {ReturnType<typeof createRandom>} random - Generator.
   * @returns {Uint8Array} Mutated copy, or `bytes` when it is too short.
   */
  setWord(bytes, random) {
    if (bytes.length < 4) return bytes;
    var out = bytes.slice();
    var at = random.int(out.length - 3);
    var value = random.pick([
      0, 0xffffffff, 0x7fffffff, 0x80000000, 0xffff, 0x10000, 1, 0xfffffffe,
    ]);
    var view = new DataView(out.buffer);
    view.setUint32(at, value >>> 0, random.chance(0.5));
    return out;
  },
  /**
   * Deletes up to 512 bytes.
   * @param {Uint8Array} bytes - Input.
   * @param {ReturnType<typeof createRandom>} random - Generator.
   * @returns {Uint8Array} Mutated copy, or `bytes` when it is too short.
   */
  deleteRange(bytes, random) {
    if (bytes.length < 2) return bytes;
    var start = random.int(bytes.length);
    var length = 1 + random.int(Math.min(512, bytes.length - start));
    return splice(bytes, start, start + length, new Uint8Array(0));
  },
  /**
   * Inserts a copy of up to 1024 bytes at a random position.
   * @param {Uint8Array} bytes - Input.
   * @param {ReturnType<typeof createRandom>} random - Generator.
   * @returns {Uint8Array} Mutated copy, or `bytes` when it is empty or over
   *   4 MiB.
   */
  duplicateRange(bytes, random) {
    if (!bytes.length || bytes.length > 4 << 20) return bytes;
    var start = random.int(bytes.length);
    var length = 1 + random.int(Math.min(1024, bytes.length - start));
    var at = random.int(bytes.length + 1);
    return splice(bytes, at, at, bytes.slice(start, start + length));
  },
  /**
   * Inserts 1-32 random bytes.
   * @param {Uint8Array} bytes - Input.
   * @param {ReturnType<typeof createRandom>} random - Generator.
   * @returns {Uint8Array} Mutated copy.
   */
  insertRandom(bytes, random) {
    var length = 1 + random.int(32);
    var insert = new Uint8Array(length);
    for (var i = 0; i < length; ++i) insert[i] = random.int(256);
    var at = random.int(bytes.length + 1);
    return splice(bytes, at, at, insert);
  },
  /**
   * Cuts the input off at a random length.
   * @param {Uint8Array} bytes - Input.
   * @param {ReturnType<typeof createRandom>} random - Generator.
   * @returns {Uint8Array} Mutated copy, or `bytes` when it is too short.
   */
  truncate(bytes, random) {
    if (bytes.length < 2) return bytes;
    return bytes.slice(0, random.int(bytes.length));
  },
  /**
   * Replaces an ASCII number with an interesting or random one; falls back
   * to `setByte` when there is no number.
   * @param {Uint8Array} bytes - Input.
   * @param {ReturnType<typeof createRandom>} random - Generator.
   * @returns {Uint8Array} Mutated copy.
   */
  replaceNumber(bytes, random) {
    var spans = numberSpans(bytes, 4096);
    if (!spans.length) return mutators.setByte(bytes, random);
    var [start, end] = random.pick(spans);
    var value = random.chance(0.7)
      ? random.pick(interestingNumbers)
      : String(random.int(1 << 20) - (1 << 10));
    return splice(bytes, start, end, encoder.encode(value));
  },
  /**
   * Inserts a PDF syntax token.
   * @param {Uint8Array} bytes - Input.
   * @param {ReturnType<typeof createRandom>} random - Generator.
   * @returns {Uint8Array} Mutated copy.
   */
  insertToken(bytes, random) {
    var at = random.int(bytes.length + 1);
    return splice(bytes, at, at, encoder.encode(random.pick(pdfTokens)));
  },
  /**
   * Swaps one PDF name for another name already in the file, so mutations
   * move keys between dictionaries the parser knows how to reach. Falls back
   * to `insertToken` with fewer than two names.
   * @param {Uint8Array} bytes - Input.
   * @param {ReturnType<typeof createRandom>} random - Generator.
   * @returns {Uint8Array} Mutated copy.
   */
  replaceKeyword(bytes, random) {
    var text = latin1.decode(
      bytes.length > 1 << 20 ? bytes.subarray(0, 1 << 20) : bytes,
    );
    var names = [...text.matchAll(/\/[A-Za-z0-9]+/g)];
    if (names.length < 2) return mutators.insertToken(bytes, random);
    var target = random.pick(names);
    var source = random.pick(names);
    return splice(
      bytes,
      target.index,
      target.index + target[0].length,
      encoder.encode(source[0]),
    );
  },
  /**
   * Inserts a deeply nested run of arrays, dictionaries, strings, `q` or
   * `BT` operators.
   * @param {Uint8Array} bytes - Input.
   * @param {ReturnType<typeof createRandom>} random - Generator.
   * @returns {Uint8Array} Mutated copy.
   */
  deepNesting(bytes, random) {
    var open = random.pick(["[", "<<", "(", "q\n", "BT\n"]);
    var depth = random.pick([64, 512, 4096, 65536]);
    var at = random.int(bytes.length + 1);
    return splice(bytes, at, at, encoder.encode(open.repeat(depth)));
  },
};

var mutatorNames = Object.keys(mutators);
var structuralWeight = new Set([
  "replaceNumber",
  "insertToken",
  "replaceKeyword",
]);

// Streams and image data mutated after inflating; bigger ones are skipped,
// since the main thread mutates for every worker.
var maxDecoded = 1 << 20;
// Largest mutant: splicing and duplication otherwise grow inputs until most
// time goes into reading them.
var maxSize = 4 << 20;

/**
 * Applies 1-3 plain mutations to `bytes`.
 * @param {Uint8Array} bytes - Input.
 * @param {ReturnType<typeof createRandom>} random - Generator.
 * @returns {Uint8Array} Mutated copy.
 */
function mutateInner(bytes, random) {
  var out = bytes;
  for (var i = 1 + random.int(3); i > 0; --i) {
    out = mutators[random.pick(mutatorNames)](out, random);
  }
  return out;
}

/**
 * Inflates one Flate stream of a PDF, mutates its decoded bytes and puts it
 * back compressed with a matching /Length. Byte mutations of compressed data
 * only break decompression, so this is what reaches content streams, fonts,
 * CMaps, and object and xref streams.
 * @param {Uint8Array} bytes - PDF.
 * @param {ReturnType<typeof createRandom>} random - Generator.
 * @returns {Uint8Array|null} The PDF, or null without a usable stream.
 */
function mutatePdfStream(bytes, random) {
  var text = latin1.decode(bytes);
  var streams = [];
  // A direct /Length (an indirect one names another object), then the rest of
  // the same dictionary up to its stream keyword.
  var pattern =
    /\/Length\s+(\d+)(?!\s+\d+\s+R)(?:(?!endobj|stream)[^]){0,4000}?>>\s*stream(\r\n|\n|\r)/g;
  for (var match of text.matchAll(pattern)) {
    var dictionaryStart = text.lastIndexOf("<<", match.index);
    var dictionary = text.slice(dictionaryStart, match.index + match[0].length);
    if (!/\/FlateDecode/.test(dictionary)) continue;
    var dataStart = match.index + match[0].length;
    var end = text.indexOf("endstream", dataStart);
    if (end < 0) continue;
    streams.push({
      lengthAt: match.index,
      length: match[1],
      dataStart,
      dataEnd: end,
    });
    if (streams.length > 256) break;
  }
  if (!streams.length) return null;
  var chosen = random.pick(streams);
  var data = bytes.subarray(chosen.dataStart, chosen.dataEnd);
  var decoded;
  try {
    decoded = inflateSync(data, { maxOutputLength: maxDecoded });
  } catch {
    return null;
  }
  var encoded = deflateSync(mutateInner(new Uint8Array(decoded), random));
  var lengthText = `/Length ${chosen.length}`;
  var newLength = encoder.encode(`/Length ${encoded.length}`);
  // Replace the data first: the /Length edit before it shifts offsets.
  var out = splice(
    bytes,
    chosen.dataStart,
    chosen.dataEnd,
    concatBytes([encoded, encoder.encode("\n")]),
  );
  return splice(
    out,
    chosen.lengthAt,
    chosen.lengthAt + lengthText.length,
    newLength,
  );
}

/**
 * Concatenates byte arrays.
 * @param {Uint8Array[]} parts - Arrays to join.
 * @returns {Uint8Array} A new array.
 */
function concatBytes(parts) {
  var out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  var at = 0;
  for (var part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/**
 * Appends a classic xref table that points at where each `N G obj` really
 * is, and a trailer that keeps the file's Root, Info, Encrypt and ID. A
 * mutation that shifts bytes would otherwise break every later offset, and
 * the parser would stop before reaching what was mutated. Files with object
 * streams are left alone: their compressed objects have no offset.
 * @param {Uint8Array} bytes - PDF.
 * @returns {Uint8Array} The PDF with a fresh xref, or `bytes`.
 */
export function rebuildXref(bytes) {
  var text = latin1.decode(bytes);
  if (/\/Type\s*\/ObjStm/.test(text)) return bytes;
  var offsets = new Map();
  for (var match of text.matchAll(
    /(?:^|[\r\n])(\d{1,7})\s+(\d{1,5})\s+obj\b/g,
  )) {
    var at = match.index + (/[\r\n]/.test(match[0][0]) ? 1 : 0);
    offsets.set(Number(match[1]), [at, Number(match[2])]);
  }
  if (!offsets.size) return bytes;
  /**
   * Formats the last indirect reference or array value of a trailer key
   * found in the file, for the rebuilt trailer.
   * @param {string} key - Key name without the slash.
   * @returns {string} ` /Key value`, or an empty string when absent.
   */
  var entries = (key) => {
    var found = [
      ...text.matchAll(
        new RegExp(`/${key}\\s+(\\d+\\s+\\d+\\s+R|\\[[^\\]]*\\])`, "g"),
      ),
    ];
    return found.length ? ` /${key} ${found[found.length - 1][1]}` : "";
  };
  var size = Math.max(...offsets.keys()) + 1;
  if (size > 1 << 20) return bytes;
  var lines = ["xref", `0 ${size}`, "0000000000 65535 f "];
  for (var id = 1; id < size; ++id) {
    var entry = offsets.get(id);
    lines.push(
      entry
        ? `${String(entry[0]).padStart(10, "0")} ${String(entry[1]).padStart(5, "0")} n `
        : "0000000000 65535 f ",
    );
  }
  var xrefAt = bytes.length + 1;
  var tail = `\n${lines.join("\n")}\ntrailer\n<< /Size ${size}${entries("Root")}${entries("Info")}${entries("Encrypt")}${entries("ID")} >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  return concatBytes([bytes, encoder.encode(tail)]);
}

var pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * Lists a PNG's chunks.
 * @param {Uint8Array} bytes - PNG.
 * @returns {Array<{at: number, length: number, type: string}>} Chunks.
 */
function pngChunks(bytes) {
  if (bytes.length < 8 || pngSignature.some((byte, i) => bytes[i] !== byte)) {
    return [];
  }
  var view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  var chunks = [];
  for (var at = 8; at + 12 <= bytes.length;) {
    var length = view.getUint32(at);
    if (at + 12 + length > bytes.length) break;
    chunks.push({
      at,
      length,
      type: latin1.decode(bytes.subarray(at + 4, at + 8)),
    });
    at += 12 + length;
  }
  return chunks;
}

/**
 * Recomputes every PNG chunk CRC. libpng rejects a critical chunk with a
 * bad CRC, so without this a mutated PNG never reaches the decoder.
 * @param {Uint8Array} bytes - PNG.
 * @returns {Uint8Array} A fixed copy, or `bytes` if it is no PNG.
 */
export function fixPngCrcs(bytes) {
  var chunks = pngChunks(bytes);
  if (!chunks.length) return bytes;
  var out = bytes.slice();
  var view = new DataView(out.buffer);
  for (var chunk of chunks) {
    var body = out.subarray(chunk.at + 4, chunk.at + 8 + chunk.length);
    view.setUint32(chunk.at + 8 + chunk.length, crc32(body) >>> 0);
  }
  return out;
}

/**
 * Inflates a PNG's image data, mutates the decoded scanlines, and writes it
 * back as one IDAT chunk, so mutations reach libpng's filters and row
 * handling instead of failing in zlib.
 * @param {Uint8Array} bytes - PNG.
 * @param {ReturnType<typeof createRandom>} random - Generator.
 * @returns {Uint8Array|null} The PNG, or null if it is none.
 */
function mutatePngData(bytes, random) {
  var chunks = pngChunks(bytes);
  var data = chunks.filter((chunk) => chunk.type === "IDAT");
  if (!data.length) return null;
  var compressed = concatBytes(
    data.map((chunk) =>
      bytes.subarray(chunk.at + 8, chunk.at + 8 + chunk.length),
    ),
  );
  var decoded;
  try {
    decoded = inflateSync(compressed, { maxOutputLength: maxDecoded });
  } catch {
    return null;
  }
  var encoded = deflateSync(mutateInner(new Uint8Array(decoded), random));
  var header = new Uint8Array(8);
  new DataView(header.buffer).setUint32(0, encoded.length);
  header.set(encoder.encode("IDAT"), 4);
  var chunk = concatBytes([header, encoded, new Uint8Array(4)]);
  var first = data[0].at;
  var last = data[data.length - 1];
  return splice(bytes, first, last.at + 12 + last.length, chunk);
}

/**
 * Applies one to `maxStack` stacked mutations to a copy of `bytes`.
 * @param {Uint8Array} bytes - Seed input; never changed.
 * @param {ReturnType<typeof createRandom>} random - Generator.
 * @param {object} [options] - Options.
 * @param {boolean} [options.text] - Prefer PDF-syntax-aware mutators.
 * @param {Uint8Array[]} [options.splicePool] - Other inputs to splice from.
 * @param {"pdf"|"font"|"image"} [options.kind] - Input kind, for the
 *   structure-aware mutators: decoded PDF streams, a rebuilt xref, and PNG
 *   image data and CRCs.
 * @param {number} [options.maxStack=6] - Upper bound of stacked mutations.
 * @returns {{bytes: Uint8Array, steps: string[]}} The mutated input and the
 *   mutators applied, in order.
 */
export function mutate(bytes, random, options = {}) {
  var maxStack = options.maxStack ?? 6;
  var count = 1 + random.int(maxStack);
  var steps = [];
  var out = bytes;
  for (var i = 0; i < count; ++i) {
    var name;
    if (options.splicePool?.length && random.chance(0.05)) {
      var other = random.pick(options.splicePool);
      var cut = random.int(out.length + 1);
      var from = random.int(other.length + 1);
      out = splice(out, cut, out.length, other.subarray(from));
      steps.push("splice");
      continue;
    }
    if (options.kind === "pdf" && random.chance(0.3)) {
      var streamMutated = mutatePdfStream(out, random);
      if (streamMutated) {
        out = streamMutated;
        steps.push("pdfStream");
        continue;
      }
    }
    if (options.kind === "image" && random.chance(0.3)) {
      var pngMutated = mutatePngData(out, random);
      if (pngMutated) {
        out = pngMutated;
        steps.push("pngData");
        continue;
      }
    }
    do {
      name = random.pick(mutatorNames);
    } while (
      options.text === false &&
      structuralWeight.has(name) &&
      random.chance(0.8)
    );
    out = mutators[name](out, random);
    steps.push(name);
  }
  // Without it, 3% of byte-mutated seeds still parse, and none with a
  // mutated stream; with it, about half.
  if (
    options.kind === "pdf" &&
    (steps.includes("pdfStream") || random.chance(0.85))
  ) {
    out = rebuildXref(out);
    steps.push("rebuildXref");
  }
  if (options.kind === "image" && random.chance(0.8)) {
    out = fixPngCrcs(out);
    steps.push("fixPngCrcs");
  }
  if (out.length > maxSize) {
    out = out.subarray(0, maxSize);
    steps.push("cap");
  }
  return { bytes: out, steps };
}
