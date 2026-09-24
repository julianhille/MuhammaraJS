#include "ResourcesDictionaryDriver.h"

#include "ConstructorsHolder.h"
#include "ImageXObjectDriver.h"
#include "ResourcesDictionary.h"

using namespace muhammara::napi;

ResourcesDictionaryDriver::ResourcesDictionaryDriver()
    : ResourcesDictionaryInstance(nullptr), holder(nullptr) {}

bool ResourcesDictionaryDriver::Init(ModuleState &state, napi_value exports) {
  ClassBuilder builder(state, "ResourcesDictionary", New);
  builder.Method("addFormXObjectMapping", AddFormXObjectMapping)
      .Method("addImageXObjectMapping", AddImageXObjectMapping)
      .Method("addProcsetResource", AddProcsetResource)
      .Method("addExtGStateMapping", AddExtGStateMapping)
      .Method("addFontMapping", AddFontMapping)
      .Method("addColorSpaceMapping", AddColorSpaceMapping)
      .Method("addPatternMapping", AddPatternMapping)
      .Method("addPropertyMapping", AddPropertyMapping)
      .Method("addXObjectMapping", AddXObjectMapping)
      .Method("addShadingMapping", AddShadingMapping);
  return builder.Define(exports, false) != nullptr;
}

napi_value ResourcesDictionaryDriver::New(const CallbackArgs &args) {
  auto *driver = new ResourcesDictionaryDriver();
  driver->holder = &ModuleState::Get(args.Env())->Constructors();
  if (!driver->Wrap(args.Env(), args.This())) {
    delete driver;
    return nullptr;
  }
  return args.This();
}

#define ID_MAPPING(Method, NativeMethod, Message)                              \
  napi_value ResourcesDictionaryDriver::Method(const CallbackArgs &args) {     \
    if (args.Length() != 1 || !IsType(args.Env(), args[0], napi_number))       \
      return ThrowTypeError(args.Env(), Message);                              \
    auto *driver = ObjectWrap::Unwrap<ResourcesDictionaryDriver>(args.Env(),   \
                                                                 args.This()); \
    return String(args.Env(),                                                  \
                  driver->ResourcesDictionaryInstance->NativeMethod(           \
                      ToUint32(args.Env(), args[0])));                         \
  }

ID_MAPPING(AddFormXObjectMapping, AddFormXObjectMapping,
           "wrong arguments, pass 1 argument which is the form xobject id")
ID_MAPPING(AddExtGStateMapping, AddExtGStateMapping,
           "wrong arguments, pass 1 argument which is the external graphic "
           "state object id")
ID_MAPPING(AddFontMapping, AddFontMapping,
           "wrong arguments, pass 1 argument which is the font object id")
ID_MAPPING(AddColorSpaceMapping, AddColorSpaceMapping,
           "wrong arguments, pass 1 argument which is the color space id")
ID_MAPPING(AddPatternMapping, AddPatternMapping,
           "wrong arguments, pass 1 argument which is the pattern object id")
ID_MAPPING(AddPropertyMapping, AddPropertyMapping,
           "wrong arguments, pass 1 argument which is the property object id")
ID_MAPPING(AddXObjectMapping, AddXObjectMapping,
           "wrong arguments, pass 1 argument which is the xobject id")
ID_MAPPING(AddShadingMapping, AddShadingMapping,
           "wrong arguments, pass 1 argument which is the shading object id")
#undef ID_MAPPING

napi_value
ResourcesDictionaryDriver::AddImageXObjectMapping(const CallbackArgs &args) {
  if (args.Length() != 1)
    return ThrowTypeError(args.Env(),
                          "wrong arguments, pass 1 argument which is "
                          "the image xobject or its ID");
  auto *driver =
      ObjectWrap::Unwrap<ResourcesDictionaryDriver>(args.Env(), args.This());
  if (driver->holder->IsImageXObjectInstance(args[0])) {
    auto *image = ObjectWrap::Unwrap<ImageXObjectDriver>(args.Env(), args[0]);
    return String(args.Env(),
                  driver->ResourcesDictionaryInstance->AddImageXObjectMapping(
                      image->ImageXObject));
  }
  if (IsType(args.Env(), args[0], napi_number))
    return String(args.Env(),
                  driver->ResourcesDictionaryInstance->AddImageXObjectMapping(
                      ToUint32(args.Env(), args[0])));
  return ThrowTypeError(
      args.Env(),
      "wrong arguments, pass 1 argument which is the image xobject or its ID");
}

napi_value
ResourcesDictionaryDriver::AddProcsetResource(const CallbackArgs &args) {
  if (args.Length() != 1 || !IsType(args.Env(), args[0], napi_string))
    return ThrowTypeError(
        args.Env(),
        "wrong arguments, pass 1 argument which is the procset name");
  auto *driver =
      ObjectWrap::Unwrap<ResourcesDictionaryDriver>(args.Env(), args.This());
  driver->ResourcesDictionaryInstance->AddProcsetResource(
      LegacyString(args.Env(), args[0]));
  return Undefined(args.Env());
}
