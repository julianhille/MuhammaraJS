#include "PDFReaderDriver.h"

#include "ByteReaderDriver.h"
#include "ByteReaderWithPositionDriver.h"
#include "ConstructorsHolder.h"
#include "ObjectByteReaderWithPosition.h"
#include "PDFArrayDriver.h"
#include "PDFDictionaryDriver.h"
#include "PDFObjectParserDriver.h"
#include "PDFPageInput.h"
#include "PDFPageInputDriver.h"
#include "PDFStreamInputDriver.h"
#include "RefCountPtr.h"
#include "text-extraction/PDFTextExtractor.h"

#include <cmath>

using namespace muhammara::napi;

namespace {
const char *kPageIndexError = "Page index must be a non-negative integer";
const char *kObjectIDError = "Object ID must be a non-negative integer";

bool ReadIndexArgument(napi_env env, napi_value value, unsigned long &index) {
  if (!IsType(env, value, napi_number))
    return false;
  double raw = ToDouble(env, value);
  if (!(raw >= 0) || raw > 4294967295.0 || raw != std::floor(raw))
    return false;
  index = static_cast<unsigned long>(raw);
  return true;
}

bool ReadExtractionLimits(const CallbackArgs &args, size_t index,
                          PDFExtractionLimits &limits) {
  if (args.Length() <= index || IsType(args.Env(), args[index], napi_undefined))
    return true;
  if (!IsObject(args.Env(), args[index]) || IsArray(args.Env(), args[index])) {
    ThrowTypeError(args.Env(), "Extraction limits must be an object");
    return false;
  }
  const char *names[] = {"maxElements", "maxOperands", "maxTextBytes",
                         "maxParsedObjects"};
  size_t *targets[] = {&limits.maxElements, &limits.maxOperands,
                       &limits.maxTextBytes, &limits.maxParsedObjects};
  for (size_t i = 0; i < 4; ++i) {
    napi_value value = Get(args.Env(), args[index], names[i]);
    if (!value)
      return false;
    if (IsType(args.Env(), value, napi_undefined))
      continue;
    double raw = IsType(args.Env(), value, napi_number)
                     ? ToDouble(args.Env(), value)
                     : 0;
    if (!IsType(args.Env(), value, napi_number) || raw != std::floor(raw) ||
        raw <= 0 || raw > 4294967295.0) {
      std::string message =
          std::string(names[i]) + " must be a positive 32-bit integer";
      ThrowRangeError(args.Env(), message.c_str());
      return false;
    }
    *targets[i] = static_cast<size_t>(raw);
  }
  return true;
}

napi_value OneByteString(napi_env env, const std::string &value) {
  napi_value result = nullptr;
  Check(env,
        napi_create_string_latin1(env, value.data(), value.size(), &result));
  return result;
}
} // namespace

PDFReaderDriver::PDFReaderDriver()
    : holder(nullptr), mStartedWithStream(false), mReadStreamProxy(nullptr),
      mOwnsParser(false), mPDFReader(nullptr),
      mLifecycle(new DriverLifecycleState()) {}

PDFReaderDriver::~PDFReaderDriver() {
  mLifecycle->End();
  delete mReadStreamProxy;
  if (mOwnsParser)
    delete mPDFReader;
}

bool PDFReaderDriver::Init(ModuleState &state, napi_value exports) {
  ClassBuilder builder(state, "PDFReader", New);
  builder.Method("getPDFLevel", GetPDFLevel)
      .Method("end", End)
      .Method("getPagesCount", GetPagesCount)
      .Method("getTrailer", GetTrailer)
      .Method("queryDictionaryObject", QueryDictionaryObject)
      .Method("queryArrayObject", QueryArrayObject)
      .Method("parseNewObject", ParseNewObject)
      .Method("getPageObjectID", GetPageObjectID)
      .Method("parsePageDictionary", ParsePageDictionary)
      .Method("parsePage", ParsePage)
      .Method("extractPageText", ExtractPageText)
      .Method("extractPageContentItems", ExtractPageContentItems)
      .Method("getObjectsCount", GetObjectsCount)
      .Method("isEncrypted", IsEncrypted)
      .Method("getXrefSize", GetXrefSize)
      .Method("getXrefEntry", GetXrefEntry)
      .Method("getXrefPosition", GetXrefPosition)
      .Method("startReadingFromStream", StartReadingFromStream)
      .Method("startReadingFromStreamForPlainCopying",
              StartReadingFromStreamForPlainCopying)
      .Method("startReadingObjectsFromStream", StartReadingObjectsFromStream)
      .Method("startReadingObjectsFromStreams", StartReadingObjectsFromStreams)
      .Method("getParserStream", GetParserStream);
  return builder.Define(exports, false) != nullptr;
}

