#include "PDFDateDriver.h"

#include <cstdlib>

using namespace muhammara::napi;

bool PDFDateDriver::Init(ModuleState &state, napi_value exports) {
  ClassBuilder builder(state, "PDFDate", New);
  builder.Method("toString", ToString)
      .Method("setToCurrentTime", SetToCurrentTime);
  return builder.Define(exports) != nullptr;
}

unsigned int
PDFDateDriver::GetUIntValueFromDateFunction(napi_env env, napi_value date,
                                            const char *functionName) {
  return ToUint32(env, Call(env, date, Get(env, date, functionName)));
}

int PDFDateDriver::GetIntValueFromDateFunction(napi_env env, napi_value date,
                                               const char *functionName) {
  return ToInt32(env, Call(env, date, Get(env, date, functionName)));
}

napi_value PDFDateDriver::New(const CallbackArgs &args) {
  auto *driver = new PDFDateDriver();
  if (args.Length() == 1) {
    if (IsDate(args.Env(), args[0])) {
      int offset =
          GetIntValueFromDateFunction(args.Env(), args[0], "getTimezoneOffset");
      long absoluteOffset = std::labs(offset);
      driver->mDate.SetTime(
          GetUIntValueFromDateFunction(args.Env(), args[0], "getFullYear"),
          GetUIntValueFromDateFunction(args.Env(), args[0], "getMonth") + 1,
          GetUIntValueFromDateFunction(args.Env(), args[0], "getDate"),
          GetUIntValueFromDateFunction(args.Env(), args[0], "getHours"),
          GetUIntValueFromDateFunction(args.Env(), args[0], "getMinutes"),
          GetUIntValueFromDateFunction(args.Env(), args[0], "getSeconds"),
          offset < 0 ? PDFDate::eLater : PDFDate::eEarlier,
          static_cast<int>(absoluteOffset / 60),
          static_cast<int>((absoluteOffset - (absoluteOffset / 60) * 60) / 60));
    } else if (IsType(args.Env(), args[0], napi_string)) {
      driver->mDate.ParseString(
          muhammara::napi::LegacyString(args.Env(), args[0]));
    }
  }
  if (!driver->Wrap(args.Env(), args.This())) {
    delete driver;
    return nullptr;
  }
  return args.This();
}

napi_value PDFDateDriver::ToString(const CallbackArgs &args) {
  auto *driver = ObjectWrap::Unwrap<PDFDateDriver>(args.Env(), args.This());
  return String(args.Env(), driver->mDate.ToString());
}

napi_value PDFDateDriver::SetToCurrentTime(const CallbackArgs &args) {
  auto *driver = ObjectWrap::Unwrap<PDFDateDriver>(args.Env(), args.This());
  driver->mDate.SetToCurrentTime();
  return args.This();
}

PDFDate *PDFDateDriver::getInstance() { return &mDate; }
