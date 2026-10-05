"use strict";

// Fuzz targets for the native addon. Each target takes one mutated input and
// drives it through the public API. A target may throw: a JS exception is a
// clean rejection. Only a process crash (signal, sanitizer report, abort) or a
// hang counts as a finding.

var fs = require("fs");
var os = require("os");
var path = require("path");
var muhammara = require("..");

var materials = path.join(__dirname, "..", "tests", "TestMaterials");
var scratch = fs.mkdtempSync(path.join(os.tmpdir(), "muhammara-fuzz-"));

var limits = {
  maxElements: 2000,
  maxOperands: 64,
  maxTextBytes: 65536,
  maxParsedObjects: 20000,
};

/**
 * Calls `fn` and swallows the JS errors it throws, since a clean rejection is
 * not a finding. Non-Error throws are rethrown.
 *
 * @param {Function} fn - The function to call.
 * @returns {*} What `fn` returned, or undefined when it threw an Error.
 */
function attempt(fn) {
  try {
    return fn();
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    return undefined;
  }
}

/**
 * Writes an input to this process's scratch file, for APIs that take a path.
 *
 * @param {Buffer} data - The input bytes.
 * @param {string} extension - The file extension, including the dot.
 * @returns {string} The path of the written file.
 */
function inputFile(data, extension) {
  var file = path.join(scratch, process.pid + extension);
  fs.writeFileSync(file, data);
  return file;
}

/**
 * Drains a read stream in 4 KiB chunks, discarding the bytes.
 *
 * @param {object} stream - A muhammara read stream with `notEnded()` and
 *   `read()`.
 * @param {number} maxBytes - How many bytes to read at most.
 */
function readStream(stream, maxBytes) {
  var total = 0;
  while (stream.notEnded() && total < maxBytes) {
    var chunk = stream.read(4096);
    if (!chunk || chunk.length === 0) break;
    total += chunk.length;
  }
}

/**
 * Walks an object graph from `object`, resolving references through the
 * reader, with a budget so cyclic or huge documents stay bounded.
 *
 * @param {object} reader - The PDF reader.
 * @param {object} object - The PDF object to start from; may be undefined.
 * @param {{left: number, deadline: number}} budget - Objects left to visit and
 *   the `Date.now()` deadline; decremented as the walk goes.
 * @param {Set<number>} seen - Object IDs already resolved.
 */
function walk(reader, object, budget, seen) {
  if (budget.left-- <= 0 || Date.now() > budget.deadline || !object) return;
  var type = object.getType();
  if (type === muhammara.ePDFObjectIndirectObjectReference) {
    var id = object.getObjectID();
    if (seen.has(id)) return;
    seen.add(id);
    walk(
      reader,
      attempt(function () {
        return reader.parseNewObject(id);
      }),
      budget,
      seen,
    );
  } else if (type === muhammara.ePDFObjectArray) {
    var items = object.toJSArray();
    for (var i = 0; i < items.length && budget.left > 0; ++i)
      walk(reader, items[i], budget, seen);
  } else if (type === muhammara.ePDFObjectDictionary) {
    var entries = object.toJSObject();
    for (var key in entries) {
      if (budget.left <= 0) break;
      walk(reader, entries[key], budget, seen);
    }
  } else if (type === muhammara.ePDFObjectStream) {
    walk(reader, object.getDictionary(), budget, seen);
    attempt(function () {
      readStream(reader.startReadingFromStream(object), 1 << 20);
    });
    attempt(function () {
      var parser = reader.startReadingObjectsFromStream(object);
      // Small streams can inflate to huge ones, so stop at the deadline too.
      for (
        var n = 0;
        n < 2000 && Date.now() < budget.deadline && parser.parseNewObject();
        ++n
      );
    });
  } else {
    attempt(function () {
      return object.toString();
    });
    attempt(function () {
      return object.value;
    });
  }
}

/**
 * Parses a PDF: walks its objects, then reads the boxes, text and content
 * items of its first pages.
 *
 * @param {Buffer} data - The PDF bytes.
 */
