// Seed inputs per kind: the shared test materials plus small synthetic PDFs
// that put each parser feature (filters, predictors, object and xref streams,
// incremental updates, encryption, text decoding) into a few hundred bytes,
// where most mutations land in structure instead of compressed payload, and
// inputs shaped like known denial-of-service patterns (decompression bombs,
// cycles, deep nesting, huge counts and dimensions), which byte mutation alone
// rarely produces.
import fs from "node:fs";
import path from "node:path";
import { crc32, deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";

var materials = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../native-with-source/tests/TestMaterials",
);
var encoder = new TextEncoder();

/**
 * Concatenates strings (UTF-8 encoded) and byte arrays.
 * @param {Array<string|Uint8Array>} parts - Parts to join.
 * @returns {Uint8Array} A new array.
 */
function concat(parts) {
  var chunks = parts.map((part) =>
    typeof part === "string" ? encoder.encode(part) : part,
  );
  var out = new Uint8Array(
    chunks.reduce((sum, chunk) => sum + chunk.length, 0),
  );
  var offset = 0;
  for (var chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/**
 * Serializes numbered objects with a classic xref table.
 * @param {Array<string|Uint8Array|Array<string|Uint8Array>>} objects - Object
 *   bodies, numbered from 1.
 * @param {string|((xrefOffset: number) => string)} [trailerExtra] -
 *   Additional trailer entries, or a function of the xref table's offset.
 * @returns {Uint8Array} The PDF.
 */
function classicPdf(objects, trailerExtra = "") {
  var parts = ["%PDF-1.7\n%\x7f\x7e\x7d\x7c\n"];
  var length = parts[0].length;
  var offsets = [];
  objects.forEach((body, index) => {
    offsets.push(length);
    var bytes = concat([
      `${index + 1} 0 obj\n`,
      ...(Array.isArray(body) ? body : [body]),
      "\nendobj\n",
    ]);
    parts.push(bytes);
    length += bytes.length;
  });
  var xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("")}`;
  parts.push(
    `${xref}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R ${typeof trailerExtra === "function" ? trailerExtra(length) : trailerExtra}>>\nstartxref\n${length}\n%%EOF\n`,
  );
  return concat(parts);
}

/**
 * Builds the parts of a stream object with a matching /Length.
 * @param {string} dictionary - Dictionary entries besides /Length.
 * @param {string|Uint8Array} data - Stream data; strings are UTF-8 encoded.
 * @returns {Array<string|Uint8Array>} The dictionary and stream keyword, the
 *   data, and the endstream keyword.
 */
function stream(dictionary, data) {
  var bytes = typeof data === "string" ? encoder.encode(data) : data;
  return [
    `<< ${dictionary} /Length ${bytes.length} >>\nstream\n`,
    bytes,
    "\nendstream",
  ];
}

/**
 * Encodes rows with the PNG Up predictor on every row: byte 2 then the
 * row deltas.
 * @param {Uint8Array[]} rows - Rows of `columns` bytes each.
 * @param {number} columns - Bytes per row.
 * @returns {Uint8Array} The predicted data.
 */
function pngPredicted(rows, columns) {
  var out = [];
  var previous = new Uint8Array(columns);
  for (var row of rows) {
    out.push(2);
    for (var i = 0; i < columns; ++i) out.push((row[i] - previous[i]) & 0xff);
    previous = row;
  }
  return new Uint8Array(out);
}

var content =
  "BT /F1 24 Tf 72 700 Td (Hello) Tj [(W) -120 (orld)] TJ 0 -30 Td <0102> Tj ET\n" +
  "q 1 0 0 1 50 50 cm 0.5 g 0 0 100 100 re f Q\n" +
  "/Im1 Do BI /W 2 /H 2 /BPC 8 /CS /G ID \x00\xff\xff\x00 EI\n";
var toUnicode =
  "/CIDInit /ProcSet findresource begin 12 dict begin begincmap\n" +
  "1 begincodespacerange <00> <FF> endcodespacerange\n" +
  "2 beginbfchar <01> <0041> <02> <D83DDE00> endbfchar\n" +
  "1 beginbfrange <20> <7E> <0020> endbfrange\n" +
  "endcmap CMapName currentdict /CMap defineresource pop end end\n";

/**
 * Builds the objects of a one-page PDF with a font, ToUnicode CMap and
 * image around a content stream.
 * @param {Array<string|Uint8Array>} contentStream - The content stream object,
 *   as returned by `stream()`.
 * @returns {Array<string|Array<string|Uint8Array>>} Object bodies, numbered
 *   from 1.
 */
function pageObjects(contentStream) {
  return [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /CropBox [10 10 600 780] /Rotate 90 /Resources << /Font << /F1 5 0 R >> /XObject << /Im1 7 0 R >> >> /Contents 4 0 R >>",
    contentStream,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding << /BaseEncoding /WinAnsiEncoding /Differences [1 /A /B 65 /bullet] >> /ToUnicode 6 0 R >>",
    stream("", toUnicode),
    stream(
      "/Type /XObject /Subtype /Image /Width 2 /Height 2 /BitsPerComponent 8 /ColorSpace /DeviceGray /Filter /FlateDecode",
      deflateSync(new Uint8Array([0, 255, 255, 0])),
    ),
  ];
}

/**
 * Builds the synthetic PDF seeds.
 * @returns {Array<{name: string, bytes: Uint8Array}>} Seeds.
 */
function syntheticPdfs() {
  var seeds = [];
  /**
   * Adds a seed.
   * @param {string} name - Seed name.
   * @param {Uint8Array} bytes - Seed bytes.
   * @returns {number} The new number of seeds.
   */
  var add = (name, bytes) => seeds.push({ name, bytes });

  add("plain", classicPdf(pageObjects(stream("", content))));
  add(
    "flate",
    classicPdf(
      pageObjects(
        stream("/Filter /FlateDecode", deflateSync(encoder.encode(content))),
      ),
    ),
  );
  add(
    "ascii-hex",
    classicPdf(
      pageObjects(
        stream(
          "/Filter /ASCIIHexDecode",
          Buffer.from(content).toString("hex") + ">",
        ),
      ),
    ),
  );
  add(
    "chained-filters",
    classicPdf(
      pageObjects(
        stream(
          "/Filter [/ASCIIHexDecode /FlateDecode]",
          Buffer.from(deflateSync(encoder.encode(content))).toString("hex") +
            ">",
        ),
      ),
    ),
  );
  // RunLength: a literal run of the content (length byte n-1 then n bytes).
  var runs = [];
  for (var i = 0; i < content.length; i += 128) {
    var chunk = content.slice(i, i + 128);
    runs.push(String.fromCharCode(chunk.length - 1) + chunk);
  }
  runs.push("\x80");
  add(
    "run-length",
    classicPdf(
      pageObjects(
        stream(
          "/Filter /RunLengthDecode",
          Buffer.from(runs.join(""), "latin1"),
        ),
      ),
    ),
  );
  add(
    "ascii85",
    classicPdf(
      pageObjects(stream("/Filter /ASCII85Decode", '87cURD]i,"Ebo80~>')),
    ),
  );
  add(
    "lzw",
    classicPdf(
      pageObjects(
        stream(
          "/Filter /LZWDecode /DecodeParms << /EarlyChange 0 >>",
          new Uint8Array([
            0x80, 0x0b, 0x60, 0x50, 0x22, 0x0c, 0x0c, 0x85, 0x01,
          ]),
        ),
      ),
    ),
  );

  // Object stream holding the catalog and pages, found through an xref stream
  // with a PNG predictor.
  var objStmBody =
    "<< /Type /Catalog /Pages 2 0 R >> << /Type /Pages /Kids [3 0 R] /Count 1 >>";
  var objStmHeader = "1 0 2 34 ";
  var header = "%PDF-1.7\n";
  var objects = [];
  var offsets = {};
  var position = header.length;
  /**
   * Appends an object and records its offset.
   * @param {number} id - Object number.
   * @param {Array<string|Uint8Array>} parts - Object body parts.
   */
  function push(id, parts) {
    var bytes = concat([`${id} 0 obj\n`, ...parts, "\nendobj\n"]);
    offsets[id] = position;
    position += bytes.length;
    objects.push(bytes);
  }
  push(3, [
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R >>",
  ]);
  push(4, stream("", "0 0 10 10 re f"));
  push(
    5,
    stream(
      `/Type /ObjStm /N 2 /First ${objStmHeader.length}`,
      objStmHeader + objStmBody,
    ),
  );
  var xrefId = 6;
  /**
   * Encodes one xref stream row for `/W [1 2 1]`.
   * @param {number} type - Entry type.
   * @param {number} field2 - Second field, two bytes.
   * @param {number} field3 - Third field, one byte.
   * @returns {Uint8Array} The row.
   */
  var entry = (type, field2, field3) =>
    new Uint8Array([type, (field2 >> 8) & 0xff, field2 & 0xff, field3]);
  var rows = [
    entry(0, 0, 255),
    entry(2, 5, 0),
    entry(2, 5, 1),
    entry(1, offsets[3], 0),
    entry(1, offsets[4], 0),
    entry(1, offsets[5], 0),
    entry(1, position, 0),
  ];
  var xrefData = deflateSync(pngPredicted(rows, 4));
  objects.push(
    concat([
      `${xrefId} 0 obj\n`,
      ...stream(
        `/Type /XRef /Size 7 /W [1 2 1] /Root 1 0 R /Filter /FlateDecode /DecodeParms << /Predictor 12 /Columns 4 >>`,
        xrefData,
      ),
      "\nendobj\n",
    ]),
  );
  add(
    "object-stream",
    concat([header, ...objects, `startxref\n${position}\n%%EOF\n`]),
  );

  // Incremental update: a second revision replaces the page and chains /Prev.
  var base = classicPdf(pageObjects(stream("", content)));
  var update = `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Contents 4 0 R /Annots [<< /Type /Annot /Subtype /Link /Rect [0 0 10 10] /A << /S /URI /URI (https://example.com) >> >>] >>\nendobj\n`;
  var previousXref = Number(
    new TextDecoder().decode(base).match(/startxref\n(\d+)/)[1],
  );
  var updateOffset = base.length;
  var xref2 = base.length + update.length;
  add(
    "incremental",
    concat([
      base,
      update,
      `xref\n3 1\n${String(updateOffset).padStart(10, "0")} 00000 n \ntrailer\n<< /Size 8 /Root 1 0 R /Prev ${previousXref} >>\nstartxref\n${xref2}\n%%EOF\n`,
    ]),
  );

  // Several pages in a nested page tree, with inherited attributes.
  add(
    "page-tree",
    classicPdf(
      [
        "<< /Type /Catalog /Pages 2 0 R /Outlines 7 0 R >>",
        "<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 3 /MediaBox [0 0 100 100] /Resources << >> >>",
        "<< /Type /Pages /Parent 2 0 R /Kids [5 0 R 6 0 R] /Count 2 /Rotate 180 >>",
        "<< /Type /Page /Parent 2 0 R /Contents [8 0 R 8 0 R] >>",
        "<< /Type /Page /Parent 3 0 R /Contents 8 0 R /UserUnit 2 >>",
        "<< /Type /Page /Parent 3 0 R /MediaBox [0 0 50 50] /TrimBox [1 1 49 49] /BleedBox [0 0 50 50] /ArtBox [2 2 48 48] >>",
        "<< /Type /Outlines /Count 0 >>",
        stream("", "0 0 1 rg 10 10 m 90 90 l S"),
      ],
      "/Info << /Title (Fuzz) /Author <FEFF00410042> /CreationDate (D:20240101000000Z) >> /ID [<00> <01>]",
    ),
  );
  return seeds;
}

/**
 * Builds PDFs shaped like denial-of-service patterns. Decoded sizes stay a
 * little past the library's ceilings (64 MiB of content, 32 MiB per token),
 * so the seeds cross them without making every run slow.
 * @returns {Array<{name: string, bytes: Uint8Array}>} Seeds.
 */
function denialOfServicePdfs() {
  var seeds = [];
  /**
   * Adds a seed, with its name prefixed by `dos-`.
   * @param {string} name - Seed name.
   * @param {Uint8Array} bytes - Seed bytes.
   * @returns {number} The new number of seeds.
   */
  var add = (name, bytes) => seeds.push({ name: `dos-${name}`, bytes });
  /**
   * Builds a one-page PDF whose content stream is `data`, Flate-compressed.
   * @param {Uint8Array} data - Decoded content.
   * @returns {Uint8Array} The PDF.
   */
  var bomb = (data) =>
    classicPdf(
      pageObjects(
        stream("/Filter /FlateDecode", deflateSync(data, { level: 9 })),
      ),
    );
  add("whitespace-bomb", bomb(Buffer.alloc(80 << 20, 0x20)));
  add(
    "string-bomb",
    bomb(Buffer.concat([Buffer.from("BT ("), Buffer.alloc(40 << 20, 0x61)])),
  );
  add("operator-bomb", bomb(Buffer.from("q Q ".repeat(4 << 20))));
  add(
    "inline-image-bomb",
    bomb(
      Buffer.concat([
        Buffer.from("BI /W 1 /H 1 /BPC 8 /CS /G ID "),
        Buffer.alloc(80 << 20, 0),
      ]),
    ),
  );
  add("nested-array-content", bomb(Buffer.alloc(4 << 20, 0x5b)));
  /**
   * Builds the objects of a one-page PDF with a trivial content stream.
   * @returns {Array<string|Array<string|Uint8Array>>} Object bodies.
   */
  var plain = () => pageObjects(stream("", "0 0 1 1 re f"));
  add(
    "deep-array",
    classicPdf([...plain(), "[".repeat(100000) + "]".repeat(100000)]),
  );
  add(
    "deep-dictionary",
    classicPdf([...plain(), "<< /A ".repeat(50000) + ">> ".repeat(50000)]),
  );
  add(
    "kids-cycle",
    classicPdf([
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Pages /Parent 2 0 R /Kids [2 0 R 3 0 R] /Count 1 >>",
    ]),
  );
  add(
    "prev-cycle",
    classicPdf(plain(), (xref) => `/Prev ${xref} `),
  );
  add(
    "huge-count",
    classicPdf([
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 2000000000 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 1 1] >>",
    ]),
  );
  add(
    "many-kids",
    classicPdf([
      "<< /Type /Catalog /Pages 2 0 R >>",
      `<< /Type /Pages /Kids [${"3 0 R ".repeat(100000)}] /Count 100000 >>`,
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 1 1] >>",
    ]),
  );
  add(
    "form-recursion",
    classicPdf([
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 1 1] /Resources << /XObject << /F 5 0 R >> >> /Contents 4 0 R >>",
      stream("", "/F Do"),
      stream(
        "/Type /XObject /Subtype /Form /BBox [0 0 1 1] /Resources << /XObject << /F 5 0 R >> >>",
        "/F Do /F Do",
      ),
    ]),
  );
  var cmap = `1 begincodespacerange <0000> <FFFF> endcodespacerange 1 beginbfrange <0000> <FFFF> [${"<0041> ".repeat(65536)}] endbfrange`;
  add(
    "huge-tounicode",
    classicPdf([
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 1 1] /Resources << /Font << /T 5 0 R >> >> /Contents 4 0 R >>",
      stream(
        "/Filter /FlateDecode",
        deflateSync(`BT /T 1 Tf <${"0000".repeat(200000)}> Tj ET`),
      ),
      "<< /Type /Font /Subtype /Type0 /BaseFont /X /Encoding /Identity-H /ToUnicode 6 0 R /DescendantFonts [7 0 R] >>",
      stream("/Filter /FlateDecode", deflateSync(cmap)),
      `<< /Type /Font /Subtype /CIDFontType2 /BaseFont /X /CIDSystemInfo << /Registry (A) /Ordering (B) /Supplement 0 >> /W [0 [${"500 ".repeat(65536)}]] >>`,
    ]),
  );
  add(
    "predictor-columns",
    classicPdf(
      pageObjects(
        stream(
          "/Filter /FlateDecode /DecodeParms << /Predictor 12 /Columns 2147483647 /Colors 4 /BitsPerComponent 16 >>",
          deflateSync(Buffer.alloc(1001, 2)),
        ),
      ),
    ),
  );
  add(
    "object-stream-count",
    classicPdf([
      ...plain(),
      stream("/Type /ObjStm /N 1000000 /First 0", "1 0 ".repeat(100000)),
    ]),
  );
  return seeds;
}

