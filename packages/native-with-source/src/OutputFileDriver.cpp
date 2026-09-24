#include "OutputFileDriver.h"

#include "ByteWriterWithPositionDriver.h"
#include "ConstructorsHolder.h"
#include "OutputFile.h"

using namespace muhammara::napi;

OutputFileDriver::OutputFileDriver()
    : holder(nullptr), outputFile_(new OutputFile()), owns_(true) {}
OutputFileDriver::~OutputFileDriver() {
  if (owns_)
    delete outputFile_;
}
PDFHummus::EStatusCode OutputFileDriver::OpenFile(const std::string &path,
                                                  bool append) {
  if (!outputFile_)
    outputFile_ = new OutputFile();
  owns_ = true;
  return outputFile_->OpenFile(path, append);
}
void OutputFileDriver::SetFromOwnedFile(OutputFile *file) {
  if (outputFile_ && owns_)
    delete outputFile_;
  owns_ = false;
  outputFile_ = file;
}
bool OutputFileDriver::Init(ModuleState &state, napi_value exports) {
  ClassBuilder builder(state, "OutputFile", New);
  builder.Method("openFile", OpenFileJS)
      .Method("closeFile", CloseFile)
      .Method("getFilePath", GetFilePath)
      .Method("getOutputStream", GetOutputStream);
  return builder.Define(exports) != nullptr;
}
napi_value OutputFileDriver::New(const CallbackArgs &args) {
  auto *driver = new OutputFileDriver();
  driver->holder = &ModuleState::Get(args.Env())->Constructors();
  if ((args.Length() == 1 || args.Length() == 2) &&
      IsType(args.Env(), args[0], napi_string))
    driver->OpenFile(LegacyString(args.Env(), args[0]),
                     args.Length() == 2 &&
                         IsType(args.Env(), args[1], napi_boolean) &&
                         ToBoolean(args.Env(), args[1]));
  if (!driver->Wrap(args.Env(), args.This())) {
    delete driver;
    return nullptr;
  }
  return args.This();
}
napi_value OutputFileDriver::OpenFileJS(const CallbackArgs &args) {
  if ((args.Length() != 1 && args.Length() != 2) ||
      !IsType(args.Env(), args[0], napi_string) ||
      (args.Length() == 2 && !IsType(args.Env(), args[1], napi_boolean)))
    return ThrowTypeError(
        args.Env(), "wrong arguments. please provide a string for the file "
                    "path and optional boolean flag to determine whether "
                    "this file is opened for appending");
  auto *driver = ObjectWrap::Unwrap<OutputFileDriver>(args.Env(), args.This());
  if (!driver)
    return ThrowTypeError(
        args.Env(), "no driver created...please create one through Hummus");
  if (driver->OpenFile(LegacyString(args.Env(), args[0]),
                       args.Length() == 2 && ToBoolean(args.Env(), args[1])) !=
      PDFHummus::eSuccess)
    return ThrowTypeError(args.Env(),
                          "can't open file. make sure path is not busy");
  return Undefined(args.Env());
}
napi_value OutputFileDriver::CloseFile(const CallbackArgs &args) {
  auto *driver = ObjectWrap::Unwrap<OutputFileDriver>(args.Env(), args.This());
  if (!driver)
    return ThrowTypeError(
        args.Env(), "no driver created...please create one through Hummus");
  if (driver->outputFile_)
    driver->outputFile_->CloseFile();
  return Undefined(args.Env());
}
napi_value OutputFileDriver::GetFilePath(const CallbackArgs &args) {
  auto *driver = ObjectWrap::Unwrap<OutputFileDriver>(args.Env(), args.This());
  if (!driver)
    return ThrowTypeError(
        args.Env(), "no driver created...please create one through Hummus");
  return driver->outputFile_ && driver->outputFile_->GetOutputStream()
             ? String(args.Env(), driver->outputFile_->GetFilePath())
             : Undefined(args.Env());
}
napi_value OutputFileDriver::GetOutputStream(const CallbackArgs &args) {
  auto *driver = ObjectWrap::Unwrap<OutputFileDriver>(args.Env(), args.This());
  if (!driver)
    return ThrowTypeError(
        args.Env(), "no driver created...please create one through Hummus");
  if (!driver->outputFile_ || !driver->outputFile_->GetOutputStream())
    return Undefined(args.Env());
  napi_value value = driver->holder->GetNewByteWriterWithPosition();
  ByteWriterWithPositionDriver *writer = nullptr;
  if (!ObjectWrap::UnwrapNew(args.Env(), value, &writer))
    return nullptr;
  writer->SetStream(driver->outputFile_->GetOutputStream(), false);
  return value;
}
