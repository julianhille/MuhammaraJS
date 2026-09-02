/** Creates a function that inspects a registered PDF's metadata and pages. */
export function createInspectPdf({ module, withString, pdfs }) {
  return function inspectPdf(name) {
    var path = pdfs.get(name);
    if (!path) throw new Error(`Unknown PDF: ${name}`);
    var reader = withString(path, (pathPointer) =>
      module._muhammara_wasm_reader_create(pathPointer),
    );
    if (!reader) throw new Error("Unable to parse PDF");
    try {
      var pageCount = module._muhammara_wasm_reader_get_pages_count(reader);
      var result = {
        pages: pageCount,
        level: module._muhammara_wasm_reader_get_pdf_level(reader),
        encrypted: Boolean(module._muhammara_wasm_reader_is_encrypted(reader)),
      };
      for (var index = 0; index < pageCount; index += 1) {
        var valuesPointer = module._malloc(40);
        try {
          if (
            !module._muhammara_wasm_reader_get_page_info(
              reader,
              index,
              valuesPointer,
            )
          )
            throw new Error(`Unable to read page ${index}`);
          var offset = valuesPointer >>> 3;
          var mediaBox = Array.from(module.HEAPF64.slice(offset, offset + 4));
          result[index + 1] = pageRecord(
            index + 1,
            mediaBox,
            module.HEAPF64[offset + 4],
          );
        } finally {
          module._free(valuesPointer);
        }
      }
      return result;
    } finally {
      module._muhammara_wasm_reader_destroy(reader);
    }
  };
}
import { pageRecord } from "./page-record.js";
