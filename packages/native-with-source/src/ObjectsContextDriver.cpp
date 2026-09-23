#include "ObjectsContextDriver.h"

#include "ByteWriterWithPositionDriver.h"
#include "ConstructorsHolder.h"
#include "DictionaryContext.h"
#include "DictionaryContextDriver.h"
#include "ETokenSeparator.h"
#include "ObjectsContext.h"
#include "PDFStreamDriver.h"

using namespace muhammara::napi;

namespace {
ObjectsContextDriver *Driver(const CallbackArgs &args) {
  return ObjectWrap::Unwrap<ObjectsContextDriver>(args.Env(), args.This());
}
bool StringOrBytes(const CallbackArgs &args, std::string &out) {
  return muhammara::napi::StringOrBytes(args.Env(), args[0], out);
}
bool OneNumber(const CallbackArgs &args, const char *error) {
  if (args.Length() == 1 && IsType(args.Env(), args[0], napi_number))
    return true;
  ThrowError(args.Env(), error);
  return false;
}
} // namespace

ObjectsContextDriver::ObjectsContextDriver()
    : ObjectsContextInstance(nullptr), holder(nullptr) {}

bool ObjectsContextDriver::Init(ModuleState &state, napi_value exports) {
  ClassBuilder b(state, "ObjectsContext", New);
  b.Method("allocateNewObjectID", AllocateNewObjectID)
      .Method("startDictionary", StartDictionary)
      .Method("startArray", StartArray)
      .Method("writeNumber", WriteNumber)
      .Method("endArray", EndArray)
      .Method("endLine", EndLine)
      .Method("endDictionary", EndDictionary)
      .Method("endIndirectObject", EndIndirectObject)
      .Method("writeIndirectObjectReference", WriteIndirectObjectReference)
      .Method("startNewIndirectObject", StartNewIndirectObject)
      .Method("startModifiedIndirectObject", StartModifiedIndirectObject)
      .Method("deleteObject", DeleteObject)
      .Method("writeName", WriteName)
      .Method("writeLiteralString", WriteLiteralString)
      .Method("writeHexString", WriteHexString)
      .Method("writeBoolean", WriteBoolean)
      .Method("writeKeyword", WriteKeyword)
      .Method("writeComment", WriteComment)
      .Method("setCompressStreams", SetCompressStreams)
      .Method("startPDFStream", StartPDFStream)
      .Method("startUnfilteredPDFStream", StartUnfilteredPDFStream)
      .Method("endPDFStream", EndPDFStream)
      .Method("startFreeContext", StartFreeContext)
      .Method("endFreeContext", EndFreeContext);
  return b.Define(exports, false) != nullptr;
}
napi_value ObjectsContextDriver::New(const CallbackArgs &a) {
  auto *d = new ObjectsContextDriver();
  d->holder = &ModuleState::Get(a.Env())->Constructors();
  if (!d->Wrap(a.Env(), a.This())) {
    delete d;
    return nullptr;
  }
  return a.This();
}
napi_value ObjectsContextDriver::AllocateNewObjectID(const CallbackArgs &a) {
  return Number(a.Env(),
                Driver(a)
                    ->ObjectsContextInstance->GetInDirectObjectsRegistry()
                    .AllocateNewObjectID());
}
napi_value ObjectsContextDriver::DeleteObject(const CallbackArgs &a) {
  if (!OneNumber(a,
                 "wrong arguments, pass 1 argument that is an object number"))
    return nullptr;
  Driver(a)->ObjectsContextInstance->GetInDirectObjectsRegistry().DeleteObject(
      ToUint32(a.Env(), a[0]));
  return a.This();
}
napi_value ObjectsContextDriver::StartDictionary(const CallbackArgs &a) {
  auto *d = Driver(a);
  napi_value value = d->holder->GetNewDictionaryContext();
  DictionaryContextDriver *driver = nullptr;
  if (!ObjectWrap::UnwrapNew(a.Env(), value, &driver))
    return nullptr;
  driver->DictionaryContextInstance =
      d->ObjectsContextInstance->StartDictionary();
  return value;
}
napi_value ObjectsContextDriver::StartArray(const CallbackArgs &a) {
  Driver(a)->ObjectsContextInstance->StartArray();
  return a.This();
}
napi_value ObjectsContextDriver::WriteNumber(const CallbackArgs &a) {
  if (!OneNumber(a, "wrong arguments, pass 1 argument that is a number"))
    return nullptr;
  double v = ToDouble(a.Env(), a[0]);
  int32_t s = ToInt32(a.Env(), a[0]);
  uint32_t u = ToUint32(a.Env(), a[0]);
  if (v == u)
    Driver(a)->ObjectsContextInstance->WriteInteger(u);
  else if (v == s)
    Driver(a)->ObjectsContextInstance->WriteInteger(s);
  else
    Driver(a)->ObjectsContextInstance->WriteDouble(v);
  return a.This();
}
napi_value ObjectsContextDriver::EndArray(const CallbackArgs &a) {
  if ((a.Length() != 0 && a.Length() != 1) ||
      (a.Length() == 1 && !IsType(a.Env(), a[0], napi_number)))
    return ThrowError(a.Env(), "wrong arguments, pass 1 optional argument that "
                               "defined the array ending");
  if (a.Length())
    Driver(a)->ObjectsContextInstance->EndArray(
        static_cast<ETokenSeparator>(ToUint32(a.Env(), a[0])));
  else
    Driver(a)->ObjectsContextInstance->EndArray();
  return a.This();
}
napi_value ObjectsContextDriver::EndLine(const CallbackArgs &a) {
  Driver(a)->ObjectsContextInstance->EndLine();
  return a.This();
}
napi_value ObjectsContextDriver::EndDictionary(const CallbackArgs &a) {
  auto *d = Driver(a);
  if (a.Length() != 1 || !d->holder->IsDictionaryContextInstance(a[0]))
    return ThrowError(a.Env(),
                      "Wrong arguments. Please provide a dictionary to end");
  auto *dict = ObjectWrap::Unwrap<DictionaryContextDriver>(a.Env(), a[0]);
  if (d->ObjectsContextInstance->EndDictionary(
          dict->DictionaryContextInstance) != PDFHummus::eSuccess)
    return ThrowError(a.Env(), "Inconsistent ending of dictionary. Wrong "
                               "nesting of startDictionary and endDictionary");
  return a.This();
}
napi_value ObjectsContextDriver::EndIndirectObject(const CallbackArgs &a) {
  Driver(a)->ObjectsContextInstance->EndIndirectObject();
  return a.This();
}
napi_value
ObjectsContextDriver::WriteIndirectObjectReference(const CallbackArgs &a) {
  if ((a.Length() != 1 && a.Length() != 2) ||
      !IsType(a.Env(), a[0], napi_number) ||
      (a.Length() == 2 && !IsType(a.Env(), a[1], napi_number)))
    return ThrowError(a.Env(), "wrong arguments. Provide object ID to write "
                               "reference for and optionally a version number");
  if (a.Length() == 1)
    Driver(a)->ObjectsContextInstance->WriteIndirectObjectReference(
        ToUint32(a.Env(), a[0]));
  else
    Driver(a)->ObjectsContextInstance->WriteIndirectObjectReference(
        ToUint32(a.Env(), a[0]), ToUint32(a.Env(), a[1]));
  return a.This();
}
napi_value ObjectsContextDriver::StartNewIndirectObject(const CallbackArgs &a) {
  if ((a.Length() != 0 && a.Length() != 1) ||
      (a.Length() == 1 && !IsType(a.Env(), a[0], napi_number)))
    return ThrowError(a.Env(), "wrong arguments, pass no arguments, or pass 1 "
                               "argument that is an object ID");
  if (!a.Length())
    return Number(a.Env(),
                  Driver(a)->ObjectsContextInstance->StartNewIndirectObject());
  Driver(a)->ObjectsContextInstance->StartNewIndirectObject(
      ToUint32(a.Env(), a[0]));
  return a.This();
}
napi_value
ObjectsContextDriver::StartModifiedIndirectObject(const CallbackArgs &a) {
  if (!OneNumber(a, "wrong arguments, pass 1 argument that is an object ID"))
    return nullptr;
  Driver(a)->ObjectsContextInstance->StartModifiedIndirectObject(
      ToUint32(a.Env(), a[0]));
  return a.This();
}
#define STRING_WRITER(Method, Native, Error)                                   \
  napi_value ObjectsContextDriver::Method(const CallbackArgs &a) {             \
    if (a.Length() != 1 || !IsType(a.Env(), a[0], napi_string))                \
      return ThrowError(a.Env(), Error);                                       \
    Driver(a)->ObjectsContextInstance->Native(LegacyString(a.Env(), a[0]));    \
    return a.This();                                                           \
  }
