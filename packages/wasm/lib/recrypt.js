import { constants } from "./constants.js";

/** Creates the byte-first equivalent of native `muhammara.recrypt`. */
export function createRecrypt({
  module,
  normalizeBytes,
  withBytes,
  withString,
  assertOutputSize,
}) {
  /**
   * Decrypts, re-encrypts, or rewrites a PDF, like native `muhammara.recrypt`.
   * @param {Uint8Array|ArrayBuffer|PDFRStreamForBuffer} source - PDF to rewrite.
   * @param {PDFRecryptOptions} [options] - Source `password`, new `userPassword`/`ownerPassword`,
   *   `userProtectionFlag`, `version`, and `compress`.
   * @returns {Uint8Array} The rewritten PDF.
   * @throws {TypeError} If `source` is not a supported byte source.
   * @throws {Error} If `log` is set, the version is 2.0 or unsupported, recrypting fails, or the output exceeds the limit.
   */
  return function recrypt(source, options = {}) {
    source = normalizeBytes(source, "PDF input");
    if (!options || typeof options !== "object") options = {};
    if (typeof options.log === "string") {
      throw new Error("recrypt log files are unavailable in WebAssembly");
    }
    var version = typeof options.version === "number" ? options.version | 0 : 0;
    if (version === constants.ePDFVersion20) {
      throw new Error(
        "PDF 2.0/AES-256 encryption is unavailable in WebAssembly",
      );
    }
    if (
      ![
        constants.ePDFVersionUndefined,
        constants.ePDFVersion10,
        constants.ePDFVersion11,
        constants.ePDFVersion12,
        constants.ePDFVersion13,
        constants.ePDFVersion14,
        constants.ePDFVersion15,
        constants.ePDFVersion16,
        constants.ePDFVersion17,
      ].includes(version)
    ) {
      throw new Error(
        "Wrong argument for PDF version, please provide a valid PDF version",
      );
    }
    var password = typeof options.password === "string" ? options.password : "";
    var userPassword =
      typeof options.userPassword === "string" ? options.userPassword : "";
    var ownerPassword =
      typeof options.ownerPassword === "string" ? options.ownerPassword : "";
    var shouldEncrypt = typeof options.userPassword === "string";
    var protection =
      typeof options.userProtectionFlag === "number"
        ? options.userProtectionFlag | 0
        : 4;
    return withBytes(source, (sourcePointer) =>
      withString(password, (passwordPointer) =>
        withString(userPassword, (userPasswordPointer) =>
          withString(ownerPassword, (ownerPasswordPointer) => {
            var lengthPointer = module._malloc(4);
            try {
              var pdfPointer = module._muhammara_wasm_recrypt(
                sourcePointer,
                source.length,
                passwordPointer,
                userPasswordPointer,
                ownerPasswordPointer,
                shouldEncrypt ? 1 : 0,
                protection,
                version,
                options.compress === false ? 0 : 1,
                lengthPointer,
              );
              var length = module.HEAPU32[lengthPointer >>> 2];
              if (!pdfPointer || !length) {
                throw new Error("Unable to recrypt PDF");
              }
              try {
                assertOutputSize(length);
                return module.HEAPU8.slice(pdfPointer, pdfPointer + length);
              } finally {
                module._muhammara_wasm_free(pdfPointer);
              }
            } finally {
              module._free(lengthPointer);
            }
          }),
        ),
      ),
    );
  };
}
