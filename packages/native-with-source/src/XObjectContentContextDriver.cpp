#include "XObjectContentContextDriver.h"
#include "ConstructorsHolder.h"
#include "XObjectContentContext.h"
using namespace muhammara::napi;
XObjectContentContextDriver::XObjectContentContextDriver()
    : ContentContext(nullptr), FormOfContext(nullptr) {}
bool XObjectContentContextDriver::Init(ModuleState &s, napi_value exports) {
  ClassBuilder b(s, "XObjectContentContext", New);
  AbstractContentContextDriver::Init(b);
  // Exported so the JavaScript layer can extend writeText; it removes the
  // export again, so XObjectContentContext is not public API.
  return b.Define(exports) != nullptr;
}
napi_value XObjectContentContextDriver::New(const CallbackArgs &a) {
  auto *d = new XObjectContentContextDriver();
  d->holder = &ModuleState::Get(a.Env())->Constructors();
  if (!d->Wrap(a.Env(), a.This())) {
    delete d;
    return nullptr;
  }
  return a.This();
}
AbstractContentContext *XObjectContentContextDriver::GetContext() {
  return ContentContext;
}
