// Fuzz targets. Each one feeds a single input through a family of Wasm entry
// points and walks whatever comes back, so parser state that is only built
// lazily is reached as well. Thrown errors are the expected outcome for most
// inputs; the runner decides which errors are findings.
import { constants } from "../../lib/constants.js";

// Walk budgets keep one input from dominating a run. They bound the harness,
// not the library: anything the library does inside a single call is fuzzed
// with the library's own limits.
var maxPages = 8;
var maxObjects = 400;
var maxDepth = 12;
// Objects visited per document, across pages, the trailer and the xref.
var maxVisits = 3000;
var maxStreamBytes = 1 << 20;
var maxStreamTokens = 2000;
// Streams decoded per document. Objects are reached once per path that
// references them, and a few large streams would otherwise dominate the run.
var maxStreams = 16;
var streamsLeft = maxStreams;
var extractionLimits = {
  maxElements: 2000,
  maxOperands: 64,
  maxTextBytes: 1 << 16,
  maxParsedObjects: 20000,
};

/**
 * Rejections seen while running the current input, as coarse signatures. The
 * runner keeps inputs that produce a signature it has not seen, as a cheap
 * stand-in for coverage feedback.
 * @type {Set<string>}
 */
export var observations = new Set();

/**
 * Reduces an error message to a signature: numbers are dropped so that
 * offsets and ids in messages do not count as new behavior.
 * @param {unknown} error - Thrown value.
 * @returns {string} The signature.
 */
export function signature(error) {
  return String(error?.message ?? error)
    .replace(/\d+/g, "N")
    .slice(0, 160);
}

/**
 * The steps of the current input that cost the most, so a slow or
 * memory-hungry input names the API call responsible. A step's own cost
 * excludes the steps nested in it. The runner sets `memory` to a function
 * returning the instances' memory size and resets the rest per input.
 */
export var profile = {
  /**
   * Returns the instances' memory size; the runner replaces this stub.
   * @returns {number} Memory size in bytes.
   */
  memory: () => 0,
  // Harness time per input. Past it, remaining steps are skipped, so many
  // bounded calls adding up are not reported as a hang; a `timeout` then
  // means one call ran away.
  budget: 8000,
  deadline: Infinity,
  stack: [],
  slowest: { step: "", milliseconds: 0 },
  hungriest: { step: "", bytes: 0 },
  /**
   * Starts a new input: sets the deadline and clears the stack and the
   * slowest and hungriest steps.
   */
  reset() {
    this.deadline = performance.now() + this.budget;
    this.stack = [];
    this.slowest = { step: "", milliseconds: 0 };
    this.hungriest = { step: "", bytes: 0 };
  },
};

/**
 * Names a step by its source, e.g. `() => reader.extractPageText(index)`.
 * @param {Function} fn - Step.
 * @returns {string} The name.
 */
function stepName(fn) {
  return String(fn).replace(/\s+/g, " ").slice(0, 160);
}

/**
 * Runs `fn`, swallowing ordinary errors. Wasm traps and other findings are
 * rethrown by `rethrowFinding`, so they still end the input.
 * @param {() => unknown} fn - Step to run.
 * @returns {unknown} Its result, or undefined if it threw.
 */
function attempt(fn) {
  if (performance.now() > profile.deadline) {
    observations.add("over budget");
    return undefined;
  }
  var frame = {
    started: performance.now(),
    memory: profile.memory(),
    nestedTime: 0,
    nestedMemory: 0,
  };
  profile.stack.push(frame);
  try {
    return fn();
  } catch (error) {
    rethrowFinding(error);
    observations.add(signature(error));
    return undefined;
  } finally {
    profile.stack.pop();
    var time = performance.now() - frame.started;
    var memory = profile.memory() - frame.memory;
    var parent = profile.stack[profile.stack.length - 1];
    if (parent) {
      parent.nestedTime += time;
      parent.nestedMemory += memory;
    }
    if (time - frame.nestedTime > profile.slowest.milliseconds) {
      profile.slowest = {
        step: stepName(fn),
        milliseconds: time - frame.nestedTime,
      };
    }
    if (memory - frame.nestedMemory > profile.hungriest.bytes) {
      profile.hungriest = {
        step: stepName(fn),
        bytes: memory - frame.nestedMemory,
      };
    }
  }
}

