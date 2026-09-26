#pragma once

#include <cstdlib>
#include <cmath>
#include <limits>
#include <memory>
#include <cstring>
#include <string>

#ifdef __EMSCRIPTEN__
#include <emscripten/emscripten.h>
#define WASM_EXPORT EMSCRIPTEN_KEEPALIVE
#else
#define WASM_EXPORT
#endif

#include "AbstractContentContext.h"
#include "DictionaryContext.h"
#include "DocumentContextExtenderAdapter.h"
#include "EStatusCode.h"
#include "InfoDictionary.h"
#include "IByteReader.h"
#include "IByteReaderWithPosition.h"
#include "IByteWriter.h"
#include "InputByteArrayStream.h"
#include "InputFile.h"
#include "ObjectsContext.h"
#include "PDFParser.h"
#include "PDFArray.h"
#include "PDFBoolean.h"
#include "PDFDictionary.h"
#include "PDFHexString.h"
#include "PDFIndirectObjectReference.h"
#include "PDFInteger.h"
#include "PDFLiteralString.h"
#include "PDFName.h"
#include "PDFObjectParser.h"
#include "PDFReal.h"
#include "PDFStreamInput.h"
#include "PDFStream.h"
#include "PDFSymbol.h"
#include "OutputStringBufferStream.h"
#include "PDFPage.h"
#include "PDFPageInput.h"
#include "PDFModifiedPage.h"
#include "PDFDocumentCopyingContext.h"
#include "PDFFormXObject.h"
#include "PDFImageXObject.h"
#include "PDFUsedFont.h"
#include "PDFRectangle.h"
#include "ResourcesDictionary.h"
#include "PDFWriter.h"
#include "PageContentContext.h"
#include "XObjectContentContext.h"
#include <algorithm>
#include <ft2build.h>
#include FT_SIZES_H
#include <vector>

class WasmDictionaryContext;
class WasmPDFStream;
class WasmByteWriter;
class WasmContentStream;
class WasmContentByteWriter;
class WasmCopyingParser;
class WasmPageInput;
class WasmModifier;
class WasmRecipe;

class WasmCatalogUpdateExtender : public DocumentContextExtenderAdapter {
 public:
  bool required = false;
  ObjectIDType pageLabelsObjectID = 0;

  bool IsCatalogUpdateRequiredForModifiedFile(PDFParser*) override {
    return required;
  }

  PDFHummus::EStatusCode OnCatalogWrite(
      CatalogInformation*, DictionaryContext* catalog,
      ObjectsContext*, PDFHummus::DocumentContext*) override {
    if (pageLabelsObjectID != 0) {
      catalog->WriteKey("PageLabels");
      catalog->WriteNewObjectReferenceValue(pageLabelsObjectID);
    }
    return PDFHummus::eSuccess;
  }
};

class WasmObjectsContext {
 public:
  ObjectsContext* context;
  bool indirectObject = false;
  bool freeContext = false;
  WasmDictionaryContext* dictionary = nullptr;
  WasmPDFStream* stream = nullptr;
  WasmByteWriter* freeWriter = nullptr;
  std::vector<WasmDictionaryContext*> dictionaries;
  std::vector<WasmPDFStream*> streams;
  std::vector<WasmByteWriter*> writers;

  explicit WasmObjectsContext(ObjectsContext* value) : context(value) {}
  ~WasmObjectsContext();
};

class WasmDictionaryContext {
 public:
  DictionaryContext* context;
  WasmObjectsContext* owner;
  bool active = true;

  WasmDictionaryContext(DictionaryContext* value, WasmObjectsContext* parent)
      : context(value), owner(parent) {}
};

class WasmPDFStream {
 public:
  PDFStream* stream;
  WasmObjectsContext* owner;
  bool active = true;

  WasmPDFStream(PDFStream* value, WasmObjectsContext* parent)
      : stream(value), owner(parent) {}
};

class WasmByteWriter {
 public:
  IByteWriter* writer;
  WasmObjectsContext* owner;
  bool active = true;

  WasmByteWriter(IByteWriter* value, WasmObjectsContext* parent)
      : writer(value), owner(parent) {}
};

inline WasmObjectsContext::~WasmObjectsContext() {
  if (dictionary != nullptr && dictionary->active) {
    context->EndDictionary(dictionary->context);
    dictionary->active = false;
  }
  if (stream != nullptr && stream->active) {
    context->EndPDFStream(stream->stream);
    indirectObject = false;
    stream->active = false;
    delete stream->stream;
    stream->stream = nullptr;
  }
  if (freeContext) context->EndFreeContext();
  if (indirectObject) context->EndIndirectObject();
  for (WasmDictionaryContext* value : dictionaries) delete value;
  for (WasmPDFStream* value : streams) delete value;
  for (WasmByteWriter* writer : writers) delete writer;
}

class WasmImage {
 public:
  PDFImageXObject* image = nullptr;
};

class WasmForm {
 public:
  PDFFormXObject* form = nullptr;
  WasmRecipe* recipe = nullptr;
  WasmModifier* modifier = nullptr;
  bool ended = true;
};

class WasmRecipe {
 public:
  OutputStringBufferStream output;
  PDFWriter writer;
  PDFPage* page = nullptr;
  PageContentContext* context = nullptr;
  std::vector<PDFUsedFont*> fonts;
  std::vector<WasmImage*> images;
  std::vector<WasmForm*> forms;
  std::vector<WasmObjectsContext*> objectsContexts;
  std::vector<WasmContentStream*> contentStreams;
  std::vector<WasmContentByteWriter*> contentWriters;
  bool finished = false;
  ObjectIDType lastAnnotationId = 0;
  WasmCatalogUpdateExtender catalogUpdate;

  ~WasmRecipe();
};

// These are views of streams owned by an active page or form. Unlike raw
// ObjectsContext streams, neither the wrapper nor its writer owns the stream.
class WasmContentStream {
 public:
  PDFStream* stream;
  WasmRecipe* recipe;
  WasmForm* form;
  bool active = true;

  WasmContentStream(PDFStream* value, WasmRecipe* writer,
                    WasmForm* owner = nullptr)
      : stream(value), recipe(writer), form(owner) {}
};