/**
 * Builds images with huge dimensions, and a PNG decompression bomb.
 * @returns {Array<{name: string, bytes: Uint8Array}>} Seeds.
 */
function denialOfServiceImages() {
  /**
   * Builds a PNG chunk with its length and CRC.
   * @param {string} type - Chunk type.
   * @param {Buffer} data - Chunk data.
   * @returns {Buffer} The chunk.
   */
  var chunk = (type, data) => {
    var body = Buffer.concat([Buffer.from(type), data]);
    var length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    var crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  /**
   * Builds an 8-bit PNG with the given header and image data.
   * @param {number} width - Width in the header.
   * @param {number} height - Height in the header.
   * @param {number} colorType - PNG color type.
   * @param {Buffer} pixels - Filtered scanlines, compressed into one IDAT.
   * @returns {Buffer} The PNG.
   */
  var png = (width, height, colorType, pixels) => {
    var header = Buffer.alloc(13);
    header.writeUInt32BE(width, 0);
    header.writeUInt32BE(height, 4);
    header[8] = 8;
    header[9] = colorType;
    return Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk("IHDR", header),
      chunk("IDAT", deflateSync(pixels, { level: 9 })),
      chunk("IEND", Buffer.alloc(0)),
    ]);
  };
  /**
   * Builds a little-endian 8-bit RGB TIFF header and IFD without image data.
   * @param {number} width - Image width.
   * @param {number} height - Image height.
   * @returns {Buffer} The TIFF.
   */
  var tiff = (width, height) => {
    var entries = [
      [256, 4, width],
      [257, 4, height],
      [258, 3, 8],
      [259, 3, 1],
      [262, 3, 2],
      [273, 4, 8],
      [277, 3, 3],
      [278, 4, height],
      [279, 4, 16],
    ];
    var ifd = Buffer.alloc(2 + entries.length * 12 + 4);
    ifd.writeUInt16LE(entries.length, 0);
    entries.forEach(([tag, type, value], index) => {
      var at = 2 + index * 12;
      ifd.writeUInt16LE(tag, at);
      ifd.writeUInt16LE(type, at + 2);
      ifd.writeUInt32LE(1, at + 4);
      if (type === 4) ifd.writeUInt32LE(value, at + 8);
      else ifd.writeUInt16LE(value, at + 8);
    });
    var header = Buffer.alloc(24);
    header.write("II*\0", 0, "latin1");
    header.writeUInt32LE(24, 4);
    return Buffer.concat([header, ifd]);
  };
  var seeds = [
    ["png-huge", png(60000, 60000, 6, Buffer.alloc(1000))],
    ["png-wide", png(2 ** 30, 1, 6, Buffer.alloc(1000))],
    // 4096 x 4096 gray: 16 MiB of pixels from about 16 KB.
    ["png-bomb", png(4096, 4096, 0, Buffer.alloc(4097 * 4096))],
    ["tiff-huge", tiff(65535, 65535)],
    ["tiff-wide", tiff(2 ** 31 - 1, 1)],
  ];
  var jpeg = path.join(materials, "images/grayscale.jpg");
  if (fs.existsSync(jpeg)) {
    var bytes = Buffer.from(fs.readFileSync(jpeg));
    var frame = bytes.indexOf(Buffer.from([0xff, 0xc0]));
    if (frame >= 0) {
      bytes.writeUInt16BE(65500, frame + 5);
      bytes.writeUInt16BE(65500, frame + 7);
      seeds.push(["jpeg-huge", bytes]);
    }
  }
  return seeds.map(([name, data]) => ({
    name: `dos-${name}`,
    bytes: new Uint8Array(data),
  }));
}

