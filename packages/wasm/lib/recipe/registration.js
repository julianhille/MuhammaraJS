/** Creates Recipe asset registration and removal methods. */
export function createRegistrationMethods({
  module,
  normalizeBytes,
  normalizeBytesAsync,
  fonts,
  images,
  pdfs,
  state,
  registerFont,
  registerWriterFont,
  unregisterWriterFont,
  removeFile,
}) {
  return {
    /**
     * Registers font bytes under a name and style for future Recipe instances.
     * Registering the same name and style replaces and removes the prior asset.
     *
     * @name registerFont
     * @function
     * @memberof Recipe
     * @param {string} name Non-empty font family name used by Recipe text.
     * @param {ByteSource} bytes Font bytes.
     * @param {RecipeFontStyle} [type="regular"] Font family style.
     * @returns {void}
     * @throws {TypeError} If the name is empty or the bytes are unsupported.
     */
    registerFont: function (name, bytes) {
      if (typeof name !== "string" || !name) {
        throw new TypeError("Font names must be non-empty strings");
      }
      bytes = normalizeBytes(bytes, "Font bytes");
      var path = `/fonts/${state.nextFont++}.font`;
      module.FS.mkdirTree("/fonts");
      module.FS.writeFile(path, bytes);
      var previous = registerFont(fonts, name, path, arguments[2]);
      // Modifiers load fonts through the byte-first low-level writer catalog.
      registerWriterFont(path, bytes);
      if (previous) {
        unregisterWriterFont(previous);
        removeFile(previous);
      }
    },
    /**
     * Asynchronously registers a font for future Recipe instances.
     * Registering the same name and style replaces and removes the prior asset.
     *
     * @name registerFontAsync
     * @function
     * @memberof Recipe
     * @async
     * @param {string} name Non-empty font family name used by Recipe text.
     * @param {AsyncByteSource} bytes Font bytes or an asynchronous byte source.
     * @param {RecipeFontStyle} [type="regular"] Font family style.
     * @returns {Promise<void>} Resolves after the font is registered.
     * @throws {TypeError} If the name is empty or the bytes are unsupported.
     */
    registerFontAsync: async function (name, bytes, type) {
      return this.registerFont(
        name,
        await normalizeBytesAsync(bytes, "Font bytes"),
        type,
      );
    },
    /**
     * Registers image bytes under a name for future Recipe instances.
     * Registering the same name replaces and removes the prior asset.
     *
     * @name registerImage
     * @function
     * @memberof Recipe
     * @param {string} name Image name used by `Recipe#image`.
     * @param {ByteSource} bytes Image bytes.
     * @param {string} extension Image filename extension.
     * @returns {void}
     * @throws {TypeError} If the bytes are unsupported or the extension is not
     * a supported JPEG, PNG, or TIFF extension.
     */
    registerImage: function (name, bytes, extension) {
      bytes = normalizeBytes(bytes, "Image bytes");
      if (!/^(jpe?g|png|tiff?)$/i.test(extension || ""))
        throw new TypeError("Image extensions must be jpeg, png, or tiff");
      var path = `/images/${state.nextImage++}.${extension.toLowerCase()}`;
      module.FS.mkdirTree("/images");
      module.FS.writeFile(path, bytes);
      var previous = images.get(name);
      images.set(name, path);
      if (previous) removeFile(previous);
    },
    /**
     * Asynchronously registers an image for future Recipe instances.
     * Registering the same name replaces and removes the prior asset.
     *
     * @name registerImageAsync
     * @function
     * @memberof Recipe
     * @async
     * @param {string} name Image name used by `Recipe#image`.
     * @param {AsyncByteSource} bytes Image bytes or an asynchronous byte source.
     * @param {string} extension Image filename extension.
     * @returns {Promise<void>} Resolves after the image is registered.
     * @throws {TypeError} If the bytes are unsupported or the extension is not
     * a supported JPEG, PNG, or TIFF extension.
     */
    registerImageAsync: async function (name, bytes, extension) {
      return this.registerImage(
        name,
        await normalizeBytesAsync(bytes, "Image bytes"),
        extension,
      );
    },
    /**
     * Registers PDF bytes under a name for composition and inspection.
     * Registering the same name replaces and removes the prior asset.
     *
     * @name registerPdf
     * @function
     * @memberof Recipe
     * @param {string} name PDF name used by composition and inspection methods.
     * @param {ByteSource} bytes PDF bytes.
     * @returns {void}
     * @throws {TypeError} If the bytes are unsupported.
     */
    registerPdf: function (name, bytes) {
      bytes = normalizeBytes(bytes, "PDF bytes");
      var path = `/recipe-pdfs/${state.nextPdf++}.pdf`;
      module.FS.mkdirTree("/recipe-pdfs");
      module.FS.writeFile(path, bytes);
      var previous = pdfs.get(name);
      pdfs.set(name, path);
      if (previous) removeFile(previous);
    },
    /**
     * Asynchronously registers a PDF for composition and inspection.
     * Registering the same name replaces and removes the prior asset.
     *
     * @name registerPdfAsync
     * @function
     * @memberof Recipe
     * @async
     * @param {string} name PDF name used by composition and inspection methods.
     * @param {AsyncByteSource} bytes PDF bytes or an asynchronous byte source.
     * @returns {Promise<void>} Resolves after the PDF is registered.
     * @throws {TypeError} If the bytes are unsupported.
     */
    registerPdfAsync: async function (name, bytes) {
      return this.registerPdf(
        name,
        await normalizeBytesAsync(bytes, "PDF bytes"),
      );
    },
    /**
     * Removes one registered font style.
     *
     * @name unregisterFont
     * @function
     * @memberof Recipe
     * @param {string} name Registered font family name.
     * @param {RecipeFontStyle} [type="regular"] Font family style to remove.
     * @returns {boolean} Whether a matching registered style was removed.
     */
    unregisterFont: function (name, type = "regular") {
      var key = String(name).toLowerCase();
      var family = fonts.get(key);
      if (!family) return false;
      var style =
        {
          bold: "b",
          b: "b",
          italic: "i",
          i: "i",
          "bold-italic": "bi",
          bi: "bi",
        }[String(type).toLowerCase()] || "r";
      var path = family[style];
      if (!path) return false;
      delete family[style];
      if (!Object.keys(family).length) fonts.delete(key);
      unregisterWriterFont(path);
      removeFile(path);
      return true;
    },
    /**
     * Removes a registered image.
     *
     * @name unregisterImage
     * @function
     * @memberof Recipe
     * @param {string} name Registered image name.
     * @returns {boolean} Whether a matching image was removed.
     */
    unregisterImage: function (name) {
      var path = images.get(name);
      if (!path) return false;
      images.delete(name);
      removeFile(path);
      return true;
    },
    /**
     * Removes a registered PDF.
     *
     * @name unregisterPdf
     * @function
     * @memberof Recipe
     * @param {string} name Registered PDF name.
     * @returns {boolean} Whether a matching PDF was removed.
     */
    unregisterPdf: function (name) {
      var path = pdfs.get(name);
      if (!path) return false;
      pdfs.delete(name);
      removeFile(path);
      return true;
    },
    /**
     * Removes all globally registered Recipe assets.
     *
     * @name disposeAssets
     * @function
     * @memberof Recipe
     * @returns {void}
     */
    disposeAssets: function () {
      fonts.forEach((family) =>
        Object.values(family).forEach((path) => {
          unregisterWriterFont(path);
          removeFile(path);
        }),
      );
      new Set([...images.values(), ...pdfs.values()]).forEach(removeFile);
      fonts.clear();
      images.clear();
      pdfs.clear();
    },
  };
}
