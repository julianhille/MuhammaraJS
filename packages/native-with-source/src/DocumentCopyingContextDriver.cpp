#include "DocumentCopyingContextDriver.h"
#include "BoxingBase.h"
#include "ByteReaderWithPositionDriver.h"
#include "ConstructorsHolder.h"
#include "FormXObjectDriver.h"
#include "PDFDocumentCopyingContext.h"
#include "PDFObjectDriver.h"
#include "PDFPageDriver.h"
#include "PDFReaderDriver.h"

#include <charconv>
using namespace muhammara::napi;
namespace {
DocumentCopyingContextDriver *D(const CallbackArgs &a) {
  return ObjectWrap::Unwrap<DocumentCopyingContextDriver>(a.Env(), a.This());
}
bool Active(const CallbackArgs &a, const char *msg) {
  if (D(a)->IsActive())
    return true;
  ThrowError(a.Env(), msg);
  return false;
}
} // namespace
DocumentCopyingContextDriver::DocumentCopyingContextDriver()
    : CopyingContext(nullptr), ReadStreamProxy(nullptr), holder(nullptr),
      mLifecycle(new DriverLifecycleState()) {}
DocumentCopyingContextDriver::~DocumentCopyingContextDriver() {
  mLifecycle->End();
  delete CopyingContext;
  delete ReadStreamProxy;
}
bool DocumentCopyingContextDriver::IsActive() {
  return CopyingContext && mLifecycle->IsActive();
}
DriverLifecycle DocumentCopyingContextDriver::GetLifecycle() {
  return mLifecycle;
}
void DocumentCopyingContextDriver::AddOwnerLifecycle(DriverLifecycle v) {
  mLifecycle->AddOwner(v);
}
bool DocumentCopyingContextDriver::Init(ModuleState &s, napi_value exports) {
  ClassBuilder b(s, "DocumentCopyingContext", New);
  b.Method("createFormXObjectFromPDFPage", CreateFormXObjectFromPDFPage)
      .Method("end", End)
      .Method("mergePDFPageToPage", MergePDFPageToPage)
      .Method("appendPDFPageFromPDF", AppendPDFPageFromPDF)
      .Method("mergePDFPageToFormXObject", MergePDFPageToFormXObject)
      .Method("getSourceDocumentParser", GetSourceDocumentParser)
      .Method("copyDirectObjectAsIs", CopyDirectObjectAsIs)
      .Method("copyObject", CopyObject)
      .Method("copyDirectObjectWithDeepCopy", CopyDirectObjectWithDeepCopy)
      .Method("copyNewObjectsForDirectObject", CopyNewObjectsForDirectObject)
      .Method("getCopiedObjectID", GetCopiedObjectID)
      .Method("getCopiedObjects", GetCopiedObjects)
      .Method("replaceSourceObjects", ReplaceSourceObjects)
      .Method("getSourceDocumentStream", GetSourceDocumentStream);
  return b.Define(exports, false) != nullptr;
}
napi_value DocumentCopyingContextDriver::New(const CallbackArgs &a) {
  auto *d = new DocumentCopyingContextDriver();
  d->holder = &ModuleState::Get(a.Env())->Constructors();
  if (!d->Wrap(a.Env(), a.This())) {
    delete d;
    return nullptr;
  }
  return a.This();
}
napi_value DocumentCopyingContextDriver::End(const CallbackArgs &a) {
  auto *d = D(a);
  d->mLifecycle->End();
  delete d->CopyingContext;
  d->CopyingContext = nullptr;
  delete d->ReadStreamProxy;
  d->ReadStreamProxy = nullptr;
  return a.This();
}
napi_value DocumentCopyingContextDriver::CreateFormXObjectFromPDFPage(
    const CallbackArgs &a) {
  if (!Active(a, "copying context object not initialized, create using "
                 "pdfWriter.createPDFCopyingContext"))
    return nullptr;
  if (a.Length() < 2 || a.Length() > 3 || !IsType(a.Env(), a[0], napi_number) ||
      (!IsType(a.Env(), a[1], napi_number) && !IsArray(a.Env(), a[1])) ||
      (a.Length() == 3 && !IsArray(a.Env(), a[2])))
    return ThrowError(
        a.Env(),
        "Wrong arguments. provide 2 or 3 arguments, where the first is a 0 "
        "based page index, and the second is a EPDFPageBox enumeration value "
        "or a 4 numbers array defining an box. a 3rd parameter may be provided "
        "to deisgnate the result form matrix");
  double matrix[6], *mp = nullptr;
  if (a.Length() == 3) {
    if (!ReadNumberArray(a.Env(), a[2], matrix,
                         "matrix array should be 6 numbers long"))
      return nullptr;
    mp = matrix;
  }
  EStatusCodeAndObjectIDType r;
  if (IsType(a.Env(), a[1], napi_number))
    r = D(a)->CopyingContext->CreateFormXObjectFromPDFPage(
        ToUint32(a.Env(), a[0]),
        static_cast<EPDFPageBox>(ToUint32(a.Env(), a[1])), mp);
  else {
    double values[4];
    if (!ReadNumberArray(a.Env(), a[1], values,
                         "box dimensions array should be 4 numbers long"))
      return nullptr;
    PDFRectangle box(values[0], values[1], values[2], values[3]);
    r = D(a)->CopyingContext->CreateFormXObjectFromPDFPage(
        ToUint32(a.Env(), a[0]), box, mp);
  }
  if (r.first != eSuccess)
    return ThrowError(a.Env(),
                      "Unable to create form xobject from PDF page, perhaps "
                      "the page index does not fit the total pages count");
  return Number(a.Env(), r.second);
}
napi_value
DocumentCopyingContextDriver::MergePDFPageToPage(const CallbackArgs &a) {
  if (!Active(a, "copying context object not initialized, create using "
                 "pdfWriter.createPDFCopyingContext"))
    return nullptr;
  auto *d = D(a);
  if (a.Length() != 2 || !d->holder->IsPDFPageInstance(a[0]) ||
      !IsType(a.Env(), a[1], napi_number))
    return ThrowError(a.Env(),
                      "Wrong arguments. provide 2 arguments, where the first "
                      "is a page, and the second is a page index to merge");
  if (d->CopyingContext->MergePDFPageToPage(
          ObjectWrap::Unwrap<PDFPageDriver>(a.Env(), a[0])->GetPage(),
          ToUint32(a.Env(), a[1])) != eSuccess)
    return ThrowError(
        a.Env(),
        "Unable to merge page index to page. Perhaps the page index is wrong");
  return Undefined(a.Env());
}
napi_value
DocumentCopyingContextDriver::AppendPDFPageFromPDF(const CallbackArgs &a) {
  if (!Active(a, "copying context object not initialized, create using "
                 "pdfWriter.createPDFCopyingContext"))
    return nullptr;
  if (a.Length() != 1 || !IsType(a.Env(), a[0], napi_number))
    return ThrowError(a.Env(),
                      "Wrong arguments. provide a page index to append");
  auto r = D(a)->CopyingContext->AppendPDFPageFromPDF(ToUint32(a.Env(), a[0]));
  if (r.first != eSuccess)
    return ThrowError(a.Env(),
                      "Unable to append page. Perhaps the page index is wrong");
  return Number(a.Env(), r.second);
}
napi_value
DocumentCopyingContextDriver::MergePDFPageToFormXObject(const CallbackArgs &a) {
  if (!Active(a, "copying context object not initialized, create using "
                 "pdfWriter.createPDFCopyingContext"))
    return nullptr;
  auto *d = D(a);
  if (a.Length() != 2 || !d->holder->IsFormXObjectInstance(a[0]) ||
      !IsType(a.Env(), a[1], napi_number))
    return ThrowError(a.Env(),
                      "Wrong arguments. provide 2 arguments, where the first "
                      "is a form, and the second is a page index to merge");
  if (d->CopyingContext->MergePDFPageToFormXObject(
          ObjectWrap::Unwrap<FormXObjectDriver>(a.Env(), a[0])->FormXObject,
          ToUint32(a.Env(), a[1])) != eSuccess)
    return ThrowError(
        a.Env(),
        "Unable to merge page index to form. Perhaps the page index is wrong");
  return Undefined(a.Env());
}
napi_value
DocumentCopyingContextDriver::GetSourceDocumentParser(const CallbackArgs &a) {
  if (!Active(a, "PDF copying context has ended"))
    return nullptr;
  auto *d = D(a);
  napi_value v = d->holder->GetNewPDFReader();
  PDFReaderDriver *reader = nullptr;
  if (!ObjectWrap::UnwrapNew(a.Env(), v, &reader))
    return nullptr;
  reader->SetFromOwnedParser(d->CopyingContext->GetSourceDocumentParser(),
                             d->GetLifecycle());
  return v;
}
static const char *inactive =
    "copying context object not initialized, create using "
    "pdfWriter.createPDFCopyingContext or "
    "PDFWriter.createPDFCopyingContextForModifiedFile";
