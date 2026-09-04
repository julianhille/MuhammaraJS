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
    registerFontAsync: async function (name, bytes, type) {
      return this.registerFont(
        name,
        await normalizeBytesAsync(bytes, "Font bytes"),
        type,
      );
    },
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
    registerImageAsync: async function (name, bytes, extension) {
      return this.registerImage(
        name,
        await normalizeBytesAsync(bytes, "Image bytes"),
        extension,
      );
    },
    registerPdf: function (name, bytes) {
      bytes = normalizeBytes(bytes, "PDF bytes");
      var path = `/recipe-pdfs/${state.nextPdf++}.pdf`;
      module.FS.mkdirTree("/recipe-pdfs");
      module.FS.writeFile(path, bytes);
      var previous = pdfs.get(name);
      pdfs.set(name, path);
      if (previous) removeFile(previous);
    },
    registerPdfAsync: async function (name, bytes) {
      return this.registerPdf(
        name,
        await normalizeBytesAsync(bytes, "PDF bytes"),
      );
    },
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
    unregisterImage: function (name) {
      var path = images.get(name);
      if (!path) return false;
      images.delete(name);
      removeFile(path);
      return true;
    },
    unregisterPdf: function (name) {
      var path = pdfs.get(name);
      if (!path) return false;
      pdfs.delete(name);
      removeFile(path);
      return true;
    },
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
