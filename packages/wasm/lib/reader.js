export function createReaderFactory({
  module,
  constants,
  normalizeBytes,
  withString,
  textStringValue,
  allocatePdfPath,
  removeFile,
}) {
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

    function requireReader() {
      if (requireOwner) requireOwner();
      if (ended || !reader) throw new Error("PDF reader has ended");
    }

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

    function objectStringBytes(bytes) {
      return new TextDecoder().decode(bytes);
    }

    function wrapObject(handle, parser) {
      if (!handle) return undefined;
      var object = {
        _handle: handle,
        _readerOwner: readerOwner,
        _copyingContext: copyingContext,
        getType: function () {
          requireReader();
          if (parser && parser.ended)
            throw new Error("PDF object parser has ended");
          return module._muhammara_wasm_object_get_type(handle);
        },
        toString: function () {
          object.getType();
          return objectString(handle);
        },
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
        toPDFArray: function () {
          return object.getType() === constants.ePDFObjectArray
            ? object
            : undefined;
        },
        toPDFDictionary: function () {
          return object.getType() === constants.ePDFObjectDictionary
            ? object
            : undefined;
        },
        toPDFStream: function () {
          return object.getType() === constants.ePDFObjectStream
            ? object
            : undefined;
        },
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
        object[`toPDF${name}`] = function () {
          return object.getType() === constants[`ePDFObject${name}`]
            ? object
            : undefined;
        };
      });
      Object.defineProperty(object, "value", {
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
        object.getLength = function () {
          object.getType();
          requireReader();
          return module._muhammara_wasm_object_array_length(handle);
        };
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
        object.toJSArray = function () {
          return Array.from({ length: object.getLength() }, (_, index) =>
            object.queryObject(index),
          );
        };
      }
      if (object.getType() === constants.ePDFObjectDictionary) {
        object.exists = function (key) {
          object.getType();
          return typeof key === "string" && objectKeys(handle).includes(key);
        };
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
        object.toJSObject = function () {
          object.getType();
          return Object.fromEntries(
            objectKeys(handle).map((key) => [key, object.queryObject(key)]),
          );
        };
      }
      if (object.getType() === constants.ePDFObjectStream) {
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
        object.getStreamContentStart = function () {
          object.getType();
          requireReader();
          return module._muhammara_wasm_object_stream_content_start(handle);
        };
      }
      if (object.getType() === constants.ePDFObjectIndirectObjectReference) {
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
        object.toText = function () {
          return textStringValue(object.toBytesArray());
        };
      }
      return object;
    }

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

    function wrapByteReader(handle, positioned) {
      var byteReader = {
        read: function (amount) {
          requireReader();
          if (!Number.isInteger(amount) || amount < 0 || amount > 0x7fffffff) {
            throw new RangeError("read requires a non-negative integer");
          }
          if (amount === 0) return [];
          var bytesPointer = module._malloc(amount);
          try {
            var length = module._muhammara_wasm_byte_reader_read(
              handle,
              bytesPointer,
              amount,
            );
            if (length < 0) throw new Error("Unable to read PDF stream");
            return Array.from(
              module.HEAPU8.slice(bytesPointer, bytesPointer + length),
            );
          } finally {
            module._free(bytesPointer);
          }
        },
        notEnded: function () {
          requireReader();
          return Boolean(module._muhammara_wasm_byte_reader_not_ended(handle));
        },
      };
      if (positioned) {
        function requirePosition(value, label) {
          if (!Number.isSafeInteger(value) || value < 0) {
            throw new RangeError(`${label} requires a non-negative integer`);
          }
        }
        byteReader.setPosition = function (position) {
          requireReader();
          requirePosition(position, "setPosition");
          if (
            !module._muhammara_wasm_byte_reader_set_position(handle, position)
          ) {
            throw new Error("Unable to set parser stream position");
          }
          return byteReader;
        };
        byteReader.setPositionFromEnd = function (position) {
          requireReader();
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
        byteReader.skip = function (amount) {
          requireReader();
          requirePosition(amount, "skip");
          if (!module._muhammara_wasm_byte_reader_skip(handle, amount)) {
            throw new Error("Unable to skip parser stream bytes");
          }
          return byteReader;
        };
        byteReader.getCurrentPosition = function () {
          requireReader();
          var position =
            module._muhammara_wasm_byte_reader_get_current_position(handle);
          if (position < 0)
            throw new Error("Unable to read parser stream position");
          return position;
        };
      }
      return byteReader;
    }

    // Node creates a one-byte V8 string for extracted PDF content. Avoid UTF-8
    // decoding here so every raw PDF byte remains the same JS code unit.
    function oneByteString(bytes) {
      var result = "";
      for (var offset = 0; offset < bytes.length; offset += 0x8000) {
        result += String.fromCharCode(
          ...bytes.subarray(offset, offset + 0x8000),
        );
      }
      return result;
    }

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
      getPagesCount: function () {
        requireReader();
        return module._muhammara_wasm_reader_get_pages_count(reader);
      },
      getPageObjectID: function (index) {
        requireReader();
        var id = module._muhammara_wasm_reader_get_page_object_id(
          reader,
          index,
        );
        if (!id) {
          throw new RangeError(`Unable to read page ${index}`);
        }
        return id;
      },
      getPDFLevel: function () {
        requireReader();
        return module._muhammara_wasm_reader_get_pdf_level(reader);
      },
      getObjectsCount: function () {
        requireReader();
        return module._muhammara_wasm_reader_get_objects_count(reader);
      },
      isEncrypted: function () {
        requireReader();
        return Boolean(module._muhammara_wasm_reader_is_encrypted(reader));
      },
      getXrefSize: function () {
        requireReader();
        return module._muhammara_wasm_reader_get_xref_size(reader);
      },
      getXrefPosition: function () {
        requireReader();
        return module._muhammara_wasm_reader_get_xref_position(reader);
      },
      getXrefEntry: function (objectId) {
        requireReader();
        var valuesPointer = module._malloc(24);
        try {
          if (
            !module._muhammara_wasm_reader_get_xref_entry(
              reader,
              objectId,
              valuesPointer,
            )
          ) {
            return null;
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
      getTrailer: function () {
        requireReader();
        return wrapObject(module._muhammara_wasm_reader_get_trailer(reader));
      },
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
      parseNewObject: function (objectId) {
        requireReader();
        if (!Number.isInteger(objectId) || objectId < 0) {
          throw new TypeError("Object ID must be a non-negative integer");
        }
        var object = wrapObject(
          module._muhammara_wasm_reader_parse_object(reader, objectId),
        );
        if (!object) throw new Error("Unable to read object");
        return object;
      },
      parsePageDictionary: function (index) {
        requireReader();
        if (!Number.isInteger(index) || index < 0) {
          throw new TypeError("Page index must be a non-negative integer");
        }
        var object = wrapObject(
          module._muhammara_wasm_reader_parse_page_dictionary(reader, index),
        );
        if (!object) throw new RangeError(`Unable to read page ${index}`);
        return object;
      },
      parsePage: function (index) {
        requireReader();
        if (!Number.isInteger(index) || index < 0) {
          throw new TypeError("Page index must be a non-negative integer");
        }
        var page = module._muhammara_wasm_reader_parse_page(reader, index);
        if (!page) throw new RangeError(`Unable to read page ${index}`);

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
          getDictionary: function () {
            requireReader();
            var dictionary = wrapObject(
              module._muhammara_wasm_page_input_get_dictionary(page),
            );
            if (!dictionary) throw new Error("Unable to read page dictionary");
            return dictionary;
          },
          getMediaBox: function () {
            return getBox(0);
          },
          getCropBox: function () {
            return getBox(1);
          },
          getTrimBox: function () {
            return getBox(2);
          },
          getBleedBox: function () {
            return getBox(3);
          },
          getArtBox: function () {
            return getBox(4);
          },
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
      extractPageText: function (index, limits = {}) {
        requireReader();
        if (!Number.isInteger(index) || index < 0) {
          throw new TypeError("Page index must be a non-negative integer");
        }
        if (!limits || typeof limits !== "object" || Array.isArray(limits)) {
          throw new TypeError("Text extraction limits must be an object");
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
          parseNewObject: function () {
            requireReader();
            if (parser.ended) throw new Error("PDF object parser has ended");
            return wrapObject(
              module._muhammara_wasm_object_parser_parse(handle),
              parser,
            );
          },
          end: function () {
            parser.ended = true;
          },
        };
      },
      startReadingFromStream: function (stream) {
        return startReadingFromStream(stream, false);
      },
      startReadingFromStreamForPlainCopying: function (stream) {
        return startReadingFromStream(stream, true);
      },
      getParserStream: function () {
        requireReader();
        var handle = module._muhammara_wasm_reader_get_parser_stream(reader);
        if (!handle) throw new Error("Unable to get PDF parser stream");
        return wrapByteReader(handle, true);
      },
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
          parseNewObject: function () {
            requireReader();
            if (parser.ended) throw new Error("PDF object parser has ended");
            return wrapObject(
              module._muhammara_wasm_object_parser_parse(handle),
              parser,
            );
          },
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
      getPageBox: function (index, box = "media") {
        requireReader();
        var boxIndexes = { media: 0, crop: 1, trim: 2, bleed: 3, art: 4 };
        if (!(box in boxIndexes)) {
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
        reader = 0;
        ended = true;
      },
    };
  }

  return createReader;
}