class WasmContentByteWriter {
 public:
  WasmContentStream* stream;
  bool active = true;

  explicit WasmContentByteWriter(WasmContentStream* value) : stream(value) {}
};

static void invalidateContentStreams(WasmRecipe* recipe, WasmForm* form) {
  if (recipe == nullptr) return;
  for (WasmContentStream* stream : recipe->contentStreams) {
    if (stream->form == form) stream->active = false;
  }
  for (WasmContentByteWriter* writer : recipe->contentWriters) {
    if (writer->stream->form == form) writer->active = false;
  }
}

static bool hasFont(WasmRecipe* recipe, PDFUsedFont* font) {
  return recipe != nullptr && font != nullptr &&
         std::find(recipe->fonts.begin(), recipe->fonts.end(), font) !=
             recipe->fonts.end();
}

// Measures text at an exact, possibly fractional, font size into values
// (xMin, yMin, xMax, yMax, width, height). PDFUsedFont takes an integer size,
// so measure at 1000 (exact font units) and scale.
static bool measureTextDimensions(PDFUsedFont* font, const char* text,
                                  double fontSize, double* values) {
  if (font == nullptr || text == nullptr || values == nullptr ||
      !std::isfinite(fontSize) || fontSize <= 0) {
    return false;
  }
  PDFUsedFont::TextMeasures measures = font->CalculateTextDimensions(text, 1000);
  double scale = fontSize / 1000.0;
  values[0] = measures.xMin * scale;
  values[1] = measures.yMin * scale;
  values[2] = measures.xMax * scale;
  values[3] = measures.yMax * scale;
  values[4] = measures.width * scale;
  values[5] = measures.height * scale;
  return true;
}

class WasmReader {
 public:
  InputFile input;
  PDFParser parser;
  PDFParser* parserView = nullptr;
  std::vector<WasmPageInput*> pages;
  std::vector<class WasmObject*> objects;
  std::vector<class WasmObjectParser*> objectParsers;
  std::vector<class WasmByteReader*> byteReaders;
  WasmCopyingParser* copyingParser = nullptr;

  ~WasmReader();

  PDFParser& GetParser() { return parserView == nullptr ? parser : *parserView; }
};

struct WasmTextElement {
  std::string content;
  std::string fontResource;
  double fontSize;
  double textMatrix[6];
};

class WasmTextExtraction {
 public:
  std::vector<WasmTextElement> elements;
};

// Mirrors EPDFPageContentItemType in the Node driver's PDFTextExtractor.h.
enum WasmPageContentItemType {
  kWasmPageContentItemText = 0,
  kWasmPageContentItemPath = 1,
  kWasmPageContentItemXObject = 2,
  kWasmPageContentItemShading = 3
};

struct WasmPageContentItem {
  WasmPageContentItemType type;
  std::string operation;
};

class WasmPageContentItems {
 public:
  std::vector<WasmPageContentItem> items;
};

// The parent owns undisposed handles. Explicit disposal unregisters the handle
// before deleting it, while parent cleanup remains the fallback.
class WasmByteReader {
 public:
  IByteReader* reader;
  IByteReaderWithPosition* positionedReader = nullptr;
  std::vector<WasmByteReader*>* owner;
  bool ownsReader = true;
  bool active = true;

  WasmByteReader(IByteReader* value, std::vector<WasmByteReader*>* readerOwner,
                 bool owns = true)
      : reader(value), owner(readerOwner), ownsReader(owns) {}

  WasmByteReader(IByteReaderWithPosition* value,
                 std::vector<WasmByteReader*>* readerOwner)
      : reader(value), positionedReader(value), owner(readerOwner),
        ownsReader(false) {}

  ~WasmByteReader() {
    if (ownsReader) delete reader;
  }
};

class WasmObject {
 public:
  PDFObject* object;
  WasmReader* reader = nullptr;
  WasmCopyingParser* copyingParser = nullptr;
  WasmObjectParser* objectParser = nullptr;

  explicit WasmObject(PDFObject* value, WasmReader* readerOwner = nullptr,
                      WasmCopyingParser* copyingOwner = nullptr)
      : object(value), reader(readerOwner), copyingParser(copyingOwner) {}
  ~WasmObject() { object->Release(); }
};

// PDFPageInput owns the parsed page dictionary; the handle remains valid only
// while its owning reader is alive.
class WasmPageInput {
 public:
  WasmReader* owner;
  PDFPageInput page;
  PDFDictionary* dictionary;

  WasmPageInput(WasmReader* reader, const RefCountPtr<PDFDictionary>& value)
      : owner(reader), page(&reader->GetParser(), value), dictionary(value.GetPtr()) {}
};

class WasmObjectParser {
 public:
  PDFObjectParser* parser;
  std::vector<WasmObject*> objects;

  explicit WasmObjectParser(PDFObjectParser* value) : parser(value) {}
  ~WasmObjectParser() {
    for (WasmObject* object : objects) delete object;
    delete parser;
  }
};

inline WasmReader::~WasmReader() {
  for (WasmByteReader* byteReader : byteReaders) delete byteReader;
  for (WasmObjectParser* parser : objectParsers) delete parser;
  for (WasmObject* object : objects) delete object;
  for (WasmPageInput* page : pages) delete page;
}

static WasmObject* addObject(WasmObjectParser* parser, PDFObject* object) {
  if (object == nullptr) return nullptr;
  WasmObject* handle = new WasmObject(object);
  handle->objectParser = parser;
  parser->objects.push_back(handle);
  return handle;
}

static WasmObject* addReaderObject(WasmReader* reader, PDFObject* object) {
  if (reader == nullptr || object == nullptr) return nullptr;
  WasmObject* handle = new WasmObject(object, reader, reader->copyingParser);
  reader->objects.push_back(handle);
  return handle;
}

static unsigned char* copyObjectString(const std::string& value,
                                       unsigned int* outputLength) {
  if (outputLength == nullptr) return nullptr;
  *outputLength = static_cast<unsigned int>(value.size());
  unsigned char* result = static_cast<unsigned char*>(std::malloc(value.empty() ? 1 : value.size()));
  if (result == nullptr) return nullptr;
  if (!value.empty()) std::memcpy(result, value.data(), value.size());
  return result;
}

