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
      startPage: function (index) {
        requireOpenModifier();
        if (!module._muhammara_wasm_modifier_start_page(modifier, index, 0)) {
          throw new RangeError(`Unable to modify page ${index}`);
        }
        return this;
      },
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
      endPage: function () {
        requireOpenModifier();
        if (!module._muhammara_wasm_modifier_end_page(modifier)) {
          throw new Error("Unable to finish modified page");
        }
        return this;
      },
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
