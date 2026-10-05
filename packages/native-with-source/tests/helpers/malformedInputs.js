// Builders for the malformed fonts, images, and PDFs that reproduce fuzzer
// findings. Each patches a shared fixture or assembles a minimal file, so a
// regression test needs no saved input. Mirrored by
// packages/wasm/tests/malformedInputs.mjs.
var fs = require("fs");
var path = require("path");

var materials = path.join(__dirname, "..", "TestMaterials");
// Inputs the Wasm fuzzer (packages/wasm/tests/fuzz) found, replayed by the
// Wasm security suite and used directly by the native tests.
var fuzzInputs = path.join(materials, "fuzz");
var output = path.join(__dirname, "..", "output");

/**
 * Reads a shared fixture into a copy the caller may patch.
 * @param {...string} parts - Path below TestMaterials.
 * @returns {Buffer} The fixture.
 */
function material(...parts) {
  return Buffer.from(fs.readFileSync(path.join(materials, ...parts)));
}

/**
 * Writes a patched fixture to the test output directory.
 * @param {string} name - File name.
 * @param {Buffer} data - File content.
 * @returns {string} Path of the written file.
 */
function writeFixture(name, data) {
  fs.mkdirSync(output, { recursive: true });
  var file = path.join(output, name);
  fs.writeFileSync(file, data);
  return file;
}

/**
 * Copies arial.ttf and sets numberOfContours of one simple glyph far beyond
 * its data, so FreeType fails to load that glyph.
 * @returns {{font: Buffer, broken: number}} The font and the broken glyph.
 */
function fontWithBrokenGlyph() {
  var font = material("fonts", "arial.ttf");
  var tables = {};
  for (var i = 0, count = font.readUInt16BE(4); i < count; ++i) {
    var record = 12 + i * 16;
    tables[font.toString("latin1", record, record + 4)] = font.readUInt32BE(
      record + 8,
    );
  }
  var longOffsets = font.readInt16BE(tables.head + 50) === 1;
  /**
   * Reads a glyph's offset from the loca table.
   * @param {number} glyph - Glyph index.
   * @returns {number} Offset into the glyf table.
   */
  function glyphOffset(glyph) {
    return longOffsets
      ? font.readUInt32BE(tables.loca + glyph * 4)
      : font.readUInt16BE(tables.loca + glyph * 2) * 2;
  }
  for (var glyph = 1; ; ++glyph) {
    var start = glyphOffset(glyph);
    if (
      glyphOffset(glyph + 1) - start > 12 &&
      font.readInt16BE(tables.glyf + start) > 0
    ) {
      font.writeInt16BE(0x7fff, tables.glyf + start);
      return { font: font, broken: glyph };
    }
  }
}

/**
 * Copies arial.ttf with its glyf table replaced by `glyph` in the last glyph
 * slot, appended to the end of the file. Every other glyph is empty.
 * @param {Buffer} glyph - Glyph data.
 * @returns {Buffer} The font.
 */
function fontWithOnlyGlyph(glyph) {
  var font = material("fonts", "arial.ttf");
  var records = {};
  for (var i = 0, count = font.readUInt16BE(4); i < count; ++i) {
    var record = 12 + i * 16;
    records[font.toString("latin1", record, record + 4)] = record;
  }
  /**
   * Reads a table's offset.
   * @param {string} tag - Table tag.
   * @returns {number} Offset of the table.
   */
  function offset(tag) {
    return font.readUInt32BE(records[tag] + 8);
  }
  var glyphs = font.readUInt16BE(offset("maxp") + 4);
  var longOffsets = font.readInt16BE(offset("head") + 50) === 1;
  for (var g = 0; g <= glyphs; ++g) {
    var value = g === glyphs ? glyph.length : 0;
    if (longOffsets) font.writeUInt32BE(value, offset("loca") + g * 4);
    else font.writeUInt16BE(value / 2, offset("loca") + g * 2);
  }
  font.writeUInt32BE(font.length, records.glyf + 8);
  font.writeUInt32BE(glyph.length, records.glyf + 12);
  return Buffer.concat([font, glyph]);
}

