import { normalizeBytes } from "./bytes.js";
import { TextEncoding } from "./value-sets.js";
import { isPageBoxType } from "./constants.js";

/**
 * Creates memory-safe utility functions around a loaded Wasm module and makes
 * `module._malloc` throw instead of returning a null pointer.
 * @param {object} module - Emscripten module.
 * @returns {object} String, byte, and operator helpers shared by writers, modifiers, and readers.
 */
export function createHelpers(module) {
  var nativeMalloc = module._malloc.bind(module);
  /**
   * Allocates Wasm memory.
   * @param {number} size - Positive byte count.
   * @returns {number} The pointer.
   * @throws {RangeError} If `size` is not a positive safe integer.
   * @throws {Error} If memory cannot be allocated.
   */
  module._malloc = function (size) {
    if (!Number.isSafeInteger(size) || size <= 0) {
      throw new RangeError("WebAssembly allocation size must be positive");
    }
    var pointer = nativeMalloc(size);
    if (!pointer) throw new Error("Unable to allocate WebAssembly memory");
    return pointer;
  };
  var encoder = new TextEncoder();
  /**
   * Deletes a virtual file; a missing file is ignored.
   * @param {string} [path] - Virtual file system path.
   * @returns {void}
   * @throws {Error} If an existing file cannot be removed.
   */
  function removeFile(path) {
    if (!path) return;
    try {
      module.FS.unlink(path);
    } catch (error) {
      if (module.FS.analyzePath(path).exists) throw error;
    }
  }
  /**
   * Runs a callback with a NUL-terminated UTF-8 copy of a string in Wasm memory.
   * @param {string} value - Text to copy.
   * @param {function(number, number): *} callback - Receives the pointer and the byte length without the terminator.
   * @returns {*} The callback result; the copy is freed afterwards.
   */
  function withString(value, callback) {
    var bytes = encoder.encode(value);
    var pointer = module._malloc(bytes.length + 1);
    module.HEAPU8.set(bytes, pointer);
    module.HEAPU8[pointer + bytes.length] = 0;
    try {
      return callback(pointer, bytes.length);
    } finally {
      module._free(pointer);
    }
  }

  /**
   * Runs a callback with a copy of bytes in Wasm memory.
   * @param {Uint8Array} bytes - Bytes to copy.
   * @param {function(number): *} callback - Receives the pointer.
   * @returns {*} The callback result; the copy is freed afterwards.
   */
  function withBytes(bytes, callback) {
    var pointer = module._malloc(Math.max(bytes.length, 1));
    module.HEAPU8.set(bytes, pointer);
    try {
      return callback(pointer);
    } finally {
      module._free(pointer);
    }
  }

  /**
   * Writes normalized bytes through a native byte writer.
   * @param {object} module - Emscripten module.
   * @param {function(number, number): number} write - Native write; negative when the writer is gone.
   * @param {ByteSource} bytes - Bytes to write.
   * @param {string} [label="ByteWriter input"] - Name used in byte errors.
   * @returns {number} The number of bytes written.
   * @throws {TypeError} If `bytes` is not a supported byte source.
   * @throws {Error} If the writer is no longer active.
   */
  function writeNativeBytes(module, write, bytes, label = "ByteWriter input") {
    bytes = normalizeBytes(bytes, label);
    return withBytes(bytes, (pointer) => {
      var written = write(pointer, bytes.length);
      if (written < 0) throw new Error("Byte writer is no longer active");
      return written;
    });
  }

  /**
   * Writes raw content-stream code for a context's `writeFreeCode()`.
   * @param {object} context - Content context to return.
   * @param {function(): void} requireContext - Throws when the context is inactive.
   * @param {function(number, number): boolean} write - Writes UTF-8 bytes at a pointer and length.
   * @param {string} freeCode - Operators to write verbatim.
   * @returns {object} `context`.
   * @throws {TypeError} If `freeCode` is not a string.
   * @throws {Error} If the context is inactive or writing fails.
   */
  function writeFreeCode(context, requireContext, write, freeCode) {
    requireContext();
    if (typeof freeCode !== "string") {
      throw new TypeError("writeFreeCode requires a string");
    }
    return withString(freeCode, (pointer, length) => {
      if (!write(pointer, length)) throw new Error("Unable to write free code");
      return context;
    });
  }

  /**
   * Installs the color space, graphics state, and rendering operators on a content context.
   * @param {object} context - Content context to extend.
   * @param {function(): void} requireContext - Throws when the context is inactive.
   * @param {Function} call - Native call taking `(code, namePointer, componentsPointer, count, hasPattern)`.
   * @returns {void}
   */
  function addStructuredContentOperators(context, requireContext, call) {
    /**
     * Applies an operator whose operand is a resource name.
     * @param {string} name - Operator name for error messages.
     * @param {number} code - Native operator code.
     * @param {string} value - Resource name.
     * @returns {object} The content context.
     * @throws {TypeError} If `value` is not a string.
     * @throws {Error} If the content context is no longer active or the operator fails.
     */
    function nameOperator(name, code, value) {
      requireContext();
      if (typeof value !== "string") {
        throw new TypeError(`${name} requires a string name`);
      }
      return withString(value, (pointer) => {
        if (!call(code, pointer, 0, 0, 0)) {
          throw new Error(`Unable to apply ${name}`);
        }
        return context;
      });
    }

    /**
     * Applies an operator whose operands are color components and an optional pattern.
     * @param {string} name - Operator name for error messages.
     * @param {number} code - Native operator code.
     * @param {number[]} values - Components.
     * @param {string} [pattern] - Pattern resource name.
     * @returns {object} The content context.
     * @throws {TypeError} If a component is not finite.
     * @throws {Error} If the content context is no longer active or the operator fails.
     */
    function componentOperator(name, code, values, pattern) {
      requireContext();
      if (!values.every(Number.isFinite)) {
        throw new TypeError(`${name} requires finite numeric components`);
      }
      return withDoubles(values, (components) =>
        withString(pattern || "", (namePointer) => {
          if (
            !call(
              code,
              namePointer,
              components,
              values.length,
              pattern !== undefined ? 1 : 0,
            )
          ) {
            throw new Error(`Unable to apply ${name}`);
          }
          return context;
        }),
      );
    }

    /**
     * Reads `SCN`/`scn` arguments: components, or one component array, then an optional pattern name.
     * @param {string} name - Operator name for error messages.
     * @param {number} code - Native operator code.
     * @param {Array} args - Call arguments; a trailing string is removed as the pattern.
     * @returns {object} The content context.
     * @throws {TypeError} If no finite components are given or the array form has extra arguments.
     * @throws {Error} If the content context is no longer active or the operator fails.
     */
    function patternComponents(name, code, args) {
      var pattern = typeof args.at(-1) === "string" ? args.pop() : undefined;
      var values = Array.isArray(args[0]) ? args[0] : args;
      if (
        args.length === 0 ||
        (Array.isArray(args[0]) && args.length !== 1) ||
        !Array.isArray(values) ||
        !values.every(Number.isFinite)
      ) {
        throw new TypeError(
          `${name} requires numeric components and an optional pattern name`,
        );
      }
      return componentOperator(name, code, values, pattern);
    }

    /**
     * Sets the color rendering intent (`ri`).
     * @param {string} name - Intent, such as `Perceptual`.
     * @returns {this} The content context, for chaining.
     * @throws {TypeError} If `name` is not a string.
     * @throws {Error} If the content context is no longer active or the operator fails.
     */
    context.ri = function (name) {
      return nameOperator("ri", 0, name);
    };
    /**
     * Sets the flatness tolerance (`i`).
     * @param {number} flatness - Tolerance from 0 to 100.
     * @returns {this} The content context, for chaining.
     * @throws {TypeError} If `flatness` is not finite.
     * @throws {Error} If the content context is no longer active or the operator fails.
     */
    context.i = function (flatness) {
      return componentOperator("i", 1, [flatness]);
    };
    /**
     * Applies a named graphics state (`gs`).
     * @param {string} name - ExtGState resource name.
     * @returns {this} The content context, for chaining.
     * @throws {TypeError} If `name` is not a string.
     * @throws {Error} If the content context is no longer active or the operator fails.
     */
    context.gs = function (name) {
      return nameOperator("gs", 2, name);
    };
    /**
     * Sets the stroking color space (`CS`).
     * @param {string} name - Color space name or resource.
     * @returns {this} The content context, for chaining.
     * @throws {TypeError} If `name` is not a string.
     * @throws {Error} If the content context is no longer active or the operator fails.
     */
    context.CS = function (name) {
      return nameOperator("CS", 3, name);
    };
    /**
     * Sets the nonstroking color space (`cs`).
     * @param {string} name - Color space name or resource.
     * @returns {this} The content context, for chaining.
     * @throws {TypeError} If `name` is not a string.
     * @throws {Error} If the content context is no longer active or the operator fails.
     */
    context.cs = function (name) {
      return nameOperator("cs", 4, name);
    };
    /**
     * Sets the stroking color in the current color space (`SC`).
     * @param {...number} components - Color components.
     * @returns {this} The content context, for chaining.
     * @throws {TypeError} If no components are given or one is not finite.
     * @throws {Error} If the content context is no longer active or the operator fails.
     */
    context.SC = function (...components) {
      if (!components.length)
        throw new TypeError("SC requires numeric components");
      return componentOperator("SC", 5, components);
    };
    /**
     * Sets the stroking color, with an optional pattern (`SCN`).
     * @param {...(number|number[]|string)} args - Components or one component array, then an optional pattern name.
     * @returns {this} The content context, for chaining.
     * @throws {TypeError} If the components are missing or not finite.
     * @throws {Error} If the content context is no longer active or the operator fails.
     */
    context.SCN = function (...args) {
      return patternComponents("SCN", 6, args);
    };
    context.sc = function (...components) {
      if (!components.length)
        throw new TypeError("sc requires numeric components");
      return componentOperator("sc", 7, components);
    };
    context.scn = function (...args) {
      return patternComponents("scn", 8, args);
    };
  }

  function withDoubles(values, callback) {
    var pointer = values.length ? module._malloc(values.length * 8) : 0;
    try {
      if (pointer) module.HEAPF64.set(values, pointer >>> 3);
      return callback(pointer);
    } finally {
      if (pointer) module._free(pointer);
    }
  }

  function copiedPageFormArguments(index, pageBox, transformation) {
    if (!Number.isInteger(index) || index < 0) {
      throw new RangeError("Page index must be a non-negative integer");
    }
    if (!(
      isPageBoxType(pageBox) ||
      (Array.isArray(pageBox) &&
        pageBox.length === 4 &&
        pageBox.every(Number.isFinite))
    )) {
      throw new TypeError(
        "Page box must be a page-box enum or four finite numbers",
      );
    }
    if (
      transformation !== undefined &&
      (!Array.isArray(transformation) ||
        transformation.length !== 6 ||
        !transformation.every(Number.isFinite))
    ) {
      throw new TypeError(
        "Transformation matrix must contain six finite numbers",
      );
    }
    return [index, pageBox, transformation];
  }

  function textEncoding(options) {
    if (options === undefined) return 0;
    if (!options || typeof options !== "object" || Array.isArray(options)) {
      throw new TypeError("text options must be an options object");
    }
    if (
      options.encoding === undefined ||
      options.encoding === TextEncoding.TEXT
    )
      return 0;
    if (options.encoding === TextEncoding.CODE) return 1;
    if (options.encoding === TextEncoding.HEX) return 2;
    throw new TypeError("text encoding must be text, code, or hex");
  }

  function withGlyphs(glyphs, callback) {
    if (
      !Array.isArray(glyphs) ||
      !glyphs.every(
        (glyph) =>
          Array.isArray(glyph) &&
          glyph.length === 2 &&
          glyph.every((value) => Number.isInteger(value) && value >= 0),
      )
    ) {
      throw new TypeError(
        "glyph text requires [glyphId, unicodeCodePoint] pairs",
      );
    }
    return withBytes(
      new Uint8Array(new Uint32Array(glyphs.flat()).buffer),
      callback,
    );
  }

  /**
   * Marshals TJ items into temporary WASM buffers.
   *
   * @param {Array} items Text strings, spacing numbers, or glyph lists.
   * @param {Function} callback Receives pointers in fixed order: types, numbers,
   * string offsets, strings, glyph offsets, glyphs, then the item count and the
   * lengths of the string offset, string, glyph offset, and glyph buffers.
   * @returns {*} The callback result before all temporary buffers are freed.
   */
  function withTJItems(items, callback) {
    if (!items.length)
      throw new TypeError("TJ requires text, glyph lists, or numbers");
    if (items.length > 100000)
      throw new RangeError("TJ exceeds the maximum item count");
    var types = new Int32Array(items.length);
    var numbers = new Float64Array(items.length);
    var stringOffsets = new Int32Array(items.length + 1);
    var glyphOffsets = new Int32Array(items.length + 1);
    var strings = [];
    var glyphs = [];
    var stringLength = 0;
    for (var index = 0; index < items.length; ++index) {
      var item = items[index];
      stringOffsets[index] = stringLength;
      glyphOffsets[index] = glyphs.length / 2;
      if (typeof item === "string") {
        var encoded = encoder.encode(item);
        if (stringLength + encoded.length > 16 * 1024 * 1024) {
          throw new RangeError("TJ string data exceeds 16 MiB");
        }
        types[index] = 0;
        strings.push(encoded);
        stringLength += encoded.length;
      } else if (typeof item === "number") {
        if (!Number.isFinite(item)) {
          throw new TypeError("TJ requires finite numeric arguments");
        }
        types[index] = 1;
        numbers[index] = item;
      } else {
        withGlyphs(item, function () {});
        types[index] = 2;
        glyphs.push(...item.flat());
        if (glyphs.length / 2 > 1000000) {
          throw new RangeError("TJ glyph data exceeds the maximum count");
        }
      }
    }
    stringOffsets[items.length] = stringLength;
    glyphOffsets[items.length] = glyphs.length / 2;
    var stringBytes = new Uint8Array(stringLength);
    var stringOffset = 0;
    for (var string of strings) {
      stringBytes.set(string, stringOffset);
      stringOffset += string.length;
    }
    return withBytes(new Uint8Array(types.buffer), (typesPointer) =>
      withBytes(new Uint8Array(numbers.buffer), (numbersPointer) =>
        withBytes(
          new Uint8Array(stringOffsets.buffer),
          (stringOffsetsPointer) =>
            withBytes(stringBytes, (stringsPointer) =>
              withBytes(
                new Uint8Array(glyphOffsets.buffer),
                (glyphOffsetsPointer) =>
                  withBytes(
                    new Uint8Array(new Uint32Array(glyphs).buffer),
                    (glyphsPointer) =>
                      callback(
                        typesPointer,
                        numbersPointer,
                        stringOffsetsPointer,
                        stringsPointer,
                        glyphOffsetsPointer,
                        glyphsPointer,
                        items.length,
                        stringOffsets.length,
                        stringBytes.length,
                        glyphOffsets.length,
                        glyphs.length / 2,
                      ),
                  ),
              ),
            ),
        ),
      ),
    );
  }

  function addTextShowingOperators(context, requireContext, api) {
    function show(operation, text, options, wordSpace = 0, characterSpace = 0) {
      requireContext();
      if (![wordSpace, characterSpace].every(Number.isFinite)) {
        throw new TypeError("DoubleQuote requires finite numeric arguments");
      }
      if (typeof text === "string")
        return withString(text, (pointer, length) => {
          if (
            !api.text(
              operation,
              textEncoding(options),
              wordSpace,
              characterSpace,
              pointer,
              length,
            )
          )
            throw new Error("Unable to show text");
          return context;
        });
      if (options !== undefined)
        throw new TypeError("glyph text has no encoding options");
      return withGlyphs(text, (pointer) => {
        if (
          !api.glyphs(
            operation,
            wordSpace,
            characterSpace,
            pointer,
            text.length,
          )
        )
          throw new Error("Unable to show glyph text");
        return context;
      });
    }
    context.Quote = function (text, options) {
      return show(1, text, options);
    };
    context.DoubleQuote = function (wordSpace, characterSpace, text, options) {
      return show(2, text, options, wordSpace, characterSpace);
    };
    context.TJ = function (...items) {
      requireContext();
      var last = items.at(-1);
      var encoding =
        last && typeof last === "object" && !Array.isArray(last)
          ? textEncoding(items.pop())
          : 0;
      return withTJItems(items, (...pointers) => {
        if (!api.tj(encoding, ...pointers))
          throw new Error("Unable to show text array");
        return context;
      });
    };
  }
  return {
    removeFile,
    withString,
    withBytes,
    writeNativeBytes,
    writeFreeCode,
    addStructuredContentOperators,
    withDoubles,
    copiedPageFormArguments,
    textEncoding,
    withGlyphs,
    withTJItems,
    addTextShowingOperators,
  };
}
