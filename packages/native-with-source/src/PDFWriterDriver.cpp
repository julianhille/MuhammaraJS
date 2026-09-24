#include "PDFWriterDriver.h"

#include "ConstructorsHolder.h"
#include "DictionaryContextDriver.h"
#include "DocumentContextDriver.h"
#include "DocumentContextExtenderAdapter.h"
#include "DocumentCopyingContextDriver.h"
#include "FormXObjectDriver.h"
#include "ImageXObjectDriver.h"
#include "InputFile.h"
#include "InputFileDriver.h"
#include "ObjectsContextDriver.h"
#include "OutputFileDriver.h"
#include "PDFDateDriver.h"
#include "PDFDocumentCopyingContext.h"
#include "PDFFormXObject.h"
#include "PDFImageXObject.h"
#include "PDFPageDriver.h"
#include "PDFReaderDriver.h"
#include "PDFRectangle.h"
#include "PageContentContextDriver.h"
#include "ResourcesDictionaryDriver.h"
#include "TIFFImageHandler.h"
#include "Trace.h"
#include "UsedFontDriver.h"

using namespace muhammara::napi;
using namespace PDFHummus;

namespace {
PDFWriterDriver *Driver(const CallbackArgs &a) {
  return ObjectWrap::Unwrap<PDFWriterDriver>(a.Env(), a.This());
}
bool Type(napi_env e, napi_value v, napi_valuetype t) {
  return IsType(e, v, t);
}
std::vector<napi_value> Values(const CallbackArgs &a) {
  std::vector<napi_value> v;
  for (size_t i = 0; i < a.Length(); ++i)
    v.push_back(a[i]);
  return v;
}
void Password(napi_env e, napi_value o, PDFParsingOptions &p) {
  if (Has(e, o, "password") && Type(e, Get(e, o, "password"), napi_string))
    p.Password = LegacyString(e, Get(e, o, "password"));
}
} // namespace

PDFWriterDriver::PDFWriterDriver()
    : holder(nullptr), startedWithStream_(false), catalogUpdateRequired_(false),
      started_(false), lifecycle_(new DriverLifecycleState()),
      writeProxy_(nullptr), readProxy_(nullptr), logProxy_(nullptr),
      env_(nullptr) {}