static char* copyCString(const std::string& value) {
  char* result = static_cast<char*>(std::malloc(value.size() + 1));
  if (result == nullptr) return nullptr;
  std::memcpy(result, value.c_str(), value.size() + 1);
  return result;
}

static double textObjectNumber(PDFObject* object) {
  if (object->GetType() == PDFObject::ePDFObjectInteger) {
    return static_cast<double>(static_cast<PDFInteger*>(object)->GetValue());
  }
  if (object->GetType() == PDFObject::ePDFObjectReal) {
    return static_cast<PDFReal*>(object)->GetValue();
  }
  return 0;
}

static bool isTextNumber(PDFObject* object) {
  return object != nullptr &&
         (object->GetType() == PDFObject::ePDFObjectInteger ||
          object->GetType() == PDFObject::ePDFObjectReal);
}

static bool areTextNumbers(
    const std::vector<RefCountPtr<PDFObject>>& operands, size_t count) {
  if (operands.size() != count) return false;
  for (size_t index = 0; index < count; ++index) {
    if (!isTextNumber(operands[index].GetPtr())) return false;
  }
  return true;
}

static void setIdentityTextMatrix(double matrix[6]) {
  const double identity[] = {1, 0, 0, 1, 0, 0};
  for (size_t index = 0; index < 6; ++index) matrix[index] = identity[index];
}

static void copyTextMatrix(double output[6], const double input[6]) {
  for (size_t index = 0; index < 6; ++index) output[index] = input[index];
}

static void multiplyTextMatrices(double output[6], const double left[6],
                                 const double right[6]) {
  double result[] = {
      left[0] * right[0] + left[1] * right[2],
      left[0] * right[1] + left[1] * right[3],
      left[2] * right[0] + left[3] * right[2],
      left[2] * right[1] + left[3] * right[3],
      left[4] * right[0] + left[5] * right[2] + right[4],
      left[4] * right[1] + left[5] * right[3] + right[5]};
  copyTextMatrix(output, result);
}

static void moveTextLine(double textMatrix[6], double textLineMatrix[6],
                         double x, double y) {
  textLineMatrix[4] += x * textLineMatrix[0] + y * textLineMatrix[2];
  textLineMatrix[5] += x * textLineMatrix[1] + y * textLineMatrix[3];
  copyTextMatrix(textMatrix, textLineMatrix);
}

struct WasmExtractedTextState {
  std::string fontResource;
  double fontSize;
  double leading;
  double ctm[6];
};

// Hard ceilings mirroring the Node driver's PDFTextExtractor.h. Callers may
// request lower values, never higher ones.
static const size_t kWasmMaxExtractedElements = 100000;
static const size_t kWasmMaxOperands = 1024;
static const size_t kWasmMaxExtractedTextBytes = 16 * 1024 * 1024;
static const size_t kWasmMaxParsedObjects = 1000000;

static size_t clampExtractionLimit(size_t requested, size_t ceiling) {
  if (requested == 0 || requested > ceiling) return ceiling;
  return requested;
}

static bool isTextString(PDFObject* object) {
  return object != nullptr &&
         (object->GetType() == PDFObject::ePDFObjectLiteralString ||
          object->GetType() == PDFObject::ePDFObjectHexString);
}

static bool isValidQuote(
    const std::vector<RefCountPtr<PDFObject>>& operands) {
  return operands.size() == 1 && isTextString(operands[0].GetPtr());
}

static bool isValidDoubleQuote(
    const std::vector<RefCountPtr<PDFObject>>& operands) {
  return operands.size() == 3 && isTextNumber(operands[0].GetPtr()) &&
         isTextNumber(operands[1].GetPtr()) &&
         isTextString(operands[2].GetPtr());
}

static std::string textString(PDFObject* object) {
  if (object->GetType() == PDFObject::ePDFObjectLiteralString) {
    return static_cast<PDFLiteralString*>(object)->GetValue();
  }
  return static_cast<PDFHexString*>(object)->GetValue();
}

static bool textArray(PDFArray* array, size_t maxBytes, std::string& result) {
  for (unsigned long index = 0; index < array->GetLength(); ++index) {
    RefCountPtr<PDFObject> item(array->QueryObject(index));
    if (isTextString(item.GetPtr())) {
      std::string value = textString(item.GetPtr());
      if (value.size() > maxBytes - result.size()) return false;
      result += value;
    }
  }
  return true;
}

static bool isVisibleTextRenderingMode(int renderingMode) {
  return renderingMode != 3 && renderingMode != 7;
}

static bool isInlineImageWhitespace(IOBasicTypes::Byte byte) {
  return byte == 0x00 || byte == 0x09 || byte == 0x0A || byte == 0x0C ||
         byte == 0x0D || byte == 0x20;
}

// Consumes an inline image's binary payload, which the tokenizer cannot read:
// the bytes are arbitrary and lex as operators, inventing page marks and
// burning the parsed-object budget. Reads raw bytes up to the EI delimiter
// instead. EI must be surrounded by whitespace, the same heuristic every PDF
// consumer uses, since nothing records the payload length.
static void skipInlineImageData(PDFObjectParser* objectParser) {
  IByteReader* stream = objectParser->StartExternalRead();
  if (stream != nullptr) {
    // The byte before the payload was the whitespace that follows ID, so an
    // empty image still matches on its very first EI.
    IOBasicTypes::Byte window[3] = {0x20, 0x20, 0x20};
    IOBasicTypes::Byte current = 0;
    while (stream->NotEnded()) {
      if (stream->Read(&current, 1) != 1) break;
      if (isInlineImageWhitespace(window[0]) && window[1] == 'E' &&
          window[2] == 'I' && isInlineImageWhitespace(current))
        break;
      window[0] = window[1];
      window[1] = window[2];
      window[2] = current;
    }
  }
  objectParser->EndExternalRead();
}

static bool isPathPaintingOperation(const std::string& operation) {
  return operation == "S" || operation == "s" || operation == "f" ||
         operation == "F" || operation == "f*" || operation == "B" ||
         operation == "B*" || operation == "b" || operation == "b*";
}