napi_value PDFReaderDriver::New(const CallbackArgs &args) {
  auto *reader = new PDFReaderDriver();
  reader->holder = &ModuleState::Get(args.Env())->Constructors();
  if (!reader->Wrap(args.Env(), args.This())) {
    delete reader;
    return nullptr;
  }
  return args.This();
}

PDFReaderDriver *PDFReaderDriver::GetActiveReader(const CallbackArgs &args) {
  auto *reader = ObjectWrap::Unwrap<PDFReaderDriver>(args.Env(), args.This());
  if (!reader->mPDFReader || !reader->mLifecycle->IsActive()) {
    ThrowTypeError(args.Env(), "PDF reader has ended");
    return nullptr;
  }
  return reader;
}

napi_value PDFReaderDriver::End(const CallbackArgs &args) {
  auto *reader = ObjectWrap::Unwrap<PDFReaderDriver>(args.Env(), args.This());
  reader->mLifecycle->End();
  delete reader->mReadStreamProxy;
  reader->mReadStreamProxy = nullptr;
  if (reader->mOwnsParser) {
    delete reader->mPDFReader;
    reader->mOwnsParser = false;
  }
  reader->mPDFReader = nullptr;
  reader->mPDFFile.CloseFile();
  return args.This();
}

#define ACTIVE_NUMBER_METHOD(Name, Expression)                                 \
  napi_value PDFReaderDriver::Name(const CallbackArgs &args) {                 \
    auto *reader = GetActiveReader(args);                                      \
    return reader ? Number(args.Env(), (Expression)) : nullptr;                \
  }

ACTIVE_NUMBER_METHOD(GetPDFLevel, reader->mPDFReader->GetPDFLevel())
ACTIVE_NUMBER_METHOD(GetPagesCount, reader->mPDFReader->GetPagesCount())
ACTIVE_NUMBER_METHOD(GetObjectsCount, reader->mPDFReader->GetObjectsCount())
ACTIVE_NUMBER_METHOD(GetXrefSize, reader->mPDFReader->GetXrefSize())
ACTIVE_NUMBER_METHOD(GetXrefPosition, reader->mPDFReader->GetXrefPosition())
#undef ACTIVE_NUMBER_METHOD

napi_value PDFReaderDriver::IsEncrypted(const CallbackArgs &args) {
  auto *reader = GetActiveReader(args);
  return reader ? Boolean(args.Env(), reader->mPDFReader->IsEncrypted())
                : nullptr;
}

napi_value PDFReaderDriver::QueryDictionaryObject(const CallbackArgs &args) {
  auto *reader = GetActiveReader(args);
  if (!reader)
    return nullptr;
  if (args.Length() != 2 || !reader->holder->IsPDFDictionaryInstance(args[0]) ||
      !IsType(args.Env(), args[1], napi_string))
    return ThrowTypeError(args.Env(),
                          "Wrong arguments. Provide a dictionary and a string");
  auto *dictionary =
      ObjectWrap::Unwrap<PDFDictionaryDriver>(args.Env(), args[0]);
  RefCountPtr<PDFObject> object = reader->mPDFReader->QueryDictionaryObject(
      dictionary->TheObject.GetPtr(), LegacyString(args.Env(), args[1]));
  return object.GetPtr() ? reader->holder->GetInstanceFor(object.GetPtr())
                         : Undefined(args.Env());
}

napi_value PDFReaderDriver::QueryArrayObject(const CallbackArgs &args) {
  auto *reader = GetActiveReader(args);
  if (!reader)
    return nullptr;
  if (args.Length() != 2 || !reader->holder->IsPDFArrayInstance(args[0]) ||
      !IsType(args.Env(), args[1], napi_number))
    return ThrowTypeError(args.Env(),
                          "Wrong arguments. Provide an array and an index");
  auto *array = ObjectWrap::Unwrap<PDFArrayDriver>(args.Env(), args[0]);
  RefCountPtr<PDFObject> object = reader->mPDFReader->QueryArrayObject(
      array->TheObject.GetPtr(), ToUint32(args.Env(), args[1]));
  return object.GetPtr() ? reader->holder->GetInstanceFor(object.GetPtr())
                         : Undefined(args.Env());
}

napi_value PDFReaderDriver::GetTrailer(const CallbackArgs &args) {
  auto *reader = GetActiveReader(args);
  if (!reader)
    return nullptr;
  PDFDictionary *trailer = reader->mPDFReader->GetTrailer();
  return trailer ? reader->holder->GetInstanceFor(trailer)
                 : Undefined(args.Env());
}