PDFWriterDriver::~PDFWriterDriver() {
  if (started_)
    Retire();
  delete writeProxy_;
  delete readProxy_;
  ReleaseLogProxy();
}
template <napi_value (*Method)(const CallbackArgs &)>
napi_value PDFWriterDriver::Active(const CallbackArgs &a) {
  auto *d = Driver(a);
  if (!d || !d->started_)
    return ThrowError(a.Env(), "PDF writer has ended");
  return Method(a);
}
bool PDFWriterDriver::Init(ModuleState &s, napi_value exports) {
  ClassBuilder b(s, "PDFWriter", New);
  b.Method("end", End)
      .Method("_abort", Abort)
      .Method("createPage", Active<CreatePage>)
      .Method("writePage", Active<WritePage>)
      .Method("writePageAndReturnID", Active<WritePageAndReturnID>)
      .Method("startPageContentContext", Active<StartPageContentContext>)
      .Method("pausePageContentContext", Active<PausePageContentContext>)
      .Method("createFormXObject", Active<CreateFormXObject>)
      .Method("endFormXObject", Active<EndFormXObject>)
      .Method("createFormXObjectFromJPG", Active<CreateformXObjectFromJPG>)
      .Method("retrieveJPGImageInformation",
              Active<RetrieveJPGImageInformation>)
      .Method("createFormXObjectFromPNG", Active<CreateFormXObjectFromPNG>)
      .Method("createFormXObjectFromTIFF", Active<CreateFormXObjectFromTIFF>)
      .Method("createImageXObjectFromJPG", Active<CreateImageXObjectFromJPG>)
      .Method("getFontForFile", Active<GetFontForFile>)
      .Method("attachURLLinktoCurrentPage", Active<AttachURLLinktoCurrentPage>)
      .Method("shutdown", Active<Shutdown>)
      .Method("getObjectsContext", Active<GetObjectsContext>)
      .Method("getDocumentContext", Active<GetDocumentContext>)
      .Method("appendPDFPagesFromPDF", Active<AppendPDFPagesFromPDF>)
      .Method("mergePDFPagesToPage", Active<MergePDFPagesToPage>)
      .Method("createPDFCopyingContext", Active<CreatePDFCopyingContext>)
      .Method("createFormXObjectsFromPDF", Active<CreateFormXObjectsFromPDF>)
      .Method("createPDFCopyingContextForModifiedFile",
              Active<CreatePDFCopyingContextForModifiedFile>)
      .Method("createPDFTextString", CreatePDFTextString)
      .Method("createPDFDate", CreatePDFDate)
      .Method("getImageDimensions", Active<GetImageDimensions>)
      .Method("getImagePagesCount", Active<GetImagePagesCount>)
      .Method("getImageType", Active<GetImageType>)
      .Method("getModifiedFileParser", Active<GetModifiedFileParser>)
      .Method("getModifiedInputFile", Active<GetModifiedInputFile>)
      .Method("getOutputFile", Active<GetOutputFile>)
      .Method("registerAnnotationReferenceForNextPageWrite",
              Active<RegisterAnnotationReferenceForNextPageWrite>)
      .Method("requireCatalogUpdate", Active<RequireCatalogUpdate>);
  return b.Define(exports) != nullptr;
}
napi_value PDFWriterDriver::New(const CallbackArgs &a) {
  auto *d = new PDFWriterDriver();
  d->holder = &ModuleState::Get(a.Env())->Constructors();
  d->env_ = a.Env();
  d->self_.Reset(a.Env(), a.This(), 0);
  if (!d->Wrap(a.Env(), a.This())) {
    delete d;
    return nullptr;
  }
  return a.This();
}
void PDFWriterDriver::Retire() {
  writer_.GetDocumentContext().RemoveDocumentContextExtender(this);
  delete writeProxy_;
  writeProxy_ = nullptr;
  delete readProxy_;
  readProxy_ = nullptr;
  ReleaseLogProxy();
  started_ = false;
  lifecycle_->End();
}
napi_value PDFWriterDriver::End(const CallbackArgs &a) {
  auto *d = Driver(a);
  if (!d || !d->started_)
    return a.This();
  EStatusCode status = d->startedWithStream_ ? d->writer_.EndPDFForStream()
                                             : d->writer_.EndPDF();
  d->Retire();
  return status == eSuccess ? a.This()
                            : ThrowTypeError(a.Env(), "Unable to end PDF");
}
napi_value PDFWriterDriver::Abort(const CallbackArgs &a) {
  auto *d = Driver(a);
  if (!d || !d->started_)
    return a.This();
  d->writer_.GetDocumentContext().RemoveDocumentContextExtender(d);
  d->writer_.Reset();
  delete d->writeProxy_;
  d->writeProxy_ = nullptr;
  delete d->readProxy_;
  d->readProxy_ = nullptr;
  d->ReleaseLogProxy();
  d->started_ = false;
  d->lifecycle_->End();
  return a.This();
}
napi_value PDFWriterDriver::CreatePage(const CallbackArgs &a) {
  return Driver(a)->holder->New("PDFPage", Values(a));
}
napi_value PDFWriterDriver::WritePage(const CallbackArgs &a) {
  napi_value result = WritePageAndReturnID(a);
  return result ? a.This() : nullptr;
}
napi_value PDFWriterDriver::WritePageAndReturnID(const CallbackArgs &a) {
  auto *d = Driver(a);
  if (a.Length() != 1 || !d->holder->IsPDFPageInstance(a[0]))
    return ThrowTypeError(
        a.Env(), "Wrong arguments, provide a page as the single parameter");
  auto *p = ObjectWrap::Unwrap<PDFPageDriver>(a.Env(), a[0]);
  if (!p)
    return ThrowTypeError(
        a.Env(), "Wrong arguments, provide a page as the single parameter");
  if (p->ContentContext &&
      d->writer_.EndPageContentContext(p->ContentContext) != eSuccess)
    return ThrowTypeError(a.Env(), "Unable to finalize page context");
  p->ContentContext = nullptr;
  auto r = d->writer_.WritePageAndReturnPageID(p->GetPage());
  return r.first == eSuccess ? Number(a.Env(), r.second)
                             : ThrowTypeError(a.Env(), "Unable to write page");
}
napi_value PDFWriterDriver::StartPageContentContext(const CallbackArgs &a) {
  auto *d = Driver(a);
  if (a.Length() != 1 || !d->holder->IsPDFPageInstance(a[0]))
    return ThrowTypeError(
        a.Env(), "Wrong arguments, provide a page as the single parameter");
  auto *p = ObjectWrap::Unwrap<PDFPageDriver>(a.Env(), a[0]);
  if (!p)
    return ThrowTypeError(
        a.Env(), "Wrong arguments, provide a page as the single parameter");
  napi_value v = d->holder->GetNewPageContentContext();
  PageContentContextDriver *c = nullptr;
  if (!ObjectWrap::UnwrapNew(a.Env(), v, &c))
    return nullptr;
  c->ContentContext = d->writer_.StartPageContentContext(p->GetPage());
  c->SetResourcesDictionary(&p->GetPage()->GetResourcesDictionary());
  p->ContentContext = c->ContentContext;
  return v;
}
napi_value PDFWriterDriver::PausePageContentContext(const CallbackArgs &a) {
  auto *d = Driver(a);
  if (a.Length() != 1 || !d->holder->IsPageContentContextInstance(a[0]))
    return ThrowTypeError(
        a.Env(),
        "Wrong arguments, provide a page context as the single parameter");
  auto *c = ObjectWrap::Unwrap<PageContentContextDriver>(a.Env(), a[0]);
  if (!c)
    return ThrowTypeError(
        a.Env(),
        "Wrong arguments, provide a page context as the single parameter");
  if (!c->ContentContext)
    return ThrowTypeError(a.Env(),
                          "paused context not initialized, please create "
                          "one using pdfWriter.startPageContentContext");
  d->writer_.PausePageContentContext(c->ContentContext);
  return a.This();
}
napi_value PDFWriterDriver::CreateFormXObject(const CallbackArgs &a) {
  if ((a.Length() != 4 && a.Length() != 5) ||
      !Type(a.Env(), a[0], napi_number) || !Type(a.Env(), a[1], napi_number) ||
      !Type(a.Env(), a[2], napi_number) || !Type(a.Env(), a[3], napi_number) ||
      (a.Length() == 5 && !Type(a.Env(), a[4], napi_number)))
    return ThrowTypeError(
        a.Env(),
        "wrong arguments, pass 4 coordinates of the form rectangle and an "
        "optional 5th agument which is the forward reference ID");
  auto *d = Driver(a);
  napi_value v = d->holder->GetNewFormXObject();
  FormXObjectDriver *f = nullptr;
  if (!ObjectWrap::UnwrapNew(a.Env(), v, &f))
    return nullptr;
  PDFRectangle r(ToDouble(a.Env(), a[0]), ToDouble(a.Env(), a[1]),
                 ToDouble(a.Env(), a[2]), ToDouble(a.Env(), a[3]));
  f->FormXObject = a.Length() == 5
                       ? d->writer_.StartFormXObject(r, ToUint32(a.Env(), a[4]))
                       : d->writer_.StartFormXObject(r);
  return v;
}
napi_value PDFWriterDriver::EndFormXObject(const CallbackArgs &a) {
  auto *d = Driver(a);
  if (a.Length() != 1 || !d->holder->IsFormXObjectInstance(a[0]))
    return ThrowTypeError(
        a.Env(), "Wrong arguments, provide a form as the single parameter");
  auto *f = ObjectWrap::Unwrap<FormXObjectDriver>(a.Env(), a[0]);
  if (!f)
    return ThrowTypeError(
        a.Env(), "Wrong arguments, provide a form as the single parameter");
  d->writer_.EndFormXObject(f->FormXObject);
  return a.This();
}
static napi_value FormImage(const CallbackArgs &a, const char *kind) {
  auto *d = Driver(a);
  if ((a.Length() != 1 && a.Length() != 2) ||
      (!Type(a.Env(), a[0], napi_string) && !IsObject(a.Env(), a[0])) ||
      (a.Length() == 2 && !Type(a.Env(), a[1], napi_number)))
    return ThrowTypeError(
        a.Env(), "wrong arguments, pass 1 argument that is the path to "
                 "the image or an image stream. Optionally pass an object "
                 "ID for a forward reference image");
  PDFFormXObject *f = nullptr;
  ObjectIDType id = a.Length() == 2 ? ToInt32(a.Env(), a[1]) : 0;
  if (IsObject(a.Env(), a[0])) {
    ObjectByteReaderWithPosition p(a.Env(), a[0]);
    if (!strcmp(kind, "JPG"))
      f = id ? d->GetWriter()->CreateFormXObjectFromJPGStream(&p, id)
             : d->GetWriter()->CreateFormXObjectFromJPGStream(&p);
    else
      f = id ? d->GetWriter()->CreateFormXObjectFromPNGStream(&p, id)
             : d->GetWriter()->CreateFormXObjectFromPNGStream(&p);
  } else {
    std::string path = LegacyString(a.Env(), a[0]);
    if (!strcmp(kind, "JPG"))
      f = id ? d->GetWriter()->CreateFormXObjectFromJPGFile(path, id)
             : d->GetWriter()->CreateFormXObjectFromJPGFile(path);
    else
      f = id ? d->GetWriter()->CreateFormXObjectFromPNGFile(path, id)
             : d->GetWriter()->CreateFormXObjectFromPNGFile(path);
  }
  if (!f)
    return ThrowTypeError(
        a.Env(), !strcmp(kind, "JPG")
                     ? "unable to create form xobject. verify that the "
                       "target is an existing jpg file/stream"
                     : "unable to create form xobject. verify that the "
                       "target is an existing png file/stream");
  napi_value v = d->holder->GetNewFormXObject();
  FormXObjectDriver *form = nullptr;
  if (!ObjectWrap::UnwrapNew(a.Env(), v, &form)) {
    delete f;
    return nullptr;
  }
  form->FormXObject = f;
  return v;
}
napi_value PDFWriterDriver::CreateformXObjectFromJPG(const CallbackArgs &a) {
  return FormImage(a, "JPG");
}
napi_value PDFWriterDriver::CreateFormXObjectFromPNG(const CallbackArgs &a) {
  return FormImage(a, "PNG");
}
napi_value PDFWriterDriver::RetrieveJPGImageInformation(const CallbackArgs &a) {
  if (a.Length() != 1 || !Type(a.Env(), a[0], napi_string))
    return ThrowTypeError(
        a.Env(),
        "wrong arguments, pass 1 argument that is the path to the image");
  auto info = Driver(a)
                  ->writer_.GetDocumentContext()
                  .GetJPEGImageHandler()
                  .RetrieveImageInformation(LegacyString(a.Env(), a[0]));
  if (!info.first)
    return ThrowTypeError(a.Env(), "unable to retrieve image information");
  napi_value o = Object(a.Env());
  Set(a.Env(), o, "samplesWidth", Number(a.Env(), info.second.SamplesWidth));
  Set(a.Env(), o, "samplesHeight", Number(a.Env(), info.second.SamplesHeight));
  Set(a.Env(), o, "colorComponentsCount",
      Number(a.Env(), info.second.ColorComponentsCount));
  Set(a.Env(), o, "JFIFInformationExists",
      Boolean(a.Env(), info.second.JFIFInformationExists));
  if (info.second.JFIFInformationExists) {
    Set(a.Env(), o, "JFIFUnit", Number(a.Env(), info.second.JFIFUnit));
    Set(a.Env(), o, "JFIFXDensity", Number(a.Env(), info.second.JFIFXDensity));
    Set(a.Env(), o, "JFIFYDensity", Number(a.Env(), info.second.JFIFYDensity));
  }
  Set(a.Env(), o, "ExifInformationExists",
      Boolean(a.Env(), info.second.ExifInformationExists));
  if (info.second.ExifInformationExists) {
    Set(a.Env(), o, "ExifUnit", Number(a.Env(), info.second.ExifUnit));
    Set(a.Env(), o, "ExifXDensity", Number(a.Env(), info.second.ExifXDensity));
    Set(a.Env(), o, "ExifYDensity", Number(a.Env(), info.second.ExifYDensity));
  }
  Set(a.Env(), o, "PhotoshopInformationExists",
      Boolean(a.Env(), info.second.PhotoshopInformationExists));
  if (info.second.PhotoshopInformationExists) {
    Set(a.Env(), o, "PhotoshopXDensity",
        Number(a.Env(), info.second.PhotoshopXDensity));
    Set(a.Env(), o, "PhotoshopYDensity",
        Number(a.Env(), info.second.PhotoshopYDensity));
  }
  return o;
}
napi_value PDFWriterDriver::GetFontForFile(const CallbackArgs &a) {
  if (a.Length() < 1 || !Type(a.Env(), a[0], napi_string) ||
      (a.Length() == 2 && !Type(a.Env(), a[1], napi_string) &&
       !Type(a.Env(), a[1], napi_number)) ||
      (a.Length() == 3 && (!Type(a.Env(), a[1], napi_string) ||
                           !Type(a.Env(), a[2], napi_number))))
    return ThrowTypeError(
        a.Env(), "wrong arguments, pass 1 argument that is the path to the "
                 "font file, with option to a 2nd parameter for another path "
                 "in case of type 1 font. another optional argument may follow "
                 "with font index in case of font packages (TTC, DFont)");
  auto *d = Driver(a);
  PDFUsedFont *f = nullptr;
  std::string p = LegacyString(a.Env(), a[0]);
  if (a.Length() == 3)
    f = d->writer_.GetFontForFile(p, LegacyString(a.Env(), a[1]),
                                  ToUint32(a.Env(), a[2]));
  else if (a.Length() == 2)
    f = Type(a.Env(), a[1], napi_string)
            ? d->writer_.GetFontForFile(p, LegacyString(a.Env(), a[1]))
            : d->writer_.GetFontForFile(p, ToUint32(a.Env(), a[1]));
  else
    f = d->writer_.GetFontForFile(p);
  if (!f)
    return ThrowTypeError(
        a.Env(), "unable to create font object. verify that the target is an "
                 "existing and supported font type (ttf,otf,type1,dfont,ttc)");
  napi_value v = d->holder->GetNewUsedFont();
  UsedFontDriver *font = nullptr;
  if (!ObjectWrap::UnwrapNew(a.Env(), v, &font))
    return nullptr;
  font->UsedFont = f;
  return v;
}
napi_value PDFWriterDriver::AttachURLLinktoCurrentPage(const CallbackArgs &a) {
  if (a.Length() != 5 || !Type(a.Env(), a[0], napi_string) ||
      !Type(a.Env(), a[1], napi_number) || !Type(a.Env(), a[2], napi_number) ||
      !Type(a.Env(), a[3], napi_number) || !Type(a.Env(), a[4], napi_number))
    return ThrowTypeError(
        a.Env(),
        "wrong arguments, pass a url, and 4 numbers (left,bottom,right,top) "
        "for the rectangle valid for clicking");
  auto s = Driver(a)->writer_.AttachURLLinktoCurrentPage(
      LegacyString(a.Env(), a[0]),
      PDFRectangle(ToDouble(a.Env(), a[1]), ToDouble(a.Env(), a[2]),
                   ToDouble(a.Env(), a[3]), ToDouble(a.Env(), a[4])));
  return s == eSuccess
             ? a.This()
             : ThrowTypeError(
                   a.Env(),
                   "unable to attach link to current page. will happen "
                   "if the input URL may not be encoded to ascii7");
}
napi_value PDFWriterDriver::Shutdown(const CallbackArgs &a) {
  if (a.Length() != 1 || !Type(a.Env(), a[0], napi_string))
    return ThrowTypeError(
        a.Env(), "wrong arguments, pass a path to save the state file to");
  EStatusCode s = Driver(a)->writer_.Shutdown(LegacyString(a.Env(), a[0]));
  Abort(a);
  return s == eSuccess
             ? a.This()
             : ThrowTypeError(a.Env(), "unable to save state file. verify that "
                                       "path is not occupied");
}
PDFHummus::EStatusCode PDFWriterDriver::StartPDF(const std::string &p,
                                                 EPDFVersion v,
                                                 const LogConfiguration &l,
                                                 const PDFCreationSettings &c) {
  startedWithStream_ = false;
  return Setup(writer_.StartPDF(p, v, l, c));
}
PDFHummus::EStatusCode PDFWriterDriver::StartPDF(napi_env e, napi_value stream,
                                                 EPDFVersion v,
                                                 const LogConfiguration &l,
                                                 const PDFCreationSettings &c) {
  writeProxy_ = new ObjectByteWriterWithPosition(e, stream);
  startedWithStream_ = true;
  return Setup(writer_.StartPDFForStream(writeProxy_, v, l, c));
}
PDFHummus::EStatusCode PDFWriterDriver::ContinuePDF(const std::string &o,
                                                    const std::string &s,
                                                    const std::string &m,
                                                    const LogConfiguration &l) {
  startedWithStream_ = false;
  return Setup(writer_.ContinuePDF(o, s, m, l));
}
PDFHummus::EStatusCode PDFWriterDriver::ContinuePDF(napi_env e, napi_value o,
                                                    const std::string &s,
                                                    napi_value m,
                                                    const LogConfiguration &l) {
  startedWithStream_ = true;
  writeProxy_ = new ObjectByteWriterWithPosition(e, o);
  if (m && !Type(e, m, napi_undefined))
    readProxy_ = new ObjectByteReaderWithPosition(e, m);
  return Setup(writer_.ContinuePDFForStream(writeProxy_, s, readProxy_, l));
}
PDFHummus::EStatusCode
PDFWriterDriver::ModifyPDF(const std::string &s, EPDFVersion v,
                           const std::string &o, const LogConfiguration &l,
                           const PDFCreationSettings &c) {
  startedWithStream_ = false;
  return Setup(writer_.ModifyPDF(s, v, o, l, c));
}
PDFHummus::EStatusCode
PDFWriterDriver::ModifyPDF(napi_env e, napi_value s, napi_value o,
                           EPDFVersion v, const LogConfiguration &l,
                           const PDFCreationSettings &c) {
  startedWithStream_ = true;
  writeProxy_ = new ObjectByteWriterWithPosition(e, o);
  readProxy_ = new ObjectByteReaderWithPosition(e, s);
  return Setup(
      writer_.ModifyPDFForStream(readProxy_, writeProxy_, false, v, l, c));
}
bool PDFWriterDriver::ColorFromArray(napi_env e, napi_value a,
                                      CMYKRGBColor &color) {
  uint32_t n = 0;
  if (!Length(e, a, &n))
    return false;
  if (n != 3 && n != 4) {
    ThrowTypeError(
        e,
        "wrong input for color values. should be array of either 3 or 4 colors");
    return false;
  }
  double values[4] = {};
  for (uint32_t i = 0; i < n; ++i) {
    napi_value value = nullptr;
    if (!Get(e, a, i, &value) || !CoerceToDouble(e, value, &values[i]))
      return false;
  }
  color = n == 4 ? CMYKRGBColor(values[0], values[1], values[2], values[3])
                 : CMYKRGBColor(values[0], values[1], values[2]);
  return true;
}
napi_value PDFWriterDriver::CreateFormXObjectFromTIFF(const CallbackArgs &a) {
  if ((a.Length() != 1 && a.Length() != 2) ||
      (!Type(a.Env(), a[0], napi_string) && !IsObject(a.Env(), a[0])) ||
      (a.Length() == 2 && !IsObject(a.Env(), a[1]) &&
       !Type(a.Env(), a[1], napi_number)))
    return ThrowTypeError(
        a.Env(), "wrong arguments, pass 1 argument that is the path to the "
                 "image, and optionally an options object or object ID");
  auto *d = Driver(a);
  TIFFUsageParameters p = TIFFUsageParameters::DefaultTIFFUsageParameters();
  ObjectIDType id = 0;
  if (a.Length() == 2) {
    if (Type(a.Env(), a[1], napi_number))
      id = ToInt32(a.Env(), a[1]);
    else {
      napi_value o = a[1];
      if (Has(a.Env(), o, "pageIndex") &&
          Type(a.Env(), Get(a.Env(), o, "pageIndex"), napi_number))
        p.PageIndex = ToUint32(a.Env(), Get(a.Env(), o, "pageIndex"));
      if (Has(a.Env(), o, "bwTreatment") &&
          IsObject(a.Env(), Get(a.Env(), o, "bwTreatment"))) {
        napi_value b = Get(a.Env(), o, "bwTreatment");
        if (Has(a.Env(), b, "asImageMask") &&
            Type(a.Env(), Get(a.Env(), b, "asImageMask"), napi_boolean))
          p.BWTreatment.AsImageMask =
              ToBoolean(a.Env(), Get(a.Env(), b, "asImageMask"));
        if (Has(a.Env(), b, "oneColor") &&
            IsArray(a.Env(), Get(a.Env(), b, "oneColor"))) {
          CMYKRGBColor color;
          if (!ColorFromArray(a.Env(), Get(a.Env(), b, "oneColor"), color))
            return nullptr;
          p.BWTreatment.OneColor = color;
        }
      }
      if (Has(a.Env(), o, "grayscaleTreatment") &&
          IsObject(a.Env(), Get(a.Env(), o, "grayscaleTreatment"))) {
        napi_value g = Get(a.Env(), o, "grayscaleTreatment");
        if (Has(a.Env(), g, "asColorMap") &&
            Type(a.Env(), Get(a.Env(), g, "asColorMap"), napi_boolean))
          p.GrayscaleTreatment.AsColorMap =
              ToBoolean(a.Env(), Get(a.Env(), g, "asColorMap"));
        if (Has(a.Env(), g, "oneColor") &&
            IsArray(a.Env(), Get(a.Env(), g, "oneColor"))) {
          CMYKRGBColor color;
          if (!ColorFromArray(a.Env(), Get(a.Env(), g, "oneColor"), color))
            return nullptr;
          p.GrayscaleTreatment.OneColor = color;
        }
        if (Has(a.Env(), g, "zeroColor") &&
            IsArray(a.Env(), Get(a.Env(), g, "zeroColor"))) {
          CMYKRGBColor color;
          if (!ColorFromArray(a.Env(), Get(a.Env(), g, "zeroColor"), color))
            return nullptr;
          p.GrayscaleTreatment.ZeroColor = color;
        }
      }
    }
  }
  if (HasPendingException(a.Env()))
    return nullptr;
  PDFFormXObject *f = nullptr;
  if (IsObject(a.Env(), a[0])) {
    ObjectByteReaderWithPosition r(a.Env(), a[0]);
    f = id ? d->writer_.CreateFormXObjectFromTIFFStream(&r, id, p)
           : d->writer_.CreateFormXObjectFromTIFFStream(&r, p);
  } else {
    std::string path = LegacyString(a.Env(), a[0]);
    f = id ? d->writer_.CreateFormXObjectFromTIFFFile(path, id, p)
           : d->writer_.CreateFormXObjectFromTIFFFile(path, p);
  }
  if (!f)
    return ThrowTypeError(a.Env(),
                          "unable to create form xobject. verify that the "
                          "target is an existing tiff file");
  napi_value v = d->holder->GetNewFormXObject();
  FormXObjectDriver *form = nullptr;
  if (!ObjectWrap::UnwrapNew(a.Env(), v, &form)) {
    delete f;
    return nullptr;
  }
  form->FormXObject = f;
  return v;
}
napi_value PDFWriterDriver::CreateImageXObjectFromJPG(const CallbackArgs &a) {
  if ((a.Length() != 1 && a.Length() != 2) ||
      (!Type(a.Env(), a[0], napi_string) && !IsObject(a.Env(), a[0])) ||
      (a.Length() == 2 && !Type(a.Env(), a[1], napi_number)))
    return ThrowTypeError(
        a.Env(),
        "wrong arguments, pass 1 argument that is the path to the image. pass "
        "another optional argument of a forward reference object ID");
  auto *d = Driver(a);
  ObjectIDType id = a.Length() == 2 ? ToInt32(a.Env(), a[1]) : 0;
  PDFImageXObject *x = nullptr;
  if (IsObject(a.Env(), a[0])) {
    ObjectByteReaderWithPosition r(a.Env(), a[0]);
    x = id ? d->writer_.CreateImageXObjectFromJPGStream(&r, id)
           : d->writer_.CreateImageXObjectFromJPGStream(&r);
  } else {
    std::string p = LegacyString(a.Env(), a[0]);
    x = id ? d->writer_.CreateImageXObjectFromJPGFile(p, id)
           : d->writer_.CreateImageXObjectFromJPGFile(p);
  }
  if (!x)
    return ThrowTypeError(a.Env(),
                          "unable to create image xobject. verify that "
                          "the target is an existing jpg file");
  napi_value v = d->holder->GetNewImageXObject();
  ImageXObjectDriver *image = nullptr;
  if (!ObjectWrap::UnwrapNew(a.Env(), v, &image)) {
    delete x;
    return nullptr;
  }
  image->ImageXObject = x;
  return v;
}
napi_value PDFWriterDriver::GetObjectsContext(const CallbackArgs &a) {
  auto *d = Driver(a);
  napi_value v = d->holder->GetNewObjectsContext();
  ObjectsContextDriver *context = nullptr;
  if (!ObjectWrap::UnwrapNew(a.Env(), v, &context))
    return nullptr;
  context->ObjectsContextInstance = &d->writer_.GetObjectsContext();
  return v;
}
napi_value PDFWriterDriver::GetDocumentContext(const CallbackArgs &a) {
  auto *d = Driver(a);
  napi_value v = d->holder->GetNewDocumentContext();
  DocumentContextDriver *context = nullptr;
  if (!ObjectWrap::UnwrapNew(a.Env(), v, &context))
    return nullptr;
  context->DocumentContextInstance = &d->writer_.GetDocumentContext();
  return v;
}
bool PDFWriterDriver::ObjectToPageRange(napi_env e, napi_value o,
                                        PDFPageRange &out) {
  PDFPageRange r;
  if (Has(e, o, "type") && Type(e, Get(e, o, "type"), napi_number))
    r.mType =
        static_cast<PDFPageRange::ERangeType>(ToUint32(e, Get(e, o, "type")));
  if (HasPendingException(e))
    return false;
  if (Has(e, o, "specificRanges") && IsArray(e, Get(e, o, "specificRanges"))) {
    napi_value a = Get(e, o, "specificRanges");
    uint32_t length = 0;
    if (!a || !Length(e, a, &length))
      return false;
    for (uint32_t i = 0; i < length; ++i) {
      napi_value item = nullptr;
      uint32_t itemLength = 0;
      napi_value first = nullptr;
      napi_value second = nullptr;
      if (!Get(e, a, i, &item) || !IsArray(e, item) ||
          !Length(e, item, &itemLength)) {
        if (!HasPendingException(e))
          ThrowTypeError(
              e, "wrong argument for specificRanges. it should be an "
                 "array of arrays. each subarray should be of the length "
                 "of 2, signifying begining page and ending page numbers");
        return false;
      }
      if (itemLength != 2 || !Get(e, item, uint32_t{0}, &first) ||
          !Get(e, item, uint32_t{1}, &second)) {
        if (!HasPendingException(e))
          ThrowTypeError(
              e, "wrong argument for specificRanges. it should be an "
                 "array of arrays. each subarray should be of the length "
                 "of 2, signifying begining page and ending page numbers");
        return false;
      }
      if (!Type(e, first, napi_number) || !Type(e, second, napi_number)) {
        ThrowTypeError(
            e, "wrong argument for specificRanges. it should be an "
               "array of arrays. each subarray should be of the length "
               "of 2, signifying begining page and ending page numbers");
        return false;
      }
      r.mSpecificRanges.push_back(
          ULongAndULong(ToUint32(e, first), ToUint32(e, second)));
    }
  }
  if (HasPendingException(e))
    return false;
  out = r;
  return true;
}
napi_value PDFWriterDriver::AppendPDFPagesFromPDF(const CallbackArgs &a) {
  if (a.Length() < 1 || a.Length() > 2 ||
      (!Type(a.Env(), a[0], napi_string) && !IsObject(a.Env(), a[0])) ||
      (a.Length() == 2 && !IsObject(a.Env(), a[1])))
    return ThrowTypeError(
        a.Env(), "wrong arguments, pass a path for file to append pages "
                 "from or a stream object, optionally an options object");
  auto *d = Driver(a);
  PDFPageRange range;
  PDFParsingOptions p;
  if (a.Length() == 2) {
    Password(a.Env(), a[1], p);
    if (HasPendingException(a.Env()) ||
        !ObjectToPageRange(a.Env(), a[1], range))
      return nullptr;
  }
  EStatusCodeAndObjectIDTypeList r;
  if (IsObject(a.Env(), a[0])) {
    ObjectByteReaderWithPosition s(a.Env(), a[0]);
    r = d->writer_.AppendPDFPagesFromPDF(&s, range, ObjectIDTypeList(), p);
  } else
    r = d->writer_.AppendPDFPagesFromPDF(LegacyString(a.Env(), a[0]), range,
                                          ObjectIDTypeList(), p);
  if (r.first != eSuccess) {
    Abort(a);
    return ThrowTypeError(a.Env(),
                          "unable to append page, make sure it's fine");
  }
  napi_value out = Array(a.Env(), r.second.size());
  uint32_t i = 0;
  for (auto id : r.second)
    Set(a.Env(), out, i++, Number(a.Env(), id));
  return out;
}
class MergeCaller : public DocumentContextExtenderAdapter {
public:
  MergeCaller(napi_env e, napi_value f) : env(e), callback(e, f) {}
  EStatusCode OnAfterMergePageFromPage(PDFPage *, PDFDictionary *,
                                       ObjectsContext *, DocumentContext *,
                                       PDFDocumentHandler *) override {
    napi_value fn = callback.Get();
    if (!fn)
      return eSuccess;
    napi_value receiver;
    if (!Check(env, napi_get_global(env, &receiver)))
      return eFailure;
    return Call(env, receiver, fn) ? eSuccess : eFailure;
  }
  napi_env env;
  Reference callback;
};
napi_value PDFWriterDriver::MergePDFPagesToPage(const CallbackArgs &a) {
  auto *d = Driver(a);
  if (a.Length() < 2)
    return ThrowTypeError(
        a.Env(),
        "Too few arguments. Pass a page object, a path to pages source file or "
        "an IByteReaderWithPosition, and two optional: configuration object "
        "and callback function that will be called between pages merging");
  if (!d->holder->IsPDFPageInstance(a[0]))
    return ThrowTypeError(
        a.Env(), "Invalid arguments. First argument must be a page object");
  if (!Type(a.Env(), a[1], napi_string) && !IsObject(a.Env(), a[1]))
    return ThrowTypeError(
        a.Env(), "Invalid arguments. Second argument must be either an "
                 "input stream or a path to a pages source file.");
  PDFPageRange range;
  PDFParsingOptions p;
  napi_value cb = nullptr;
  for (size_t i = 2; i < a.Length(); ++i) {
    if (Type(a.Env(), a[i], napi_function))
      cb = a[i];
    else if (IsObject(a.Env(), a[i])) {
      Password(a.Env(), a[i], p);
      if (HasPendingException(a.Env()) ||
          !ObjectToPageRange(a.Env(), a[i], range))
        return nullptr;
    }
  }
  std::unique_ptr<MergeCaller> caller;
  if (cb) {
    caller = std::make_unique<MergeCaller>(a.Env(), cb);
    d->writer_.GetDocumentContext().AddDocumentContextExtender(caller.get());
  }
  auto *page = ObjectWrap::Unwrap<PDFPageDriver>(a.Env(), a[0]);
  EStatusCode s;
  if (IsObject(a.Env(), a[1])) {
    ObjectByteReaderWithPosition r(a.Env(), a[1]);
    s = d->writer_.MergePDFPagesToPage(page->GetPage(), &r, range,
                                       ObjectIDTypeList(), p);
  } else
    s = d->writer_.MergePDFPagesToPage(page->GetPage(),
                                      LegacyString(a.Env(), a[1]),
                                       range, ObjectIDTypeList(), p);
  if (caller)
    d->writer_.GetDocumentContext().RemoveDocumentContextExtender(caller.get());
  return s == eSuccess
             ? a.This()
             : ThrowTypeError(
                   a.Env(),
                   "unable to append to page, make sure source file exists");
}
napi_value PDFWriterDriver::CreatePDFCopyingContext(const CallbackArgs &a) {
  if (a.Length() < 1 || a.Length() > 2 ||
      (!Type(a.Env(), a[0], napi_string) && !IsObject(a.Env(), a[0])) ||
      (a.Length() == 2 && !IsObject(a.Env(), a[1])))
    return ThrowTypeError(
        a.Env(),
        "wrong arguments, pass a path to a PDF file to create copying context "
        "for or a stream object, and then an optional options object");
  auto *d = Driver(a);
  PDFParsingOptions p;
  if (a.Length() == 2)
    Password(a.Env(), a[1], p);
  PDFDocumentCopyingContext *c = nullptr;
  DriverLifecycle owner;
  ObjectByteReaderWithPosition *proxy = nullptr;
  if (IsObject(a.Env(), a[0])) {
    if (d->holder->IsPDFReaderInstance(a[0])) {
      auto *r = ObjectWrap::Unwrap<PDFReaderDriver>(a.Env(), a[0]);
      if (!r->GetParser())
        return ThrowTypeError(a.Env(), "PDF reader has ended");
      owner = r->GetLifecycle();
      c = d->writer_.GetDocumentContext().CreatePDFCopyingContext(
          r->GetParser());
    } else {
      proxy = new ObjectByteReaderWithPosition(a.Env(), a[0]);
      c = d->writer_.CreatePDFCopyingContext(proxy, p);
    }
  } else
    c = d->writer_.CreatePDFCopyingContext(LegacyString(a.Env(), a[0]), p);
  if (!c) {
    delete proxy;
    return ThrowTypeError(a.Env(),
                          "unable to create copying context. verify that "
                          "the target is an existing PDF file");
  }
  napi_value v = d->holder->GetNewDocumentCopyingContext();
  DocumentCopyingContextDriver *cd = nullptr;
  if (!ObjectWrap::UnwrapNew(a.Env(), v, &cd)) {
    delete c;
    delete proxy;
    return nullptr;
  }
  cd->CopyingContext = c;
  cd->ReadStreamProxy = proxy;
  cd->AddOwnerLifecycle(d->lifecycle_);
  if (owner)
    cd->AddOwnerLifecycle(owner);
  return v;
}
napi_value PDFWriterDriver::CreateFormXObjectsFromPDF(const CallbackArgs &a) {
  if (a.Length() < 1 || a.Length() > 5 || !Type(a.Env(), a[0], napi_string) ||
      (a.Length() >= 2 && !Type(a.Env(), a[1], napi_number) &&
       !IsArray(a.Env(), a[1])) ||
      (a.Length() >= 3 && !IsObject(a.Env(), a[2])) ||
      (a.Length() >= 4 && !IsArray(a.Env(), a[3])) ||
      (a.Length() == 5 && !IsArray(a.Env(), a[4])))
    return ThrowTypeError(
        a.Env(),
        "wrong arguments, pass a path to the file, and optionals - a box "
        "enumerator or actual 4 numbers box, a range object, a matrix for the "
        "form, array of object ids to copy in addition");
  auto *d = Driver(a);
  PDFPageRange range;
  PDFParsingOptions p;
  if (a.Length() >= 3) {
    Password(a.Env(), a[2], p);
    if (HasPendingException(a.Env()) ||
        !ObjectToPageRange(a.Env(), a[2], range))
      return nullptr;
  }
  double matrix[6], *mp = nullptr;
  if (a.Length() >= 4) {
    if (!ReadNumberArray(a.Env(), a[3], matrix,
                         "matrix array should be 6 numbers long"))
      return nullptr;
    mp = matrix;
  }
  ObjectIDTypeList extra;
  if (a.Length() == 5) {
    uint32_t length = 0;
    if (!Length(a.Env(), a[4], &length))
      return nullptr;
    for (uint32_t i = 0; i < length; ++i) {
      napi_value value = nullptr;
      uint32_t id = 0;
      if (!Get(a.Env(), a[4], i, &value) ||
          !CoerceToUint32(a.Env(), value, &id))
        return nullptr;
      extra.push_back(id);
    }
  }
  EStatusCodeAndObjectIDTypeList r;
  if (IsArray(a.Env(), a[1])) {
    double values[4];
    if (!ReadNumberArray(a.Env(), a[1], values,
                         "box dimensions array should be 4 numbers long"))
      return nullptr;
    PDFRectangle box(values[0], values[1], values[2], values[3]);
    r = d->writer_.CreateFormXObjectsFromPDF(LegacyString(a.Env(), a[0]), range,
                                             box, mp, extra, p);
  } else
    r = d->writer_.CreateFormXObjectsFromPDF(
        LegacyString(a.Env(), a[0]), range,
        a.Length() >= 2
            ? static_cast<EPDFPageBox>(ToUint32(a.Env(), a[1]))
            : ePDFPageBoxMediaBox,
        mp, extra, p);
  if (r.first != eSuccess)
    return ThrowTypeError(
        a.Env(),
        "unable to create forms from file. make sure the file exists, and that "
        "the input page range is valid (well, if you provided one..m'k?");
  napi_value out = Array(a.Env(), r.second.size());
  uint32_t i = 0;
  for (auto id : r.second)
    Set(a.Env(), out, i++, Number(a.Env(), id));
  return out;
}
napi_value
PDFWriterDriver::CreatePDFCopyingContextForModifiedFile(const CallbackArgs &a) {
  auto *d = Driver(a);
  auto *c = d->writer_.CreatePDFCopyingContextForModifiedFile();
  if (!c)
    return ThrowTypeError(
        a.Env(),
        "unable to create copying context for modified file...possibly a file "
        "is not being modified by this writer...");
  napi_value v = d->holder->GetNewDocumentCopyingContext();
  DocumentCopyingContextDriver *cd = nullptr;
  if (!ObjectWrap::UnwrapNew(a.Env(), v, &cd)) {
    delete c;
    return nullptr;
  }
  cd->CopyingContext = c;
  cd->AddOwnerLifecycle(d->lifecycle_);
  return v;
}
napi_value PDFWriterDriver::CreatePDFTextString(const CallbackArgs &a) {
  return Driver(a)->holder->GetNewPDFTextString(Values(a));
}
napi_value PDFWriterDriver::CreatePDFDate(const CallbackArgs &a) {
  return Driver(a)->holder->GetNewPDFDate(Values(a), true);
}
PDFWriter *PDFWriterDriver::GetWriter() { return &writer_; }
void PDFWriterDriver::SetLogStream(napi_env e, napi_value stream,
                                   LogConfiguration &c) {
  ReleaseLogProxy();
  logProxy_ = new ObjectByteWriter(e, stream);
  c.ShouldLog = true;
  c.LogFileLocation = "";
  c.LogStream = logProxy_;
}
// The proxy is handed to the process-global trace, which keeps a raw pointer to
// it. Detach it there before freeing it, or the next trace of any writer writes
// through freed memory.
void PDFWriterDriver::ReleaseLogProxy() {
  if (!logProxy_)
    return;
  Trace::DefaultTrace().SetLogSettings("", false, false);
  delete logProxy_;
  logProxy_ = nullptr;
}
napi_value PDFWriterDriver::GetImageDimensions(const CallbackArgs &a) {
  if (a.Length() < 1 || a.Length() > 3 ||
      (!Type(a.Env(), a[0], napi_string) && !IsObject(a.Env(), a[0])) ||
      (a.Length() >= 2 && !Type(a.Env(), a[1], napi_number)) ||
      (a.Length() == 3 && !IsObject(a.Env(), a[2])))
    return ThrowTypeError(
        a.Env(), "wrong arguments, pass 1 to 3 arguments. a path to an "
                 "image or a stream object, an optional image index (for "
                 "multi-image files), and an options object");
  auto *d = Driver(a);
  PDFParsingOptions p;
  if (a.Length() == 3)
    Password(a.Env(), a[2], p);
  DoubleAndDoublePair dim;
  if (IsObject(a.Env(), a[0])) {
    ObjectByteReaderWithPosition r(a.Env(), a[0]);
    dim = d->writer_.GetImageDimensions(
        &r, a.Length() >= 2 ? ToUint32(a.Env(), a[1]) : 0, p);
  } else
    dim = d->writer_.GetImageDimensions(
        LegacyString(a.Env(), a[0]),
        a.Length() >= 2 ? ToUint32(a.Env(), a[1]) : 0,
        p);
  napi_value o = Object(a.Env());
  Set(a.Env(), o, "width", Number(a.Env(), dim.first));
  Set(a.Env(), o, "height", Number(a.Env(), dim.second));
  return o;
}
napi_value PDFWriterDriver::GetImagePagesCount(const CallbackArgs &a) {
  if (a.Length() < 1 || a.Length() > 2 || !Type(a.Env(), a[0], napi_string) ||
      (a.Length() == 2 && !IsObject(a.Env(), a[1])))
    return ThrowTypeError(
        a.Env(), "wrong arguments, pass 1 argument and an optional one. a "
                 "path to an image, and an options object");
  PDFParsingOptions p;
  if (a.Length() == 2)
    Password(a.Env(), a[1], p);
  return Number(a.Env(), Driver(a)->writer_.GetImagePagesCount(
                              LegacyString(a.Env(), a[0]), p));
}
napi_value PDFWriterDriver::GetImageType(const CallbackArgs &a) {
  if (a.Length() != 1 || !Type(a.Env(), a[0], napi_string))
    return ThrowTypeError(
        a.Env(), "wrong arguments, pass 1 argument. a path to an image");
  switch (Driver(a)->writer_.GetImageType(LegacyString(a.Env(), a[0]), 0)) {
  case ePDF:
    return String(a.Env(), "PDF");
  case eJPG:
    return String(a.Env(), "JPEG");
  case eTIFF:
    return String(a.Env(), "TIFF");
  case ePNG:
    return String(a.Env(), "PNG");
  default:
    return Undefined(a.Env());
  }
}
napi_value PDFWriterDriver::GetModifiedFileParser(const CallbackArgs &a) {
  auto *d = Driver(a);
  PDFParser *p = &d->writer_.GetModifiedFileParser();
  if (!p->GetTrailer())
    return ThrowTypeError(a.Env(),
                          "unable to create modified parser...possibly a "
                          "file is not being modified by this writer...");
  napi_value v = d->holder->GetNewPDFReader();
  PDFReaderDriver *reader = nullptr;
  if (!ObjectWrap::UnwrapNew(a.Env(), v, &reader))
    return nullptr;
  reader->SetFromOwnedParser(p);
  return v;
}
napi_value PDFWriterDriver::GetModifiedInputFile(const CallbackArgs &a) {
  auto *d = Driver(a);
  InputFile *f = &d->writer_.GetModifiedInputFile();
  if (!f->GetInputStream())
    return ThrowTypeError(
        a.Env(), "unable to create modified input file...possibly a file "
                 "is not being modified by this writer...");
  napi_value v = d->holder->GetNewInputFile();
  InputFileDriver *file = nullptr;
  if (!ObjectWrap::UnwrapNew(a.Env(), v, &file))
    return nullptr;
  file->SetFromOwnedFile(f);
  return v;
}
napi_value PDFWriterDriver::GetOutputFile(const CallbackArgs &a) {
  auto *d = Driver(a);
  OutputFile *f = &d->writer_.GetOutputFile();
  if (!f->GetOutputStream())
    return ThrowTypeError(
        a.Env(), "unable to get output file. probably pdf writing hasn't "
                 "started, or the output is not to a file");
  napi_value v = d->holder->GetNewOutputFile();
  OutputFileDriver *file = nullptr;
  if (!ObjectWrap::UnwrapNew(a.Env(), v, &file))
    return nullptr;
  file->SetFromOwnedFile(f);
  return v;
}
napi_value PDFWriterDriver::RegisterAnnotationReferenceForNextPageWrite(
    const CallbackArgs &a) {
  if (a.Length() != 1 || !Type(a.Env(), a[0], napi_number))
    return ThrowTypeError(
        a.Env(),
        "wrong arguments,  pass an object ID for an annotation to register");
  Driver(a)
      ->writer_.GetDocumentContext()
      .RegisterAnnotationReferenceForNextPageWrite(ToUint32(a.Env(), a[0]));
  return a.This();
}
napi_value PDFWriterDriver::RequireCatalogUpdate(const CallbackArgs &a) {
  Driver(a)->catalogUpdateRequired_ = true;
  return Undefined(a.Env());
}
napi_value WrapDictionary(ConstructorsHolder *h, napi_env e,
                          DictionaryContext *d) {
  napi_value v = h->GetNewDictionaryContext();
  DictionaryContextDriver *driver = nullptr;
  if (!ObjectWrap::UnwrapNew(e, v, &driver))
    return nullptr;
  driver->DictionaryContextInstance = d;
  return v;
}
EStatusCode PDFWriterDriver::OnPageWrite(PDFPage *p, DictionaryContext *d,
                                         ObjectsContext *, DocumentContext *) {
  napi_value o = Object(env_);
  if (!o)
    return eFailure;
  napi_value pv = holder->GetNewPDFPage();
  PDFPageDriver *pd = nullptr;
  if (!ObjectWrap::UnwrapNew(env_, pv, &pd))
    return eFailure;
  if (pd->mOwnsPage)
    delete pd->mPDFPage;
  pd->mPDFPage = p;
  pd->mOwnsPage = false;
  napi_value dictionary = WrapDictionary(holder, env_, d);
  if (!dictionary || !Set(env_, o, "page", pv) ||
      !Set(env_, o, "pageDictionaryContext", dictionary))
    return eFailure;
  return TriggerEvent("OnPageWrite", o);
}
EStatusCode PDFWriterDriver::OnResourcesWrite(ResourcesDictionary *r,
                                              DictionaryContext *d,
                                              ObjectsContext *,
                                              DocumentContext *) {
  napi_value o = Object(env_);
  if (!o)
    return eFailure;
  napi_value rv = holder->GetNewResourcesDictionary();
  ResourcesDictionaryDriver *resources = nullptr;
  if (!ObjectWrap::UnwrapNew(env_, rv, &resources))
    return eFailure;
  resources->ResourcesDictionaryInstance = r;
  napi_value dictionary = WrapDictionary(holder, env_, d);
  if (!dictionary || !Set(env_, o, "resources", rv) ||
      !Set(env_, o, "pageResourcesDictionaryContext", dictionary))
    return eFailure;
  return TriggerEvent("OnResourcesWrite", o);
}
EStatusCode PDFWriterDriver::OnResourceDictionaryWrite(DictionaryContext *d,
                                                       const std::string &n,
                                                       ObjectsContext *,
                                                       DocumentContext *) {
  napi_value o = Object(env_);
  if (!o)
    return eFailure;
  napi_value dictionary = WrapDictionary(holder, env_, d);
  napi_value name = String(env_, n);
  if (!dictionary || !name ||
      !Set(env_, o, "resourceDictionaryName", name) ||
      !Set(env_, o, "resourceDictionary", dictionary))
    return eFailure;
  return TriggerEvent("OnResourceDictionaryWrite", o);
}
EStatusCode PDFWriterDriver::OnCatalogWrite(CatalogInformation *,
                                            DictionaryContext *d,
                                            ObjectsContext *,
                                            DocumentContext *) {
  napi_value o = Object(env_);
  if (!o)
    return eFailure;
  napi_value dictionary = WrapDictionary(holder, env_, d);
  if (!dictionary || !Set(env_, o, "catalogDictionaryContext", dictionary))
    return eFailure;
  return TriggerEvent("OnCatalogWrite", o);
}
EStatusCode PDFWriterDriver::TriggerEvent(const std::string &n, napi_value p) {
  napi_value self = self_.Get();
  napi_value f = Get(env_, self, "triggerDocumentExtensionEvent");
  if (!f || Type(env_, f, napi_undefined))
    return eFailure;
  return Call(env_, self, f, {String(env_, n), p}) ? eSuccess : eFailure;
}
#define SUCCESS_METHOD(signature)                                              \
  EStatusCode PDFWriterDriver::signature { return eSuccess; }