static bool contentItemHasText(const std::vector<RefCountPtr<PDFObject> >& operands,
                               const std::string& operation) {
  if (operation == "TJ" && operands.size() == 1 &&
      operands[0].GetPtr()->GetType() == PDFObject::ePDFObjectArray) {
    std::string joined;
    textArray(static_cast<PDFArray*>(operands[0].GetPtr()), kWasmMaxExtractedTextBytes, joined);
    return !joined.empty();
  }
  return !operands.empty() && isTextString(operands.back().GetPtr()) &&
         !textString(operands.back().GetPtr()).empty();
}

// This mirrors the Node driver's bounded PDFTextExtractor implementation.
static bool extractPageText(PDFParser* parser, PDFDictionary* page,
                             std::vector<WasmTextElement>& elements,
                             size_t maxElements, size_t maxOperands,
                             size_t maxTextBytes, size_t maxParsedObjects) {
  RefCountPtr<PDFObject> contents(parser->QueryDictionaryObject(page, "Contents"));
  if (!contents) return true;

  PDFObjectParser* objectParser = nullptr;
  if (contents->GetType() == PDFObject::ePDFObjectStream) {
    objectParser = parser->StartReadingObjectsFromStream(
        static_cast<PDFStreamInput*>(contents.GetPtr()));
  } else if (contents->GetType() == PDFObject::ePDFObjectArray) {
    objectParser = parser->StartReadingObjectsFromStreams(
        static_cast<PDFArray*>(contents.GetPtr()));
  }
  if (!objectParser) return true;

  bool inTextObject = false;
  std::string fontResource;
  double fontSize = 0;
  double textMatrix[] = {1, 0, 0, 1, 0, 0};
  double textLineMatrix[] = {1, 0, 0, 1, 0, 0};
  double ctm[] = {1, 0, 0, 1, 0, 0};
  double textLeading = 0;
  std::vector<WasmExtractedTextState> textStateStack;
  std::vector<RefCountPtr<PDFObject>> operands;
  size_t extractedTextBytes = 0;
  size_t parsedObjects = 0;
  bool withinLimits = true;
  PDFObject* object = nullptr;
  while (withinLimits && (object = objectParser->ParseNewObject()) != nullptr) {
    RefCountPtr<PDFObject> objectHolder(object);
    if (++parsedObjects > maxParsedObjects) {
      withinLimits = false;
      break;
    }
    if (object->GetType() != PDFObject::ePDFObjectSymbol) {
      if (operands.size() == maxOperands) {
        withinLimits = false;
        break;
      }
      operands.push_back(objectHolder);
      continue;
    }

    std::string operation = static_cast<PDFSymbol*>(object)->GetValue();
    if (operation == "q" && operands.empty()) {
      WasmExtractedTextState state;
      state.fontResource = fontResource;
      state.fontSize = fontSize;
      state.leading = textLeading;
      copyTextMatrix(state.ctm, ctm);
      textStateStack.push_back(state);
    } else if (operation == "Q" && operands.empty() &&
               !textStateStack.empty()) {
      fontResource = textStateStack.back().fontResource;
      fontSize = textStateStack.back().fontSize;
      textLeading = textStateStack.back().leading;
      copyTextMatrix(ctm, textStateStack.back().ctm);
      textStateStack.pop_back();
    } else if (operation == "cm" && areTextNumbers(operands, 6)) {
      double matrix[6];
      for (size_t index = 0; index < 6; ++index) {
        matrix[index] = textObjectNumber(operands[index].GetPtr());
      }
      multiplyTextMatrices(ctm, matrix, ctm);
    } else if (operation == "BT" && operands.empty() && !inTextObject) {
      inTextObject = true;
      setIdentityTextMatrix(textMatrix);
      setIdentityTextMatrix(textLineMatrix);
    } else if (operation == "ET" && operands.empty() && inTextObject) {
      inTextObject = false;
    } else if (operation == "Tf" && operands.size() == 2) {
      if (operands[0]->GetType() == PDFObject::ePDFObjectName) {
        fontResource = static_cast<PDFName*>(operands[0].GetPtr())->GetValue();
      }
      fontSize = textObjectNumber(operands[1].GetPtr());
    } else if (inTextObject && operation == "Tm" &&
               areTextNumbers(operands, 6)) {
      for (size_t index = 0; index < 6; ++index) {
        textMatrix[index] = textObjectNumber(operands[index].GetPtr());
      }
      copyTextMatrix(textLineMatrix, textMatrix);
    } else if (inTextObject && (operation == "Td" || operation == "TD") &&
               areTextNumbers(operands, 2)) {
      double x = textObjectNumber(operands[0].GetPtr());
      double y = textObjectNumber(operands[1].GetPtr());
      if (operation == "TD") textLeading = -y;
      moveTextLine(textMatrix, textLineMatrix, x, y);
    } else if (inTextObject && operation == "TL" &&
               areTextNumbers(operands, 1)) {
      textLeading = textObjectNumber(operands[0].GetPtr());
    } else if (inTextObject && operation == "T*" && operands.empty()) {
      moveTextLine(textMatrix, textLineMatrix, 0, -textLeading);
    } else if (operation == "ID") {
      skipInlineImageData(objectParser);
      operands.clear();
      continue;
    } else if (inTextObject &&
               (operation == "Tj" || operation == "TJ" ||
                (operation == "'" && isValidQuote(operands)) ||
                (operation == "\"" && isValidDoubleQuote(operands)))) {
      if (operation == "'" || operation == "\"") {
        moveTextLine(textMatrix, textLineMatrix, 0, -textLeading);
      }
      std::string content;
      if (operation == "TJ" && operands.size() == 1 &&
          operands[0]->GetType() == PDFObject::ePDFObjectArray) {
        if (!textArray(static_cast<PDFArray*>(operands[0].GetPtr()),
                       maxTextBytes - extractedTextBytes, content)) {
          withinLimits = false;
          break;
        }
      } else if (!operands.empty() && isTextString(operands.back().GetPtr())) {
        content = textString(operands.back().GetPtr());
      }
      if (!content.empty()) {
        if (elements.size() == maxElements ||
            content.size() > maxTextBytes - extractedTextBytes) {
          withinLimits = false;
          break;
        }
        WasmTextElement element;
        element.content = content;
        element.fontResource = fontResource;
        element.fontSize = fontSize;
        multiplyTextMatrices(element.textMatrix, textMatrix, ctm);
        elements.push_back(element);
        extractedTextBytes += content.size();
      }
    }
    operands.clear();
  }
  delete objectParser;
  return withinLimits;
}