PDFHummus::EStatusCode
PDFReaderDriver::StartPDFParsing(napi_env env, napi_value stream,
                                 const PDFParsingOptions &options) {
  if (!mPDFReader && !mOwnsParser) {
    mPDFReader = new PDFParser();
    mOwnsParser = true;
  }
  delete mReadStreamProxy;
  mStartedWithStream = true;
  mReadStreamProxy = new ObjectByteReaderWithPosition(env, stream);
  mPDFReader->ResetParser();
  return mPDFReader->StartPDFParsing(mReadStreamProxy, options);
}

PDFHummus::EStatusCode
PDFReaderDriver::StartPDFParsing(const std::string &path,
                                 const PDFParsingOptions &options) {
  if (!mPDFReader && !mOwnsParser) {
    mPDFReader = new PDFParser();
    mOwnsParser = true;
  }
  delete mReadStreamProxy;
  mReadStreamProxy = nullptr;
  mStartedWithStream = false;
  mPDFReader->ResetParser();
  if (mPDFFile.OpenFile(path) != PDFHummus::eSuccess)
    return PDFHummus::eFailure;
  return mPDFReader->StartPDFParsing(mPDFFile.GetInputStream(), options);
}

void PDFReaderDriver::SetFromOwnedParser(PDFParser *parser,
                                         DriverLifecycle ownerLifecycle) {
  if (mOwnsParser) {
    delete mPDFReader;
    mOwnsParser = false;
    delete mReadStreamProxy;
    mReadStreamProxy = nullptr;
    mStartedWithStream = false;
    mPDFFile.CloseFile();
  }
  mPDFReader = parser;
  mLifecycle->SetOwner(ownerLifecycle);
}

PDFParser *PDFReaderDriver::GetParser() {
  return mLifecycle->IsActive() ? mPDFReader : nullptr;
}
DriverLifecycle PDFReaderDriver::GetLifecycle() { return mLifecycle; }

napi_value PDFReaderDriver::ParseNewObject(const CallbackArgs &args) {
  auto *reader = GetActiveReader(args);
  if (!reader)
    return nullptr;
  if (args.Length() != 1)
    return ThrowTypeError(args.Env(), "Wrong arguments. Provide an Object ID");
  unsigned long objectID;
  if (!ReadIndexArgument(args.Env(), args[0], objectID))
    return ThrowTypeError(args.Env(), kObjectIDError);
  RefCountPtr<PDFObject> object = reader->mPDFReader->ParseNewObject(objectID);
  if (!object)
    return ThrowTypeError(
        args.Env(),
        "Unable to read object. Most probably object ID is wrong (or some file "
        "read issue...but i'd first check that ID. if i were you)");
  return reader->holder->GetInstanceFor(object.GetPtr());
}

napi_value PDFReaderDriver::GetPageObjectID(const CallbackArgs &args) {
  auto *reader = GetActiveReader(args);
  if (!reader)
    return nullptr;
  if (args.Length() != 1)
    return ThrowTypeError(args.Env(), "Wrong arguments. Provide a page index");
  unsigned long index;
  if (!ReadIndexArgument(args.Env(), args[0], index))
    return ThrowTypeError(args.Env(), kPageIndexError);
  return Number(args.Env(), reader->mPDFReader->GetPageObjectID(index));
}

napi_value PDFReaderDriver::ParsePageDictionary(const CallbackArgs &args) {
  auto *reader = GetActiveReader(args);
  if (!reader)
    return nullptr;
  if (args.Length() != 1)
    return ThrowTypeError(args.Env(), "Wrong arguments. Provide a page index");
  unsigned long index;
  if (!ReadIndexArgument(args.Env(), args[0], index))
    return ThrowTypeError(args.Env(), kPageIndexError);
  RefCountPtr<PDFDictionary> object = reader->mPDFReader->ParsePage(index);
  return object.GetPtr()
             ? reader->holder->GetInstanceFor(object.GetPtr())
             : ThrowTypeError(
                   args.Env(),
                   "Unable to read page, parhaps page index is wrong");
}

