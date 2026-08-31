export function createRawObjectsContext({
  module,
  constants,
  normalizeBytes,
  withString,
  withBytes,
}) {
  function rawObjectsContext(handle, requireOpen) {
    var activeDictionary = null;
    var activeStream = null;
    var activeFreeWriter = null;
    var activeIndirectObject = false;
    var indirectObjectClosedByStream = false;

    function requireContext() {
      requireOpen();
    }

    function writeBytes(writer, bytes) {
      bytes = normalizeBytes(bytes, "ByteWriter input");
      return withBytes(bytes, (pointer) => {
        var written = module._muhammara_wasm_byte_writer_write(
          writer,
          pointer,
          bytes.length,
        );
        if (written < 0) throw new Error("Byte writer is no longer active");
        return written;
      });
    }

    function writeObjectString(type, value) {
      requireContext();
      if (value instanceof Uint8Array || value instanceof ArrayBuffer) {
        if (type !== 1 && type !== 2) {
          throw new TypeError("Only literal and hex strings accept bytes");
        }
        var bytes = normalizeBytes(value);
        return withBytes(bytes, (pointer) => {
          if (
            !module._muhammara_wasm_objects_write_bytes(
              handle,
              type,
              pointer,
              bytes.length,
            )
          ) {
            throw new Error("Unable to write PDF object bytes");
          }
        });
      }
      if (typeof value !== "string")
        throw new TypeError("Value must be a string or bytes");
      return withString(value, (pointer) => {
        if (
          !module._muhammara_wasm_objects_write_string(handle, type, pointer)
        ) {
          throw new Error("Unable to write PDF object string");
        }
      });
    }

    function dictionaryContext(dictionary) {
      function requireDictionary() {
        requireContext();
        if (activeDictionary !== dictionary) {
          throw new Error("Dictionary context is no longer active");
        }
      }
      function writeValue(type, value) {
        requireDictionary();
        if (value instanceof Uint8Array || value instanceof ArrayBuffer) {
          return withBytes(normalizeBytes(value), (pointer) => {
            if (
              !module._muhammara_wasm_dictionary_write_bytes(
                dictionary,
                type,
                pointer,
                value.byteLength,
              )
            ) {
              throw new Error("Unable to write dictionary value");
            }
          });
        }
        return withString(String(value), (pointer) => {
          if (
            !module._muhammara_wasm_dictionary_write_value(
              dictionary,
              type,
              pointer,
              0,
              0,
              0,
            )
          ) {
            throw new Error("Unable to write dictionary value");
          }
        });
      }
      return {
        _handle: dictionary,
        writeKey: function (key) {
          requireDictionary();
          if (typeof key !== "string")
            throw new TypeError("Dictionary key must be a string");
          withString(key, (pointer) => {
            if (
              !module._muhammara_wasm_dictionary_write_key(dictionary, pointer)
            ) {
              throw new Error("Unable to write dictionary key");
            }
          });
          return this;
        },
        writeNameValue: function (value) {
          if (typeof value !== "string")
            throw new TypeError("Name value must be a string");
          writeValue(0, value);
          return this;
        },
        writeLiteralStringValue: function (value) {
          if (
            typeof value !== "string" &&
            !(value instanceof Uint8Array) &&
            !(value instanceof ArrayBuffer)
          ) {
            throw new TypeError(
              "Literal string value must be a string or bytes",
            );
          }
          writeValue(1, value);
          return this;
        },
        writeHexStringValue: function (value) {
          if (
            typeof value !== "string" &&
            !(value instanceof Uint8Array) &&
            !(value instanceof ArrayBuffer)
          ) {
            throw new TypeError("Hex string value must be a string or bytes");
          }
          writeValue(2, value);
          return this;
        },
        writeNumberValue: function (value) {
          requireDictionary();
          if (!Number.isFinite(value))
            throw new TypeError("Number must be finite");
          if (
            !module._muhammara_wasm_dictionary_write_value(
              dictionary,
              3,
              0,
              value,
              0,
              0,
            )
          ) {
            throw new Error("Unable to write dictionary number");
          }
          return this;
        },
        writeBooleanValue: function (value) {
          requireDictionary();
          if (typeof value !== "boolean")
            throw new TypeError("Value must be boolean");
          if (
            !module._muhammara_wasm_dictionary_write_value(
              dictionary,
              4,
              0,
              0,
              0,
              value,
            )
          ) {
            throw new Error("Unable to write dictionary boolean");
          }
          return this;
        },
        writeObjectReferenceValue: function (objectId) {
          requireDictionary();
          if (!Number.isInteger(objectId) || objectId <= 0)
            throw new RangeError("Object ID must be positive");
          if (
            !module._muhammara_wasm_dictionary_write_value(
              dictionary,
              5,
              0,
              0,
              objectId,
              0,
            )
          ) {
            throw new Error("Unable to write dictionary reference");
          }
          return this;
        },
        writeNullValue: function () {
          requireDictionary();
          if (
            !module._muhammara_wasm_dictionary_write_value(
              dictionary,
              6,
              0,
              0,
              0,
              0,
            )
          ) {
            throw new Error("Unable to write dictionary null");
          }
          return this;
        },
        writeRectangleValue: function (...values) {
          requireDictionary();
          if (values.length === 1) values = values[0];
          if (
            !Array.isArray(values) ||
            values.length !== 4 ||
            !values.every(Number.isFinite)
          ) {
            throw new TypeError("Rectangle requires four finite coordinates");
          }
          if (
            !module._muhammara_wasm_dictionary_write_rectangle(
              dictionary,
              ...values,
            )
          ) {
            throw new Error("Unable to write dictionary rectangle");
          }
          return this;
        },
      };
    }

    function streamContext(stream) {
      var result = {
        _handle: stream,
        getWriteStream: function () {
          requireContext();
          if (activeStream !== stream)
            throw new Error("PDF stream is no longer active");
          var writer =
            module._muhammara_wasm_pdf_stream_get_write_stream(stream);
          if (!writer) throw new Error("Unable to get PDF stream writer");
          return {
            write: (bytes) => {
              if (activeStream !== stream)
                throw new Error("PDF stream is no longer active");
              return writeBytes(writer, bytes);
            },
          };
        },
      };
      return result;
    }

    return {
      _hasActive: function () {
        return (
          activeDictionary !== null ||
          activeStream !== null ||
          activeFreeWriter !== null ||
          activeIndirectObject
        );
      },
      allocateNewObjectID: function () {
        requireContext();
        var objectId =
          module._muhammara_wasm_objects_allocate_new_object_id(handle);
        if (!objectId) throw new Error("Unable to allocate object ID");
        return objectId;
      },
      startNewIndirectObject: function (objectId) {
        requireContext();
        if (
          objectId !== undefined &&
          (!Number.isInteger(objectId) || objectId <= 0)
        ) {
          throw new RangeError("Object ID must be positive");
        }
        var id = module._muhammara_wasm_objects_start_indirect_object(
          handle,
          objectId || 0,
        );
        if (!id) throw new Error("Unable to start indirect object");
        activeIndirectObject = true;
        indirectObjectClosedByStream = false;
        return objectId === undefined ? id : this;
      },
      endIndirectObject: function () {
        requireContext();
        if (indirectObjectClosedByStream) {
          indirectObjectClosedByStream = false;
          return this;
        }
        if (!module._muhammara_wasm_objects_end_indirect_object(handle)) {
          throw new Error("Unable to end indirect object");
        }
        activeIndirectObject = false;
        return this;
      },
      startModifiedIndirectObject: function (objectId) {
        requireContext();
        if (!Number.isInteger(objectId) || objectId <= 0) {
          throw new RangeError("Object ID must be positive");
        }
        if (
          !module._muhammara_wasm_objects_start_modified_indirect_object(
            handle,
            objectId,
          )
        ) {
          throw new Error("Unable to start modified indirect object");
        }
        activeIndirectObject = true;
        indirectObjectClosedByStream = false;
        return this;
      },
      deleteObject: function (objectId) {
        requireContext();
        if (
          !Number.isInteger(objectId) ||
          objectId <= 0 ||
          !module._muhammara_wasm_objects_delete_object(handle, objectId)
        ) {
          throw new RangeError("Object ID must be positive");
        }
        return this;
      },
      startDictionary: function () {
        requireContext();
        var dictionary =
          module._muhammara_wasm_objects_start_dictionary(handle);
        if (!dictionary) throw new Error("Unable to start dictionary");
        activeDictionary = dictionary;
        return dictionaryContext(dictionary);
      },
      endDictionary: function (dictionary) {
        requireContext();
        if (
          !dictionary ||
          activeDictionary !== dictionary._handle ||
          !module._muhammara_wasm_objects_end_dictionary(
            handle,
            activeDictionary,
          )
        ) {
          throw new Error("Inconsistent ending of dictionary");
        }
        activeDictionary = null;
        return this;
      },
      startArray: function () {
        requireContext();
        if (!module._muhammara_wasm_objects_start_array(handle))
          throw new Error("Unable to start array");
        return this;
      },
      endArray: function (separator = constants.eTokenSeparatorNone) {
        requireContext();
        if (
          !Number.isInteger(separator) ||
          separator < 0 ||
          separator > 2 ||
          !module._muhammara_wasm_objects_end_array(handle, separator)
        ) {
          throw new Error("Unable to end array");
        }
        return this;
      },
      writeNumber: function (value) {
        requireContext();
        if (
          !Number.isFinite(value) ||
          !module._muhammara_wasm_objects_write_number(
            handle,
            value,
            Number.isInteger(value),
          )
        ) {
          throw new TypeError("Number must be finite");
        }
        return this;
      },
      writeIndirectObjectReference: function (objectId, generation = 0) {
        requireContext();
        if (
          !Number.isInteger(objectId) ||
          objectId <= 0 ||
          !Number.isInteger(generation) ||
          generation < 0 ||
          !module._muhammara_wasm_objects_write_reference(
            handle,
            objectId,
            generation,
          )
        ) {
          throw new RangeError("Object ID and generation must be valid");
        }
        return this;
      },
      writeBoolean: function (value) {
        requireContext();
        if (typeof value !== "boolean")
          throw new TypeError("Value must be boolean");
        module._muhammara_wasm_objects_write_boolean(handle, value);
        return this;
      },
      writeName: function (value) {
        writeObjectString(0, value);
        return this;
      },
      writeLiteralString: function (value) {
        writeObjectString(1, value);
        return this;
      },
      writeHexString: function (value) {
        writeObjectString(2, value);
        return this;
      },
      writeKeyword: function (value) {
        writeObjectString(3, value);
        return this;
      },
      writeComment: function (value) {
        writeObjectString(4, value);
        return this;
      },
      endLine: function () {
        requireContext();
        module._muhammara_wasm_objects_end_line(handle);
        return this;
      },
      setCompressStreams: function (value) {
        requireContext();
        if (
          typeof value !== "boolean" ||
          !module._muhammara_wasm_objects_set_compress_streams(handle, value)
        ) {
          throw new TypeError("Compression must be boolean");
        }
        return this;
      },
      startPDFStream: function (dictionary) {
        requireContext();
        if (
          dictionary !== undefined &&
          activeDictionary !== dictionary._handle
        ) {
          throw new TypeError("Provide the active dictionary context");
        }
        var stream = module._muhammara_wasm_objects_start_pdf_stream(
          handle,
          dictionary?._handle || 0,
          0,
        );
        if (!stream) throw new Error("Unable to start PDF stream");
        activeDictionary = null;
        activeStream = stream;
        return streamContext(stream);
      },
      startUnfilteredPDFStream: function (dictionary) {
        requireContext();
        if (
          dictionary !== undefined &&
          activeDictionary !== dictionary._handle
        ) {
          throw new TypeError("Provide the active dictionary context");
        }
        var stream = module._muhammara_wasm_objects_start_pdf_stream(
          handle,
          dictionary?._handle || 0,
          1,
        );
        if (!stream) throw new Error("Unable to start unfiltered PDF stream");
        activeDictionary = null;
        activeStream = stream;
        return streamContext(stream);
      },
      endPDFStream: function (stream) {
        requireContext();
        if (
          !stream ||
          activeStream !== stream._handle ||
          !module._muhammara_wasm_objects_end_pdf_stream(handle, activeStream)
        ) {
          throw new Error("Unable to end PDF stream");
        }
        activeStream = null;
        activeIndirectObject = false;
        indirectObjectClosedByStream = true;
        return this;
      },
      startFreeContext: function () {
        requireContext();
        var writer = module._muhammara_wasm_objects_start_free_context(handle);
        if (!writer) throw new Error("Unable to start free context");
        activeFreeWriter = writer;
        return {
          write: (bytes) => {
            if (activeFreeWriter !== writer)
              throw new Error("Free context is no longer active");
            return writeBytes(writer, bytes);
          },
          getCurrentPosition: function () {
            if (activeFreeWriter !== writer)
              throw new Error("Free context is no longer active");
            return module._muhammara_wasm_objects_get_current_position(handle);
          },
        };
      },
      endFreeContext: function () {
        requireContext();
        if (!module._muhammara_wasm_objects_end_free_context(handle)) {
          throw new Error("Unable to end free context");
        }
        activeFreeWriter = null;
        return this;
      },
    };
  }
  return rawObjectsContext;
}