/**
 * Reads the files of a directory as seeds, sorted by path.
 * @param {string} directory - Directory to read; missing ones give no seeds.
 * @param {number} maxBytes - Largest file size to include.
 * @param {(name: string) => boolean} filter - Selects files by name.
 * @returns {Array<{name: string, bytes: Uint8Array}>} Seeds, named by their
 *   path relative to TestMaterials.
 */
function readDirectory(directory, maxBytes, filter) {
  if (!fs.existsSync(directory)) return [];
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && filter(entry.name))
    .map((entry) => path.join(directory, entry.name))
    .filter((file) => fs.statSync(file).size <= maxBytes)
    .sort()
    .map((file) => ({
      name: path.relative(materials, file),
      bytes: new Uint8Array(fs.readFileSync(file)),
    }));
}

/**
 * Loads the seeds for one kind of input.
 * @param {"pdf"|"font"|"image"} kind - Input kind.
 * @param {object} [muhammara] - Wasm API, used to add uncompressed and
 *   encrypted rewrites of the PDF seeds.
 * @returns {Array<{name: string, bytes: Uint8Array}>} Seeds.
 */
export function loadSeeds(kind, muhammara) {
  if (kind === "pdf") {
    var pdfs = [
      ...syntheticPdfs(),
      ...denialOfServicePdfs(),
      ...readDirectory(materials, 160 << 10, (name) => /\.pdf$/i.test(name)),
      ...readDirectory(path.join(materials, "recipe"), 64 << 10, (name) =>
        /\.pdf$/i.test(name),
      ),
    ];
    if (!muhammara) return pdfs;
    var rewrites = [];
    // Uncompressed copies of the bombs would be the bombs' decoded size.
    for (var seed of pdfs
      .filter((entry) => !entry.name.startsWith("dos-"))
      .slice(0, 24)) {
      try {
        rewrites.push({
          name: `${seed.name}#uncompressed`,
          bytes: muhammara.recrypt(seed.bytes, { compress: false }),
        });
      } catch {
        // Seeds the library rejects are still useful as they are.
      }
    }
    for (var version of [muhammara.ePDFVersion13, muhammara.ePDFVersion14]) {
      try {
        rewrites.push({
          name: `plain#encrypted-${version}`,
          bytes: muhammara.recrypt(pdfs[0].bytes, {
            userPassword: "user",
            ownerPassword: "owner",
            userProtectionFlag: 4,
            compress: false,
            version,
          }),
        });
      } catch {
        // Encryption may be unavailable in a build; the plain seeds remain.
      }
    }
    return [...pdfs, ...rewrites];
  }
  if (kind === "font") {
    return readDirectory(path.join(materials, "fonts"), 1 << 20, () => true);
  }
  if (kind === "image") {
    return [
      ...readDirectory(path.join(materials, "images"), 64 << 10, (name) =>
        /\.jpe?g$/i.test(name),
      ),
      ...readDirectory(
        path.join(materials, "images/png"),
        64 << 10,
        () => true,
      ),
      ...readDirectory(path.join(materials, "images/tiff"), 40 << 10, (name) =>
        /\.tiff?$/i.test(name),
      ),
      ...denialOfServiceImages(),
    ];
  }
  throw new Error(`unknown seed kind ${kind}`);
}