/**
 * Finds the CFF table of an OpenType font. Minimal CFF reading, enough to find
 * the dictionaries the tests patch.
 * @param {Buffer} font - OpenType font.
 * @returns {number} Offset of the CFF table.
 */
function cffOffset(font) {
  for (var i = 0, count = font.readUInt16BE(4); i < count; ++i) {
    var record = 12 + i * 16;
    if (font.toString("latin1", record, record + 4) === "CFF ")
      return font.readUInt32BE(record + 8);
  }
  throw new Error("No CFF table");
}

/**
 * Reads a CFF INDEX header.
 * @param {Buffer} font - OpenType font.
 * @param {number} at - Offset of the INDEX.
 * @returns {{end: number, first?: number[]}} End of the INDEX and the bounds
 * of its first entry.
 */
function cffIndex(font, at) {
  var count = font.readUInt16BE(at);
  if (count === 0) return { end: at + 2 };
  var offSize = font[at + 2];
  var base = at + 3 + (count + 1) * offSize - 1;
  /**
   * Reads where an INDEX entry starts.
   * @param {number} i - Entry index; `count` gives the end of the data.
   * @returns {number} Offset of the entry in the font.
   */
  function offset(i) {
    return base + font.readUIntBE(at + 3 + i * offSize, offSize);
  }
  return { end: offset(count), first: [offset(0), offset(1)] };
}

/**
 * Maps each operator of a CFF DICT (12 x as 1200 + x) to its operands and its
 * position.
 * @param {Buffer} font - OpenType font.
 * @param {number} start - Offset of the DICT.
 * @param {number} end - Offset past the DICT.
 * @returns {Object<number, {operands: number[], at: number}>} The operators.
 */
function cffDict(font, start, end) {
  var result = {};
  var operands = [];
  for (var at = start; at < end;) {
    var b = font[at];
    if (b <= 21) {
      var op = b === 12 ? 1200 + font[at + 1] : b;
      result[op] = { operands: operands, at: at };
      operands = [];
      at += b === 12 ? 2 : 1;
    } else if (b === 28) {
      operands.push(font.readInt16BE(at + 1));
      at += 3;
    } else if (b === 29) {
      operands.push(font.readInt32BE(at + 1));
      at += 5;
    } else if (b === 30) {
      while ((font[++at] & 0x0f) !== 0x0f && font[at] >> 4 !== 0x0f);
      operands.push(0);
      ++at;
    } else if (b <= 246) {
      operands.push(b - 139);
      at += 1;
    } else if (b <= 250) {
      operands.push((b - 247) * 256 + font[at + 1] + 108);
      at += 2;
    } else {
      operands.push(-(b - 251) * 256 - font[at + 1] - 108);
      at += 2;
    }
  }
  return result;
}

/**
 * Reads the Top DICT of the first font in a CFF table.
 * @param {Buffer} font - OpenType font.
 * @returns {{cff: number, dict: Object}} CFF table offset and Top DICT.
 */
function cffTopDict(font) {
  var cff = cffOffset(font);
  var names = cffIndex(font, cff + font[cff + 2]);
  var top = cffIndex(font, names.end).first;
  return { cff: cff, dict: cffDict(font, top[0], top[1]) };
}

/**
 * Builds a PDF with a classic xref table from object bodies numbered from 1.
 * @param {string[]} objects - Object bodies; object 1 must be the catalog.
 * @returns {Buffer} The PDF.
 */
