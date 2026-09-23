#include "PDFPageModifierDriver.h"
#include "ConstructorsHolder.h"
#include "PDFFormXObject.h"
#include "PDFModifiedPage.h"
#include "PDFWriterDriver.h"
#include "XObjectContentContextDriver.h"
using namespace muhammara::napi;
using namespace PDFHummus;
namespace {
PDFPageModifierDriver *D(const CallbackArgs &a) {
  return ObjectWrap::Unwrap<PDFPageModifierDriver>(a.Env(), a.This());
}
} // namespace
PDFPageModifierDriver::PDFPageModifierDriver(PDFWriter *w, unsigned long p,
                                              bool e)
    : holder(nullptr), mModifierPageInstance(new PDFModifiedPage(w, p, e)) {}
PDFPageModifierDriver::~PDFPageModifierDriver() {
  delete mModifierPageInstance;
}
bool PDFPageModifierDriver::Init(ModuleState &s, napi_value exports) {
  ClassBuilder b(s, "PDFPageModifier", New);
  b.Method("startContext", StartContext)
      .Method("getContext", GetContext)
      .Method("endContext", EndContext)
      .Method("attachURLLinktoCurrentPage", AttachURLLinktoCurrentPage)
      .Method("writePage", WritePage);
  return b.Define(exports, true) != nullptr;
}
napi_value PDFPageModifierDriver::New(const CallbackArgs &a) {
  auto &constructors = ModuleState::Get(a.Env())->Constructors();
  if (a.Length() < 1 || !constructors.IsPDFWriterInstance(a[0]) ||
      (a.Length() >= 2 && !IsType(a.Env(), a[1], napi_number)) ||
      (a.Length() >= 3 && !IsType(a.Env(), a[2], napi_boolean)))
    return ThrowTypeError(
        a.Env(),
        "Wrong arguments, perovide a: PDFWriter of the pdf that page you want "
        "modified, page index of that page, and boolean indicating if you want "
        "to ensure encapsulation. last one defaults to false");
  auto *w = ObjectWrap::Unwrap<PDFWriterDriver>(a.Env(), a[0]);
  if (!w)
    return ThrowTypeError(
        a.Env(), "Wrong arguments, provide a PDFWriter as the first object");
  auto pageIndex =
      a.Length() >= 2 ? static_cast<unsigned long>(ToDouble(a.Env(), a[1])) : 0;
  auto *d = new PDFPageModifierDriver(
      w->GetWriter(), pageIndex,
      a.Length() >= 3 ? ToBoolean(a.Env(), a[2]) : false);
  d->holder = &constructors;
  if (!d->Wrap(a.Env(), a.This())) {
    delete d;
    return nullptr;
  }
  return a.This();
}
napi_value PDFPageModifierDriver::StartContext(const CallbackArgs &a) {
  auto *d = D(a);
  if (!d)
    return ThrowTypeError(
        a.Env(), "no driver created...please create one through Hummus");
  if (!d->mModifierPageInstance->StartContentContext())
    return ThrowTypeError(
        a.Env(),
        "context not created, page index is either wrong, or page is null");
  return a.This();
}
napi_value PDFPageModifierDriver::GetContext(const CallbackArgs &a) {
  auto *d = D(a);
  if (!d)
    return ThrowTypeError(
        a.Env(), "no driver created...please create one through Hummus");
  if (!d->mModifierPageInstance->GetCurrentFormContext())
    return ThrowTypeError(
        a.Env(), "No context created, please create one with startContext");
  napi_value v = d->holder->GetNewXObjectContentContext();
  XObjectContentContextDriver *c = nullptr;
  if (!ObjectWrap::UnwrapNew(a.Env(), v, &c)) return nullptr;
  c->ContentContext =
      d->mModifierPageInstance->GetCurrentFormContext()->GetContentContext();
  c->FormOfContext = d->mModifierPageInstance->GetCurrentFormContext();
  c->SetResourcesDictionary(
      d->mModifierPageInstance->GetCurrentResourcesDictionary());
  return v;
}
napi_value PDFPageModifierDriver::EndContext(const CallbackArgs &a) {
  auto *d = D(a);
  if (!d)
    return ThrowTypeError(
        a.Env(), "no driver created...please create one through Hummus");
  d->mModifierPageInstance->EndContentContext();
  return a.This();
}
napi_value
PDFPageModifierDriver::AttachURLLinktoCurrentPage(const CallbackArgs &a) {
  if (a.Length() != 5 || !IsType(a.Env(), a[0], napi_string) ||
      !IsType(a.Env(), a[1], napi_number) ||
      !IsType(a.Env(), a[2], napi_number) ||
      !IsType(a.Env(), a[3], napi_number) ||
      !IsType(a.Env(), a[4], napi_number))
    return ThrowTypeError(
        a.Env(),
        "wrong arguments, pass a url, and 4 numbers (left,bottom,right,top) "
        "for the rectangle valid for clicking");
  if (D(a)->mModifierPageInstance->AttachURLLinktoCurrentPage(
          LegacyString(a.Env(), a[0]),
          PDFRectangle(ToDouble(a.Env(), a[1]), ToDouble(a.Env(), a[2]),
                       ToDouble(a.Env(), a[3]), ToDouble(a.Env(), a[4]))) !=
      eSuccess)
    return ThrowTypeError(
        a.Env(), "unable to attach link to current page. will happen if "
                 "the input URL may not be encoded to ascii7");
  return a.This();
}
napi_value PDFPageModifierDriver::WritePage(const CallbackArgs &a) {
  auto *d = D(a);
  if (!d)
    return ThrowTypeError(
        a.Env(), "no driver created...please create one through Hummus");
  if (d->mModifierPageInstance->WritePage() != eSuccess)
    return ThrowTypeError(a.Env(), "Unable to write page");
  return a.This();
}