function pdfRead(data) {
  var reader = muhammara.createReader(new muhammara.PDFRStreamForBuffer(data), {
    password: "user",
  });
  try {
    var budget = { left: 5000, deadline: Date.now() + 3000 };
    var seen = new Set();
    walk(reader, reader.getTrailer(), budget, seen);
    var objects = Math.min(reader.getObjectsCount(), 2000);
    for (var id = 0; id < objects && budget.left > 0; ++id) {
      attempt(function () {
        reader.getXrefEntry(id);
      });
      if (!seen.has(id))
        attempt(function () {
          seen.add(id);
          walk(reader, reader.parseNewObject(id), budget, seen);
        });
    }
    var pages = Math.min(reader.getPagesCount(), 20);
    for (var i = 0; i < pages; ++i) {
      attempt(function () {
        reader.parsePageDictionary(i);
      });
      attempt(function () {
        var page = reader.parsePage(i);
        page.getMediaBox();
        page.getCropBox();
        page.getTrimBox();
        page.getBleedBox();
        page.getArtBox();
        page.getRotate();
      });
      attempt(function () {
        reader.extractPageText(i, limits);
      });
      attempt(function () {
        reader.extractPageText(i, limits, { decodeText: false });
      });
      attempt(function () {
        reader.extractPageContentItems(i, limits);
      });
    }
  } finally {
    reader.end();
  }
}

/**
 * Opens a PDF for modification, draws on its first page and copies that page.
 *
 * @param {Buffer} data - The PDF bytes.
 */
function pdfModify(data) {
  var writer = muhammara.createWriterToModify(
    new muhammara.PDFRStreamForBuffer(data),
    new muhammara.PDFWStreamForBuffer(),
    { userPassword: "user" },
  );
  attempt(function () {
    var modifier = new muhammara.PDFPageModifier(writer, 0, true);
    modifier.startContext().getContext().q().re(10, 10, 50, 50).f().Q();
    modifier.endContext().writePage();
  });
  attempt(function () {
    var copying = writer.createPDFCopyingContextForModifiedFile();
    copying.appendPDFPageFromPDF(0);
  });
  writer.end();
}

/**
 * Copies pages of a PDF into a new document: appended, as a form XObject and
 * merged into a page.
 *
 * @param {Buffer} data - The PDF bytes.
 */
function pdfCopy(data) {
  var writer = muhammara.createWriter(new muhammara.PDFWStreamForBuffer());
  try {
    attempt(function () {
      writer.appendPDFPagesFromPDF(new muhammara.PDFRStreamForBuffer(data), {
        type: muhammara.eRangeTypeSpecific,
        specificRanges: [[0, 4]],
      });
    });
    attempt(function () {
      var copying = writer.createPDFCopyingContext(
        new muhammara.PDFRStreamForBuffer(data),
      );
      attempt(function () {
        copying.createFormXObjectFromPDFPage(0, muhammara.ePDFPageBoxMediaBox);
      });
      attempt(function () {
        var page = writer.createPage(0, 0, 595, 842);
        copying.mergePDFPageToPage(page, 0);
        writer.writePage(page);
      });
      copying.end();
    });
  } finally {
    writer.end();
  }
}

/**
 * Decrypts a PDF with the password `user` and encrypts it again.
 *
 * @param {Buffer} data - The PDF bytes.
 */
function pdfRecrypt(data) {
  muhammara.recrypt(
    new muhammara.PDFRStreamForBuffer(data),
    new muhammara.PDFWStreamForBuffer(),
    {
      password: "user",
      userPassword: "u",
      ownerPassword: "o",
      userProtectionFlag: 4,
    },
  );
}

// Each image type's own XObject entry points, besides drawImage.
var imageCreators = {
  /**
   * Reads JPEG information and creates image and form XObjects from it.
   *
   * @param {object} writer - The PDF writer.
   * @param {string} file - The JPEG input path.
   */
  ".jpg": function (writer, file) {
    attempt(function () {
      writer.retrieveJPGImageInformation(file);
    });
    attempt(function () {
      writer.createImageXObjectFromJPG(file);
    });
    attempt(function () {
      writer.createFormXObjectFromJPG(new muhammara.PDFRStreamForFile(file));
    });
  },
  /**
   * Creates a form XObject from a PNG.
   *
   * @param {object} writer - The PDF writer.
   * @param {string} file - The PNG input path.
   */
  ".png": function (writer, file) {
    attempt(function () {
      writer.createFormXObjectFromPNG(new muhammara.PDFRStreamForFile(file));
    });
  },
  /**
   * Creates a form XObject from the second page of a TIFF, with bitonal and
   * grayscale treatments.
   *
   * @param {object} writer - The PDF writer.
   * @param {string} file - The TIFF input path.
   */
  ".tif": function (writer, file) {
    attempt(function () {
      writer.createFormXObjectFromTIFF(file, {
        pageIndex: 1,
        bwTreatment: { asImageMask: true, oneColor: [255, 0, 0] },
        grayscaleTreatment: {
          asColorMap: true,
          oneColor: [0, 0, 255],
          zeroColor: [255, 255, 0],
        },
      });
    });
  },
};