SUCCESS_METHOD(OnFormXObjectWrite(ObjectIDType, ObjectIDType,
                                  DictionaryContext *, ObjectsContext *,
                                  DocumentContext *))
SUCCESS_METHOD(OnJPEGImageXObjectWrite(ObjectIDType, DictionaryContext *,
                                       ObjectsContext *, DocumentContext *,
                                       JPEGImageHandler *))
SUCCESS_METHOD(OnTIFFImageXObjectWrite(ObjectIDType, DictionaryContext *,
                                       ObjectsContext *, DocumentContext *,
                                       TIFFImageHandler *))
SUCCESS_METHOD(OnPDFParsingComplete(ObjectsContext *, DocumentContext *,
                                    PDFDocumentHandler *))
SUCCESS_METHOD(OnBeforeCreateXObjectFromPage(PDFDictionary *, ObjectsContext *,
                                             DocumentContext *,
                                             PDFDocumentHandler *))
SUCCESS_METHOD(OnAfterCreateXObjectFromPage(PDFFormXObject *, PDFDictionary *,
                                            ObjectsContext *, DocumentContext *,
                                            PDFDocumentHandler *))
SUCCESS_METHOD(OnBeforeCreatePageFromPage(PDFDictionary *, ObjectsContext *,
                                          DocumentContext *,
                                          PDFDocumentHandler *))
