#include "ImageXObjectDriver.h"

#include "PDFImageXObject.h"

using namespace muhammara::napi;

ImageXObjectDriver::ImageXObjectDriver()
    : ImageXObject(nullptr), holder(nullptr) {}
ImageXObjectDriver::~ImageXObjectDriver() { delete ImageXObject; }

bool ImageXObjectDriver::Init(ModuleState &state, napi_value exports) {
  ClassBuilder builder(state, "ImageXObject", New);
  builder.Accessor("id", GetID);
  return builder.Define(exports, false) != nullptr;
}

napi_value ImageXObjectDriver::New(const CallbackArgs &args) {
  auto *driver = new ImageXObjectDriver();
  if (!driver->Wrap(args.Env(), args.This())) {
    delete driver;
    return nullptr;
  }
  return args.This();
}

napi_value ImageXObjectDriver::GetID(const CallbackArgs &args) {
  auto *driver =
      ObjectWrap::Unwrap<ImageXObjectDriver>(args.Env(), args.This());
  if (!driver->ImageXObject) {
    return ThrowError(args.Env(), "image object not initialized, create using "
                                  "pdfWriter.createFormXObject");
  }
  return Number(args.Env(), driver->ImageXObject->GetImageObjectID());
}