/**
 * Creates an image target for one image type.
 *
 * @param {string} extension - The image file extension, a key of
 *   `imageCreators`.
 * @returns {Function} The target's run function.
 */
function image(extension) {
  /**
   * Writes the input to a file, inspects it and draws it on a page.
   *
   * @param {Buffer} data - The image bytes.
   */
  return function (data) {
    var file = inputFile(data, extension);
    var writer = muhammara.createWriter(new muhammara.PDFWStreamForBuffer());
    try {
      imageCreators[extension](writer, file);
      attempt(function () {
        writer.getImageType(file);
      });
      attempt(function () {
        writer.getImagePagesCount(file);
      });
      attempt(function () {
        writer.getImageDimensions(file);
      });
      var page = writer.createPage(0, 0, 595, 842);
      var context = writer.startPageContentContext(page);
      attempt(function () {
        context.drawImage(10, 10, file, {
          transformation: { width: 100, height: 100, proportional: true },
        });
      });
      attempt(function () {
        writer.writePage(page);
      });
    } finally {
      attempt(function () {
        writer.end();
      });
    }
  };
}

/**
 * Creates a font target for one font file type.
 *
 * @param {string} extension - The font file extension; `.pfb` is loaded with
 *   the PFM metrics file.
 * @returns {Function} The target's run function.
 */
function font(extension) {
  /**
   * Writes the input to a file, loads it as a font, measures text and writes
   * text with it on a page.
   *
   * @param {Buffer} data - The font bytes.
   */
  return function (data) {
    var file = inputFile(data, extension);
    var writer = muhammara.createWriter(new muhammara.PDFWStreamForBuffer());
    try {
      var used =
        extension === ".pfb"
          ? writer.getFontForFile(file, metrics)
          : writer.getFontForFile(file, 0);
      attempt(function () {
        used.calculateTextDimensions("Hello, fuzz! é中", 12);
      });
      attempt(function () {
        used.getFontMetrics(12);
      });
      var page = writer.createPage(0, 0, 595, 842);
      var context = writer.startPageContentContext(page);
      attempt(function () {
        context.writeText("Hello, fuzz! é中", 10, 400, {
          font: used,
          size: 14,
        });
      });
      attempt(function () {
        context.BT().Tf(used, 12).Tj([1, 2, 3, 65535]).ET();
      });
      attempt(function () {
        writer.writePage(page);
      });
    } finally {
      attempt(function () {
        writer.end();
      });
    }
  };
}

/**
 * Rebuilds the xref of a mutated PDF from its "N G obj" markers, so that
 * mutations inside objects reach the parsers behind the xref instead of
 * breaking the xref itself.
 *
 * @param {Buffer} data - The PDF bytes.
 * @returns {Buffer} The PDF with its xref, trailer and startxref replaced.
 */
function repairXref(data) {
  var text = data.toString("latin1");
  var end = text.lastIndexOf("\nxref");
  if (end < 0) end = text.lastIndexOf("startxref");
  if (end < 0) end = text.length;
  var body = text.slice(0, end);
  var offsets = [];
  var re = /(?:^|[\r\n])(\d{1,6})\s+(\d{1,5})\s+obj\b/g;
  var match;
  while ((match = re.exec(body))) {
    var id = Number(match[1]);
    // Huge sparse xrefs only slow every case down; parsing them is linear.
    if (id < 20000) offsets[id] = match.index + match[0].search(/\d/);
  }
  var root = /\/Root\s+(\d+\s+\d+\s+R)/.exec(text);
  var catalog = /(\d+)\s+0\s+obj\s*<<[^>]*\/Type\s*\/Catalog/.exec(body);
  var rootRef = root ? root[1] : catalog ? catalog[1] + " 0 R" : "1 0 R";
  var xref = "xref\n0 " + (offsets.length || 1) + "\n0000000000 65535 f \n";
  for (var i = 1; i < offsets.length; ++i)
    xref +=
      offsets[i] === undefined
        ? "0000000000 65535 f \n"
        : String(offsets[i]).padStart(10, "0") + " 00000 n \n";
  return Buffer.concat([
    data.subarray(0, end),
    Buffer.from(
      "\n" +
        xref +
        "trailer\n<< /Size " +
        (offsets.length || 1) +
        " /Root " +
        rootRef +
        " >>\nstartxref\n" +
        (end + 1) +
        "\n%%EOF\n",
      "latin1",
    ),
  ]);
}

