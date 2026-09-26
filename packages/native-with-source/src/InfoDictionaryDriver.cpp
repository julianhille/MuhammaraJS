#include "InfoDictionaryDriver.h"

#include "ConstructorsHolder.h"
#include "InfoDictionary.h"
#include "PDFDateDriver.h"
#include "PDFTextString.h"
#include <cstring>

using namespace muhammara::napi;

namespace {
const char *kUninitialized =
    "info dictionary driver not initialized. use the document context object "
    "to get a valid info dictionary";
InfoDictionaryDriver *Driver(const CallbackArgs &args) {
  return ObjectWrap::Unwrap<InfoDictionaryDriver>(args.Env(), args.This());
}
PDFTextString *TextField(InfoDictionary *info, const char *name) {
  if (!strcmp(name, "title"))
    return &info->Title;
  if (!strcmp(name, "author"))
    return &info->Author;
  if (!strcmp(name, "subject"))
    return &info->Subject;
  if (!strcmp(name, "keywords"))
    return &info->Keywords;
  if (!strcmp(name, "creator"))
    return &info->Creator;
  return &info->Producer;
}
} // namespace

InfoDictionaryDriver::InfoDictionaryDriver()
    : InfoDictionaryInstance(nullptr), holder(nullptr) {}
bool InfoDictionaryDriver::Init(ModuleState &state, napi_value exports) {
  ClassBuilder b(state, "InfoDictionary", New);
  b.Method("addAdditionalInfoEntry", AddAdditionalInfoEntry)
      .Method("removeAdditionalInfoEntry", RemoveAdditionalInfoEntry)
      .Method("clearAdditionalInfoEntries", ClearAdditionalInfoEntries)
      .Method("getAdditionalInfoEntry", GetAdditionalInfoEntry)
      .Method("getAdditionalInfoEntries", GetAdditionalInfoEntries)
      .Method("setCreationDate", SetCreationDate)
      .Method("setModDate", SetModDate);
  const char *fields[] = {"title",    "author",  "subject",
                          "keywords", "creator", "producer"};
  for (const char *field : fields)
    b.Accessor(field, GetText, SetText, const_cast<char *>(field));
  b.Accessor("trapped", GetTrapped, SetTrapped);
  return b.Define(exports, false) != nullptr;
}
napi_value InfoDictionaryDriver::New(const CallbackArgs &args) {
  auto *driver = new InfoDictionaryDriver();
  driver->holder = &ModuleState::Get(args.Env())->Constructors();
  if (!driver->Wrap(args.Env(), args.This())) {
    delete driver;
    return nullptr;
  }
  return args.This();
}
napi_value InfoDictionaryDriver::GetText(const CallbackArgs &args) {
  auto *driver = Driver(args);
  if (!driver->InfoDictionaryInstance)
    return ThrowTypeError(args.Env(), kUninitialized);
  return String(args.Env(), TextField(driver->InfoDictionaryInstance,
                                      static_cast<const char *>(args.Data()))
                                ->ToUTF8String());
}
napi_value InfoDictionaryDriver::SetText(const CallbackArgs &args) {
  auto *driver = Driver(args);
  if (!driver->InfoDictionaryInstance)
    return ThrowTypeError(args.Env(), kUninitialized);
  std::string value = LegacyString(args.Env(), args[0]);
  if (HasPendingException(args.Env()))
    return nullptr;
  TextField(driver->InfoDictionaryInstance,
            static_cast<const char *>(args.Data()))
      ->FromUTF8(value);
  return Undefined(args.Env());
}
napi_value InfoDictionaryDriver::GetTrapped(const CallbackArgs &args) {
  auto *driver = Driver(args);
  return driver->InfoDictionaryInstance
             ? Number(args.Env(), driver->InfoDictionaryInstance->Trapped)
             : ThrowTypeError(args.Env(), kUninitialized);
}
napi_value InfoDictionaryDriver::SetTrapped(const CallbackArgs &args) {
  auto *driver = Driver(args);
  if (!driver->InfoDictionaryInstance)
    return ThrowTypeError(args.Env(), kUninitialized);
  driver->InfoDictionaryInstance->Trapped =
      static_cast<EInfoTrapped>(ToUint32(args.Env(), args[0]));
  return Undefined(args.Env());
}
static napi_value SetDate(const CallbackArgs &args, bool creation) {
  auto *driver = Driver(args);
  if (!driver->InfoDictionaryInstance)
    return ThrowTypeError(args.Env(), kUninitialized);
  std::vector<napi_value> values;
  for (size_t i = 0; i < args.Length(); ++i)
    values.push_back(args[i]);
  napi_value value = driver->holder->GetNewPDFDate(values);
  PDFDateDriver *dateDriver = nullptr;
  if (!ObjectWrap::UnwrapNew(args.Env(), value, &dateDriver))
    return nullptr;
  PDFDate date = *dateDriver->getInstance();
  if (creation)
    driver->InfoDictionaryInstance->CreationDate = date;
  else
    driver->InfoDictionaryInstance->ModDate = date;
  return Undefined(args.Env());
}
napi_value InfoDictionaryDriver::SetCreationDate(const CallbackArgs &args) {
  return SetDate(args, true);
}
napi_value InfoDictionaryDriver::SetModDate(const CallbackArgs &args) {
  return SetDate(args, false);
}
napi_value
InfoDictionaryDriver::AddAdditionalInfoEntry(const CallbackArgs &args) {
  auto *d = Driver(args);
  if (!d->InfoDictionaryInstance)
    return ThrowTypeError(args.Env(), kUninitialized);
  if (args.Length() != 2 || !IsType(args.Env(), args[0], napi_string) ||
      !IsType(args.Env(), args[1], napi_string))
    return ThrowTypeError(
        args.Env(),
        "wrong arguments. please provide two strings - key and value ");
  PDFTextString value;
  value.FromUTF8(LegacyString(args.Env(), args[1]));
  d->InfoDictionaryInstance->AddAdditionalInfoEntry(
      LegacyString(args.Env(), args[0]), value);
  return Undefined(args.Env());
}
napi_value
InfoDictionaryDriver::RemoveAdditionalInfoEntry(const CallbackArgs &args) {
  auto *d = Driver(args);
  if (!d->InfoDictionaryInstance)
    return ThrowTypeError(args.Env(), kUninitialized);
  if (args.Length() != 1 || !IsType(args.Env(), args[0], napi_string))
    return ThrowTypeError(
        args.Env(),
        "wrong arguments. please provide key of the entry to remove ");
  d->InfoDictionaryInstance->RemoveAdditionalInfoEntry(
      LegacyString(args.Env(), args[0]));
  return Undefined(args.Env());
}
napi_value
InfoDictionaryDriver::ClearAdditionalInfoEntries(const CallbackArgs &args) {
  auto *d = Driver(args);
  if (!d->InfoDictionaryInstance)
    return ThrowTypeError(args.Env(), kUninitialized);
  d->InfoDictionaryInstance->ClearAdditionalInfoEntries();
  return Undefined(args.Env());
}
napi_value
InfoDictionaryDriver::GetAdditionalInfoEntry(const CallbackArgs &args) {
  auto *d = Driver(args);
  if (!d->InfoDictionaryInstance)
    return ThrowTypeError(args.Env(), kUninitialized);
  if (args.Length() != 1 || !IsType(args.Env(), args[0], napi_string))
    return ThrowTypeError(
        args.Env(),
        "wrong arguments. please provide key of the entry to return ");
  return String(args.Env(),
                d->InfoDictionaryInstance
                    ->GetAdditionalInfoEntry(LegacyString(args.Env(), args[0]))
                    .ToUTF8String());
}
napi_value
InfoDictionaryDriver::GetAdditionalInfoEntries(const CallbackArgs &args) {
  auto *d = Driver(args);
  if (!d->InfoDictionaryInstance)
    return ThrowTypeError(args.Env(), kUninitialized);
  napi_value result = Object(args.Env());
  MapIterator<StringToPDFTextString> it =
      d->InfoDictionaryInstance->GetAdditionaEntriesIterator();
  while (it.MoveNext())
    Set(args.Env(), result, it.GetKey().c_str(),
        String(args.Env(), it.GetValue().ToUTF8String()));
  return result;
}
