#include "ConstructorsHolder.h"

#include "ByteReaderDriver.h"
#include "ByteReaderWithPositionDriver.h"
#include "ByteWriterDriver.h"
#include "DictionaryContextDriver.h"
#include "DocumentContextDriver.h"
#include "DocumentCopyingContextDriver.h"
#include "FormXObjectDriver.h"
#include "ImageXObjectDriver.h"
#include "ObjectsContextDriver.h"
#include "PDFArrayDriver.h"
#include "PDFBooleanDriver.h"
#include "PDFDictionaryDriver.h"
#include "PDFHexStringDriver.h"
#include "PDFIndirectObjectReferenceDriver.h"
#include "PDFIntegerDriver.h"
#include "PDFLiteralStringDriver.h"
#include "PDFNameDriver.h"
#include "PDFNullDriver.h"
#include "PDFObject.h"
#include "PDFObjectParserDriver.h"
#include "PDFPageDriver.h"
#include "PDFPageInputDriver.h"
#include "PDFReaderDriver.h"
#include "PDFRealDriver.h"
#include "PDFStreamDriver.h"
#include "PDFStreamInputDriver.h"
#include "PDFSymbolDriver.h"
#include "PageContentContextDriver.h"
#include "ResourcesDictionaryDriver.h"
#include "UsedFontDriver.h"
#include "XObjectContentContextDriver.h"

using namespace muhammara::napi;

namespace {

template <typename Driver>
napi_value NewObject(const ConstructorsHolder &holder, const char *name) {
  napi_value instance = holder.New(name);
  Driver *driver = nullptr;
  if (!ObjectWrap::UnwrapNew(holder.Env(), instance, &driver))
    return nullptr;
  driver->holder = const_cast<ConstructorsHolder *>(&holder);
  return instance;
}

template <typename Driver>
napi_value SetObject(const ConstructorsHolder &holder, napi_value instance,
                     PDFObject *object) {
  Driver *driver = nullptr;
  if (!ObjectWrap::UnwrapNew(holder.Env(), instance, &driver))
    return nullptr;
  driver->TheObject = object;
  return instance;
}

} // namespace

napi_value ConstructorsHolder::GetNewPDFNull() const {
  return NewObject<PDFNullDriver>(*this, "PDFNull");
}

napi_value ConstructorsHolder::GetNewPDFBoolean() const {
  return NewObject<PDFBooleanDriver>(*this, "PDFBoolean");
}

napi_value ConstructorsHolder::GetNewPDFInteger() const {
  return NewObject<PDFIntegerDriver>(*this, "PDFInteger");
}

napi_value ConstructorsHolder::GetNewPDFReal() const {
  return NewObject<PDFRealDriver>(*this, "PDFReal");
}

napi_value ConstructorsHolder::GetNewPDFName() const {
  return NewObject<PDFNameDriver>(*this, "PDFName");
}

napi_value ConstructorsHolder::GetNewPDFSymbol() const {
  return NewObject<PDFSymbolDriver>(*this, "PDFSymbol");
}

napi_value ConstructorsHolder::GetNewPDFLiteralString() const {
  return NewObject<PDFLiteralStringDriver>(*this, "PDFLiteralString");
}

napi_value ConstructorsHolder::GetNewPDFHexString() const {
  return NewObject<PDFHexStringDriver>(*this, "PDFHexString");
}

napi_value ConstructorsHolder::GetNewPDFIndirectObjectReference() const {
  return NewObject<PDFIndirectObjectReferenceDriver>(
      *this, "PDFIndirectObjectReference");
}

napi_value ConstructorsHolder::GetNewPDFArray() const {
  return NewObject<PDFArrayDriver>(*this, "PDFArray");
}

napi_value ConstructorsHolder::GetNewPDFDictionary() const {
  return NewObject<PDFDictionaryDriver>(*this, "PDFDictionary");
}

napi_value ConstructorsHolder::GetNewPDFStreamInput() const {
  return NewObject<PDFStreamInputDriver>(*this, "PDFStreamInput");
}

napi_value ConstructorsHolder::GetNewPDFObjectParser() const {
  return NewObject<PDFObjectParserDriver>(*this, "PDFObjectParserDriver");
}

napi_value ConstructorsHolder::GetNewPDFReader() const {
  return NewObject<PDFReaderDriver>(*this, "PDFReader");
}

napi_value ConstructorsHolder::GetNewPDFPageInput() const {
  return NewObject<PDFPageInputDriver>(*this, "PDFPageInput");
}

