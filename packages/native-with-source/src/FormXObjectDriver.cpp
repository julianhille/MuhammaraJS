#include "FormXObjectDriver.h"

#include "ConstructorsHolder.h"
#include "PDFFormXObject.h"
#include "PDFStreamDriver.h"
#include "PDFWriterDriver.h"
#include "ResourcesDictionaryDriver.h"
#include "XObjectContentContextDriver.h"

using namespace muhammara::napi;

FormXObjectDriver::FormXObjectDriver()
    : FormXObject(nullptr), holder(nullptr), mPDFWriterDriver(nullptr),
      mContentLifecycle(std::make_shared<DriverLifecycleState>(
          "Form XObject content has ended")) {}
void FormXObjectDriver::SetOpenIn(PDFWriterDriver *writer) {
  mPDFWriterDriver = writer;
}
bool FormXObjectDriver::IsOpenIn(PDFWriterDriver *writer) const {
  return FormXObject && mPDFWriterDriver == writer &&
         mContentLifecycle->IsActive();
}
void FormXObjectDriver::EndContent() {
  mPDFWriterDriver = nullptr;
  mContentLifecycle->End();
}
FormXObjectDriver::~FormXObjectDriver() {
  // An unfinished form's stream deletes the writer's output when destroyed.
  if (openContent && openContent->writer &&
      openContent->forms.erase(FormXObject))
    openContent->writer->AbandonFormXObject(FormXObject);
  delete FormXObject;
}

bool FormXObjectDriver::Init(ModuleState &state, napi_value exports) {
  ClassBuilder b(state, "FormXObject", New);
  b.Accessor("id", GetID)
      .Method("getContentContext", GetContentContext)
      .Method("getResourcesDictinary", GetResourcesDictionary)
      .Method("getResourcesDictionary", GetResourcesDictionary)
      .Method("getContentStream", GetContentStream);
  return b.Define(exports, false) != nullptr;
}
napi_value FormXObjectDriver::New(const CallbackArgs &a) {
  auto *d = new FormXObjectDriver();
  d->holder = &ModuleState::Get(a.Env())->Constructors();
  if (!d->Wrap(a.Env(), a.This())) {
    delete d;
    return nullptr;
  }
  return a.This();
}
napi_value FormXObjectDriver::GetID(const CallbackArgs &a) {
  auto *d = ObjectWrap::Unwrap<FormXObjectDriver>(a.Env(), a.This());
  if (!d->FormXObject)
    return ThrowTypeError(a.Env(), "form object not initialized, create using "
                                   "pdfWriter.CreateFormXObject");
  return Number(a.Env(), d->FormXObject->GetObjectID());
}
napi_value FormXObjectDriver::GetContentContext(const CallbackArgs &a) {
  auto *d = ObjectWrap::Unwrap<FormXObjectDriver>(a.Env(), a.This());
  if (!d->mContentLifecycle->IsActive())
    return ThrowError(a.Env(), "Form XObject content is not writable");
  napi_value v = d->holder->GetNewXObjectContentContext();
  XObjectContentContextDriver *c = nullptr;
  if (!ObjectWrap::UnwrapNew(a.Env(), v, &c))
    return nullptr;
  c->ContentContext = d->FormXObject->GetContentContext();
  c->FormOfContext = d->FormXObject;
  c->SetResourcesDictionary(&d->FormXObject->GetResourcesDictionary());
  c->AddOwner(d->Lifecycle());
  c->AddOwner(d->mContentLifecycle);
  return v;
}
napi_value FormXObjectDriver::GetResourcesDictionary(const CallbackArgs &a) {
  auto *d = ObjectWrap::Unwrap<FormXObjectDriver>(a.Env(), a.This());
  napi_value v = d->holder->GetNewResourcesDictionary();
  ResourcesDictionaryDriver *resources = nullptr;
  if (!ObjectWrap::UnwrapNew(a.Env(), v, &resources))
    return nullptr;
  resources->ResourcesDictionaryInstance =
      &d->FormXObject->GetResourcesDictionary();
  resources->AddOwner(d->Lifecycle());
  return v;
}
napi_value FormXObjectDriver::GetContentStream(const CallbackArgs &a) {
  auto *d = ObjectWrap::Unwrap<FormXObjectDriver>(a.Env(), a.This());
  if (!d->mContentLifecycle->IsActive())
    return ThrowError(a.Env(),
                      "Form XObject content stream is no longer active");
  napi_value v = d->holder->GetNewPDFStream();
  PDFStreamDriver *stream = nullptr;
  if (!ObjectWrap::UnwrapNew(a.Env(), v, &stream))
    return nullptr;
  stream->PDFStreamInstance = d->FormXObject->GetContentStream();
  stream->AddOwner(d->Lifecycle());
  stream->AddOwner(d->mContentLifecycle);
  return v;
}