// This mirrors the Node driver's PDFTextExtractor::ExtractPageContentItems.
// maxTextBytes has no effect here: items carry an operator name, not text.
static bool extractPageContentItems(PDFParser* parser, PDFDictionary* page,
                                    std::vector<WasmPageContentItem>& items,
                                    size_t maxElements, size_t maxOperands,
                                    size_t maxParsedObjects) {
  RefCountPtr<PDFObject> contents(parser->QueryDictionaryObject(page, "Contents"));
  if (!contents) return true;

  PDFObjectParser* objectParser = nullptr;
  if (contents->GetType() == PDFObject::ePDFObjectStream) {
    objectParser = parser->StartReadingObjectsFromStream(
        static_cast<PDFStreamInput*>(contents.GetPtr()));
  } else if (contents->GetType() == PDFObject::ePDFObjectArray) {
    objectParser = parser->StartReadingObjectsFromStreams(
        static_cast<PDFArray*>(contents.GetPtr()));
  }
  if (!objectParser) return true;

  bool inTextObject = false;
  int textRenderingMode = 0;
  std::vector<int> textRenderingModes;
  std::vector<RefCountPtr<PDFObject> > operands;
  size_t parsedObjects = 0;
  bool withinLimits = true;
  PDFObject* object = nullptr;
  while (withinLimits && (object = objectParser->ParseNewObject()) != nullptr) {
    RefCountPtr<PDFObject> objectHolder(object);
    if (++parsedObjects > maxParsedObjects) {
      withinLimits = false;
      break;
    }
    if (object->GetType() != PDFObject::ePDFObjectSymbol) {
      if (operands.size() == maxOperands) {
        withinLimits = false;
        break;
      }
      operands.push_back(objectHolder);
      continue;
    }

    std::string operation = static_cast<PDFSymbol*>(object)->GetValue();
    if (operation == "BT") {
      inTextObject = true;
    } else if (operation == "ET") {
      inTextObject = false;
    } else if (operation == "Tr" && operands.size() == 1) {
      textRenderingMode = static_cast<int>(textObjectNumber(operands[0].GetPtr()));
    } else if (operation == "q") {
      textRenderingModes.push_back(textRenderingMode);
    } else if (operation == "Q" && !textRenderingModes.empty()) {
      textRenderingMode = textRenderingModes.back();
      textRenderingModes.pop_back();
    } else if (operation == "ID") {
      skipInlineImageData(objectParser);
      operands.clear();
      continue;
    }

    WasmPageContentItemType type = kWasmPageContentItemText;
    bool hasItem = false;
    if (operation == "BI") {
      // An inline image paints the page exactly as "Do" does; the operation
      // name tells the two apart.
      type = kWasmPageContentItemXObject;
      hasItem = true;
    } else if (inTextObject && isVisibleTextRenderingMode(textRenderingMode) &&
        (operation == "Tj" || operation == "'" || operation == "\"" ||
         operation == "TJ") &&
        contentItemHasText(operands, operation)) {
      type = kWasmPageContentItemText;
      hasItem = true;
    } else if (isPathPaintingOperation(operation)) {
      type = kWasmPageContentItemPath;
      hasItem = true;
    } else if (operation == "Do" && operands.size() == 1 &&
               operands[0].GetPtr()->GetType() == PDFObject::ePDFObjectName) {
      type = kWasmPageContentItemXObject;
      hasItem = true;
    } else if (operation == "sh" && operands.size() == 1 &&
               operands[0].GetPtr()->GetType() == PDFObject::ePDFObjectName) {
      type = kWasmPageContentItemShading;
      hasItem = true;
    }

    if (hasItem) {
      if (items.size() == maxElements) {
        withinLimits = false;
        break;
      }
      WasmPageContentItem item;
      item.type = type;
      item.operation = operation;
      items.push_back(item);
    }
    operands.clear();
  }
  delete objectParser;
  return withinLimits;
}

static char* addResourceMapping(ResourcesDictionary* resources, int type,
                                ObjectIDType objectId) {
  if (resources == nullptr || objectId == 0) return nullptr;
  std::string name;
  switch (type) {
    case 0: name = resources->AddExtGStateMapping(objectId); break;
    case 1: name = resources->AddFontMapping(objectId); break;
    case 2: name = resources->AddColorSpaceMapping(objectId); break;
    case 3: name = resources->AddPatternMapping(objectId); break;
    case 4: name = resources->AddPropertyMapping(objectId); break;
    case 5: name = resources->AddXObjectMapping(objectId); break;
    case 6: name = resources->AddFormXObjectMapping(objectId); break;
    case 7: name = resources->AddImageXObjectMapping(objectId); break;
    case 8: name = resources->AddShadingMapping(objectId); break;
    default: return nullptr;
  }
  return copyCString(name);
}