#define DEFINE_NEW_OBJECT(Method, Driver, Name)                                \
  napi_value ConstructorsHolder::Method() const {                              \
    return NewObject<Driver>(*this, Name);                                     \
  }

DEFINE_NEW_OBJECT(GetNewDictionaryContext, DictionaryContextDriver,
                  "DictionaryContext")
DEFINE_NEW_OBJECT(GetNewObjectsContext, ObjectsContextDriver, "ObjectsContext")
DEFINE_NEW_OBJECT(GetNewDocumentCopyingContext, DocumentCopyingContextDriver,
                  "DocumentCopyingContext")
DEFINE_NEW_OBJECT(GetNewDocumentContext, DocumentContextDriver,
                  "DocumentContext")
DEFINE_NEW_OBJECT(GetNewImageXObject, ImageXObjectDriver, "ImageXObject")
DEFINE_NEW_OBJECT(GetNewUsedFont, UsedFontDriver, "PDFUsedFont")
DEFINE_NEW_OBJECT(GetNewResourcesDictionary, ResourcesDictionaryDriver,
                  "ResourcesDictionary")
DEFINE_NEW_OBJECT(GetNewFormXObject, FormXObjectDriver, "FormXObject")
DEFINE_NEW_OBJECT(GetNewXObjectContentContext, XObjectContentContextDriver,
                  "XObjectContentContext")
DEFINE_NEW_OBJECT(GetNewPageContentContext, PageContentContextDriver,
                  "PageContentContext")

#undef DEFINE_NEW_OBJECT

napi_value ConstructorsHolder::GetNewPDFPage() const {
  napi_value undefined = Undefined(Env());
  if (!undefined)
    return nullptr;
  napi_value instance = New("PDFPage", {undefined});
  PDFPageDriver *driver = nullptr;
  if (!ObjectWrap::UnwrapNew(Env(), instance, &driver))
    return nullptr;
  driver->holder = const_cast<ConstructorsHolder *>(this);
  return instance;
}

napi_value ConstructorsHolder::GetNewPDFPageModifier(
    const std::vector<napi_value> &arguments) const {
  return New("PDFPageModifier", arguments);
}

napi_value ConstructorsHolder::GetNewByteReader() const {
  return New("ByteReader");
}

napi_value ConstructorsHolder::GetNewByteReaderWithPosition() const {
  return New("ByteReaderWithPosition");
}

napi_value ConstructorsHolder::GetNewByteWriter() const {
  return New("ByteWriter");
}
napi_value ConstructorsHolder::GetNewByteWriterWithPosition() const {
  return New("ByteWriterWithPosition");
}
napi_value ConstructorsHolder::GetNewInputFile() const {
  return New("InputFile");
}
napi_value ConstructorsHolder::GetNewOutputFile() const {
  return New("OutputFile");
}
napi_value ConstructorsHolder::GetNewInfoDictionary() const {
  return New("InfoDictionary");
}
napi_value ConstructorsHolder::GetNewPDFWriter() const {
  return New("PDFWriter");
}

napi_value ConstructorsHolder::GetNewPDFStream() const {
  return NewObject<PDFStreamDriver>(*this, "PDFStream");
}

napi_value ConstructorsHolder::GetNewPDFTextString(
    const std::vector<napi_value> &arguments) const {
  return New("PDFTextString", arguments);
}

napi_value
ConstructorsHolder::GetNewPDFDate(const std::vector<napi_value> &arguments,
                                  bool allowNoArguments) const {
  if (arguments.empty() && allowNoArguments) {
    return New("PDFDate", {String(Env(), "")});
  }
  if (arguments.size() != 1 || (!IsDate(Env(), arguments[0]) &&
                                !IsType(Env(), arguments[0], napi_string))) {
    return ThrowTypeError(
        Env(), "Wrong arguments. Provide 1 argument which is a date");
  }
  return New("PDFDate", arguments);
}