SUCCESS_METHOD(OnAfterCreatePageFromPage(PDFPage *, PDFDictionary *,
                                         ObjectsContext *, DocumentContext *,
                                         PDFDocumentHandler *))
SUCCESS_METHOD(OnBeforeMergePageFromPage(PDFPage *, PDFDictionary *,
                                         ObjectsContext *, DocumentContext *,
                                         PDFDocumentHandler *))
SUCCESS_METHOD(OnAfterMergePageFromPage(PDFPage *, PDFDictionary *,
                                        ObjectsContext *, DocumentContext *,
                                        PDFDocumentHandler *))
SUCCESS_METHOD(OnPDFCopyingComplete(ObjectsContext *, DocumentContext *,
                                    PDFDocumentHandler *))
#undef SUCCESS_METHOD
bool PDFWriterDriver::IsCatalogUpdateRequiredForModifiedFile(PDFParser *) {
  return catalogUpdateRequired_;
}
EStatusCode PDFWriterDriver::Setup(EStatusCode s) {
  if (s == eSuccess) {
    writer_.GetDocumentContext().AddDocumentContextExtender(this);
    started_ = true;
  } else {
    delete writeProxy_;
    writeProxy_ = nullptr;
    delete readProxy_;
    readProxy_ = nullptr;
    ReleaseLogProxy();
  }
  return s;
}