/**
 * Wraps a PDF target so it runs on the input with its xref rebuilt.
 *
 * @param {Function} run - The PDF target's run function.
 * @returns {Function} The wrapped run function.
 */
function repaired(run) {
  /**
   * Runs the wrapped target on the input after `repairXref()`.
   *
   * @param {Buffer} data - The PDF bytes.
   */
  return function (data) {
    run(repairXref(data));
  };
}

/**
 * Builds a one-page PDF around `content`, with simple, TrueType-like and Type0
 * fonts, a form XObject and an image, so content operators find resources to
 * use.
 *
 * @param {Buffer} content - The page content stream.
 * @param {Buffer} [toUnicode] - The ToUnicode CMap of the TrueType and Type0
 *   fonts; defaults to `defaultCMap`.
 * @returns {Buffer} The PDF bytes.
 */
function pageWith(content, toUnicode) {
  var cmap = toUnicode || defaultCMap;
  var objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R" +
      " /Resources << /Font << /F1 5 0 R /F2 6 0 R /F3 7 0 R >>" +
      " /XObject << /X1 9 0 R /Im1 10 0 R >> /ExtGState << /G1 << /CA 0.5 >> >> >> >>",
    null, // content
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding << /Differences [65 /B /C /uni4E2D] >> >>",
    "<< /Type /Font /Subtype /TrueType /BaseFont /Arial /FirstChar 32 /LastChar 40 /Widths [1 2 3 4 5 6 7 8 9] /ToUnicode 8 0 R >>",
    "<< /Type /Font /Subtype /Type0 /BaseFont /X /Encoding /Identity-H /ToUnicode 8 0 R" +
      " /DescendantFonts [<< /Type /Font /Subtype /CIDFontType2 /BaseFont /X /W [1 [500 600] 10 20 300] /DW 1000" +
      " /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> >>] >>",
    null, // ToUnicode
    "<< /Type /XObject /Subtype /Form /BBox [0 0 100 100] /Resources << /Font << /F1 5 0 R >> >> /Length 30 >>\nstream\nBT /F1 9 Tf (in a form) Tj ET\n\nendstream",
    "<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceGray /BitsPerComponent 8 /Length 1 >>\nstream\n\u0080\nendstream",
  ];
  var parts = [Buffer.from("%PDF-1.7\n", "latin1")];
  var offsets = [];
  var length = parts[0].length;
  objects.forEach(function (body, index) {
    var stream = index === 3 ? content : index === 7 ? cmap : null;
    var chunk = stream
      ? Buffer.concat([
          Buffer.from(
            index + 1 + " 0 obj\n<< /Length " + stream.length + " >>\nstream\n",
            "latin1",
          ),
          stream,
          Buffer.from("\nendstream\nendobj\n", "latin1"),
        ])
      : Buffer.from(index + 1 + " 0 obj\n" + body + "\nendobj\n", "latin1");
    offsets.push(length);
    parts.push(chunk);
    length += chunk.length;
  });
  var xref = "xref\n0 " + (objects.length + 1) + "\n0000000000 65535 f \n";
  offsets.forEach(function (offset) {
    xref += String(offset).padStart(10, "0") + " 00000 n \n";
  });
  parts.push(
    Buffer.from(
      xref +
        "trailer\n<< /Size " +
        (objects.length + 1) +
        " /Root 1 0 R >>\nstartxref\n" +
        length +
        "\n%%EOF\n",
      "latin1",
    ),
  );
  return Buffer.concat(parts);
}