napi_value PDFReaderDriver::ParsePage(const CallbackArgs &args) {
  auto *reader = GetActiveReader(args);
  if (!reader)
    return nullptr;
  if (args.Length() != 1)
    return ThrowTypeError(args.Env(), "Wrong arguments. Provide a page index");
  unsigned long index;
  if (!ReadIndexArgument(args.Env(), args[0], index))
    return ThrowTypeError(args.Env(), kPageIndexError);
  RefCountPtr<PDFDictionary> object = reader->mPDFReader->ParsePage(index);
  if (!object)
    return ThrowTypeError(
        args.Env(), "Unable to read page, page index is wrong or page is null");
  napi_value instance = reader->holder->GetNewPDFPageInput();
  PDFPageInputDriver *page = nullptr;
  if (!ObjectWrap::UnwrapNew(args.Env(), instance, &page))
    return nullptr;
  page->PageInput = new PDFPageInput(reader->mPDFReader, object);
  page->PageInputDictionary = object.GetPtr();
  return instance;
}

napi_value PDFReaderDriver::ExtractPageText(const CallbackArgs &args) {
  auto *reader = GetActiveReader(args);
  if (!reader)
    return nullptr;
  if (args.Length() < 1 || args.Length() > 2)
    return ThrowTypeError(
        args.Env(),
        "Wrong arguments. Provide a page index and optional extraction limits");
  unsigned long index;
  if (!ReadIndexArgument(args.Env(), args[0], index))
    return ThrowTypeError(args.Env(), kPageIndexError);
  PDFExtractionLimits limits;
  if (!ReadExtractionLimits(args, 1, limits))
    return nullptr;
  RefCountPtr<PDFDictionary> page(reader->mPDFReader->ParsePage(index));
  if (!page)
    return ThrowTypeError(
        args.Env(), "Unable to read page, page index is wrong or page is null");
  std::vector<PDFTextElement> elements;
  if (!PDFTextExtractor().Extract(reader->mPDFReader, page.GetPtr(), elements,
                                  limits))
    return ThrowError(args.Env(),
                      "Page content exceeds text extraction limits");
  napi_value result = Array(args.Env(), elements.size());
  for (size_t i = 0; i < elements.size(); ++i) {
    napi_value element = Object(args.Env());
    Set(args.Env(), element, "content",
        OneByteString(args.Env(), elements[i].content));
    Set(args.Env(), element, "fontResource",
        String(args.Env(), elements[i].fontResource));
    Set(args.Env(), element, "fontSize",
        Number(args.Env(), elements[i].fontSize));
    napi_value matrix = Array(args.Env(), 6);
    for (uint32_t j = 0; j < 6; ++j)
      Set(args.Env(), matrix, j, Number(args.Env(), elements[i].textMatrix[j]));
    Set(args.Env(), element, "textMatrix", matrix);
    Set(args.Env(), result, i, element);
  }
  return result;
}

napi_value PDFReaderDriver::ExtractPageContentItems(const CallbackArgs &args) {
  auto *reader = GetActiveReader(args);
  if (!reader)
    return nullptr;
  if (args.Length() < 1 || args.Length() > 2)
    return ThrowTypeError(
        args.Env(),
        "Wrong arguments. Provide a page index and optional extraction limits");
  unsigned long index;
  if (!ReadIndexArgument(args.Env(), args[0], index))
    return ThrowTypeError(args.Env(), kPageIndexError);
  PDFExtractionLimits limits;
  if (!ReadExtractionLimits(args, 1, limits))
    return nullptr;
  RefCountPtr<PDFDictionary> page(reader->mPDFReader->ParsePage(index));
  if (!page)
    return ThrowTypeError(
        args.Env(), "Unable to read page, page index is wrong or page is null");
  std::vector<PDFPageContentItem> items;
  if (!PDFTextExtractor().ExtractPageContentItems(reader->mPDFReader,
                                                  page.GetPtr(), items, limits))
    return ThrowError(args.Env(),
                      "Page content exceeds item extraction limits");
  napi_value result = Array(args.Env(), items.size());
  for (size_t i = 0; i < items.size(); ++i) {
    napi_value item = Object(args.Env());
    Set(args.Env(), item, "type", Number(args.Env(), items[i].type));
    Set(args.Env(), item, "operation", String(args.Env(), items[i].operation));
    Set(args.Env(), result, i, item);
  }
  return result;
}

napi_value PDFReaderDriver::GetXrefEntry(const CallbackArgs &args) {
  auto *reader = GetActiveReader(args);
  if (!reader)
    return nullptr;
  if (args.Length() != 1)
    return ThrowTypeError(args.Env(), "Wrong arguments. Provide an Object ID");
  unsigned long objectID;
  if (!ReadIndexArgument(args.Env(), args[0], objectID))
    return ThrowTypeError(args.Env(), kObjectIDError);
  XrefEntryInput *entry = reader->mPDFReader->GetXrefEntry(objectID);
  if (!entry)
    return ThrowTypeError(args.Env(), "Unable to read object xref entry, object "
                                      "ID is out of range");
  napi_value result = Object(args.Env());
  Set(args.Env(), result, "objectPosition",
      Number(args.Env(), entry->mObjectPosition));
  Set(args.Env(), result, "revision", Number(args.Env(), entry->mRivision));
  Set(args.Env(), result, "type", Number(args.Env(), entry->mType));
  return result;
}