napi_value ConstructorsHolder::GetInstanceFor(PDFObject *object) const {
  if (!object)
    return HasPendingException(Env())
               ? nullptr
               : ThrowError(Env(), "Unable to wrap a null PDF object");
  switch (object->GetType()) {
  case PDFObject::ePDFObjectBoolean:
    return SetObject<PDFBooleanDriver>(*this, GetNewPDFBoolean(), object);
  case PDFObject::ePDFObjectLiteralString:
    return SetObject<PDFLiteralStringDriver>(*this, GetNewPDFLiteralString(),
                                             object);
  case PDFObject::ePDFObjectHexString:
    return SetObject<PDFHexStringDriver>(*this, GetNewPDFHexString(), object);
  case PDFObject::ePDFObjectNull:
    return SetObject<PDFNullDriver>(*this, GetNewPDFNull(), object);
  case PDFObject::ePDFObjectName:
    return SetObject<PDFNameDriver>(*this, GetNewPDFName(), object);
  case PDFObject::ePDFObjectInteger:
    return SetObject<PDFIntegerDriver>(*this, GetNewPDFInteger(), object);
  case PDFObject::ePDFObjectReal:
    return SetObject<PDFRealDriver>(*this, GetNewPDFReal(), object);
  case PDFObject::ePDFObjectIndirectObjectReference:
    return SetObject<PDFIndirectObjectReferenceDriver>(
        *this, GetNewPDFIndirectObjectReference(), object);
  case PDFObject::ePDFObjectArray:
    return SetObject<PDFArrayDriver>(*this, GetNewPDFArray(), object);
  case PDFObject::ePDFObjectDictionary:
    return SetObject<PDFDictionaryDriver>(*this, GetNewPDFDictionary(), object);
  case PDFObject::ePDFObjectStream:
    return SetObject<PDFStreamInputDriver>(*this, GetNewPDFStreamInput(),
                                           object);
  case PDFObject::ePDFObjectSymbol:
    return SetObject<PDFSymbolDriver>(*this, GetNewPDFSymbol(), object);
  default:
    return Undefined(Env());
  }
}

#define DEFINE_INSTANCE_CHECK(Method, Name)                                    \
  bool ConstructorsHolder::Method(napi_value value) const {                    \
    return IsInstance(Name, value);                                            \
  }

DEFINE_INSTANCE_CHECK(IsPDFNullInstance, "PDFNull")
DEFINE_INSTANCE_CHECK(IsPDFBooleanInstance, "PDFBoolean")
DEFINE_INSTANCE_CHECK(IsPDFIntegerInstance, "PDFInteger")
DEFINE_INSTANCE_CHECK(IsPDFRealInstance, "PDFReal")
DEFINE_INSTANCE_CHECK(IsPDFNameInstance, "PDFName")
DEFINE_INSTANCE_CHECK(IsPDFSymbolInstance, "PDFSymbol")
DEFINE_INSTANCE_CHECK(IsPDFLiteralStringInstance, "PDFLiteralString")
DEFINE_INSTANCE_CHECK(IsPDFHexStringInstance, "PDFHexString")
DEFINE_INSTANCE_CHECK(IsPDFIndirectObjectReferenceInstance,
                      "PDFIndirectObjectReference")
DEFINE_INSTANCE_CHECK(IsPDFArrayInstance, "PDFArray")
DEFINE_INSTANCE_CHECK(IsPDFDictionaryInstance, "PDFDictionary")
DEFINE_INSTANCE_CHECK(IsPDFStreamInputInstance, "PDFStreamInput")
DEFINE_INSTANCE_CHECK(IsDictionaryContextInstance, "DictionaryContext")
DEFINE_INSTANCE_CHECK(IsPDFStreamInstance, "PDFStream")
DEFINE_INSTANCE_CHECK(IsPDFPageInstance, "PDFPage")
DEFINE_INSTANCE_CHECK(IsFormXObjectInstance, "FormXObject")
DEFINE_INSTANCE_CHECK(IsImageXObjectInstance, "ImageXObject")
DEFINE_INSTANCE_CHECK(IsUsedFontInstance, "PDFUsedFont")
DEFINE_INSTANCE_CHECK(IsPDFReaderInstance, "PDFReader")
DEFINE_INSTANCE_CHECK(IsPageContentContextInstance, "PageContentContext")
DEFINE_INSTANCE_CHECK(IsPDFWriterInstance, "PDFWriter")
DEFINE_INSTANCE_CHECK(IsPDFDateInstance, "PDFDate")

#undef DEFINE_INSTANCE_CHECK

bool ConstructorsHolder::IsPDFObjectInstance(napi_value value) const {
  return IsPDFNullInstance(value) || IsPDFBooleanInstance(value) ||
         IsPDFIntegerInstance(value) || IsPDFRealInstance(value) ||
         IsPDFNameInstance(value) || IsPDFSymbolInstance(value) ||
         IsPDFLiteralStringInstance(value) || IsPDFHexStringInstance(value) ||
         IsPDFIndirectObjectReferenceInstance(value) ||
         IsPDFArrayInstance(value) || IsPDFDictionaryInstance(value) ||
         IsPDFStreamInputInstance(value);
}