var defaultCMap = Buffer.from(
  "/CIDInit /ProcSet findresource begin 12 dict begin begincmap\n" +
    "/CMapName /Fuzz def /CMapType 2 def\n" +
    "1 begincodespacerange <0000> <FFFF> endcodespacerange\n" +
    "2 beginbfchar <0001> <0041> <0002> <D83DDE00> endbfchar\n" +
    "2 beginbfrange <0010> <0020> <0061> <0030> <0032> [<0062> <00630064> <4E2D>] endbfrange\n" +
    "1 begincidrange <0000> <00FF> 0 endcidrange\n" +
    "endcmap CMapName currentdict /CMap defineresource pop end end\n",
  "latin1",
);

var defaultContent = Buffer.from(
  "q 1 0 0 1 10 10 cm BT /F1 12 Tf 72 700 Td (Hello \\(fuzz\\) \\101) Tj\n" +
    "[(A) -120 (B) 50 (C)] TJ 0 -14 TD (next) ' 2 1 (q) \" ET\n" +
    "BT /F2 10 Tf 3 Tr 1 0 0 1 72 600 Tm <2021222324> Tj 1.5 Tz 2 Tc 3 Tw 4 TL T* ET\n" +
    "BT /F3 14 Tf 72 500 Td <000100020010001F0031> Tj [<0001> -500 <0002>] TJ ET\n" +
    "/G1 gs /X1 Do /Im1 Do 0 0 m 100 100 l S 10 10 50 50 re f* Q\n" +
    "BI /W 1 /H 1 /CS /G /BPC 8 ID \u0080 EI\n" +
    "/OC /MC0 BDC (marked) Tj EMC\n",
  "latin1",
);

/**
 * Collects decoded streams, such as content streams and ToUnicode CMaps, from
 * the PDF seeds.
 *
 * @param {Buffer[]} pdfs - The PDF seeds.
 * @param {Function} pick - Called with the reader and each parsed object;
 *   returns the stream object to collect, or a falsy value to skip it.
 * @returns {Buffer[]} Up to 200 decoded streams of at most about 64 KiB each.
 */
function streamsFrom(pdfs, pick) {
  var found = [];
  pdfs.forEach(function (data) {
    attempt(function () {
      var reader = muhammara.createReader(
        new muhammara.PDFRStreamForBuffer(data),
      );
      try {
        var count = Math.min(reader.getObjectsCount(), 500);
        for (var id = 1; id < count && found.length < 200; ++id)
          attempt(function () {
            var object = reader.parseNewObject(id);
            var stream = pick(reader, object);
            if (!stream) return;
            var bytes = [];
            var input = reader.startReadingFromStream(stream);
            var total = 0;
            while (input.notEnded() && total < 65536) {
              var chunk = input.read(4096);
              if (!chunk || !chunk.length) break;
              bytes.push(Buffer.from(chunk));
              total += chunk.length;
            }
            if (total) found.push(Buffer.concat(bytes));
          });
      } finally {
        reader.end();
      }
    });
  });
  return found;
}

/**
 * Builds the content target's seeds: the default content plus the first
 * content stream of each page in the PDF seeds.
 *
 * @param {Buffer[]} pdfs - The PDF seeds.
 * @returns {Buffer[]} The content stream seeds.
 */
function contentSeeds(pdfs) {
  return [defaultContent].concat(
    streamsFrom(pdfs, function (reader, object) {
      if (!object || object.getType() !== muhammara.ePDFObjectDictionary)
        return;
      var dictionary = object.toJSObject();
      if (
        !dictionary.Type ||
        dictionary.Type.value !== "Page" ||
        !dictionary.Contents
      )
        return;
      var contents = reader.queryDictionaryObject(object, "Contents");
      if (contents.getType() === muhammara.ePDFObjectArray)
        contents = reader.queryArrayObject(contents, 0);
      return contents.getType() === muhammara.ePDFObjectStream
        ? contents
        : null;
    }),
  );
}

/**
 * Builds the cmap target's seeds: the default CMap plus the ToUnicode streams
 * in the PDF seeds.
 *
 * @param {Buffer[]} pdfs - The PDF seeds.
 * @returns {Buffer[]} The CMap seeds.
 */
function cmapSeeds(pdfs) {
  return [defaultCMap].concat(
    streamsFrom(pdfs, function (reader, object) {
      if (!object || object.getType() !== muhammara.ePDFObjectDictionary)
        return;
      if (!object.exists("ToUnicode")) return;
      var cmap = reader.queryDictionaryObject(object, "ToUnicode");
      return cmap.getType() === muhammara.ePDFObjectStream ? cmap : null;
    }),
  );
}

