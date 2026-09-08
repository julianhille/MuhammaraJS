/** Creates the byte-first equivalent of native `muhammara.recrypt`. */
export function createRecrypt({
  module,
  normalizeBytes,
  withBytes,
  withString,
  assertOutputSize,
}) {
  return function recrypt(source, options = {}) {
    source = normalizeBytes(source, "PDF input");
    if (!options || typeof options !== "object") options = {};
    if (typeof options.log === "string") {
      throw new Error("recrypt log files are unavailable in WebAssembly");
    }
    var version = typeof options.version === "number" ? options.version | 0 : 0;
    if (![0, 10, 11, 12, 13, 14, 15, 16, 17, 20].includes(version)) {
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
