#include "InputFileDriver.h"

#include "ByteReaderWithPositionDriver.h"
#include "ConstructorsHolder.h"
#include "InputFile.h"

using namespace muhammara::napi;

InputFileDriver::InputFileDriver()
    : holder(nullptr), mInputFileInstance(new InputFile()),
      mOwnsInstance(true) {}
InputFileDriver::~InputFileDriver() {
  if (mOwnsInstance)
    delete mInputFileInstance;
}

PDFHummus::EStatusCode InputFileDriver::OpenFile(const std::string &path) {
  if (!mInputFileInstance)
    mInputFileInstance = new InputFile();
  mOwnsInstance = true;
  return mInputFileInstance->OpenFile(path);
}

void InputFileDriver::SetFromOwnedFile(InputFile *file) {
  if (mInputFileInstance && mOwnsInstance)
    delete mInputFileInstance;
  mOwnsInstance = false;
  mInputFileInstance = file;
}

bool InputFileDriver::Init(ModuleState &state, napi_value exports) {
  ClassBuilder builder(state, "InputFile", New);
  builder.Method("openFile", OpenFileJS)
      .Method("closeFile", CloseFile)
      .Method("getFilePath", GetFilePath)
      .Method("getFileSize", GetFileSize)
      .Method("getInputStream", GetInputStream);
  return builder.Define(exports) != nullptr;
}

napi_value InputFileDriver::New(const CallbackArgs &args) {
  auto *driver = new InputFileDriver();
  driver->holder = &ModuleState::Get(args.Env())->Constructors();
  if (args.Length() == 1 && IsType(args.Env(), args[0], napi_string))
    driver->OpenFile(LegacyString(args.Env(), args[0]));
  if (!driver->Wrap(args.Env(), args.This())) {
    delete driver;
    return nullptr;
  }
  return args.This();
}

napi_value InputFileDriver::OpenFileJS(const CallbackArgs &args) {
  if (args.Length() != 1 || !IsType(args.Env(), args[0], napi_string))
    return ThrowError(
        args.Env(),
        "wrong arguments. please provide a string for the file path");
  auto *driver = ObjectWrap::Unwrap<InputFileDriver>(args.Env(), args.This());
  if (!driver)
    return ThrowError(args.Env(),
                      "no driver created...please create one through Hummus");
  if (driver->OpenFile(LegacyString(args.Env(), args[0])) !=
      PDFHummus::eSuccess)
    return ThrowError(args.Env(), "can't open file. make sure path exists");
  return Undefined(args.Env());
}

napi_value InputFileDriver::CloseFile(const CallbackArgs &args) {
  auto *driver = ObjectWrap::Unwrap<InputFileDriver>(args.Env(), args.This());
  if (!driver)
    return ThrowError(args.Env(),
                      "no driver created...please create one through Hummus");
  if (driver->mInputFileInstance)
    driver->mInputFileInstance->CloseFile();
  return Undefined(args.Env());
}

napi_value InputFileDriver::GetFilePath(const CallbackArgs &args) {
  auto *driver = ObjectWrap::Unwrap<InputFileDriver>(args.Env(), args.This());
  if (!driver)
    return ThrowError(args.Env(),
                      "no driver created...please create one through Hummus");
  return driver->mInputFileInstance &&
                 driver->mInputFileInstance->GetInputStream()
             ? String(args.Env(), driver->mInputFileInstance->GetFilePath())
             : Undefined(args.Env());
}

napi_value InputFileDriver::GetFileSize(const CallbackArgs &args) {
  auto *driver = ObjectWrap::Unwrap<InputFileDriver>(args.Env(), args.This());
  if (!driver)
    return ThrowError(args.Env(),
                      "no driver created...please create one through Hummus");
  return driver->mInputFileInstance &&
                 driver->mInputFileInstance->GetInputStream()
             ? Number(args.Env(), driver->mInputFileInstance->GetFileSize())
             : Undefined(args.Env());
}

napi_value InputFileDriver::GetInputStream(const CallbackArgs &args) {
  auto *driver = ObjectWrap::Unwrap<InputFileDriver>(args.Env(), args.This());
  if (!driver)
    return ThrowError(args.Env(),
                      "no driver created...please create one through Hummus");
  if (!driver->mInputFileInstance ||
      !driver->mInputFileInstance->GetInputStream())
    return Undefined(args.Env());
  napi_value result = driver->holder->GetNewByteReaderWithPosition();
  ByteReaderWithPositionDriver *reader = nullptr;
  if (!ObjectWrap::UnwrapNew(args.Env(), result, &reader))
    return nullptr;
  reader->SetStream(driver->mInputFileInstance->GetInputStream(), false);
  return result;
}
