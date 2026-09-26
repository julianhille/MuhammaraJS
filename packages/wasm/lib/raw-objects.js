/** Creates a low-level context for writing raw PDF objects. */
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
        /**
         * Writes a dictionary key; follow it with one value.
         * @param {string} key - Key name without the leading slash.
         * @returns {this} The dictionary context.
         * @throws {TypeError} If `key` is not a string.
         * @throws {Error} If the writer has ended or the dictionary is no longer active.
         */
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
        /**
         * Writes a name value.
         * @param {string} value - Name without the leading slash.
         * @returns {this} The dictionary context.
         * @throws {TypeError} If `value` is not a string.
         * @throws {Error} If the writer has ended or the dictionary is no longer active.
         */
        writeNameValue: function (value) {
          if (typeof value !== "string")
            throw new TypeError("Name value must be a string");
          writeValue(0, value);
          return this;
        },
        /**
         * Writes a literal string value.
         * @param {string|Uint8Array|ArrayBuffer} value - Text, or raw string bytes.
         * @returns {this} The dictionary context.
         * @throws {TypeError} If `value` is neither a string nor bytes.
         * @throws {Error} If the writer has ended or the dictionary is no longer active.
         */
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
        /**
         * Writes a hexadecimal string value.
         * @param {string|Uint8Array|ArrayBuffer} value - Text, or raw string bytes.
         * @returns {this} The dictionary context.
         * @throws {TypeError} If `value` is neither a string nor bytes.
         * @throws {Error} If the writer has ended or the dictionary is no longer active.
         */
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
        /**
         * Writes a number value.
         * @param {number} value - Finite number.
         * @returns {this} The dictionary context.
         * @throws {TypeError} If `value` is not finite.
         * @throws {Error} If the writer has ended or the dictionary is no longer active.
         */
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
        /**
         * Writes a boolean value.
         * @param {boolean} value - Value to write.
         * @returns {this} The dictionary context.
         * @throws {TypeError} If `value` is not a boolean.
         * @throws {Error} If the writer has ended or the dictionary is no longer active.
         */
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
        /**
         * Writes an indirect object reference value with generation 0.
         * @param {number} objectId - Positive object ID.
         * @returns {this} The dictionary context.
         * @throws {RangeError} If `objectId` is not a positive integer.
         * @throws {Error} If the writer has ended or the dictionary is no longer active.
         */
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
        /**
         * Writes a null value.
         * @returns {this} The dictionary context.
         * @throws {Error} If the writer has ended or the dictionary is no longer active.
         */
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
        /**
         * Writes a rectangle array value.
         * @param {...(number|PDFRectangle)} values - Left, bottom, right, and top, or one array of them.
         * @returns {this} The dictionary context.
         * @throws {TypeError} If there are not four finite coordinates.
         * @throws {Error} If the writer has ended or the dictionary is no longer active.
         */
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
        /**
         * Opens a writer for the stream's content.
         * @returns {ByteWriteStream} A writer that fails once the stream has ended.
         * @throws {Error} If the writer has ended, the stream is not active, or no writer is available.
         */
        getWriteStream: function () {
          requireContext();
          if (activeStream !== stream)
            throw new Error("PDF stream is no longer active");
          var writer =
            module._muhammara_wasm_pdf_stream_get_write_stream(stream);
          if (!writer) throw new Error("Unable to get PDF stream writer");
          return {
            /**
             * Appends bytes to the stream content.
             * @param {Uint8Array|ArrayBuffer|PDFRStreamForBuffer} bytes - Bytes to write.
             * @returns {number} Number of bytes written.
             * @throws {TypeError} If `bytes` is not a supported byte source.
             * @throws {Error} If the stream is no longer active.
             */
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
      /**
       * Reserves an object ID for a later `startNewIndirectObject(id)`.
       * @returns {number} The new object ID.
       * @throws {Error} If the writer has ended or no ID can be allocated.
       */
      allocateNewObjectID: function () {
        requireContext();
        var objectId =
          module._muhammara_wasm_objects_allocate_new_object_id(handle);
        if (!objectId) throw new Error("Unable to allocate object ID");
        return objectId;
      },
      /**
       * Starts an indirect object, with a new or a previously allocated ID.
       * @param {number} [objectId] - ID from `allocateNewObjectID()`.
       * @returns {number|this} The new object ID when `objectId` is omitted; otherwise the context.
       * @throws {RangeError} If `objectId` is not a positive integer.
       * @throws {Error} If the writer has ended or the object cannot be started.
       */
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
      /**
       * Ends the current indirect object; after `endPDFStream()` it only resets state.
       * @returns {this} The objects context.
       * @throws {Error} If the writer has ended or no object is open.
       */
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
      /**
       * Starts a replacement for an existing object of a modified PDF.
       * @param {number} objectId - ID of the object to replace.
       * @returns {this} The objects context.
       * @throws {RangeError} If `objectId` is not a positive integer.
       * @throws {Error} If the writer has ended or the object cannot be replaced.
       */
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
      /**
       * Marks an object of a modified PDF as deleted.
       * @param {number} objectId - ID of the object to delete.
       * @returns {this} The objects context.
       * @throws {RangeError} If `objectId` is not positive or cannot be deleted.
       * @throws {Error} If the writer has ended.
       */
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
      /**
       * Starts a dictionary; only this dictionary accepts keys until it ends.
       * @returns {DictionaryContext} The active dictionary.
       * @throws {Error} If the writer has ended or the dictionary cannot be started.
       */
      startDictionary: function () {
        requireContext();
        var dictionary =
          module._muhammara_wasm_objects_start_dictionary(handle);
        if (!dictionary) throw new Error("Unable to start dictionary");
        activeDictionary = dictionary;
        return dictionaryContext(dictionary);
      },
      /**
       * Ends the active dictionary.
       * @param {DictionaryContext} dictionary - The dictionary from `startDictionary()`.
       * @returns {this} The objects context.
       * @throws {Error} If the writer has ended or `dictionary` is not the active one.
       */
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
      /**
       * Starts an array; write its items, then call `endArray()`.
       * @returns {this} The objects context.
       * @throws {Error} If the writer has ended or the array cannot be started.
       */
      startArray: function () {
        requireContext();
        if (!module._muhammara_wasm_objects_start_array(handle))
          throw new Error("Unable to start array");
        return this;
      },
      /**
       * Ends the current array.
       * @param {ETokenSeparator} [separator=eTokenSeparatorNone] - Token written after `]`.
       * @returns {this} The objects context.
       * @throws {Error} If the writer has ended, the separator is not an `eTokenSeparator*` constant, or no array is open.
       */
      endArray: function (separator = constants.eTokenSeparatorNone) {
        requireContext();
        if (
          ![
            constants.eTokenSeparatorSpace,
            constants.eTokenSeparatorEndLine,
            constants.eTokenSeparatorNone,
          ].includes(separator) ||
          !module._muhammara_wasm_objects_end_array(handle, separator)
        ) {
          throw new Error("Unable to end array");
        }
        return this;
      },
      /**
       * Writes a number token, as an integer when `value` is whole.
       * @param {number} value - Finite number.
       * @returns {this} The objects context.
       * @throws {TypeError} If `value` is not finite or cannot be written.
       * @throws {Error} If the writer has ended.
       */
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
      /**
       * Writes an `id generation R` reference.
       * @param {number} objectId - Positive object ID.
       * @param {number} [generation=0] - Non-negative generation number.
       * @returns {this} The objects context.
       * @throws {RangeError} If the ID or generation is invalid.
       * @throws {Error} If the writer has ended.
       */
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
      /**
       * Writes a boolean token.
       * @param {boolean} value - Value to write.
       * @returns {this} The objects context.
       * @throws {TypeError} If `value` is not a boolean.
       * @throws {Error} If the writer has ended.
       */
      writeBoolean: function (value) {
        requireContext();
        if (typeof value !== "boolean")
          throw new TypeError("Value must be boolean");
        module._muhammara_wasm_objects_write_boolean(handle, value);
        return this;
      },
      /**
       * Writes a name token.
       * @param {string} value - Name without the leading slash.
       * @returns {this} The objects context.
       * @throws {TypeError} If `value` is not a string.
       * @throws {Error} If the writer has ended or writing fails.
       */
      writeName: function (value) {
        writeObjectString(0, value);
        return this;
      },
      /**
       * Writes a literal string token.
       * @param {string|Uint8Array|ArrayBuffer} value - Text, or raw string bytes.
       * @returns {this} The objects context.
       * @throws {TypeError} If `value` is neither a string nor bytes.
       * @throws {Error} If the writer has ended or writing fails.
       */
      writeLiteralString: function (value) {
        writeObjectString(1, value);
        return this;
      },
      /**
       * Writes a hexadecimal string token.
       * @param {string|Uint8Array|ArrayBuffer} value - Text, or raw string bytes.
       * @returns {this} The objects context.
       * @throws {TypeError} If `value` is neither a string nor bytes.
       * @throws {Error} If the writer has ended or writing fails.
       */
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
