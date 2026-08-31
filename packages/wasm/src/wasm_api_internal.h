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

#pragma once

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

  bool IsCatalogUpdateRequiredForModifiedFile(PDFParser*) override {
    return required;
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

// The reader owns these handles because PDFParser owns the underlying input
// stream that they read from. A handle may be closed independently, but its
// storage remains reader-owned until the reader is destroyed.
class WasmByteReader {
 public:
  IByteReader* reader;
  IByteReaderWithPosition* positionedReader = nullptr;
  WasmReader* owner;
  bool ownsReader = true;
  bool active = true;

  WasmByteReader(IByteReader* value, WasmReader* readerOwner,
                 bool owns = true)
      : reader(value), owner(readerOwner), ownsReader(owns) {}

  WasmByteReader(IByteReaderWithPosition* value, WasmReader* readerOwner)
      : reader(value), positionedReader(value), owner(readerOwner),
        ownsReader(false) {}
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
  for (WasmByteReader* byteReader : byteReaders) {
    if (byteReader->ownsReader) delete byteReader->reader;
    byteReader->reader = nullptr;
    byteReader->positionedReader = nullptr;
    byteReader->active = false;
    delete byteReader;
  }
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

static bool isTextString(PDFObject* object) {
  return object != nullptr &&
         (object->GetType() == PDFObject::ePDFObjectLiteralString ||
          object->GetType() == PDFObject::ePDFObjectHexString);
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
    if (operation == "BT") {
      inTextObject = true;
    } else if (operation == "ET") {
      inTextObject = false;
    } else if (operation == "Tf" && operands.size() == 2) {
      if (operands[0]->GetType() == PDFObject::ePDFObjectName) {
        fontResource = static_cast<PDFName*>(operands[0].GetPtr())->GetValue();
      }
      fontSize = textObjectNumber(operands[1].GetPtr());
    } else if (operation == "Tm" && operands.size() == 6) {
      for (size_t index = 0; index < 6; ++index) {
        textMatrix[index] = textObjectNumber(operands[index].GetPtr());
      }
    } else if (inTextObject &&
               (operation == "Tj" || operation == "'" || operation == "\"" ||
                operation == "TJ")) {
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
        for (size_t index = 0; index < 6; ++index) {
          element.textMatrix[index] = textMatrix[index];
        }
        elements.push_back(element);
        extractedTextBytes += content.size();
      }
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

static WasmObject* addCopyingObject(WasmCopyingParser* parser, PDFObject* object) {
  if (parser == nullptr || !parser->active || object == nullptr) return nullptr;
  return addReaderObject(parser, object);
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
                                       double characterSpace, const char* text) {
  if (context == nullptr || text == nullptr || !std::isfinite(wordSpace) ||
      !std::isfinite(characterSpace)) return PDFHummus::eFailure;
  if (operation == 0) {
    if (encoding == 1) return context->TjLow(text);
    if (encoding == 2) return context->TjHexLow(text);
    return context->Tj(text);
  }
  if (operation == 1) {
    if (encoding == 1) return context->QuoteLow(text);
    if (encoding == 2) return context->QuoteHexLow(text);
    return context->Quote(text);
  }
  if (operation == 2) {
    if (encoding == 1) return context->DoubleQuoteLow(wordSpace, characterSpace, text);
    if (encoding == 2) return context->DoubleQuoteHexLow(wordSpace, characterSpace, text);
    return context->DoubleQuote(wordSpace, characterSpace, text);
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
                                      int count, unsigned int stringsLength,
                                      unsigned int glyphOffsetsLength,
                                      unsigned int glyphCount) {
  if (context == nullptr || encoding < 0 || encoding > 2 || count < 0 ||
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
      int offset = stringOffsets[index];
      if (strings == nullptr || offset < 0 ||
          static_cast<unsigned int>(offset) >= stringsLength ||
          std::memchr(strings + offset, 0, stringsLength - offset) == nullptr) {
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
    for (int index = 0; index < count; ++index)
      types[index] == 1 ? values.push_back(StringOrDouble(numbers[index]))
                        : values.push_back(StringOrDouble(strings + stringOffsets[index]));
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
      font->TranslateStringToGlyphs(strings + stringOffsets[index], translated);
      values.push_back(GlyphUnicodeMappingListOrDouble(translated));
    } else {
      int start = glyphOffsets[index];
      int end = glyphOffsets[index + 1];
      values.push_back(GlyphUnicodeMappingListOrDouble(glyphList(glyphs + start * 2, end - start)));
    }
  }
  return context->TJ(values);
}
