#include "PDFPageDriver.h"
#include "ConstructorsHolder.h"
#include "PDFRectangle.h"
#include "ResourcesDictionaryDriver.h"
using namespace muhammara::napi;
namespace {
PDFPageDriver *D(const CallbackArgs &a) {
  return ObjectWrap::Unwrap<PDFPageDriver>(a.Env(), a.This());
}
napi_value Box(napi_env e, const PDFRectangle &r) {
  napi_value a = Array(e, 4);
  Set(e, a, uint32_t{0}, Number(e, r.LowerLeftX));
  Set(e, a, uint32_t{1}, Number(e, r.LowerLeftY));
  Set(e, a, uint32_t{2}, Number(e, r.UpperRightX));
  Set(e, a, uint32_t{3}, Number(e, r.UpperRightY));
  return a;
}
bool ReadBox(const CallbackArgs &a, const char *error, PDFRectangle &out) {
  napi_value v = a[0];
  uint32_t length = 0;
  if (!IsArray(a.Env(), v)) {
    ThrowError(a.Env(), error);
    return false;
  }
  if (!Length(a.Env(), v, &length))
    return false;
  if (length != 4) {
    ThrowError(a.Env(), error);
    return false;
  }
  double values[4];
  if (!ReadNumberArray(a.Env(), v, values))
    return false;
  out = PDFRectangle(values[0], values[1], values[2], values[3]);
  return true;
}
} // namespace
PDFPageDriver::PDFPageDriver()
    : ContentContext(nullptr), holder(nullptr), mPDFPage(nullptr),
      mOwnsPage(false) {}
PDFPageDriver::~PDFPageDriver() {
  if (mOwnsPage)
    delete mPDFPage;
}
bool PDFPageDriver::Init(ModuleState &s, napi_value exports) {
  ClassBuilder b(s, "PDFPage", New);
  b.Accessor("mediaBox", GetMediaBox, SetMediaBox)
      .Accessor("cropBox", GetCropBox, SetCropBox)
      .Accessor("bleedBox", GetBleedBox, SetBleedBox)
      .Accessor("trimBox", GetTrimBox, SetTrimBox)
      .Accessor("artBox", GetArtBox, SetArtBox)
      .Accessor("rotate", GetRotate, SetRotate)
      .Method("getResourcesDictionary", GetResourcesDictionary);
  return b.Define(exports, true) != nullptr;
}
napi_value PDFPageDriver::New(const CallbackArgs &a) {
  auto *d = new PDFPageDriver();
  d->holder = &ModuleState::Get(a.Env())->Constructors();
  if (a.Length() != 1) {
    d->mPDFPage = new PDFPage();
    d->mOwnsPage = true;
    if (a.Length() == 4 && IsType(a.Env(), a[0], napi_number) &&
        IsType(a.Env(), a[1], napi_number) &&
        IsType(a.Env(), a[2], napi_number) &&
        IsType(a.Env(), a[3], napi_number))
      d->mPDFPage->SetMediaBox(
          PDFRectangle(ToDouble(a.Env(), a[0]), ToDouble(a.Env(), a[1]),
                       ToDouble(a.Env(), a[2]), ToDouble(a.Env(), a[3])));
  }
  if (!d->Wrap(a.Env(), a.This())) {
    delete d;
    return nullptr;
  }
  return a.This();
}
napi_value PDFPageDriver::GetMediaBox(const CallbackArgs &a) {
  return Box(a.Env(), D(a)->mPDFPage->GetMediaBox());
}
napi_value PDFPageDriver::SetMediaBox(const CallbackArgs &a) {
  PDFRectangle r;
  if (!ReadBox(a, "Media box is set to a value which is not a 4 numbers array",
               r))
    return nullptr;
  D(a)->mPDFPage->SetMediaBox(r);
  return Undefined(a.Env());
}
#define OPTIONAL_BOX(Name, Native, Error)                                      \
  napi_value PDFPageDriver::Get##Name(const CallbackArgs &a) {                 \
    auto v = D(a)->mPDFPage->Get##Native();                                    \
    return v.first ? Box(a.Env(), v.second) : Undefined(a.Env());              \
  }                                                                            \
  napi_value PDFPageDriver::Set##Name(const CallbackArgs &a) {                 \
    PDFRectangle r;                                                            \
    if (!ReadBox(a, Error, r))                                                 \
      return nullptr;                                                          \
    D(a)->mPDFPage->Set##Native(r);                                            \
    return Undefined(a.Env());                                                 \
  }
OPTIONAL_BOX(CropBox, CropBox,
             "Crop box is set to a value which is not a 4 numbers array")
OPTIONAL_BOX(BleedBox, BleedBox,
             "Bleed box is set to a value which is not a 4 numbers array")
OPTIONAL_BOX(TrimBox, TrimBox,
             "Trim box is set to a value which is not a 4 numbers array")
OPTIONAL_BOX(ArtBox, ArtBox,
             "Art box is set to a value which is not a 4 numbers array")
#undef OPTIONAL_BOX
napi_value PDFPageDriver::GetRotate(const CallbackArgs &a) {
  auto v = D(a)->mPDFPage->GetRotate();
  return v.first ? Number(a.Env(), v.second) : Undefined(a.Env());
}
napi_value PDFPageDriver::SetRotate(const CallbackArgs &a) {
  if (!IsType(a.Env(), a[0], napi_number))
    return ThrowError(a.Env(), "Rotation is not set to a number");
  D(a)->mPDFPage->SetRotate(ToUint32(a.Env(), a[0]));
  return Undefined(a.Env());
}
napi_value PDFPageDriver::GetResourcesDictionary(const CallbackArgs &a) {
  auto *d = D(a);
  napi_value v = d->holder->GetNewResourcesDictionary();
  ResourcesDictionaryDriver *resources = nullptr;
  if (!ObjectWrap::UnwrapNew(a.Env(), v, &resources))
    return nullptr;
  resources->ResourcesDictionaryInstance =
      &d->GetPage()->GetResourcesDictionary();
  return v;
}