function pdfWith(objects) {
  var out = "%PDF-1.7\n";
  var offsets = [];
  objects.forEach(function (body, i) {
    offsets.push(out.length);
    out += i + 1 + " 0 obj\n" + body + "\nendobj\n";
  });
  var xref = out.length;
  out += "xref\n0 " + (objects.length + 1) + "\n0000000000 65535 f \n";
  offsets.forEach(function (offset) {
    out += String(offset).padStart(10, "0") + " 00000 n \n";
  });
  out +=
    "trailer\n<< /Size " +
    (objects.length + 1) +
    " /Root 1 0 R >>\nstartxref\n" +
    xref +
    "\n%%EOF\n";
  return Buffer.from(out, "latin1");
}

/**
 * Builds an encrypted PDF with an empty page tree, whose standard security
 * handler (V 4, R 4) declares `cryptFilters` as its /CF dictionary.
 * @param {string} cryptFilters - Body of the /CF value, e.g. `<< /StdCF 5 >>`.
 * @returns {Buffer} The PDF.
 */
function encryptedPdfWithCryptFilters(cryptFilters) {
  var hash = "<" + "00".repeat(32) + ">";
  var source = pdfWith([
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [] /Count 0 >>",
    "<< /Filter /Standard /V 4 /R 4 /Length 128 /P -4 /O " +
      hash +
      " /U " +
      hash +
      " /CF " +
      cryptFilters +
      " /StmF /StdCF /StrF /StdCF >>",
  ]);
  // pdfWith's trailer has no /Encrypt, so add one along with an /ID.
  return Buffer.from(
    source
      .toString("latin1")
      .replace("/Root 1 0 R", "/Root 1 0 R /Encrypt 3 0 R /ID [<00> <00>]"),
    "latin1",
  );
}

/**
 * Builds a PDF with an empty page tree, indexed by an xref stream.
 * @param {number[]} widths - The xref stream's /W field widths.
 * @param {string} [catalogOffset] - Catalog offset to write instead of the
 * real one, as a BigInt literal.
 * @returns {Buffer} The PDF.
 */
function pdfWithXrefStream(widths, catalogOffset) {
  var catalog = "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";
  var pages = "2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\n";
  var offsets = [9, 9 + catalog.length, 9 + catalog.length + pages.length];
  /**
   * Encodes one xref stream entry.
   * @param {number} type - Entry type.
   * @param {number|string} offset - Offset, or a BigInt literal.
   * @returns {Buffer} The entry.
   */
  function entry(type, offset) {
    var field = Buffer.alloc(widths[0] + widths[1] + widths[2]);
    field[widths[0] - 1] = type;
    field.writeBigUInt64BE(BigInt(offset), widths[0] + widths[1] - 8);
    return field;
  }
  var data = Buffer.concat([
    entry(0, 0),
    entry(1, catalogOffset === undefined ? offsets[0] : catalogOffset),
    entry(1, offsets[1]),
    entry(1, offsets[2]),
  ]);
  return Buffer.concat([
    Buffer.from("%PDF-1.7\n" + catalog + pages, "latin1"),
    Buffer.from(
      "3 0 obj\n<< /Type /XRef /Size 4 /W [" +
        widths.join(" ") +
        "] /Root 1 0 R /Length " +
        data.length +
        " >>\nstream\n",
      "latin1",
    ),
    data,
    Buffer.from(
      "\nendstream\nendobj\nstartxref\n" + offsets[2] + "\n%%EOF\n",
      "latin1",
    ),
  ]);
}

module.exports = {
  materials: materials,
  fuzzInputs: fuzzInputs,
  material: material,
  writeFixture: writeFixture,
  fontWithBrokenGlyph: fontWithBrokenGlyph,
  fontWithOnlyGlyph: fontWithOnlyGlyph,
  cffIndex: cffIndex,
  cffDict: cffDict,
  cffTopDict: cffTopDict,
  pdfWith: pdfWith,
  encryptedPdfWithCryptFilters: encryptedPdfWithCryptFilters,
  pdfWithXrefStream: pdfWithXrefStream,
};