STRING_WRITER(WriteName, WriteName,
              "wrong arguments, pass 1 argument that is a name (string)")
STRING_WRITER(WriteKeyword, WriteKeyword,
              "wrong arguments, pass 1 argument that is a keyword (string)")
STRING_WRITER(WriteComment, WriteComment,
              "wrong arguments, pass 1 argument that is a comment (string)")
#undef STRING_WRITER
napi_value ObjectsContextDriver::WriteLiteralString(const CallbackArgs &a) {
  if (a.Length() != 1 ||
      (!IsType(a.Env(), a[0], napi_string) && !IsArray(a.Env(), a[0])))
    return ThrowError(a.Env(), "wrong arguments, pass 1 argument that is a "
                               "literal string (string) or an array");
  std::string value;
  if (!StringOrBytes(a, value))
    return nullptr;
  Driver(a)->ObjectsContextInstance->WriteLiteralString(value);
  return a.This();
}
napi_value ObjectsContextDriver::WriteHexString(const CallbackArgs &a) {
  if (a.Length() != 1 ||
      (!IsType(a.Env(), a[0], napi_string) && !IsArray(a.Env(), a[0])))
    return ThrowError(a.Env(), "wrong arguments, pass 1 argument that is a "
                               "literal string (string) or an array");
  std::string value;
  if (!StringOrBytes(a, value))
    return nullptr;
  Driver(a)->ObjectsContextInstance->WriteHexString(value);
  return a.This();
}
napi_value ObjectsContextDriver::WriteBoolean(const CallbackArgs &a) {
  if (a.Length() != 1 || !IsType(a.Env(), a[0], napi_boolean))
    return ThrowError(a.Env(),
                      "wrong arguments, pass 1 argument that is a boolean");
  Driver(a)->ObjectsContextInstance->WriteBoolean(ToBoolean(a.Env(), a[0]));
  return a.This();
}
napi_value ObjectsContextDriver::SetCompressStreams(const CallbackArgs &a) {
  if (a.Length() != 1 || !IsType(a.Env(), a[0], napi_boolean))
    return ThrowError(a.Env(),
                      "wrong arguments, pass 1 argument that is a boolean, "
                      "determining whether streams are to be compressed");
  Driver(a)->ObjectsContextInstance->SetCompressStreams(
      ToBoolean(a.Env(), a[0]));
  return a.This();
}
static napi_value StartStream(const CallbackArgs &a, bool filtered) {
  auto *d = Driver(a);
  if ((a.Length() != 0 && a.Length() != 1) ||
      (a.Length() == 1 && !d->holder->IsDictionaryContextInstance(a[0])))
    return ThrowError(a.Env(), "wrong arguments, please provide no arguments "
                               "or an optional stream dictionary");
  DictionaryContext *dict =
      a.Length() ? ObjectWrap::Unwrap<DictionaryContextDriver>(a.Env(), a[0])
                       ->DictionaryContextInstance
                 : nullptr;
  napi_value value = d->holder->GetNewPDFStream();
  PDFStreamDriver *sd = nullptr;
  if (!ObjectWrap::UnwrapNew(a.Env(), value, &sd))
    return nullptr;
  sd->PDFStreamInstance =
      filtered
          ? (dict ? d->ObjectsContextInstance->StartPDFStream(dict)
                  : d->ObjectsContextInstance->StartPDFStream())
          : (dict ? d->ObjectsContextInstance->StartUnfilteredPDFStream(dict)
                  : d->ObjectsContextInstance->StartUnfilteredPDFStream());
  sd->mOwns = true;
  return value;
}
napi_value ObjectsContextDriver::StartPDFStream(const CallbackArgs &a) {
  return StartStream(a, true);
}
napi_value
ObjectsContextDriver::StartUnfilteredPDFStream(const CallbackArgs &a) {
  return StartStream(a, false);
}
napi_value ObjectsContextDriver::EndPDFStream(const CallbackArgs &a) {
  auto *d = Driver(a);
  if (a.Length() != 1 || !d->holder->IsPDFStreamInstance(a[0]))
    return ThrowError(a.Env(), "wrong arguments, provide a stream to end");
  d->ObjectsContextInstance->EndPDFStream(
      ObjectWrap::Unwrap<PDFStreamDriver>(a.Env(), a[0])->PDFStreamInstance);
  return a.This();
}
napi_value ObjectsContextDriver::StartFreeContext(const CallbackArgs &a) {
  auto *d = Driver(a);
  napi_value value = d->holder->GetNewByteWriterWithPosition();
  ByteWriterWithPositionDriver *writer = nullptr;
  if (!ObjectWrap::UnwrapNew(a.Env(), value, &writer))
    return nullptr;
  writer->SetStream(d->ObjectsContextInstance->StartFreeContext(), false);
  return value;
}
napi_value ObjectsContextDriver::EndFreeContext(const CallbackArgs &a) {
  Driver(a)->ObjectsContextInstance->EndFreeContext();
  return a.This();
}