napi_value
DocumentCopyingContextDriver::CopyDirectObjectAsIs(const CallbackArgs &a) {
  if (!Active(a, inactive))
    return nullptr;
  if (a.Length() != 1 || !D(a)->holder->IsPDFObjectInstance(a[0]))
    return ThrowError(
        a.Env(),
        "Wrong arguments. provide 1 argument, which is PDFObject to copy");
  if (D(a)->CopyingContext->CopyDirectObjectAsIs(
          ObjectWrap::Unwrap<PDFObjectDriver>(a.Env(), a[0])->GetObject()) !=
      eSuccess)
    return ThrowError(
        a.Env(),
        "Unable to merge page index to form. Perhaps the page index is wrong");
  return Undefined(a.Env());
}
napi_value DocumentCopyingContextDriver::CopyObject(const CallbackArgs &a) {
  if (!Active(a, inactive))
    return nullptr;
  if (a.Length() != 1 || !IsType(a.Env(), a[0], napi_number))
    return ThrowError(a.Env(), "Wrong arguments. provide 1 argument, which is "
                               "object ID of the object to copy");
  auto r = D(a)->CopyingContext->CopyObject(ToUint32(a.Env(), a[0]));
  if (r.first != eSuccess)
    return ThrowError(a.Env(),
                      "unable to copy the object. object id may be wrong");
  return Number(a.Env(), r.second);
}
napi_value DocumentCopyingContextDriver::CopyDirectObjectWithDeepCopy(
    const CallbackArgs &a) {
  if (!Active(a, inactive))
    return nullptr;
  if (a.Length() != 1 || !D(a)->holder->IsPDFObjectInstance(a[0]))
    return ThrowError(
        a.Env(),
        "Wrong arguments. provide 1 argument, which is PDFObject to copy");
  auto r = D(a)->CopyingContext->CopyDirectObjectWithDeepCopy(
      ObjectWrap::Unwrap<PDFObjectDriver>(a.Env(), a[0])->GetObject());
  if (r.first != eSuccess)
    return ThrowError(a.Env(),
                      "Unable to copy object, perhaps the object id is wrong");
  napi_value out = Array(a.Env(), r.second.size());
  uint32_t i = 0;
  for (auto id : r.second)
    Set(a.Env(), out, i++, Number(a.Env(), id));
  return out;
}
napi_value DocumentCopyingContextDriver::CopyNewObjectsForDirectObject(
    const CallbackArgs &a) {
  if (!Active(a, inactive))
    return nullptr;
  if (a.Length() != 1 || !IsArray(a.Env(), a[0]))
    return ThrowError(
        a.Env(),
        "Wrong arguments. provide 1 argument, which is an array of object IDs");
  ObjectIDTypeList ids;
  uint32_t length = 0;
  if (!Length(a.Env(), a[0], &length))
    return nullptr;
  for (uint32_t i = 0; i < length; ++i) {
    napi_value value = nullptr;
    uint32_t id = 0;
    if (!Get(a.Env(), a[0], i, &value) ||
        !CoerceToUint32(a.Env(), value, &id))
      return nullptr;
    ids.push_back(id);
  }
  if (D(a)->CopyingContext->CopyNewObjectsForDirectObject(ids) != eSuccess)
    return ThrowError(a.Env(), "Unable to copy elements");
  return Undefined(a.Env());
}
napi_value
DocumentCopyingContextDriver::GetCopiedObjectID(const CallbackArgs &a) {
  if (!Active(a, inactive))
    return nullptr;
  if (a.Length() != 1 || !IsType(a.Env(), a[0], napi_number))
    return ThrowError(
        a.Env(), "Wrong arguments. provide 1 argument, an object ID to check");
  auto r = D(a)->CopyingContext->GetCopiedObjectID(ToUint32(a.Env(), a[0]));
  if (r.first != eSuccess)
    return ThrowError(a.Env(), "Unable to find element");
  return Number(a.Env(), r.second);
}
napi_value
DocumentCopyingContextDriver::GetCopiedObjects(const CallbackArgs &a) {
  if (!Active(a, inactive))
    return nullptr;
  napi_value out = Object(a.Env());
  auto it = D(a)->CopyingContext->GetCopiedObjectsMappingIterator();
  while (it.MoveNext())
    Set(a.Env(), out, std::to_string(it.GetKey()).c_str(),
        Number(a.Env(), it.GetValue()));
  return out;
}
napi_value
DocumentCopyingContextDriver::ReplaceSourceObjects(const CallbackArgs &a) {
  if (!Active(a, inactive))
    return nullptr;
  if (a.Length() != 1 || !IsObject(a.Env(), a[0]))
    return ThrowError(a.Env(),
                      "Wrong arguments. provide 1 argument, which is an object "
                      "mapping source object ids to map to target object IDs");
  napi_value keys = nullptr;
  if (!Check(a.Env(),
             napi_get_all_property_names(a.Env(), a[0], napi_key_own_only,
                                         napi_key_all_properties,
                                         napi_key_numbers_to_strings, &keys)))
    return nullptr;
  ObjectIDTypeToObjectIDTypeMap map;
  uint32_t length = 0;
  if (!Length(a.Env(), keys, &length))
    return nullptr;
  for (uint32_t i = 0; i < length; ++i) {
    napi_value key = nullptr;
    if (!Get(a.Env(), keys, i, &key))
      return nullptr;
    std::string name = LegacyString(a.Env(), key);
    if (HasPendingException(a.Env()))
      return nullptr;
    ObjectIDType sourceID = 0;
    auto parsed =
        std::from_chars(name.data(), name.data() + name.size(), sourceID);
    if (name.empty() || parsed.ec != std::errc() ||
        parsed.ptr != name.data() + name.size())
      return ThrowError(a.Env(),
                        "Wrong arguments. source object IDs must be unsigned "
                        "integer property names");
    napi_value value = nullptr;
    if (!Check(a.Env(), napi_get_property(a.Env(), a[0], key, &value)))
      return nullptr;
    uint32_t targetID = 0;
    if (!CoerceToUint32(a.Env(), value, &targetID))
      return nullptr;
    map.emplace(sourceID, targetID);
  }
  D(a)->CopyingContext->ReplaceSourceObjects(map);
  return Undefined(a.Env());
}
napi_value
DocumentCopyingContextDriver::GetSourceDocumentStream(const CallbackArgs &a) {
  if (!Active(a, inactive))
    return nullptr;
  auto *d = D(a);
  napi_value v = d->holder->GetNewByteReaderWithPosition();
  ByteReaderWithPositionDriver *reader = nullptr;
  if (!ObjectWrap::UnwrapNew(a.Env(), v, &reader))
    return nullptr;
  reader->SetStream(d->CopyingContext->GetSourceDocumentStream(), false);
  return v;
}