/**
 * Extracts the text and content items of a PDF's first page and parses its
 * content stream.
 *
 * @param {Buffer} data - The PDF bytes.
 */
function readPage(data) {
  var reader = muhammara.createReader(new muhammara.PDFRStreamForBuffer(data));
  try {
    attempt(function () {
      reader.extractPageText(0, limits);
    });
    attempt(function () {
      reader.extractPageText(0, limits, { decodeText: false });
    });
    attempt(function () {
      reader.extractPageContentItems(0, limits);
    });
    attempt(function () {
      var parser = reader.startReadingObjectsFromStream(
        reader.queryDictionaryObject(reader.parsePageDictionary(0), "Contents"),
      );
      for (var n = 0; n < 5000 && parser.parseNewObject(); ++n);
    });
  } finally {
    reader.end();
  }
}

/**
 * Wraps a content stream in a page, reads the page, then copies it, which
 * rewrites its content and resources.
 *
 * @param {Buffer} data - The content stream bytes.
 */
function content(data) {
  var pdf = pageWith(data);
  readPage(pdf);
  pdfCopy(pdf);
}

/**
 * Reads a page whose fonts use the input as their ToUnicode CMap.
 *
 * @param {Buffer} data - The CMap bytes.
 */
function cmap(data) {
  readPage(pageWith(defaultContent, data));
}

/**
 * Lists the seed files in a TestMaterials directory. Large seeds make every
 * case slow, so they are left out.
 *
 * @param {string} dir - The directory, relative to TestMaterials.
 * @param {RegExp} pattern - The file names to include.
 * @param {number} maxBytes - The largest file size to include.
 * @returns {string[]} The seed file paths.
 */
function seeds(dir, pattern, maxBytes) {
  var base = path.join(materials, dir);
  return fs
    .readdirSync(base)
    .filter(function (name) {
      return (
        pattern.test(name) &&
        fs.statSync(path.join(base, name)).size <= maxBytes
      );
    })
    .map(function (name) {
      return path.join(base, name);
    });
}

var metrics = path.join(materials, "fonts", "HLB_____.PFM");
var pdfSeeds = seeds(".", /\.pdf$/i, 256 * 1024);

module.exports = {
  "pdf-read": { run: pdfRead, seeds: pdfSeeds, pdf: true },
  "pdf-modify": { run: pdfModify, seeds: pdfSeeds, pdf: true },
  "pdf-copy": { run: pdfCopy, seeds: pdfSeeds, pdf: true },
  "pdf-recrypt": { run: pdfRecrypt, seeds: pdfSeeds, pdf: true },
  jpeg: { run: image(".jpg"), seeds: seeds("images", /\.jpe?g$/i, 1 << 20) },
  png: { run: image(".png"), seeds: seeds("images/png", /\.png$/i, 1 << 20) },
  tiff: {
    run: image(".tif"),
    seeds: seeds("images/tiff", /\.tiff?$/i, 1 << 20),
  },
  truetype: {
    run: font(".ttf"),
    seeds: seeds("fonts", /\.(ttf|ttc|dfont)$/i, 2 << 20),
  },
  opentype: { run: font(".otf"), seeds: seeds("fonts", /\.otf$/i, 4 << 20) },
  type1: { run: font(".pfb"), seeds: seeds("fonts", /\.pfb$/i, 1 << 20) },
  // The same PDF flows, with the xref rebuilt after mutation.
  "pdf-read-deep": { run: repaired(pdfRead), seeds: [], pdf: true },
  "pdf-modify-deep": { run: repaired(pdfModify), seeds: [], pdf: true },
  "pdf-copy-deep": { run: repaired(pdfCopy), seeds: [], pdf: true },
  content: { run: content, seeds: [], seedData: contentSeeds, text: true },
  cmap: { run: cmap, seeds: [], seedData: cmapSeeds, text: true },
};

/**
 * Removes the scratch directory with this process's input files.
 */
module.exports.cleanup = function () {
  fs.rmSync(scratch, { recursive: true, force: true });
};

// For checking the targets by hand.
module.exports.pageWith = pageWith;
module.exports.repairXref = repairXref;
