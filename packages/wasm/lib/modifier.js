/** Creates a factory for low-level PDF modifiers. */
export function createModifierFactory({
  module,
  constants,
  colorValue,
  normalizeBytes,
  fonts,
  images,
  state,
  withString,
  removeFile,
  assertOutputSize,
}) {
  /**
   * Opens a PDF for compact page drawing.
   * @param {Uint8Array|ArrayBuffer|PDFRStreamForBuffer} bytes - PDF to modify.
   * @returns {CompactModifier} A modifier; finish it with `end()` or release it with `dispose()`.
   * @throws {TypeError} If `bytes` is not a supported byte source.
   * @throws {Error} If the PDF cannot be opened for modification.
   */
  function createModifier(bytes) {
    bytes = normalizeBytes(bytes, "PDF input");
    var path = `/pdfs/${state.nextPdf++}.pdf`;
    module.FS.mkdirTree("/pdfs");
    module.FS.writeFile(path, bytes);
    var modifier;
    try {
      modifier = withString(path, (pathPointer) =>
        module._muhammara_wasm_modifier_create(
          pathPointer,
          constants.ePDFVersion14,
          1,
        ),
      );
    } catch (error) {
      removeFile(path);
      throw error;
    }
    if (!modifier) {
      removeFile(path);
      throw new Error("Unable to modify PDF");
    }
    var ended = false;
    /**
     * Releases the native modifier and its input file; later calls do nothing.
     * @returns {void}
     */
    function dispose() {
      if (ended) return;
      if (modifier) module._muhammara_wasm_modifier_destroy(modifier);
      removeFile(path);
      modifier = 0;
      ended = true;
    }
    function requireOpenModifier() {
      if (ended || !modifier) throw new Error("PDF modifier has ended");
    }
    return {
      /**
       * Starts drawing on an existing page.
       * @param {number} index - Zero-based page index.
       * @returns {this} The modifier.
       * @throws {RangeError} If the page cannot be modified.
       * @throws {Error} If the modifier has ended.
       */
      startPage: function (index) {
        requireOpenModifier();
        if (!module._muhammara_wasm_modifier_start_page(modifier, index, 0)) {
          throw new RangeError(`Unable to modify page ${index}`);
        }
        return this;
      },
      /**
       * Draws a rectangle in PDF coordinates, stroked unless `fill` is set.
       * @param {number} x - Left edge.
       * @param {number} y - Bottom edge.
       * @param {number} width - Rectangle width.
       * @param {number} height - Rectangle height.
       * @param {CompactModifierShapeOptions} [options] - `fill`, `stroke`, or `color`, in that precedence.
       * @returns {this} The modifier.
       * @throws {TypeError} If the color is not a ColorValue.
       * @throws {Error} If the modifier has ended or drawing fails.
       */
      rectangle: function (x, y, width, height, options = {}) {
        requireOpenModifier();
        var color = colorValue(options.fill || options.stroke || options.color);
        if (
          !module._muhammara_wasm_modifier_rectangle(
            modifier,
            x,
            y,
            width,
            height,
            color,
            options.fill ? 1 : 0,
          )
        ) {
          throw new Error("Unable to draw on modified page");
        }
        return this;
      },
      /**
       * Draws a circle in PDF coordinates, stroked unless `fill` is set.
       * @param {number} x - Center x.
       * @param {number} y - Center y.
       * @param {number} radius - Circle radius.
       * @param {CompactModifierShapeOptions} [options] - `fill`, `stroke`, or `color`, in that precedence.
       * @returns {this} The modifier.
       * @throws {TypeError} If the color is not a ColorValue.
       * @throws {Error} If the modifier has ended or drawing fails.
       */
      circle: function (x, y, radius, options = {}) {
        requireOpenModifier();
        if (
          !module._muhammara_wasm_modifier_circle(
            modifier,
            x,
            y,
            radius,
            colorValue(options.fill || options.stroke || options.color),
            options.fill ? 1 : 0,
          )
        ) {
          throw new Error("Unable to draw on modified page");
        }
        return this;
      },
      /**
       * Draws a line in PDF coordinates.
       * @param {number} startX - Start x.
       * @param {number} startY - Start y.
       * @param {number} endX - End x.
       * @param {number} endY - End y.
       * @param {CompactModifierLineOptions} [options] - `stroke` or `color`, and `lineWidth` (default 1).
       * @returns {this} The modifier.
       * @throws {TypeError} If the color is not a ColorValue.
       * @throws {Error} If the modifier has ended or drawing fails.
       */
      line: function (startX, startY, endX, endY, options = {}) {
        requireOpenModifier();
        if (
          !module._muhammara_wasm_modifier_line(
            modifier,
            startX,
            startY,
            endX,
            endY,
            colorValue(options.stroke || options.color),
            options.lineWidth || 1,
          )
        ) {
          throw new Error("Unable to draw on modified page");
        }
        return this;
      },
      /**
       * Writes text in PDF coordinates with a font registered on the module.
       * @param {string} value - Text to write.
       * @param {number} x - Baseline start x.
       * @param {number} y - Baseline y.
       * @param {CompactModifierTextOptions} options - Registered `font` name, `fontSize` (default 12), and `color`.
       * @returns {this} The modifier.
       * @throws {TypeError} If the color is not a ColorValue.
       * @throws {Error} If the modifier has ended, the font is not registered, or writing fails.
       */
      text: function (value, x, y, options = {}) {
        requireOpenModifier();
        var fontPath = fonts.get(options.font);
        if (!fontPath) {
          throw new Error(`Unknown font: ${options.font || "(none)"}`);
        }
        withString(value, (textPointer) =>
          withString(fontPath, (fontPointer) => {
            if (
              !module._muhammara_wasm_modifier_text(
                modifier,
                x,
                y,
                textPointer,
                fontPointer,
                options.fontSize || 12,
                colorValue(options.color),
              )
            ) {
              throw new Error("Unable to write text on modified page");
            }
          }),
        );
        return this;
      },
      /**
       * Places a registered image, scaled to the given box, in PDF coordinates.
       * @param {string} name - Name the image was registered under.
       * @param {number} x - Left edge.
       * @param {number} y - Bottom edge.
       * @param {number} width - Placed width.
       * @param {number} height - Placed height.
       * @returns {this} The modifier.
       * @throws {Error} If the modifier has ended, the image is unknown, or placing fails.
       */
      image: function (name, x, y, width, height) {
        requireOpenModifier();
        var imagePath = images.get(name);
        if (!imagePath) {
          throw new Error(`Unknown image: ${name}`);
        }
        return withString(imagePath, (imagePointer) => {
          if (
            !module._muhammara_wasm_modifier_image(
              modifier,
              imagePointer,
              x,
              y,
              width,
              height,
            )
          ) {
            throw new Error("Unable to place image on modified page");
          }
          return this;
        });
      },
      /**
       * Finishes drawing on the current page.
       * @returns {this} The modifier.
       * @throws {Error} If the modifier has ended or the page cannot be finished.
       */
      endPage: function () {
        requireOpenModifier();
        if (!module._muhammara_wasm_modifier_end_page(modifier)) {
          throw new Error("Unable to finish modified page");
        }
        return this;
      },
      /**
       * Writes the modified PDF and releases the modifier.
       * @returns {Uint8Array} The modified PDF bytes.
       * @throws {Error} If the modifier has ended, the PDF cannot be written, or it exceeds the output limit.
       */
      end: function () {
        requireOpenModifier();
        var lengthPointer = module._malloc(4);
        try {
          var pdfPointer = module._muhammara_wasm_modifier_end_pdf(
            modifier,
            lengthPointer,
          );
          var length = module.HEAPU32[lengthPointer >>> 2];
          if (!pdfPointer || !length) {
            throw new Error("Unable to finish modified PDF");
          }
          try {
            assertOutputSize(length);
            return module.HEAPU8.slice(pdfPointer, pdfPointer + length);
          } finally {
            module._muhammara_wasm_free(pdfPointer);
          }
        } finally {
          module._free(lengthPointer);
          dispose();
        }
      },
      dispose: function () {
        dispose();
      },
    };
  }

  return createModifier;
}