static PDFStreamInputDriver *GetStreamInput(const CallbackArgs &args,
                                            PDFReaderDriver *reader) {
  if (args.Length() != 1 ||
      !reader->holder->IsPDFStreamInputInstance(args[0])) {
    ThrowTypeError(args.Env(), "Wrong arguments. provide a PDF stream input");
    return nullptr;
  }
  return ObjectWrap::Unwrap<PDFStreamInputDriver>(args.Env(), args[0]);
}

napi_value PDFReaderDriver::StartReadingFromStream(const CallbackArgs &args) {
  auto *reader = GetActiveReader(args);
  if (!reader)
    return nullptr;
  auto *stream = GetStreamInput(args, reader);
  if (!stream)
    return nullptr;
  napi_value result = reader->holder->GetNewByteReader();
  ByteReaderDriver *driver = nullptr;
  if (!ObjectWrap::UnwrapNew(args.Env(), result, &driver))
    return nullptr;
  IByteReader *streamReader =
      reader->mPDFReader->StartReadingFromStream(stream->TheObject.GetPtr());
  if (!streamReader)
    return ThrowError(args.Env(), "Unable to read PDF stream");
  driver->SetStream(streamReader, true);
  return result;
}

napi_value PDFReaderDriver::StartReadingFromStreamForPlainCopying(
    const CallbackArgs &args) {
  auto *reader = GetActiveReader(args);
  if (!reader)
    return nullptr;
  auto *stream = GetStreamInput(args, reader);
  if (!stream)
    return nullptr;
  napi_value result = reader->holder->GetNewByteReader();
  ByteReaderDriver *driver = nullptr;
  if (!ObjectWrap::UnwrapNew(args.Env(), result, &driver))
    return nullptr;
  IByteReader *streamReader =
      reader->mPDFReader->StartReadingFromStreamForPlainCopying(
          stream->TheObject.GetPtr());
  if (!streamReader)
    return ThrowError(args.Env(), "Unable to read PDF stream");
  driver->SetStream(streamReader, true);
  return result;
}

napi_value
PDFReaderDriver::StartReadingObjectsFromStream(const CallbackArgs &args) {
  auto *reader = GetActiveReader(args);
  if (!reader)
    return nullptr;
  auto *stream = GetStreamInput(args, reader);
  if (!stream)
    return nullptr;
  napi_value result = reader->holder->GetNewPDFObjectParser();
  PDFObjectParserDriver *driver = nullptr;
  if (!ObjectWrap::UnwrapNew(args.Env(), result, &driver))
    return nullptr;
  PDFObjectParser *objectsParser =
      reader->mPDFReader->StartReadingObjectsFromStream(
          stream->TheObject.GetPtr());
  if (!objectsParser)
    return ThrowError(args.Env(), "Unable to read PDF stream objects");
  driver->PDFObjectParserInstance = objectsParser;
  return result;
}

napi_value
PDFReaderDriver::StartReadingObjectsFromStreams(const CallbackArgs &args) {
  auto *reader = GetActiveReader(args);
  if (!reader)
    return nullptr;
  if (args.Length() != 1 || !reader->holder->IsPDFArrayInstance(args[0]))
    return ThrowTypeError(args.Env(), "Wrong arguments. provide a PDF array");
  auto *array = ObjectWrap::Unwrap<PDFArrayDriver>(args.Env(), args[0]);
  napi_value result = reader->holder->GetNewPDFObjectParser();
  PDFObjectParserDriver *driver = nullptr;
  if (!ObjectWrap::UnwrapNew(args.Env(), result, &driver))
    return nullptr;
  driver->PDFObjectParserInstance =
      reader->mPDFReader->StartReadingObjectsFromStreams(
          array->TheObject.GetPtr());
  return result;
}

napi_value PDFReaderDriver::GetParserStream(const CallbackArgs &args) {
  auto *reader = GetActiveReader(args);
  if (!reader)
    return nullptr;
  napi_value result = reader->holder->GetNewByteReaderWithPosition();
  ByteReaderWithPositionDriver *driver = nullptr;
  if (!ObjectWrap::UnwrapNew(args.Env(), result, &driver))
    return nullptr;
  driver->SetStream(reader->mPDFReader->GetParserStream(), false);
  return result;
}
