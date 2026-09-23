#include "PageContentContextDriver.h"
#include "ConstructorsHolder.h"
#include "PDFPageDriver.h"
#include "PDFStreamDriver.h"
#include "PageContentContext.h"
using namespace muhammara::napi;
PageContentContextDriver::PageContentContextDriver()
    : ContentContext(nullptr) {}
PageContentContextDriver::~PageContentContextDriver() = default;
bool PageContentContextDriver::Init(ModuleState &s, napi_value exports) {
  ClassBuilder b(s, "PageContentContext", New);
  b.Method("getCurrentPageContentStream", GetCurrentPageContentStream)
      .Method("getAssociatedPage", GetAssociatedPage);
  AbstractContentContextDriver::Init(b);
  return b.Define(exports, false) != nullptr;
}
napi_value PageContentContextDriver::New(const CallbackArgs &a) {
  auto *d = new PageContentContextDriver();
  d->holder = &ModuleState::Get(a.Env())->Constructors();
  if (!d->Wrap(a.Env(), a.This())) {
    delete d;
    return nullptr;
  }
  return a.This();
}
AbstractContentContext *PageContentContextDriver::GetContext() {
  return ContentContext;
}
napi_value
PageContentContextDriver::GetCurrentPageContentStream(const CallbackArgs &a) {
  auto *d = ObjectWrap::Unwrap<PageContentContextDriver>(a.Env(), a.This());
  napi_value v = d->holder->GetNewPDFStream();
  PDFStreamDriver *stream = nullptr;
  if (!ObjectWrap::UnwrapNew(a.Env(), v, &stream))
    return nullptr;
  stream->PDFStreamInstance = d->ContentContext->GetCurrentPageContentStream();
  return v;
}
napi_value PageContentContextDriver::GetAssociatedPage(const CallbackArgs &a) {
  auto *d = ObjectWrap::Unwrap<PageContentContextDriver>(a.Env(), a.This());
  PDFPage *page = d->ContentContext->GetAssociatedPage();
  napi_value v = d->holder->GetNewPDFPage();
  PDFPageDriver *p = nullptr;
  if (!ObjectWrap::UnwrapNew(a.Env(), v, &p))
    return nullptr;
  p->mPDFPage = page;
  p->mOwnsPage = false;
  return v;
}