static ObjectIDType writeAnnotation(
    ObjectsContext& objects, PDFHummus::DocumentContext& document,
    const char* subtype, const char* contents, const char* title, const char* name,
    double left, double bottom, double right, double top, const double* color,
    int colorLength, double borderWidth, const double* borderDash,
    int borderDashLength, const double* quadPoints, int quadPointsLength,
    unsigned long flags, int open, double opacity) {
  if (subtype == nullptr || *subtype == '\0' || right < left || top < bottom ||
      colorLength < 0 || (colorLength != 0 && colorLength != 1 && colorLength != 3 &&
                          colorLength != 4) ||
      (colorLength != 0 && color == nullptr) || borderDashLength < 0 ||
      (borderDashLength != 0 && borderDash == nullptr) || quadPointsLength < 0 ||
      quadPointsLength % 8 != 0 || (quadPointsLength != 0 && quadPoints == nullptr) ||
      borderWidth < 0 || opacity < 0 || opacity > 1) {
    return 0;
  }
  ObjectIDType id = objects.StartNewIndirectObject();
  if (id == 0) return 0;
  DictionaryContext* dictionary = objects.StartDictionary();
  if (dictionary == nullptr) {
    objects.EndIndirectObject();
    return 0;
  }
  dictionary->WriteKey("Type");
  dictionary->WriteNameValue("Annot");
  dictionary->WriteKey("Subtype");
  dictionary->WriteNameValue(subtype);
  dictionary->WriteKey("Rect");
  dictionary->WriteRectangleValue(PDFRectangle(left, bottom, right, top));
  if (colorLength != 0) {
    dictionary->WriteKey("C");
    objects.StartArray();
    for (int index = 0; index < colorLength; ++index) objects.WriteDouble(color[index]);
    objects.EndArray();
  }
  if (borderWidth > 0 || borderDashLength != 0) {
    dictionary->WriteKey("Border");
    objects.StartArray();
    objects.WriteDouble(0);
    objects.WriteDouble(0);
    objects.WriteDouble(borderWidth);
    if (borderDashLength != 0) {
      objects.StartArray();
      for (int index = 0; index < borderDashLength; ++index)
        objects.WriteDouble(borderDash[index]);
      objects.EndArray();
    }
    objects.EndArray();
  }
  if (quadPointsLength != 0) {
    dictionary->WriteKey("QuadPoints");
    objects.StartArray();
    for (int index = 0; index < quadPointsLength; ++index)
      objects.WriteDouble(quadPoints[index]);
    objects.EndArray();
  }
  if (contents != nullptr && *contents != '\0') {
    dictionary->WriteKey("Contents");
    dictionary->WriteLiteralStringValue(contents);
  }
  if (title != nullptr && *title != '\0') {
    dictionary->WriteKey("T");
    dictionary->WriteLiteralStringValue(title);
  }
  if (name != nullptr && *name != '\0') {
    dictionary->WriteKey("NM");
    dictionary->WriteLiteralStringValue(name);
  }
  if (flags != 0) {
    dictionary->WriteKey("F");
    dictionary->WriteIntegerValue(flags);
  }
  if (open) {
    dictionary->WriteKey("Open");
    dictionary->WriteBooleanValue(true);
  }
  if (opacity != 1) {
    dictionary->WriteKey("CA");
    dictionary->WriteDoubleValue(opacity);
  }
  PDFHummus::EStatusCode status = objects.EndDictionary(dictionary);
  objects.EndIndirectObject();
  if (status != PDFHummus::eSuccess) return 0;
  document.RegisterAnnotationReferenceForNextPageWrite(id);
  return id;
}

class WasmModifier {
 public:
  InputFile input;
  OutputStringBufferStream output;
  PDFWriter writer;
  PDFModifiedPage* page = nullptr;
  PDFPage* newPage = nullptr;
  AbstractContentContext* context = nullptr;
  bool finished = false;
  WasmCatalogUpdateExtender catalogUpdate;
  std::vector<WasmObjectsContext*> objectsContexts;
  std::vector<WasmImage*> images;
  std::vector<WasmForm*> forms;

  ~WasmModifier();
};

class WasmCopyingContext {
 public:
  WasmRecipe* recipe = nullptr;
  WasmModifier* modifier = nullptr;
  PDFDocumentCopyingContext* context = nullptr;
  std::vector<WasmCopyingParser*> parsers;
  std::vector<WasmByteReader*> byteReaders;
  bool ended = false;

  ~WasmCopyingContext();
};

// This is a non-owning reader view over the parser owned by its copying context.
class WasmCopyingParser : public WasmReader {
 public:
  WasmCopyingContext* owner;
  bool active = true;

  WasmCopyingParser(WasmCopyingContext* context, PDFParser* value)
      : owner(context) {
    parserView = value;
    copyingParser = this;
  }
};

inline WasmCopyingContext::~WasmCopyingContext() {
  for (WasmCopyingParser* parser : parsers) delete parser;
  for (WasmByteReader* reader : byteReaders) delete reader;
  delete context;
  context = nullptr;
}

inline WasmRecipe::~WasmRecipe() {
  delete page;
  for (WasmImage* image : images) {
    delete image->image;
    delete image;
  }
  for (WasmForm* form : forms) {
    delete form->form;
    delete form;
  }
  for (WasmObjectsContext* context : objectsContexts) {
    delete context;
  }
  for (WasmContentByteWriter* writer : contentWriters) delete writer;
  for (WasmContentStream* stream : contentStreams) delete stream;
}

inline WasmModifier::~WasmModifier() {
  delete page;
  delete newPage;
  for (WasmImage* image : images) {
    delete image->image;
    delete image;
  }
  for (WasmForm* form : forms) {
    delete form->form;
    delete form;
  }
  for (WasmObjectsContext* context : objectsContexts) {
    delete context;
  }
}

static AbstractContentContext::GraphicOptions graphicOptions(unsigned int color,
                                                             bool fill) {
  return AbstractContentContext::GraphicOptions(
      fill ? AbstractContentContext::eFill : AbstractContentContext::eStroke,
      AbstractContentContext::eRGB, color);
}

static bool setColor(AbstractContentContext* context, unsigned int color, bool fill) {
  double red = ((color >> 16) & 0xff) / 255.0;
  double green = ((color >> 8) & 0xff) / 255.0;
  double blue = (color & 0xff) / 255.0;
  return (fill ? context->rg(red, green, blue) : context->RG(red, green, blue)) ==
         PDFHummus::eSuccess;
}