/**
 * Whether an error is a finding rather than an API rejecting its input: a
 * Wasm trap or abort, an exception escaping the module, a stack overflow, or
 * a JavaScript bug in the glue.
 * @param {unknown} error - Thrown value.
 * @returns {string|null} The finding's kind, or null.
 */
export function classifyError(error) {
  if (error instanceof WebAssembly.RuntimeError) return "wasm-trap";
  // Sanitizer reports end the program with exit(1).
  if (error?.name === "ExitStatus") return "exit";
  // A C++ exception or longjmp that no frame caught leaves the module as a
  // bare number or Emscripten object. It skips every epilogue on the way, so
  // the Wasm stack pointer is never restored and later calls overflow.
  if (!(error instanceof Error)) return "escaped-exception";
  var message = String(error?.message ?? error);
  if (/^Aborted\(|\bAborted\b.*\bOOM\b|Cannot enlarge memory/.test(message)) {
    return "wasm-abort";
  }
  if (error instanceof RangeError && /call stack/i.test(message)) {
    return "stack-overflow";
  }
  if (
    (error instanceof TypeError || error instanceof ReferenceError) &&
    /Cannot read propert|Cannot set propert|is not a function|is not iterable|is not defined|of undefined|of null|Cannot convert undefined|Cannot destructure/.test(
      message,
    )
  ) {
    return "js-error";
  }
  return null;
}

/**
 * Rethrows an error that `classifyError` counts as a finding.
 * @param {unknown} error - Thrown value.
 */
function rethrowFinding(error) {
  if (classifyError(error)) throw error;
}

/**
 * Visits a parsed object and what it references, depth- and count-limited.
 * @param {object} reader - PDF reader.
 * @param {object} object - Parsed object.
 * @param {{count: number}} budget - Shared visit budget.
 * @param {number} depth - Current depth.
 */
function walkObject(reader, object, budget, depth) {
  if (!object || depth > maxDepth || --budget.count < 0) return;
  var type = attempt(() => object.getType());
  observations.add(`type ${type} at ${Math.min(depth, 4)}`);
  attempt(() => object.toString());
  attempt(() => object.value);
  switch (type) {
    case constants.ePDFObjectLiteralString:
    case constants.ePDFObjectHexString: {
      var string = attempt(() =>
        type === constants.ePDFObjectLiteralString
          ? object.toPDFLiteralString()
          : object.toPDFHexString(),
      );
      attempt(() => string?.toBytesArray());
      attempt(() => string?.toText());
      break;
    }
    case constants.ePDFObjectArray: {
      var array = attempt(() => object.toPDFArray());
      var length = attempt(() => array?.getLength()) ?? 0;
      for (var i = 0; i < Math.min(length, 64); ++i) {
        walkObject(
          reader,
          attempt(() => reader.queryArrayObject(array, i)),
          budget,
          depth + 1,
        );
      }
      break;
    }
    case constants.ePDFObjectDictionary: {
      var dictionary = attempt(() => object.toPDFDictionary());
      var entries = attempt(() => dictionary?.toJSObject()) ?? {};
      for (var key of Object.keys(entries).slice(0, 64)) {
        walkObject(
          reader,
          attempt(() => reader.queryDictionaryObject(dictionary, key)),
          budget,
          depth + 1,
        );
      }
      break;
    }
    case constants.ePDFObjectStream: {
      var stream = attempt(() => object.toPDFStream());
      if (!stream) break;
      walkObject(
        reader,
        attempt(() => stream.getDictionary()),
        budget,
        depth + 1,
      );
      readStream(reader, stream);
      break;
    }
    default:
      break;
  }
}

/**
 * Decodes a stream's bytes and tokenizes it as content.
 * @param {object} reader - PDF reader.
 * @param {object} stream - Stream object.
 */
function readStream(reader, stream) {
  if (--streamsLeft < 0) return;
  var decoded = 0;
  attempt(() => {
    var bytes = reader.startReadingFromStream(stream);
    var total = 0;
    while (total < maxStreamBytes && bytes.notEnded()) {
      var chunk = bytes.read(65536);
      if (!chunk?.length) break;
      total += chunk.length;
    }
    observations.add(`stream 2^${Math.ceil(Math.log2(total + 1))}`);
    decoded = total;
  });
  attempt(() => {
    var bytes = reader.startReadingFromStreamForPlainCopying(stream);
    bytes.read(4096);
  });
  // The object parser has no budget by design and takes time in proportion
  // to the decoded size, so a bomb would dominate the run. The extractors,
  // which are bounded, still read every stream in full.
  if (decoded >= maxStreamBytes) return;
  attempt(() => {
    var parser = reader.startReadingObjectsFromStream(stream);
    try {
      for (var i = 0; i < maxStreamTokens; ++i) {
        var token = parser.parseNewObject();
        if (!token) break;
        attempt(() => token.toString());
      }
    } finally {
      parser.end();
    }
  });
}

/**
 * Reads everything a reader exposes about a document.
 * @param {object} muhammara - Wasm API.
 * @param {Uint8Array} bytes - PDF bytes.
 * @param {object} [options] - Reader options.
 */
function inspect(muhammara, bytes, options) {
  var reader = muhammara.createReader(bytes, options);
  streamsLeft = maxStreams;
  try {
    attempt(() => reader.getPDFLevel());
    attempt(() => reader.isEncrypted());
    attempt(() => reader.getXrefPosition());
    attempt(() => reader.getObjectsCount());
    var budget = { count: maxVisits };
    walkObject(
      reader,
      attempt(() => reader.getTrailer()),
      budget,
      0,
    );
    for (var key of ["Root", "Info", "Encrypt", "ID", "Prev", "Size"]) {
      attempt(() => reader.getTrailerEntryType(key));
    }
    var pages = attempt(() => reader.getPagesCount()) ?? 0;
    observations.add(`pages ${Math.min(pages, 16)}`);
    for (var index = 0; index < Math.min(pages, maxPages); ++index) {
      attempt(() => reader.getPageObjectID(index));
      attempt(() => reader.getPageInfo(index));
      for (var box of ["media", "crop", "bleed", "trim", "art"]) {
        attempt(() => reader.getPageBox(index, box));
      }
      var page = attempt(() => reader.parsePage(index));
      if (page) {
        attempt(() => page.getRotate());
        attempt(() => page.getMediaBox());
        attempt(() => page.getCropBox());
        attempt(() => page.getArtBox());
      }
      walkObject(
        reader,
        attempt(() => reader.parsePageDictionary(index)),
        budget,
        0,
      );
      var elements = attempt(() =>
        reader.extractPageText(index, extractionLimits),
      );
      observations.add(
        `text ${Math.ceil(Math.log2((elements?.length ?? 0) + 1))}`,
      );
      attempt(() =>
        reader.extractPageText(index, extractionLimits, { decodeText: false }),
      );
      attempt(() => reader.extractPageContentItems(index, extractionLimits));
    }
    var size = attempt(() => reader.getXrefSize()) ?? 0;
    for (var id = 0; id < Math.min(size, maxObjects); ++id) {
      attempt(() => reader.getXrefEntry(id));
      if (budget.count <= 0) break;
      // Each object gets a share of what is left, so one wide object cannot
      // keep the walk from reaching the rest.
      var share = { count: Math.min(64, budget.count) };
      var granted = share.count;
      walkObject(
        reader,
        attempt(() => reader.parseNewObject(id)),
        share,
        0,
      );
      budget.count -= granted - Math.max(share.count, 0);
    }
  } finally {
    attempt(() => reader.end());
  }
}

var assetCounter = 0;

/**
 * Builds an asset-registry name unique within the worker.
 * @param {string} prefix - Kind of asset.
 * @returns {string} The name.
 */
function assetName(prefix) {
  return `${prefix}-${++assetCounter}`;
}

export var targets = {
  /** Parses and walks a PDF through PDFReader. */
  reader: {
    seeds: "pdf",
    /**
     * Walks the PDF, and again with the user password when it is encrypted.
     * @param {{muhammara: object}} api - The worker's Wasm API.
     * @param {Uint8Array} bytes - Input.
     */
    run({ muhammara }, bytes) {
      var encrypted = false;
      attempt(() => {
        var reader = muhammara.createReader(bytes);
        encrypted = reader.isEncrypted();
        reader.end();
      });
      if (encrypted)
        attempt(() => inspect(muhammara, bytes, { password: "user" }));
      inspect(muhammara, bytes);
    },
  },

  /**
   * Extracts text and content items from every page, decoding fonts,
   * encodings and ToUnicode CMaps in the glue, without the reader's object
   * walk, so inputs run fast and reach the extractors deep.
   */
  text: {
    seeds: "pdf",
    /**
     * Extracts text, raw text and content items from up to 16 pages.
     * @param {{muhammara: object}} api - The worker's Wasm API.
     * @param {Uint8Array} bytes - Input.
     */
    run({ muhammara }, bytes) {
      var reader = muhammara.createReader(bytes);
      try {
        var pages = attempt(() => reader.getPagesCount()) ?? 0;
        for (var index = 0; index < Math.min(pages, 16); ++index) {
          var elements = attempt(() => reader.extractPageText(index));
          observations.add(
            `text ${Math.ceil(Math.log2((elements?.length ?? 0) + 1))}`,
          );
          for (var element of elements ?? []) {
            observations.add(`decoded ${/\uFFFD/.test(element.text)}`);
          }
          attempt(() =>
            reader.extractPageText(index, extractionLimits, {
              decodeText: false,
            }),
          );
          var items = attempt(() => reader.extractPageContentItems(index));
          for (var item of items ?? []) observations.add(`item ${item.type}`);
        }
      } finally {
        attempt(() => reader.end());
      }
    },
  },

  /** Opens a PDF for incremental modification and writes a page over it. */
  modify: {
    seeds: "pdf",
    /**
     * Draws on up to three pages with the low-level modifier, then on the
     * first page with the compact modifier.
     * @param {{muhammara: object}} api - The worker's Wasm API.
     * @param {Uint8Array} bytes - Input.
     */
    run({ muhammara }, bytes) {
      attempt(() => {
        var modifier = muhammara.createWriterToModify(bytes);
        try {
          var reader = attempt(() => modifier.getModifiedFileParser());
          var pages = attempt(() => reader?.getPagesCount()) ?? 1;
          for (var index = 0; index < Math.min(pages, 3); ++index) {
            attempt(() => {
              var page = modifier.createPageModifier(index, index % 2 === 0);
              var context = page.startContext().getContext();
              context.q().re(10, 10, 50, 50).f().Q();
              page.endContext().writePage();
            });
          }
          modifier.end();
        } finally {
          attempt(() => modifier.dispose());
        }
      });
      attempt(() => {
        var compact = muhammara.createModifier(bytes);
        try {
          compact.startPage(0).rectangle(10, 10, 50, 50, { fill: "#00ff00" });
          compact.endPage().end();
        } finally {
          attempt(() => compact.dispose());
        }
      });
    },
  },

  /** Copies a PDF's pages into a new document in every supported way. */
  copy: {
    seeds: "pdf",
    /**
     * Appends, imports as form XObjects, merges and copies the PDF's pages
     * and objects, then walks the output.
     * @param {{muhammara: object}} api - The worker's Wasm API.
     * @param {Uint8Array} bytes - Input.
     */
    run({ muhammara }, bytes) {
      attempt(() => {
        var writer = muhammara.createWriter();
        try {
          attempt(() => writer.appendPDFPagesFromPDF(bytes));
          attempt(() => writer.createFormXObjectsFromPDF(bytes));
          attempt(() => {
            var page = writer.createPage(0, 0, 595, 842);
            writer.mergePDFPagesToPage(page, bytes, {
              type: muhammara.eRangeTypeSpecific,
              specificRanges: [[0, 0]],
            });
            writer.writePage(page);
          });
          attempt(() => {
            var context = writer.createPDFCopyingContext(bytes);
            try {
              var reader = context.getSourceDocumentParser();
              var pages = Math.min(
                attempt(() => reader.getPagesCount()) ?? 0,
                3,
              );
              for (var index = 0; index < pages; ++index) {
                attempt(() => context.appendPDFPageFromPDF(index));
                attempt(() => context.createFormXObjectFromPDFPage(index, 0));
              }
              var size = Math.min(attempt(() => reader.getXrefSize()) ?? 0, 64);
              for (var id = 1; id < size; ++id) {
                attempt(() => context.copyObject(id));
              }
            } finally {
              attempt(() => context.end());
            }
          });
          var output = writer.end();
          attempt(() => inspect(muhammara, output));
        } finally {
          attempt(() => writer.dispose());
        }
      });
    },
  },

  /** Rewrites a PDF with and without encryption. */
  recrypt: {
    seeds: "pdf",
    /**
     * Recrypts uncompressed, with the user password, and with new passwords.
     * @param {{muhammara: object}} api - The worker's Wasm API.
     * @param {Uint8Array} bytes - Input.
     */
    run({ muhammara }, bytes) {
      attempt(() => muhammara.recrypt(bytes, { compress: false }));
      attempt(() => muhammara.recrypt(bytes, { password: "user" }));
      attempt(() =>
        muhammara.recrypt(bytes, {
          userPassword: "user",
          ownerPassword: "owner",
          userProtectionFlag: 4,
          version: muhammara.ePDFVersion14,
        }),
      );
    },
  },

  /** Opens a PDF with Recipe, edits, inspects, appends and overlays it. */
  recipe: {
    seeds: "pdf",
    /**
     * Edits, inspects, reads, appends and overlays the PDF with Recipe.
     * @param {{Recipe: Function}} api - The worker's Recipe class.
     * @param {Uint8Array} bytes - Input.
     */
    run({ Recipe }, bytes) {
      /**
       * Calls `fn` with a Recipe and disposes it afterwards. A Recipe that
       * never reaches endPDF() keeps its writer until disposed; disposing
       * every one keeps the leak check about the library.
       * @param {object} recipe - Recipe to dispose.
       * @param {(recipe: object) => unknown} fn - Work with the recipe.
       * @returns {unknown} What `fn` returned.
       */
      var using = (recipe, fn) => {
        try {
          return fn(recipe);
        } finally {
          attempt(() => recipe.dispose());
        }
      };
      attempt(() =>
        using(new Recipe(bytes), (recipe) => {
          attempt(() => recipe.metadata);
          recipe
            .editPage(1)
            .text("fuzz", 10, 10)
            .rectangle(20, 20, 30, 30, { stroke: "#ff0000" })
            .endPage()
            .endPDF();
        }),
      );
      attempt(() =>
        using(new Recipe(bytes), (recipe) => recipe.structure("json")),
      );
      attempt(() => using(new Recipe(), (recipe) => recipe.read(bytes)));
      var name = assetName("pdf");
      attempt(() => {
        Recipe.registerPdf(name, bytes);
        try {
          using(new Recipe(), (recipe) => {
            recipe.createPage("A4").endPage();
            attempt(() => recipe.appendPage(name));
            attempt(() => recipe.editPage(1).overlay(name).endPage());
            recipe.endPDF();
          });
        } finally {
          Recipe.unregisterPdf(name);
        }
      });
    },
  },

  /** Loads a font through FreeType and writes, measures and embeds text. */
  font: {
    seeds: "font",
    /**
     * Registers the input as a font, uses faces 0 and 1 to measure and write
     * text, then walks the output.
     * @param {{muhammara: object}} api - The worker's Wasm API.
     * @param {Uint8Array} bytes - Input.
     */
    run({ muhammara }, bytes) {
      var name = assetName("font");
      attempt(() => {
        muhammara.registerFont(name, bytes);
        var writer = muhammara.createWriter();
        try {
          for (var index of [0, 1]) {
            attempt(() => {
              var font = writer.getFontForBytes(name, index);
              attempt(() => font.getFontMetrics(12));
              attempt(() =>
                font.calculateTextDimensions("Hello, 世界 ﬁ €", 12),
              );
              var page = writer.createPage(0, 0, 595, 842);
              var context = writer.startPageContentContext(page);
              context.writeText("Hello, world ÄÖÜ ﬁ € \u{1F600}", 10, 100, {
                font,
                size: 12,
              });
              context.BT().Tf(font, 14).Tm(1, 0, 0, 1, 10, 200).Tj("abc").ET();
              writer.writePage(page);
            });
          }
          var output = writer.end();
          attempt(() => inspect(muhammara, output));
        } finally {
          attempt(() => writer.dispose());
        }
      });
      attempt(() => muhammara.unregisterFont(name));
    },
  },

  /** Decodes a JPEG, PNG or TIFF image and places it on pages. */
  image: {
    seeds: "image",
    /**
     * Inspects the input as an image, creates XObjects from it as JPEG, PNG
     * and TIFF, draws it on a page, then walks the output.
     * @param {{muhammara: object}} api - The worker's Wasm API.
     * @param {Uint8Array} bytes - Input.
     */
    run({ muhammara }, bytes) {
      var name = assetName("image");
      var writer = muhammara.createWriter();
      try {
        attempt(() => writer.getImageType(bytes));
        attempt(() => writer.getImageDimensions(bytes));
        attempt(() => writer.getImagePagesCount(bytes));
        attempt(() => writer.retrieveJPGImageInformation(bytes));
        for (var extension of ["jpg", "png", "tiff"]) {
          attempt(() => {
            muhammara.registerImage(name, bytes, extension);
            try {
              if (extension === "jpg") {
                attempt(() => writer.createImageXObjectFromJPGBytes(name));
                attempt(() => writer.createFormXObjectFromJPGBytes(name));
              } else if (extension === "png") {
                attempt(() => writer.createFormXObjectFromPNGBytes(name));
              }
            } finally {
              muhammara.unregisterImage(name);
            }
          });
        }
        for (var pageIndex of [0, 1]) {
          attempt(() =>
            writer.createFormXObjectFromTIFFBytes(bytes, { pageIndex }),
          );
          attempt(() =>
            writer.createFormXObjectFromTIFFBytes(bytes, {
              pageIndex,
              bwTreatment: { asImageMask: true, oneColor: [255, 0, 0] },
              grayscaleTreatment: {
                asColorMap: true,
                oneColor: [0, 0, 255],
                zeroColor: [255, 255, 255],
              },
            }),
          );
        }
        attempt(() => {
          var page = writer.createPage(0, 0, 595, 842);
          var context = writer.startPageContentContext(page);
          attempt(() => context.drawImage(10, 10, bytes));
          attempt(() =>
            context.drawImage(10, 10, bytes, {
              index: 1,
              transformation: { width: 100, height: 100, proportional: true },
            }),
          );
          writer.writePage(page);
        });
        var output = attempt(() => writer.end());
        if (output) attempt(() => inspect(muhammara, output));
      } finally {
        attempt(() => writer.dispose());
      }
    },
  },
};
