#include "PDFObjectDriver.h"

#include "BoxingBase.h"
#include "ConstructorsHolder.h"
#include "PDFBoolean.h"
#include "PDFHexString.h"
#include "PDFInteger.h"
#include "PDFLiteralString.h"
#include "PDFName.h"
#include "PDFObject.h"
#include "PDFReal.h"
#include "PDFSymbol.h"

using muhammara::napi::CallbackArgs;
using muhammara::napi::ClassBuilder;
using muhammara::napi::Number;
using muhammara::napi::ObjectWrap;
using muhammara::napi::String;
using muhammara::napi::Undefined;

void PDFObjectDriver::AddMethods(ClassBuilder &builder) {
  builder.Method("getType", GetType)
      .Method("toPDFIndirectObjectReference", ToPDFIndirectObjectReference)
      .Method("toPDFArray", ToPDFArray)
      .Method("toPDFDictionary", ToPDFDictionary)
      .Method("toPDFStream", ToPDFStream)
      .Method("toPDFBoolean", ToPDFBoolean)
      .Method("toPDFLiteralString", ToPDFLiteralString)
      .Method("toPDFHexString", ToPDFHexString)
      .Method("toPDFNull", ToPDFNull)
      .Method("toPDFName", ToPDFName)
      .Method("toPDFInteger", ToPDFInteger)
      .Method("toPDFReal", ToPDFReal)
      .Method("toPDFSymbol", ToPDFSymbol)
      .Method("toNumber", ToNumber)
      .Method("toString", ToString);
}

napi_value PDFObjectDriver::GetType(const CallbackArgs &args) {
  PDFObjectDriver *driver =
      ObjectWrap::Unwrap<PDFObjectDriver>(args.Env(), args.This());
  return Number(args.Env(),
                static_cast<unsigned long>(driver->GetObject()->GetType()));
}

napi_value PDFObjectDriver::Convert(const CallbackArgs &args,
                                    int expectedType) {
  PDFObjectDriver *driver =
      ObjectWrap::Unwrap<PDFObjectDriver>(args.Env(), args.This());
  PDFObject *object = driver->GetObject();
  if (object->GetType() != expectedType) {
    return Undefined(args.Env());
  }
  return driver->holder->GetInstanceFor(object);
}

#define DEFINE_CONVERSION(Method, Type)                                        \
  napi_value PDFObjectDriver::Method(const CallbackArgs &args) {               \
    return Convert(args, PDFObject::Type);                                     \
  }

DEFINE_CONVERSION(ToPDFIndirectObjectReference,
                  ePDFObjectIndirectObjectReference)
DEFINE_CONVERSION(ToPDFArray, ePDFObjectArray)
DEFINE_CONVERSION(ToPDFDictionary, ePDFObjectDictionary)
DEFINE_CONVERSION(ToPDFStream, ePDFObjectStream)
DEFINE_CONVERSION(ToPDFBoolean, ePDFObjectBoolean)
DEFINE_CONVERSION(ToPDFLiteralString, ePDFObjectLiteralString)
DEFINE_CONVERSION(ToPDFHexString, ePDFObjectHexString)
DEFINE_CONVERSION(ToPDFNull, ePDFObjectNull)
DEFINE_CONVERSION(ToPDFName, ePDFObjectName)
DEFINE_CONVERSION(ToPDFInteger, ePDFObjectInteger)
DEFINE_CONVERSION(ToPDFReal, ePDFObjectReal)
DEFINE_CONVERSION(ToPDFSymbol, ePDFObjectSymbol)

#undef DEFINE_CONVERSION

napi_value PDFObjectDriver::ToNumber(const CallbackArgs &args) {
  PDFObject *object =
      ObjectWrap::Unwrap<PDFObjectDriver>(args.Env(), args.This())->GetObject();
  if (object->GetType() == PDFObject::ePDFObjectInteger) {
    return Number(args.Env(), static_cast<PDFInteger *>(object)->GetValue());
  }
  if (object->GetType() == PDFObject::ePDFObjectReal) {
    return Number(args.Env(), static_cast<PDFReal *>(object)->GetValue());
  }
  return Undefined(args.Env());
}

napi_value PDFObjectDriver::ToString(const CallbackArgs &args) {
  PDFObject *object =
      ObjectWrap::Unwrap<PDFObjectDriver>(args.Env(), args.This())->GetObject();
  std::string result;
  switch (object->GetType()) {
  case PDFObject::ePDFObjectName:
    result = static_cast<PDFName *>(object)->GetValue();
    break;
  case PDFObject::ePDFObjectLiteralString:
    result = static_cast<PDFLiteralString *>(object)->GetValue();
    break;
  case PDFObject::ePDFObjectHexString:
    result = static_cast<PDFHexString *>(object)->GetValue();
    break;
  case PDFObject::ePDFObjectReal:
    result = Double(static_cast<PDFReal *>(object)->GetValue()).ToString();
    break;
  case PDFObject::ePDFObjectInteger:
    result = BoxingBaseWithRW<long long>(
                 static_cast<PDFInteger *>(object)->GetValue())
                 .ToString();
    break;
  case PDFObject::ePDFObjectSymbol:
    result = static_cast<PDFSymbol *>(object)->GetValue();
    break;
  case PDFObject::ePDFObjectBoolean:
    result = static_cast<PDFBoolean *>(object)->GetValue() ? "true" : "false";
    break;
  default:
    result = PDFObject::scPDFObjectTypeLabel(object->GetType());
  }
  return String(args.Env(), result);
}