static PDFHummus::EStatusCode applyOperator(AbstractContentContext* context,
                                            int operation, double a, double b,
                                            double c, double d, double e,
                                            double f) {
  switch (operation) {
    case 0: return context->b();
    case 1: return context->B();
    case 2: return context->bStar();
    case 3: return context->BStar();
    case 4: return context->s();
    case 5: return context->S();
    case 6: return context->f();
    case 7: return context->F();
    case 8: return context->fStar();
    case 9: return context->n();
    case 10: return context->m(a, b);
    case 11: return context->l(a, b);
    case 12: return context->c(a, b, c, d, e, f);
    case 13: return context->v(a, b, c, d);
    case 14: return context->y(a, b, c, d);
    case 15: return context->h();
    case 16: return context->re(a, b, c, d);
    case 17: return context->q();
    case 18: return context->Q();
    case 19: return context->cm(a, b, c, d, e, f);
    case 20: return context->w(a);
    case 21: return context->J(static_cast<int>(a));
    case 22: return context->j(static_cast<int>(a));
    case 23: return context->M(a);
    case 24: return context->g(a);
    case 25: return context->G(a);
    case 26: return context->rg(a, b, c);
    case 27: return context->RG(a, b, c);
    case 28: return context->k(a, b, c, d);
    case 29: return context->K(a, b, c, d);
    case 30: return context->W();
    case 31: return context->WStar();
    case 32: return context->BT();
    case 33: return context->ET();
    case 34: return context->Tm(a, b, c, d, e, f);
    case 35: return context->Tc(a);
    case 36: return std::isfinite(a) ? context->Tw(a) : PDFHummus::eFailure;
    case 37:
      if (!std::isfinite(a) || std::trunc(a) != a ||
          a < std::numeric_limits<int>::min() ||
          a > std::numeric_limits<int>::max()) return PDFHummus::eFailure;
      return context->Tz(static_cast<int>(a));
    case 38: return std::isfinite(a) ? context->TL(a) : PDFHummus::eFailure;
    case 39:
      if (!std::isfinite(a) || std::trunc(a) != a ||
          a < std::numeric_limits<int>::min() ||
          a > std::numeric_limits<int>::max()) return PDFHummus::eFailure;
      return context->Tr(static_cast<int>(a));
    case 40: return std::isfinite(a) ? context->Ts(a) : PDFHummus::eFailure;
    case 41: return std::isfinite(a) && std::isfinite(b) ? context->Td(a, b) : PDFHummus::eFailure;
    case 42: return std::isfinite(a) && std::isfinite(b) ? context->TD(a, b) : PDFHummus::eFailure;
    case 43: return context->TStar();
    default: return PDFHummus::eFailure;
  }
}

static PDFHummus::EStatusCode applyStructuredOperator(
    AbstractContentContext* context, int operation, const char* name,
    const double* components, int length, int hasPattern) {
  if (context == nullptr || length < 0 ||
      (length > 0 && components == nullptr)) return PDFHummus::eFailure;
  for (int index = 0; index < length; ++index) {
    if (!std::isfinite(components[index])) return PDFHummus::eFailure;
  }
  switch (operation) {
    case 0:
      return name == nullptr ? PDFHummus::eFailure : context->ri(name);
    case 1:
      if (length != 1 || components[0] < std::numeric_limits<int>::min() ||
          components[0] > std::numeric_limits<int>::max()) {
        return PDFHummus::eFailure;
      }
      return context->i(static_cast<int>(components[0]));
    case 2:
      return name == nullptr ? PDFHummus::eFailure : context->gs(name);
    case 3:
      return name == nullptr ? PDFHummus::eFailure : context->CS(name);
    case 4:
      return name == nullptr ? PDFHummus::eFailure : context->cs(name);
    case 5: return context->SC(const_cast<double*>(components), length);
    case 6:
      return hasPattern ? context->SCN(const_cast<double*>(components), length,
                                       name == nullptr ? "" : name)
                        : context->SCN(const_cast<double*>(components), length);
    case 7: return context->sc(const_cast<double*>(components), length);
    case 8:
      return hasPattern ? context->scn(const_cast<double*>(components), length,
                                       name == nullptr ? "" : name)
                        : context->scn(const_cast<double*>(components), length);
    default: return PDFHummus::eFailure;
  }
}

static PDFHummus::EStatusCode showText(AbstractContentContext* context, int operation,
                                       int encoding, double wordSpace,
                                       double characterSpace, const char* text,
                                       unsigned int textLength) {
  if (context == nullptr || text == nullptr || !std::isfinite(wordSpace) ||
      !std::isfinite(characterSpace)) return PDFHummus::eFailure;
  std::string value(text, textLength);
  if (operation == 0) {
    if (encoding == 1) return context->TjLow(value);
    if (encoding == 2) return context->TjHexLow(value);
    return context->Tj(value);
  }
  if (operation == 1) {
    if (encoding == 1) return context->QuoteLow(value);
    if (encoding == 2) return context->QuoteHexLow(value);
    return context->Quote(value);
  }
  if (operation == 2) {
    if (encoding == 1) return context->DoubleQuoteLow(wordSpace, characterSpace, value);
    if (encoding == 2) return context->DoubleQuoteHexLow(wordSpace, characterSpace, value);
    return context->DoubleQuote(wordSpace, characterSpace, value);
  }
  return PDFHummus::eFailure;
}

static int drawImage(AbstractContentContext* context, double x, double y,
                     const char* imagePath, unsigned int imageIndex,
                     int transformationMethod, const double* matrix,
                     double boundingBoxWidth, double boundingBoxHeight,
                     int fitProportional, int fitPolicy) {
  if (context == nullptr || imagePath == nullptr || !std::isfinite(x) ||
      !std::isfinite(y) || matrix == nullptr || transformationMethod < 0 ||
      transformationMethod > 2 || !std::isfinite(boundingBoxWidth) ||
      !std::isfinite(boundingBoxHeight) || fitPolicy < 0 || fitPolicy > 1) {
    return 0;
  }
  AbstractContentContext::ImageOptions options;
  options.imageIndex = imageIndex;
  options.transformationMethod =
      static_cast<AbstractContentContext::EImageTransformation>(transformationMethod);
  for (int index = 0; index < 6; ++index) {
    if (!std::isfinite(matrix[index])) return 0;
    options.matrix[index] = matrix[index];
  }
  options.boundingBoxWidth = boundingBoxWidth;
  options.boundingBoxHeight = boundingBoxHeight;
  options.fitProportional = fitProportional != 0;
  options.fitPolicy = static_cast<AbstractContentContext::EFitPolicy>(fitPolicy);
  return context->DrawImage(x, y, imagePath, options) == PDFHummus::eSuccess;
}

static GlyphUnicodeMappingList glyphList(const unsigned int* glyphs, int length) {
  GlyphUnicodeMappingList result;
  for (int index = 0; index < length; ++index) {
    GlyphUnicodeMapping mapping;
    mapping.mGlyphCode = glyphs[index * 2];
    mapping.mUnicodeValues.push_back(glyphs[index * 2 + 1]);
    result.push_back(mapping);
  }
  return result;
}

