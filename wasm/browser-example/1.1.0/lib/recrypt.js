import { constants } from "./constants.js";

// Every option `recrypt()` reads.
var recryptOptionKeys = [
  "password",
  "userPassword",
  "ownerPassword",
  "userProtectionFlag",
  "version",
  "compress",
  "log",
];

/**
 * Copies the recrypt options as they are now, like native reads them when
 * `recryptAsync()` is called. Each key is read with a plain property get, so
 * getters, inherited properties, and Proxy values are kept.
 * @param {PDFRecryptOptions} [options] - The caller's options.
 * @returns {PDFRecryptOptions|*} A plain copy, or `options` itself when it is
 *   not an object.
 */
function copyRecryptOptions(options) {
  if (!options || typeof options !== "object") return options;
  var copy = {};
  for (var key of recryptOptionKeys) copy[key] = options[key];
  return copy;
}

/**
 * Creates the byte-first equivalents of native `recrypt` and `recryptAsync`.
 * @param {object} dependencies - Module, constants, byte helpers, and the
 *   `recryptWorker` host, or null to recrypt on the calling thread.
 * @returns {{recrypt: Function, recryptAsync: Function}} `recrypt(bytes,
 *   options)` and `recryptAsync(source, options)`.
 */
export function createRecrypt({
  module,
  normalizeBytes,
  normalizeBytesAsync,
  withBytes,
  withString,
  assertOutputSize,
  recryptWorker,
}) {
  /**
   * Checks the recrypt options and reads them into plain values, which a
   * worker can receive and `recrypt()` reads the same way.
   * @param {PDFRecryptOptions|null} [options] - Recrypt options.
   * @returns {{password: string, userPassword: (string|undefined),
   *   ownerPassword: string, userProtectionFlag: number, version: number,
   *   compress: boolean}} The options as plain values.
   * @throws {Error} If `log` is set or the version is 2.0 or unsupported.
   */
  function readRecryptOptions(options) {
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
    return {
      password: typeof options.password === "string" ? options.password : "",
      userPassword:
        typeof options.userPassword === "string"
          ? options.userPassword
          : undefined,
      ownerPassword:
        typeof options.ownerPassword === "string" ? options.ownerPassword : "",
      userProtectionFlag:
        typeof options.userProtectionFlag === "number"
          ? options.userProtectionFlag | 0
          : 4,
      version,
      compress: options.compress !== false,
    };
  }

  /**
   * Rewrites a PDF that is already normalized, so neither caller copies it a
   * second time.
   * @param {Uint8Array} source - PDF to rewrite, owned by this call.
   * @param {PDFRecryptOptions|null} [options] - Recrypt options.
   * @returns {Uint8Array} The rewritten PDF.
   * @throws {Error} If `log` is set, the version is 2.0 or unsupported, recrypting fails, or the output exceeds the limit.
   */
  function recryptBytes(source, options) {
    var {
      password,
      userPassword,
      ownerPassword,
      userProtectionFlag: protection,
      version,
      compress,
    } = readRecryptOptions(options);
    var shouldEncrypt = userPassword !== undefined;
    return withBytes(source, (sourcePointer) =>
      withString(password, (passwordPointer) =>
        withString(userPassword ?? "", (userPasswordPointer) =>
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
                compress ? 1 : 0,
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
  }

  return {
    /**
     * Decrypts, re-encrypts, or rewrites a PDF, like native `muhammara.recrypt`.
     * @param {Uint8Array|ArrayBuffer|PDFRStreamForBuffer} source - PDF to rewrite.
     * @param {PDFRecryptOptions|null} [options] - Source `password`, new `userPassword`/`ownerPassword`,
     *   `userProtectionFlag`, `version`, and `compress`; `null` means none.
     * @returns {Uint8Array} The rewritten PDF.
     * @throws {TypeError} If `source` is not a supported byte source.
     * @throws {RangeError} If the bytes exceed `maxInputBytes`.
     * @throws {Error} If `log` is set, the version is 2.0 or unsupported, recrypting fails, or the output exceeds the limit.
     */
    recrypt: function recrypt(source, options = {}) {
      return recryptBytes(normalizeBytes(source, "PDF input"), options);
    },
    /**
     * Rewrites a PDF like `recrypt()`, after reading an asynchronous byte
     * source. Recrypting runs in a worker, so the calling thread stays free,
     * unless no worker can start or the instance was loaded with
     * `recryptWorker: false`; then it runs on the calling thread.
     * @async
     * @param {AsyncByteSource} source - PDF bytes, Blob, or File.
     * @param {PDFRecryptOptions|null} [options] - Source `password`, new `userPassword`/`ownerPassword`,
     *   `userProtectionFlag`, `version`, and `compress`; `null` means none.
     * @returns {Promise<Uint8Array>} The rewritten PDF.
     * @throws {TypeError} If `source` is not a supported byte source.
     * @throws {RangeError} If the bytes exceed `maxInputBytes`.
     * @throws {Error} If `log` is set, the version is 2.0 or unsupported, recrypting fails, or the output exceeds the limit.
     */
    recryptAsync: async function recryptAsync(source, options = {}) {
      options = copyRecryptOptions(options);
      // The normalized bytes are already this call's own copy.
      var bytes = await normalizeBytesAsync(source, "PDF input");
      var plain = readRecryptOptions(options);
      var result = recryptWorker ? await recryptWorker.run(bytes, plain) : null;
      // Without a worker, recrypt here, as recrypt() does.
      return result || recryptBytes(bytes, plain);
    },
  };
}
