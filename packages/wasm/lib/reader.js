import { PageBox } from "./value-sets.js";
/**
 * Rejects page indices and object IDs the native reader would silently wrap.
 * @param {*} value - Candidate index or ID.
 * @param {string} label - Name used in the error message.
 * @returns {void}
 * @throws {TypeError} If `value` is not an unsigned 32-bit integer.
 */
function requireIndex(value, label) {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
    throw new TypeError(`${label} must be a non-negative integer`);
  }
}

/**
 * Creates a factory for low-level PDF readers.
 * @param {object} dependencies - Module, constants, and byte helpers shared with the writer.
 * @returns {Function} `createReader(bytes, readerHandle, requireOwner, copyingContext, destroyReader)`.
 */
export function createReaderFactory({
  module,
  constants,
  normalizeBytes,
  withString,
  textStringValue,
  allocatePdfPath,
  removeFile,
}) {
  /**
   * Opens PDF bytes or wraps an existing native reader handle.
   *
   * @param {Uint8Array|ArrayBuffer} bytes PDF bytes when creating a reader.
   * @param {number} readerHandle Existing native reader handle; ownership remains
   * with its caller unless `destroyReader` is true.
   * @param {Function} requireOwner Verifies the owner of a borrowed handle remains open.
   * @param {number} copyingContext Borrowed native copying context for source streams.
   * @param {boolean} destroyReader Whether `end()` destroys `readerHandle`.
   * @returns {object} A reader whose `end()` releases owned resources.
   * @throws {TypeError} If `bytes` is not a supported byte source.
   * @throws {Error} If the PDF cannot be parsed.
   */
  function createReader(
    bytes,
    readerHandle,
    requireOwner,
    copyingContext,
    destroyReader = true,
  ) {
    var reader = readerHandle;
    var path;
    if (!reader) {
      bytes = normalizeBytes(bytes, "PDF input");
      path = allocatePdfPath();
      module.FS.mkdirTree("/pdfs");
      module.FS.writeFile(path, bytes);
      try {
        reader = withString(path, (pathPointer) =>
          module._muhammara_wasm_reader_create(pathPointer),
        );
      } catch (error) {
        removeFile(path);
        throw error;
      }
    }
    if (!reader) {
      removeFile(path);
      throw new Error("Unable to parse PDF");
    }
    var ended = false;
    var readerOwner = {};
    var byteReaders = new Set();

    /**
     * Rejects use of an ended reader or of a borrowed handle whose owner ended.
     * @returns {void}
     * @throws {Error} If the reader or its owner has ended.
     */
    function requireReader() {
      if (requireOwner) requireOwner();
      if (ended || !reader) throw new Error("PDF reader has ended");
    }

    /**
     * Reads a parsed object's string form.
     * @param {number} handle - Native object handle.
     * @returns {string} The UTF-8 decoded value.
     * @throws {Error} If the reader has ended or the value cannot be read.
     */
    function objectString(handle) {
      requireReader();
      var lengthPointer = module._malloc(4);
      try {
        var pointer = module._muhammara_wasm_object_get_string(
          handle,
          lengthPointer,
        );
        var length = module.HEAPU32[lengthPointer >>> 2];
        if (!pointer && length) throw new Error("Unable to read PDF object");
        try {
          return pointer
            ? new TextDecoder().decode(
                module.HEAPU8.slice(pointer, pointer + length),
              )
            : "";
        } finally {
          if (pointer) module._muhammara_wasm_free(pointer);
        }
      } finally {
        module._free(lengthPointer);
      }
    }

    /**
     * Lists a parsed dictionary's keys.
     * @param {number} handle - Native dictionary handle.
     * @returns {string[]} Keys without leading slashes.
     * @throws {Error} If the reader has ended or the dictionary cannot be read.
     */
    function objectKeys(handle) {
      requireReader();
      var lengthPointer = module._malloc(4);
      try {
        var pointer = module._muhammara_wasm_object_dictionary_keys(
          handle,
          lengthPointer,
        );
        var length = module.HEAPU32[lengthPointer >>> 2];
        if (!pointer && length)
          throw new Error("Unable to read PDF dictionary");
        try {
          return pointer
            ? objectStringBytes(module.HEAPU8.slice(pointer, pointer + length))
                .split("\0")
                .filter(Boolean)
            : [];
        } finally {
          if (pointer) module._muhammara_wasm_free(pointer);
        }
      } finally {
        module._free(lengthPointer);
      }
    }

    /**
     * Decodes UTF-8 key bytes.
     * @param {Uint8Array} bytes - Encoded bytes.
     * @returns {string} The decoded text.
     */
    function objectStringBytes(bytes) {
      return new TextDecoder().decode(bytes);
    }

    /**
     * Wraps a native object handle with the PDFObject methods its type supports.
     * @param {number} handle - Native object handle, or 0.
     * @param {{handle: number, ended: boolean}} [parser] - Object parser that owns the handle.
     * @returns {PDFObject|undefined} The object, or undefined for a 0 handle.
     */
    function wrapObject(handle, parser) {
      if (!handle) return undefined;
      var object = {
        _handle: handle,
        _readerOwner: readerOwner,
        _copyingContext: copyingContext,
        /**
         * Reads the object type.
         * @returns {PDFObjectType} One of the `ePDFObject*` constants.
         * @throws {Error} If the reader or its object parser has ended.
         */
        getType: function () {
          requireReader();
          if (parser && parser.ended)
            throw new Error("PDF object parser has ended");
          return module._muhammara_wasm_object_get_type(handle);
        },
        /**
         * Formats the object value as text.
         * @returns {string} The value; names without their slash.
         * @throws {Error} If the reader or its object parser has ended.
         */
        toString: function () {
          object.getType();
          return objectString(handle);
        },
        /**
         * Reads a numeric value.
         * @returns {number|undefined} The number, or undefined for a non-numeric object.
         * @throws {Error} If the reader or its object parser has ended.
         */
        toNumber: function () {
          object.getType();
          requireReader();
          var pointer = module._malloc(8);
          try {
            return module._muhammara_wasm_object_get_number(handle, pointer)
              ? module.HEAPF64[pointer >>> 3]
              : undefined;
          } finally {
            module._free(pointer);
          }
        },
        /**
         * Narrows the object to an array.
         * @returns {PDFArray|undefined} This object when it is an array.
         * @throws {Error} If the reader or its object parser has ended.
         */
        toPDFArray: function () {
          return object.getType() === constants.ePDFObjectArray
            ? object
            : undefined;
        },
        /**
         * Narrows the object to a dictionary.
         * @returns {PDFDictionary|undefined} This object when it is a dictionary.
         * @throws {Error} If the reader or its object parser has ended.
         */
        toPDFDictionary: function () {
          return object.getType() === constants.ePDFObjectDictionary
            ? object
            : undefined;
        },
        /**
         * Narrows the object to a stream.
         * @returns {PDFStreamInput|undefined} This object when it is a stream.
         * @throws {Error} If the reader or its object parser has ended.
         */
        toPDFStream: function () {
          return object.getType() === constants.ePDFObjectStream
            ? object
            : undefined;
        },
        /**
         * Narrows the object to an indirect reference.
         * @returns {PDFIndirectObjectReference|undefined} This object when it is a reference.
         * @throws {Error} If the reader or its object parser has ended.
         */
        toPDFIndirectObjectReference: function () {
          return object.getType() ===
            constants.ePDFObjectIndirectObjectReference
            ? object
            : undefined;
        },
      };
      [
        "Boolean",
        "LiteralString",
        "HexString",
        "Null",
        "Name",
        "Integer",
        "Real",
        "Symbol",
      ].forEach((name) => {
        /**
         * Narrows the object to the scalar type in the method name.
         * @returns {PDFObject|undefined} This object when its type matches.
         * @throws {Error} If the reader or its object parser has ended.
         */
        object[`toPDF${name}`] = function () {
          return object.getType() === constants[`ePDFObject${name}`]
            ? object
            : undefined;
        };
      });
      Object.defineProperty(object, "value", {
        /**
         * Reads the object's JavaScript value.
         * @returns {string|number|boolean|undefined} A boolean, number, or string form of the value.
         * @throws {Error} If the reader or its object parser has ended.
         */
        get: function () {
          var type = object.getType();
          if (type === constants.ePDFObjectBoolean) {
            var pointer = module._malloc(4);
            try {
              if (!module._muhammara_wasm_object_get_boolean(handle, pointer))
                return undefined;
              return Boolean(module.HEAP32[pointer >>> 2]);
            } finally {
              module._free(pointer);
            }
          }
          return type === constants.ePDFObjectInteger ||
            type === constants.ePDFObjectReal
            ? object.toNumber()
            : objectString(handle);
        },
      });
      if (object.getType() === constants.ePDFObjectArray) {
        /**
         * Counts the array items.
         * @returns {number} The item count.
         * @throws {Error} If the reader or its object parser has ended.
         */
        object.getLength = function () {
          object.getType();
          requireReader();
          return module._muhammara_wasm_object_array_length(handle);
        };
        /**
         * Reads an array item, resolving an indirect reference.
         * @param {number} index - Zero-based item index.
         * @returns {PDFObject|undefined} The item, or undefined past the end.
         * @throws {RangeError} If `index` is not a non-negative integer.
         * @throws {Error} If the reader or its object parser has ended.
         */
        object.queryObject = function (index) {
          object.getType();
          if (!Number.isInteger(index) || index < 0)
            throw new RangeError("Array index must be a non-negative integer");
          return wrapObject(
            parser
              ? module._muhammara_wasm_object_array_query(
                  parser.handle,
                  handle,
                  index,
                )
              : module._muhammara_wasm_reader_object_array_query(
                  reader,
                  handle,
                  index,
                ),
            parser,
          );
        };
        /**
         * Reads every array item, resolving indirect references.
         * @returns {PDFObject[]} The items in order.
         * @throws {Error} If the reader or its object parser has ended.
         */
        object.toJSArray = function () {
          return Array.from({ length: object.getLength() }, (_, index) =>
            object.queryObject(index),
          );
        };
      }
      if (object.getType() === constants.ePDFObjectDictionary) {
        /**
         * Checks for a key.
         * @param {string} key - Key without the leading slash.
         * @returns {boolean} Whether the dictionary has the key; false for a non-string.
         * @throws {Error} If the reader or its object parser has ended.
         */
        object.exists = function (key) {
          object.getType();
          return typeof key === "string" && objectKeys(handle).includes(key);
        };
        /**
         * Reads a dictionary value, resolving an indirect reference.
         * @param {string} key - Key without the leading slash.
         * @returns {PDFObject} The value.
         * @throws {TypeError} If `key` is not a string.
         * @throws {Error} If the key is missing or the reader or parser has ended.
         */
        object.queryObject = function (key) {
          object.getType();
          if (typeof key !== "string")
            throw new TypeError("Dictionary key must be a string");
          var result = withString(key, (pointer) =>
            parser
              ? module._muhammara_wasm_object_dictionary_query(
                  parser.handle,
                  handle,
                  pointer,
                )
              : module._muhammara_wasm_reader_object_dictionary_query(
                  reader,
                  handle,
                  pointer,
                ),
          );
          if (!result) throw new Error("key not found");
          return wrapObject(result, parser);
        };
        /**
         * Reads every dictionary value, resolving indirect references.
         * @returns {Record<string, PDFObject>} Values keyed by key name.
         * @throws {Error} If the reader or its object parser has ended.
         */
        object.toJSObject = function () {
          object.getType();
          return Object.fromEntries(
            objectKeys(handle).map((key) => [key, object.queryObject(key)]),
          );
        };
      }
      if (object.getType() === constants.ePDFObjectStream) {
        /**
         * Reads the stream dictionary.
         * @returns {PDFDictionary} The dictionary.
         * @throws {Error} If the reader or its object parser has ended.
         */
        object.getDictionary = function () {
          object.getType();
          return wrapObject(
            parser
              ? module._muhammara_wasm_object_stream_dictionary(
                  parser.handle,
                  handle,
                )
              : module._muhammara_wasm_reader_object_stream_dictionary(
                  reader,
                  handle,
                ),
            parser,
          );
        };
        /**
         * Locates the stream data in the PDF file.
         * @returns {number} Byte offset of the first content byte.
         * @throws {Error} If the reader or its object parser has ended.
         */
        object.getStreamContentStart = function () {
          object.getType();
          requireReader();
          return module._muhammara_wasm_object_stream_content_start(handle);
        };
      }
      if (object.getType() === constants.ePDFObjectIndirectObjectReference) {
        /**
         * Reads the referenced object ID.
         * @returns {number} The object ID.
         * @throws {Error} If the reader or parser has ended or the reference cannot be read.
         */
        object.getObjectID = function () {
          object.getType();
          requireReader();
          var pointer = module._malloc(8);
          try {
            if (
              !module._muhammara_wasm_object_indirect_reference(handle, pointer)
            )
              throw new Error("Unable to read indirect reference");
            return module.HEAPU32[pointer >>> 2];
          } finally {
            module._free(pointer);
          }
        };
        /**
         * Reads the referenced generation number.
         * @returns {number} The generation.
         * @throws {Error} If the reader or parser has ended or the reference cannot be read.
         */
        object.getVersion = function () {
          object.getType();
          requireReader();
          var pointer = module._malloc(8);
          try {
            if (
              !module._muhammara_wasm_object_indirect_reference(handle, pointer)
            )
              throw new Error("Unable to read indirect reference");
            return module.HEAPU32[(pointer >>> 2) + 1];
          } finally {
            module._free(pointer);
          }
        };
      }
      if (
        object.getType() === constants.ePDFObjectLiteralString ||
        object.getType() === constants.ePDFObjectHexString
      ) {
        /**
         * Reads the raw string bytes, decoded from hex for a hex string.
         * @returns {Uint8Array} The bytes.
         * @throws {Error} If the reader or parser has ended or the bytes cannot be read.
         */
        object.toBytesArray = function () {
          object.getType();
          requireReader();
          var lengthPointer = module._malloc(4);
          try {
            var pointer = module._muhammara_wasm_object_get_string_bytes(
              handle,
              lengthPointer,
            );
            var length = module.HEAPU32[lengthPointer >>> 2];
            if (!pointer && length)
              throw new Error("Unable to read PDF string bytes");
            try {
              return pointer
                ? module.HEAPU8.slice(pointer, pointer + length)
                : new Uint8Array();
            } finally {
              if (pointer) module._muhammara_wasm_free(pointer);
            }
          } finally {
            module._free(lengthPointer);
          }
        };
        /**
         * Decodes the string as a PDF text string.
         * @returns {string} Text from PDFDocEncoding or UTF-16BE bytes.
         * @throws {Error} If the reader or parser has ended.
         */
        object.toText = function () {
          return textStringValue(object.toBytesArray());
        };
      }
      return object;
    }

    /**
     * Opens a byte reader over a stream's content.
     * @param {PDFStreamInput} stream - Stream parsed by this reader.
     * @param {boolean} plainCopying - Whether to read the raw, still encoded bytes.
     * @returns {PDFByteReader} The byte reader.
     * @throws {TypeError} If `stream` is not a stream from this reader.
     * @throws {Error} If the reader has ended or the stream cannot be read.
     */
    function startReadingFromStream(stream, plainCopying) {
      requireReader();
      if (
        !stream ||
        stream._readerOwner !== readerOwner ||
        typeof stream.getType !== "function" ||
        stream.getType() !== constants.ePDFObjectStream
      ) {
        throw new TypeError("Provide a reader-owned PDF stream input");
      }
      var handle = module._muhammara_wasm_reader_start_reading_from_stream(
        reader,
        stream._handle,
        plainCopying ? 1 : 0,
      );
      if (!handle) throw new Error("Unable to read PDF stream");
      return wrapByteReader(handle, false);
    }

    /**
     * Wraps a native byte reader and registers it for release on `end()`.
     * @param {number} handle - Native byte reader handle.
     * @param {boolean} positioned - Whether to add position methods.
     * @returns {PDFByteReader|PositionedPDFByteReader} The byte reader.
     */
    function wrapByteReader(handle, positioned) {
      var active = true;

      /**
       * Rejects access after this byte reader is disposed.
       * @returns {void}
       * @throws {Error} If the reader or this byte reader has ended.
       */
      function requireByteReader() {
        requireReader();
        if (!active) throw new Error("PDF byte reader has ended");
      }

      /**
       * Unregisters and releases this byte reader once.
       * @returns {PDFByteReader} The byte reader.
       */
      function disposeByteReader() {
        if (!active) return byteReader;
        if (!ended && reader) {
          module._muhammara_wasm_byte_reader_destroy(handle);
        }
        byteReaders.delete(disposeByteReader);
        handle = 0;
        active = false;
        return byteReader;
      }

      var byteReader = {
        /**
         * Reads the next bytes.
         * @param {number} amount - Maximum byte count.
         * @returns {Uint8Array} A copy of at most `amount` bytes.
         * @throws {RangeError} If `amount` is not an integer from 0 to 2^31 - 1.
         * @throws {Error} If the reader or byte reader has ended or reading fails.
         */
        read: function (amount) {
          requireByteReader();
          if (!Number.isInteger(amount) || amount < 0 || amount > 0x7fffffff) {
            throw new RangeError("read requires a non-negative integer");
          }
          if (amount === 0) return new Uint8Array();
          var bytesPointer = module._malloc(amount);
          try {
            var length = module._muhammara_wasm_byte_reader_read(
              handle,
              bytesPointer,
              amount,
            );
            if (length < 0) throw new Error("Unable to read PDF stream");
            return module.HEAPU8.slice(bytesPointer, bytesPointer + length);
          } finally {
            module._free(bytesPointer);
          }
        },
        /**
         * Reports whether unread bytes remain.
         * @returns {boolean} Whether more bytes can be read.
         * @throws {Error} If the reader or byte reader has ended.
         */
        notEnded: function () {
          requireByteReader();
          return Boolean(module._muhammara_wasm_byte_reader_not_ended(handle));
        },
        /** Releases this byte reader without ending its parent PDF reader. */
        dispose: disposeByteReader,
      };
      if (positioned) {
        /**
         * Rejects a negative or non-integer position.
         * @param {*} value - Candidate position or amount.
         * @param {string} label - Method name for the error message.
         * @returns {void}
         * @throws {RangeError} If `value` is not a non-negative safe integer.
         */
        function requirePosition(value, label) {
          if (!Number.isSafeInteger(value) || value < 0) {
            throw new RangeError(`${label} requires a non-negative integer`);
          }
        }
        /**
         * Moves to an absolute position.
         * @param {number} position - Byte offset.
         * @returns {PositionedPDFByteReader} The byte reader.
         * @throws {RangeError} If `position` is not a non-negative integer.
         * @throws {Error} If the reader or byte reader has ended or the position cannot be set.
         */
        byteReader.setPosition = function (position) {
          requireByteReader();
          requirePosition(position, "setPosition");
          if (
            !module._muhammara_wasm_byte_reader_set_position(handle, position)
          ) {
            throw new Error("Unable to set parser stream position");
          }
          return byteReader;
        };
        /**
         * Moves to a position counted back from the end.
         * @param {number} position - Byte offset from the end.
         * @returns {PositionedPDFByteReader} The byte reader.
         * @throws {RangeError} If `position` is not a non-negative integer.
         * @throws {Error} If the reader or byte reader has ended or the position cannot be set.
         */
        byteReader.setPositionFromEnd = function (position) {
          requireByteReader();
          requirePosition(position, "setPositionFromEnd");
          if (
            !module._muhammara_wasm_byte_reader_set_position_from_end(
              handle,
              position,
            )
          ) {
            throw new Error("Unable to set parser stream position");
          }
          return byteReader;
        };
        /**
         * Advances without reading.
         * @param {number} amount - Bytes to skip.
         * @returns {PositionedPDFByteReader} The byte reader.
         * @throws {RangeError} If `amount` is not a non-negative integer.
         * @throws {Error} If the reader or byte reader has ended or skipping fails.
         */
        byteReader.skip = function (amount) {
          requireByteReader();
          requirePosition(amount, "skip");
          if (!module._muhammara_wasm_byte_reader_skip(handle, amount)) {
            throw new Error("Unable to skip parser stream bytes");
          }
          return byteReader;
        };
        /**
         * Reads the current position.
         * @returns {number} Byte offset.
         * @throws {Error} If the reader or byte reader has ended or the position cannot be read.
         */
        byteReader.getCurrentPosition = function () {
          requireByteReader();
          var position =
            module._muhammara_wasm_byte_reader_get_current_position(handle);
          if (position < 0)
            throw new Error("Unable to read parser stream position");
          return position;
        };
      }
      byteReaders.add(disposeByteReader);
      return byteReader;
    }

    // Node creates a one-byte V8 string for extracted PDF content. Avoid UTF-8
    // decoding here so every raw PDF byte remains the same JS code unit.
    /**
     * Maps each byte to one JavaScript code unit, as Node's extraction does.
     * @param {Uint8Array} bytes - Raw bytes.
     * @returns {string} A string whose code units equal the bytes.
     */
    function oneByteString(bytes) {
      var result = "";
      for (var offset = 0; offset < bytes.length; offset += 0x8000) {
        result += String.fromCharCode(
          ...bytes.subarray(offset, offset + 0x8000),
        );
      }
      return result;
    }

    // Shared by extractPageText and extractPageContentItems so both accept the
    // same object. Values are validated here and clamped to the built-in
    // ceilings in the Wasm module, matching the Node reader.
    /**
     * Validates a page index and extraction limits and fills in defaults.
     * @param {number} pageIndex - Zero-based page index.
     * @param {PDFExtractionLimits} limits - Requested limits.
     * @returns {{maxElements: number, maxOperands: number, maxTextBytes: number, maxParsedObjects: number}} Complete limits.
     * @throws {TypeError} If the index is invalid or `limits` is not an object.
     * @throws {RangeError} If a limit is not a positive 32-bit integer.
     */
    function extractionLimits(pageIndex, limits) {
      requireIndex(pageIndex, "Page index");
      if (!limits || typeof limits !== "object" || Array.isArray(limits)) {
        throw new TypeError("Extraction limits must be an object");
      }
      var values = {
        maxElements: limits.maxElements ?? 100000,
        maxOperands: limits.maxOperands ?? 1024,
        maxTextBytes: limits.maxTextBytes ?? 16 * 1024 * 1024,
        maxParsedObjects: limits.maxParsedObjects ?? 1000000,
      };
      Object.entries(values).forEach(([name, value]) => {
        if (!Number.isInteger(value) || value <= 0 || value > 0xffffffff) {
          throw new RangeError(`${name} must be a positive 32-bit integer`);
        }
      });
      return values;
    }

    /**
     * Reads one string field of an extraction result.
     * @param {number} extraction - Native extraction handle.
     * @param {number} index - Element index.
     * @param {function(number, number, number): number} read - Export that returns the field bytes.
     * @returns {string} The field as one-byte code units.
     * @throws {Error} If the field cannot be read.
     */
    function extractedString(extraction, index, read) {
      var lengthPointer = module._malloc(4);
      try {
        module.HEAPU32[lengthPointer >>> 2] = 0;
        var pointer = read(extraction, index, lengthPointer);
        var length = module.HEAPU32[lengthPointer >>> 2];
        if (!pointer && length)
          throw new Error("Unable to read extracted text");
        try {
          return pointer
            ? oneByteString(module.HEAPU8.slice(pointer, pointer + length))
            : "";
        } finally {
          if (pointer) module._muhammara_wasm_free(pointer);
        }
      } finally {
        module._free(lengthPointer);
      }
    }

    return {
      /**
       * Counts the document pages.
       * @returns {number} The page count.
       * @throws {Error} If the reader has ended.
       */
      getPagesCount: function () {
        requireReader();
        return module._muhammara_wasm_reader_get_pages_count(reader);
      },
      /**
       * Looks up a page's object ID.
       * @param {number} index - Zero-based page index.
       * @returns {number} The page object ID.
       * @throws {TypeError} If `index` is not a non-negative integer.
       * @throws {RangeError} If the page does not exist.
       * @throws {Error} If the reader has ended.
       */
      getPageObjectID: function (index) {
        requireReader();
        requireIndex(index, "Page index");
        var id = module._muhammara_wasm_reader_get_page_object_id(
          reader,
          index,
        );
        if (!id) {
          throw new RangeError(`Unable to read page ${index}`);
        }
        return id;
      },
      /**
       * Reads the header PDF version.
       * @returns {number} The version, such as 1.7.
       * @throws {Error} If the reader has ended.
       */
      getPDFLevel: function () {
        requireReader();
        return module._muhammara_wasm_reader_get_pdf_level(reader);
      },
      /**
       * Counts the objects in the cross-reference table.
       * @returns {number} The object count.
       * @throws {Error} If the reader has ended.
       */
      getObjectsCount: function () {
        requireReader();
        return module._muhammara_wasm_reader_get_objects_count(reader);
      },
      /**
       * Reports whether the document is encrypted.
       * @returns {boolean} Whether an `/Encrypt` dictionary is present.
       * @throws {Error} If the reader has ended.
       */
      isEncrypted: function () {
        requireReader();
        return Boolean(module._muhammara_wasm_reader_is_encrypted(reader));
      },
      /**
       * Reads the cross-reference table size.
       * @returns {number} The number of entries.
       * @throws {Error} If the reader has ended.
       */
      getXrefSize: function () {
        requireReader();
        return module._muhammara_wasm_reader_get_xref_size(reader);
      },
      /**
       * Locates the last cross-reference section.
       * @returns {number} Its byte offset.
       * @throws {Error} If the reader has ended.
       */
      getXrefPosition: function () {
        requireReader();
        return module._muhammara_wasm_reader_get_xref_position(reader);
      },
      /**
       * Reads a cross-reference entry.
       * @param {number} objectId - Object ID.
       * @returns {PDFXrefEntry} The entry's position, revision, and type.
       * @throws {TypeError} If the ID is invalid or outside the xref table.
       * @throws {Error} If the reader has ended.
       */
      getXrefEntry: function (objectId) {
        requireReader();
        requireIndex(objectId, "Object ID");
        var valuesPointer = module._malloc(24);
        try {
          if (
            !module._muhammara_wasm_reader_get_xref_entry(
              reader,
              objectId,
              valuesPointer,
            )
          ) {
            throw new TypeError(
              "Unable to read object xref entry, object ID is out of range",
            );
          }
          var offset = valuesPointer >>> 3;
          return {
            objectPosition: module.HEAPF64[offset],
            revision: module.HEAPF64[offset + 1],
            type: module.HEAPF64[offset + 2],
          };
        } finally {
          module._free(valuesPointer);
        }
      },
      /**
       * Reads the type of a trailer entry.
       * @param {string} key - Trailer key without the leading slash.
       * @returns {PDFObjectType|null} The type, or null when the key is missing.
       * @throws {TypeError} If `key` is not a string.
       * @throws {Error} If the reader has ended.
       */
      getTrailerEntryType: function (key) {
        requireReader();
        return withString(key, (keyPointer) => {
          var type = module._muhammara_wasm_reader_get_trailer_entry_type(
            reader,
            keyPointer,
          );
          return type < 0 ? null : type;
        });
      },
      /**
       * Reads the trailer dictionary.
       * @returns {PDFDictionary} The trailer.
       * @throws {Error} If the reader has ended.
       */
      getTrailer: function () {
        requireReader();
        return wrapObject(module._muhammara_wasm_reader_get_trailer(reader));
      },
      /**
       * Reads a dictionary value, resolving an indirect reference.
       * @param {PDFDictionary} dictionary - Dictionary parsed by this reader.
       * @param {string} key - Key without the leading slash.
       * @returns {PDFObject|undefined} The value, or undefined when the key is missing.
       * @throws {TypeError} If the dictionary is from another reader or `key` is not a string.
       * @throws {Error} If the reader has ended.
       */
      queryDictionaryObject: function (dictionary, key) {
        requireReader();
        if (
          !dictionary ||
          dictionary._readerOwner !== readerOwner ||
          typeof key !== "string"
        ) {
          throw new TypeError("Provide a dictionary and a string");
        }
        return withString(key, (pointer) =>
          wrapObject(
            module._muhammara_wasm_reader_query_dictionary_object(
              reader,
              dictionary._handle || 0,
              pointer,
            ),
          ),
        );
      },
      /**
       * Reads an array item, resolving an indirect reference.
       * @param {PDFArray} array - Array parsed by this reader.
       * @param {number} index - Zero-based item index.
       * @returns {PDFObject|undefined} The item, or undefined past the end.
       * @throws {TypeError} If the array is from another reader or `index` is invalid.
       * @throws {Error} If the reader has ended.
       */
      queryArrayObject: function (array, index) {
        requireReader();
        if (
          !array ||
          array._readerOwner !== readerOwner ||
          !Number.isInteger(index) ||
          index < 0
        ) {
          throw new TypeError("Provide an array and a non-negative index");
        }
        return wrapObject(
          module._muhammara_wasm_reader_query_array_object(
            reader,
            array._handle || 0,
            index,
          ),
        );
      },
      /**
       * Parses an indirect object.
       * @param {number} objectId - Object ID.
       * @returns {PDFObject} The parsed object.
       * @throws {TypeError} If `objectId` is not an unsigned 32-bit integer.
       * @throws {Error} If the reader has ended or the object cannot be read.
       */
      parseNewObject: function (objectId) {
        requireReader();
        requireIndex(objectId, "Object ID");
        var object = wrapObject(
          module._muhammara_wasm_reader_parse_object(reader, objectId),
        );
        if (!object) throw new Error("Unable to read object");
        return object;
      },
      /**
       * Parses a page dictionary.
       * @param {number} index - Zero-based page index.
       * @returns {PDFDictionary} The page dictionary.
       * @throws {TypeError} If `index` is not a non-negative integer.
       * @throws {RangeError} If the page does not exist.
       * @throws {Error} If the reader has ended.
       */
      parsePageDictionary: function (index) {
        requireReader();
        requireIndex(index, "Page index");
        var object = wrapObject(
          module._muhammara_wasm_reader_parse_page_dictionary(reader, index),
        );
        if (!object) throw new RangeError(`Unable to read page ${index}`);
        return object;
      },
      /**
       * Parses a page with inherited boxes and rotation resolved.
       * @param {number} index - Zero-based page index.
       * @returns {PDFPageInput} The page.
       * @throws {TypeError} If `index` is not a non-negative integer.
       * @throws {RangeError} If the page does not exist.
       * @throws {Error} If the reader has ended.
       */
      parsePage: function (index) {
        requireReader();
        requireIndex(index, "Page index");
        var page = module._muhammara_wasm_reader_parse_page(reader, index);
        if (!page) throw new RangeError(`Unable to read page ${index}`);

        /**
         * Reads a page box by the page export's box code.
         * @param {number} box - 0 media, 1 crop, 2 trim, 3 bleed, 4 art.
         * @returns {PDFRectangle} The box.
         * @throws {Error} If the reader has ended or the box cannot be read.
         */
        function getBox(box) {
          requireReader();
          var resultPointer = module._malloc(32);
          try {
            if (
              !module._muhammara_wasm_page_input_get_box(
                page,
                box,
                resultPointer,
              )
            ) {
              throw new Error("Unable to read page box");
            }
            return Array.from(
              module.HEAPF64.slice(
                resultPointer >>> 3,
                (resultPointer >>> 3) + 4,
              ),
            );
          } finally {
            module._free(resultPointer);
          }
        }

        return {
          /**
           * Reads the page dictionary.
           * @returns {PDFDictionary} The dictionary.
           * @throws {Error} If the reader has ended or the dictionary cannot be read.
           */
          getDictionary: function () {
            requireReader();
            var dictionary = wrapObject(
              module._muhammara_wasm_page_input_get_dictionary(page),
            );
            if (!dictionary) throw new Error("Unable to read page dictionary");
            return dictionary;
          },
          /**
           * Reads the media box.
           * @returns {PDFRectangle} The box.
           * @throws {Error} If the reader has ended or the box cannot be read.
           */
          getMediaBox: function () {
            return getBox(0);
          },
          /**
           * Reads the crop box, which defaults to the media box.
           * @returns {PDFRectangle} The box.
           * @throws {Error} If the reader has ended or the box cannot be read.
           */
          getCropBox: function () {
            return getBox(1);
          },
          /**
           * Reads the trim box, which defaults to the crop box.
           * @returns {PDFRectangle} The box.
           * @throws {Error} If the reader has ended or the box cannot be read.
           */
          getTrimBox: function () {
            return getBox(2);
          },
          /**
           * Reads the bleed box, which defaults to the crop box.
           * @returns {PDFRectangle} The box.
           * @throws {Error} If the reader has ended or the box cannot be read.
           */
          getBleedBox: function () {
            return getBox(3);
          },
          /**
           * Reads the art box, which defaults to the crop box.
           * @returns {PDFRectangle} The box.
           * @throws {Error} If the reader has ended or the box cannot be read.
           */
          getArtBox: function () {
            return getBox(4);
          },
          /**
           * Reads the page rotation.
           * @returns {number} Degrees, a multiple of 90.
           * @throws {Error} If the reader has ended or the rotation cannot be read.
           */
          getRotate: function () {
            requireReader();
            var valuePointer = module._malloc(4);
            try {
              if (
                !module._muhammara_wasm_page_input_get_rotate(
                  page,
                  valuePointer,
                )
              ) {
                throw new Error("Unable to read page rotation");
              }
              return module.HEAP32[valuePointer >>> 2];
            } finally {
              module._free(valuePointer);
            }
          },
        };
      },
      /**
       * Lists text-showing operations in content-stream drawing order.
       * @param {number} pageIndex - Zero-based page index.
       * @param {PDFExtractionLimits} [limits] - Tighter extraction budgets.
       * @returns {PDFTextElement[]} Raw content, font resource, size, and text matrix per operation.
       * @throws {TypeError} If the index is invalid or `limits` is not an object.
       * @throws {RangeError} If a limit is invalid or the page does not exist.
       * @throws {Error} If the reader has ended or the page exceeds the limits.
       */
      extractPageText: function (pageIndex, limits = {}) {
        requireReader();
        var values = extractionLimits(pageIndex, limits);
        var index = pageIndex;
        var statusPointer = module._malloc(4);
        try {
          module.HEAP32[statusPointer >>> 2] = 0;
          var extraction = module._muhammara_wasm_reader_extract_page_text(
            reader,
            index,
            values.maxElements,
            values.maxOperands,
            values.maxTextBytes,
            values.maxParsedObjects,
            statusPointer,
          );
          var status = module.HEAP32[statusPointer >>> 2];
          if (!extraction) {
            if (status === 3) {
              throw new Error("Page content exceeds text extraction limits");
            }
            throw new RangeError(`Unable to read page ${index}`);
          }
          try {
            var count =
              module._muhammara_wasm_text_extraction_get_count(extraction);
            return Array.from({ length: count }, (_, elementIndex) => ({
              content: extractedString(
                extraction,
                elementIndex,
                module._muhammara_wasm_text_extraction_get_content,
              ),
              fontResource: extractedString(
                extraction,
                elementIndex,
                module._muhammara_wasm_text_extraction_get_font_resource,
              ),
              fontSize: module._muhammara_wasm_text_extraction_get_font_size(
                extraction,
                elementIndex,
              ),
              textMatrix: Array.from({ length: 6 }, (_, matrixIndex) =>
                module._muhammara_wasm_text_extraction_get_text_matrix(
                  extraction,
                  elementIndex,
                  matrixIndex,
                ),
              ),
            }));
          } finally {
            module._muhammara_wasm_text_extraction_destroy(extraction);
          }
        } finally {
          module._free(statusPointer);
        }
      },
      /**
       * Lists the direct content operations that produce a page mark.
       * @param {number} pageIndex - Zero-based page index.
       * @param {PDFExtractionLimits} [limits] - Tighter extraction budgets.
       * @returns {PDFPageContentItem[]} The item type and operator per mark.
       * @throws {TypeError} If the index is invalid or `limits` is not an object.
       * @throws {RangeError} If a limit is invalid or the page does not exist.
       * @throws {Error} If the reader has ended or the page exceeds the limits.
       */
      extractPageContentItems: function (pageIndex, limits = {}) {
        requireReader();
        var values = extractionLimits(pageIndex, limits);
        var index = pageIndex;
        var statusPointer = module._malloc(4);
        try {
          module.HEAP32[statusPointer >>> 2] = 0;
          var extraction =
            module._muhammara_wasm_reader_extract_page_content_items(
              reader,
              index,
              values.maxElements,
              values.maxOperands,
              values.maxTextBytes,
              values.maxParsedObjects,
              statusPointer,
            );
          var status = module.HEAP32[statusPointer >>> 2];
          if (!extraction) {
            if (status === 3) {
              throw new Error("Page content exceeds item extraction limits");
            }
            throw new RangeError(`Unable to read page ${index}`);
          }
          try {
            var count =
              module._muhammara_wasm_page_content_items_get_count(extraction);
            return Array.from({ length: count }, (_, itemIndex) => ({
              type: module._muhammara_wasm_page_content_items_get_type(
                extraction,
                itemIndex,
              ),
              operation: extractedString(
                extraction,
                itemIndex,
                module._muhammara_wasm_page_content_items_get_operation,
              ),
            }));
          } finally {
            module._muhammara_wasm_page_content_items_destroy(extraction);
          }
        } finally {
          module._free(statusPointer);
        }
      },
      /**
       * Parses the objects in a content stream one by one.
       * @param {PDFStreamInput} stream - Stream parsed by this reader.
       * @returns {PDFObjectParser} The object parser.
       * @throws {TypeError} If `stream` is not a stream from this reader.
       * @throws {Error} If the reader has ended or the stream cannot be read.
       */
      startReadingObjectsFromStream: function (stream) {
        requireReader();
        if (
          !stream ||
          stream._readerOwner !== readerOwner ||
          typeof stream.getType !== "function" ||
          stream.getType() !== constants.ePDFObjectStream
        ) {
          throw new TypeError("Provide a reader-owned PDF stream input");
        }
        var handle =
          module._muhammara_wasm_reader_start_reading_objects_from_stream(
            reader,
            stream._handle,
          );
        if (!handle) throw new Error("Unable to read PDF stream objects");
        var parser = { handle, ended: false };
        return {
          /**
           * Parses the next object or operator.
           * @returns {PDFObject|undefined} The object, or undefined at the end.
           * @throws {Error} If the reader or this parser has ended.
           */
          parseNewObject: function () {
            requireReader();
            if (parser.ended) throw new Error("PDF object parser has ended");
            return wrapObject(
              module._muhammara_wasm_object_parser_parse(handle),
              parser,
            );
          },
          /**
           * Ends the parser; objects it returned stop working.
           * @returns {void}
           */
          end: function () {
            parser.ended = true;
          },
        };
      },
      /**
       * Opens a reader over a stream's decoded content.
       * @param {PDFStreamInput} stream - Stream parsed by this reader.
       * @returns {PDFByteReader} The byte reader.
       * @throws {TypeError} If `stream` is not a stream from this reader.
       * @throws {Error} If the reader has ended or the stream cannot be read.
       */
      startReadingFromStream: function (stream) {
        return startReadingFromStream(stream, false);
      },
      /**
       * Opens a reader over a stream's raw, still encoded content.
       * @param {PDFStreamInput} stream - Stream parsed by this reader.
       * @returns {PDFByteReader} The byte reader.
       * @throws {TypeError} If `stream` is not a stream from this reader.
       * @throws {Error} If the reader has ended or the stream cannot be read.
       */
      startReadingFromStreamForPlainCopying: function (stream) {
        return startReadingFromStream(stream, true);
      },
      /**
       * Opens a positioned reader over the whole PDF file.
       * @returns {PositionedPDFByteReader} The byte reader.
       * @throws {Error} If the reader has ended or the stream is unavailable.
       */
      getParserStream: function () {
        requireReader();
        var handle = module._muhammara_wasm_reader_get_parser_stream(reader);
        if (!handle) throw new Error("Unable to get PDF parser stream");
        return wrapByteReader(handle, true);
      },
      /**
       * Opens a positioned reader over a copying context's source file.
       * @returns {PositionedPDFByteReader} The byte reader.
       * @throws {Error} If the reader has ended, did not come from a copying context, or the stream is unavailable.
       */
      getSourceDocumentStream: function () {
        requireReader();
        if (!copyingContext) {
          throw new Error(
            "Source document stream is only available from a copying context",
          );
        }
        var handle =
          module._muhammara_wasm_copying_context_get_source_document_stream(
            copyingContext,
          );
        if (!handle) throw new Error("Unable to get source document stream");
        return wrapByteReader(handle, true);
      },
      /**
       * Parses the objects of several content streams as one sequence.
       * @param {PDFArray} streams - Array of streams parsed by this reader.
       * @returns {PDFObjectParser} The object parser.
       * @throws {TypeError} If `streams` is not an array from this reader.
       * @throws {Error} If the reader has ended or the streams cannot be read.
       */
      startReadingObjectsFromStreams: function (streams) {
        requireReader();
        if (
          !streams ||
          streams._readerOwner !== readerOwner ||
          typeof streams.getType !== "function" ||
          streams.getType() !== constants.ePDFObjectArray
        ) {
          throw new TypeError("Provide a reader-owned PDF array");
        }
        var handle =
          module._muhammara_wasm_reader_start_reading_objects_from_streams(
            reader,
            streams._handle,
          );
        if (!handle) throw new Error("Unable to read PDF stream objects");
        var parser = { handle, ended: false };
        return {
          /**
           * Parses the next object or operator across the streams.
           * @returns {PDFObject|undefined} The object, or undefined at the end.
           * @throws {Error} If the reader or this parser has ended.
           */
          parseNewObject: function () {
            requireReader();
            if (parser.ended) throw new Error("PDF object parser has ended");
            return wrapObject(
              module._muhammara_wasm_object_parser_parse(handle),
              parser,
            );
          },
          /**
           * Ends the parser; objects it returned stop working.
           * @returns {void}
           */
          end: function () {
            parser.ended = true;
          },
        };
      },
      getPageInfo: function (index) {
        requireReader();
        var resultPointer = module._malloc(40);
        try {
          if (
            !module._muhammara_wasm_reader_get_page_info(
              reader,
              index,
              resultPointer,
            )
          ) {
            throw new RangeError(`Unable to read page ${index}`);
          }
          var values = module.HEAPF64;
          var offset = resultPointer >>> 3;
          var mediaBox = Array.from(values.slice(offset, offset + 4));
          return {
            mediaBox,
            rotate: values[offset + 4],
            width: mediaBox[2] - mediaBox[0],
            height: mediaBox[3] - mediaBox[1],
          };
        } finally {
          module._free(resultPointer);
        }
      },
      getPageBox: function (index, box = PageBox.MEDIA) {
        requireReader();
        // Box codes of the reader export, not the ePDFPageBox constants.
        var boxIndexes = {
          [PageBox.MEDIA]: 0,
          [PageBox.CROP]: 1,
          [PageBox.TRIM]: 2,
          [PageBox.BLEED]: 3,
          [PageBox.ART]: 4,
        };
        if (!Object.hasOwn(boxIndexes, box)) {
          throw new RangeError(`Unknown page box: ${box}`);
        }
        var resultPointer = module._malloc(32);
        try {
          if (
            !module._muhammara_wasm_reader_get_page_box(
              reader,
              index,
              boxIndexes[box],
              resultPointer,
            )
          ) {
            throw new RangeError(`Unable to read page ${index}`);
          }
          return Array.from(
            module.HEAPF64.slice(
              resultPointer >>> 3,
              (resultPointer >>> 3) + 4,
            ),
          );
        } finally {
          module._free(resultPointer);
        }
      },
      end: function () {
        if (reader) {
          try {
            Array.from(byteReaders).forEach(function (disposeByteReader) {
              disposeByteReader();
            });
            if (destroyReader) module._muhammara_wasm_reader_destroy(reader);
          } finally {
            removeFile(path);
            reader = 0;
            ended = true;
          }
        }
        return this;
      },
      _end: function () {
        Array.from(byteReaders).forEach(function (disposeByteReader) {
          disposeByteReader();
        });
        reader = 0;
        ended = true;
      },
    };
  }

  return createReader;
}