static PDFHummus::EStatusCode showGlyphs(AbstractContentContext* context, int operation,
                                         double wordSpace, double characterSpace,
                                         const unsigned int* glyphs, int length) {
  if (context == nullptr || length < 0 || (length > 0 && glyphs == nullptr) ||
      !std::isfinite(wordSpace) || !std::isfinite(characterSpace)) return PDFHummus::eFailure;
  GlyphUnicodeMappingList value = glyphList(glyphs, length);
  if (operation == 0) return context->Tj(value);
  if (operation == 1) return context->Quote(value);
  if (operation == 2) return context->DoubleQuote(wordSpace, characterSpace, value);
  return PDFHummus::eFailure;
}

static PDFHummus::EStatusCode showTJ(AbstractContentContext* context, int encoding,
                                     const int* types, const double* numbers,
                                      const int* stringOffsets, const char* strings,
                                      const int* glyphOffsets, const unsigned int* glyphs,
                                      int count, unsigned int stringOffsetsLength,
                                      unsigned int stringsLength,
                                      unsigned int glyphOffsetsLength,
                                      unsigned int glyphCount) {
  // Both offset arrays hold one entry per item plus a terminating total, so
  // every item can be read as the half-open range [offset, next offset).
  if (context == nullptr || encoding < 0 || encoding > 2 || count < 0 ||
      stringOffsetsLength < static_cast<unsigned int>(count) + 1 ||
      glyphOffsetsLength < static_cast<unsigned int>(count) + 1 ||
      (count > 0 && (types == nullptr ||
      numbers == nullptr || stringOffsets == nullptr || glyphOffsets == nullptr))) {
    return PDFHummus::eFailure;
  }
  bool hasGlyphs = false;
  for (int index = 0; index < count; ++index) {
    if (types[index] < 0 || types[index] > 2 ||
        (types[index] == 1 && !std::isfinite(numbers[index]))) {
      return PDFHummus::eFailure;
    }
    if (types[index] == 0) {
      int start = stringOffsets[index];
      int end = stringOffsets[index + 1];
      if (strings == nullptr || start < 0 || end < start ||
          static_cast<unsigned int>(end) > stringsLength) {
        return PDFHummus::eFailure;
      }
    }
    if (types[index] == 2) {
      int start = glyphOffsets[index];
      int end = glyphOffsets[index + 1];
      if (glyphs == nullptr || start < 0 || end < start ||
          static_cast<unsigned int>(end) > glyphCount) {
        return PDFHummus::eFailure;
      }
    }
    hasGlyphs = hasGlyphs || types[index] == 2;
  }
  if (!hasGlyphs) {
    StringOrDoubleList values;
    for (int index = 0; index < count; ++index) {
      if (types[index] == 1) {
        values.push_back(StringOrDouble(numbers[index]));
      } else {
        int start = stringOffsets[index];
        values.push_back(StringOrDouble(
            std::string(strings + start, stringOffsets[index + 1] - start)));
      }
    }
    if (encoding == 1) return context->TJLow(values);
    if (encoding == 2) return context->TJHexLow(values);
    return context->TJ(values);
  }
  PDFUsedFont* font = context->GetCurrentFont();
  if (font == nullptr) return PDFHummus::eFailure;
  GlyphUnicodeMappingListOrDoubleList values;
  for (int index = 0; index < count; ++index) {
    if (types[index] == 1) {
      values.push_back(GlyphUnicodeMappingListOrDouble(numbers[index]));
    } else if (types[index] == 0) {
      GlyphUnicodeMappingList translated;
      int start = stringOffsets[index];
      font->TranslateStringToGlyphs(
          std::string(strings + start, stringOffsets[index + 1] - start),
          translated);
      values.push_back(GlyphUnicodeMappingListOrDouble(translated));
    } else {
      int start = glyphOffsets[index];
      int end = glyphOffsets[index + 1];
      values.push_back(GlyphUnicodeMappingListOrDouble(glyphList(glyphs + start * 2, end - start)));
    }
  }
  return context->TJ(values);
}

#include "FreeTypeFaceWrapper.h"
#include FT_TRUETYPE_TABLES_H

// Measure a glyph id list the way the native UsedFont driver does.
inline bool fontGlyphDimensions(PDFUsedFont* font, const uint32_t* glyphs, int count,
                                double fontSize, double* values) {
  if (font == nullptr || values == nullptr || count < 0 || (count > 0 && glyphs == nullptr) ||
      !std::isfinite(fontSize) || fontSize <= 0) {
    return false;
  }
  UIntList list;
  for (int index = 0; index < count; ++index) list.push_back(glyphs[index]);
  PDFUsedFont::TextMeasures measures =
      font->CalculateTextDimensions(list, static_cast<long>(fontSize));
  values[0] = measures.xMin;
  values[1] = measures.yMin;
  values[2] = measures.xMax;
  values[3] = measures.yMax;
  values[4] = measures.width;
  values[5] = measures.height;
  return true;
}

// Underline thickness and position from the font post table, with the native
// fallbacks, plus the text advance that ends the underline.
inline bool fontUnderline(PDFUsedFont* font, const char* text, double fontSize,
                          double* values) {
  if (font == nullptr || text == nullptr || values == nullptr || !std::isfinite(fontSize) ||
      fontSize <= 0) {
    return false;
  }
  FreeTypeFaceWrapper* wrapper = font->GetFreeTypeFont();
  double thickness = 0.05;
  double position = -0.15;
  void* tableInfo = FT_Get_Sfnt_Table(*wrapper, ft_sfnt_post);
  if (tableInfo != nullptr) {
    TT_Postscript* table = static_cast<TT_Postscript*>(tableInfo);
    thickness = table->underlineThickness * 1.0 / (*wrapper)->units_per_EM;
    position = table->underlinePosition * 1.0 / (*wrapper)->units_per_EM;
  }
  values[0] = thickness * fontSize;
  values[1] = position * fontSize;
  values[2] = font->CalculateTextAdvance(text, fontSize);
  return true;
}
