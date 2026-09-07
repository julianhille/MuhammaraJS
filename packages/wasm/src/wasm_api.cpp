#include "wasm_api_internal.h"

extern "C" {

WASM_EXPORT unsigned char* muhammara_wasm_recrypt(
    const unsigned char* input, unsigned int inputLength, const char* password,
    const char* userPassword, const char* ownerPassword, int shouldEncrypt,
    int userProtectionFlag, int version, int compress,
    unsigned int* outputLength) {
  if (input == nullptr || inputLength == 0 || password == nullptr ||
      userPassword == nullptr || ownerPassword == nullptr ||
      outputLength == nullptr) {
    return nullptr;
  }

  *outputLength = 0;
  InputByteArrayStream source(const_cast<unsigned char*>(input), inputLength);
  OutputStringBufferStream output;
  PDFCreationSettings settings(compress != 0, true);
  settings.DocumentEncryptionOptions.ShouldEncrypt = shouldEncrypt != 0;
  settings.DocumentEncryptionOptions.UserPassword = userPassword;
  settings.DocumentEncryptionOptions.OwnerPassword = ownerPassword;
  settings.DocumentEncryptionOptions.UserProtectionOptionsFlag =
      userProtectionFlag;
  if (PDFWriter::RecryptPDF(&source, password, &output,
                            LogConfiguration::DefaultLogConfiguration(), settings,
                            static_cast<EPDFVersion>(version)) !=
      PDFHummus::eSuccess) {
    return nullptr;
  }

  std::string pdf = output.ToString();
  unsigned char* result = static_cast<unsigned char*>(std::malloc(pdf.size()));
  if (result == nullptr) return nullptr;
  std::memcpy(result, pdf.data(), pdf.size());
  *outputLength = static_cast<unsigned int>(pdf.size());
  return result;
}

unsigned char* muhammara_wasm_recipe_end_pdf(WasmRecipe* recipe,
                                             unsigned int* outputLength) {
  if (recipe == nullptr || outputLength == nullptr || recipe->page != nullptr ||
      recipe->finished || recipe->writer.EndPDFForStream() != PDFHummus::eSuccess) {
    return nullptr;
  }
  recipe->finished = true;
  for (WasmContentStream* stream : recipe->contentStreams) stream->active = false;
  for (WasmContentByteWriter* writer : recipe->contentWriters) writer->active = false;
  std::string pdf = recipe->output.ToString();
  unsigned char* result = static_cast<unsigned char*>(std::malloc(pdf.size()));
  if (result == nullptr) {
    return nullptr;
  }
  std::memcpy(result, pdf.data(), pdf.size());
  *outputLength = static_cast<unsigned int>(pdf.size());
  return result;
}

/**
 * Creates a one-page PDF in WebAssembly memory.
 *
 * The caller owns the returned buffer and must release it with
 * muhammara_wasm_free. Returns null on failure. outputLength is zeroed after
 * validating the output pointer and page dimensions.
 */
unsigned char* muhammara_wasm_create_blank_pdf(double width, double height,
                                                unsigned int* outputLength) {
  if (outputLength == nullptr || width <= 0 || height <= 0) {
    return nullptr;
  }

  *outputLength = 0;
  OutputStringBufferStream output;
  PDFWriter writer;

  if (writer.StartPDFForStream(&output, ePDFVersion14) != PDFHummus::eSuccess) {
    return nullptr;
  }

  PDFPage page;
  page.SetMediaBox(PDFRectangle(0, 0, width, height));
  if (writer.WritePage(&page) != PDFHummus::eSuccess ||
      writer.EndPDFForStream() != PDFHummus::eSuccess) {
    return nullptr;
  }

  std::string pdf = output.ToString();
  unsigned char* result = static_cast<unsigned char*>(std::malloc(pdf.size()));
  if (result == nullptr) {
    return nullptr;
  }

  std::memcpy(result, pdf.data(), pdf.size());
  *outputLength = static_cast<unsigned int>(pdf.size());
  return result;
}

void muhammara_wasm_free(void* pointer) {
  std::free(pointer);
}


}  // extern "C"
