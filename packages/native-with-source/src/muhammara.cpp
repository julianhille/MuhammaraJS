#include "napi/NapiSupport.h"

#include "ByteReaderDriver.h"
#include "ByteReaderWithPositionDriver.h"
#include "ByteWriterDriver.h"
#include "ByteWriterWithPositionDriver.h"
#include "DictionaryContextDriver.h"
#include "DocumentContextDriver.h"
#include "DocumentCopyingContextDriver.h"
#include "EPDFVersion.h"
#include "ETokenSeparator.h"
#include "FormXObjectDriver.h"
#include "ImageXObjectDriver.h"
#include "InfoDictionary.h"
#include "InfoDictionaryDriver.h"
#include "InputFileDriver.h"
#include "ObjectByteReaderWithPosition.h"
#include "ObjectByteWriterWithPosition.h"
#include "ObjectsContextDriver.h"
#include "OutputFileDriver.h"
#include "PDFArrayDriver.h"
#include "PDFBooleanDriver.h"
#include "PDFDateDriver.h"
#include "PDFDictionaryDriver.h"
#include "PDFEmbedParameterTypes.h"
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
#include "PDFPageModifierDriver.h"
#include "PDFParser.h"
#include "PDFReaderDriver.h"
#include "PDFRealDriver.h"
#include "PDFStreamDriver.h"
#include "PDFStreamInputDriver.h"
#include "PDFSymbolDriver.h"
#include "PDFTextStringDriver.h"
#include "PDFWriterDriver.h"
#include "PageContentContextDriver.h"
#include "ProcsetResourcesConstants.h"
#include "ResourcesDictionaryDriver.h"
#include "UsedFontDriver.h"
#include "XObjectContentContextDriver.h"
#include "text-extraction/PDFTextExtractor.h"

using namespace muhammara::napi;
using namespace PDFHummus;

namespace {

bool ReadCreationOptions(napi_env env, napi_value options, EPDFVersion &version,
                          LogConfiguration &log, PDFCreationSettings &creation,
                          bool allowUndefinedVersion = false) {
  if (!options || !IsObject(env, options))
    return true;
  if (Has(env, options, "version") &&
      IsType(env, Get(env, options, "version"), napi_number)) {
    int32_t value = ToInt32(env, Get(env, options, "version"));
    if ((!allowUndefinedVersion || value != ePDFVersionUndefined) &&
        (value < ePDFVersion10 || ePDFVersionMax < value)) {
      ThrowError(
          env,
          "Wrong argument for PDF version, please provide a valid PDF version");
      return false;
    }
    version = static_cast<EPDFVersion>(value);
  }
  if (Has(env, options, "compress") &&
      IsType(env, Get(env, options, "compress"), napi_boolean))
    creation.CompressStreams = ToBoolean(env, Get(env, options, "compress"));
  if (Has(env, options, "log") &&
      IsType(env, Get(env, options, "log"), napi_string)) {
    log.ShouldLog = true;
    log.LogFileLocation = LegacyString(env, Get(env, options, "log"));
  }
  if (Has(env, options, "userPassword") &&
      IsType(env, Get(env, options, "userPassword"), napi_string)) {
    creation.DocumentEncryptionOptions.ShouldEncrypt = true;
    creation.DocumentEncryptionOptions.UserPassword =
        LegacyString(env, Get(env, options, "userPassword"));
  }
  if (Has(env, options, "ownerPassword") &&
      IsType(env, Get(env, options, "ownerPassword"), napi_string))
    creation.DocumentEncryptionOptions.OwnerPassword =
        LegacyString(env, Get(env, options, "ownerPassword"));
  creation.DocumentEncryptionOptions.UserProtectionOptionsFlag =
      Has(env, options, "userProtectionFlag") &&
              IsType(env, Get(env, options, "userProtectionFlag"), napi_number)
          ? ToInt32(env, Get(env, options, "userProtectionFlag"))
          : 4;
  return !HasPendingException(env);
}

napi_value CreateWriter(const CallbackArgs &args) {
  if (args.Length() < 1 || args.Length() > 2)
    return ThrowError(
        args.Env(),
        "Wrong number of arguments, Provide one argument stating the location "
        "of the output file, and an optional options object");
  if (!IsType(args.Env(), args[0], napi_string) &&
      !IsObject(args.Env(), args[0]))
    return ThrowError(args.Env(),
                      "Wrong arguments, please provide a path to a file as the "
                      "first argument or a stream object");
  auto &constructors = ModuleState::Get(args.Env())->Constructors();
  napi_value instance = constructors.GetNewPDFWriter();
  PDFWriterDriver *driver = nullptr;
  if (!ObjectWrap::UnwrapNew(args.Env(), instance, &driver))
    return nullptr;
  EPDFVersion version = ePDFVersion14;
  PDFCreationSettings creation(true, true);
  LogConfiguration log = LogConfiguration::DefaultLogConfiguration();
  if (args.Length() == 2 &&
      !ReadCreationOptions(args.Env(), args[1], version, log, creation))
    return nullptr;
  EStatusCode status =
      IsObject(args.Env(), args[0])
          ? driver->StartPDF(args.Env(), args[0], version, log, creation)
          : driver->StartPDF(LegacyString(args.Env(), args[0]), version, log,
                             creation);
  return status == eSuccess
             ? instance
             : ThrowError(args.Env(), "Unable to create PDF file, make sure "
                                      "that output file target is available");
}

napi_value CreateWriterToContinue(const CallbackArgs &args) {
  if ((args.Length() != 2 && args.Length() != 3) ||
      (!IsType(args.Env(), args[0], napi_string) &&
       !IsObject(args.Env(), args[0])) ||
      !IsType(args.Env(), args[1], napi_string) ||
      (args.Length() == 3 && !IsObject(args.Env(), args[2])))
    return ThrowError(
        args.Env(),
        "Wrong arguments, provide 2 strings - path to file to continue, and "
        "path to state file (provided to the previous shutdown call. You may "
        "also add an options object");
  napi_value instance =
      ModuleState::Get(args.Env())->Constructors().GetNewPDFWriter();
  PDFWriterDriver *d = nullptr;
  if (!ObjectWrap::UnwrapNew(args.Env(), instance, &d))
    return nullptr;
  std::string alternative;
  napi_value modified = Undefined(args.Env());
  LogConfiguration log = LogConfiguration::DefaultLogConfiguration();
  if (args.Length() == 3) {
    napi_value o = args[2];
    if (Has(args.Env(), o, "modifiedFilePath") &&
        IsType(args.Env(), Get(args.Env(), o, "modifiedFilePath"), napi_string))
      alternative =
          LegacyString(args.Env(), Get(args.Env(), o, "modifiedFilePath"));
    if (Has(args.Env(), o, "modifiedStream") &&
        IsObject(args.Env(), Get(args.Env(), o, "modifiedStream")))
      modified = Get(args.Env(), o, "modifiedStream");
    if (Has(args.Env(), o, "log")) {
      napi_value l = Get(args.Env(), o, "log");
      if (IsType(args.Env(), l, napi_string)) {
        log.ShouldLog = true;
        log.LogFileLocation = LegacyString(args.Env(), l);
      } else if (IsObject(args.Env(), l))
        d->SetLogStream(args.Env(), l, log);
    }
  }
  if (HasPendingException(args.Env()))
    return nullptr;
  EStatusCode status =
      IsObject(args.Env(), args[0])
          ? d->ContinuePDF(args.Env(), args[0],
                           LegacyString(args.Env(), args[1]),
                           modified, log)
          : d->ContinuePDF(LegacyString(args.Env(), args[0]),
                           LegacyString(args.Env(), args[1]), alternative, log);
  return status == eSuccess
             ? instance
             : ThrowError(args.Env(),
                          "Unable to continue PDF file, make sure that output "
                          "file target is available and state file exists");
}

napi_value CreateWriterToModify(const CallbackArgs &args) {
  if (args.Length() < 1 ||
      (!IsType(args.Env(), args[0], napi_string) &&
       !IsObject(args.Env(), args[0])) ||
      (IsType(args.Env(), args[0], napi_string) && args.Length() > 2) ||
      (IsObject(args.Env(), args[0]) &&
       (args.Length() < 2 || !IsObject(args.Env(), args[1]) ||
        args.Length() > 3)))
    return ThrowError(
        args.Env(),
        "Wrong arguments, please path a path to modified file, or a pair of "
        "stream - first for the source, and second for destination. in "
        "addition you can optionally add an options object");
  napi_value instance =
      ModuleState::Get(args.Env())->Constructors().GetNewPDFWriter();
  PDFWriterDriver *d = nullptr;
  if (!ObjectWrap::UnwrapNew(args.Env(), instance, &d))
    return nullptr;
  EPDFVersion version = ePDFVersion10;
  PDFCreationSettings creation(true, true);
  LogConfiguration log = LogConfiguration::DefaultLogConfiguration();
  std::string alternative;
  size_t oi = IsType(args.Env(), args[0], napi_string) ? 1 : 2;
  if (args.Length() == oi + 1) {
    if (!ReadCreationOptions(args.Env(), args[oi], version, log, creation))
      return nullptr;
    if (Has(args.Env(), args[oi], "modifiedFilePath") &&
        IsType(args.Env(), Get(args.Env(), args[oi], "modifiedFilePath"),
               napi_string))
      alternative =
          LegacyString(args.Env(),
                       Get(args.Env(), args[oi], "modifiedFilePath"));
  }
  if (HasPendingException(args.Env()))
    return nullptr;
  EStatusCode status =
      IsObject(args.Env(), args[0])
          ? d->ModifyPDF(args.Env(), args[0], args[1], version, log, creation)
          : d->ModifyPDF(LegacyString(args.Env(), args[0]), version, alternative,
                         log, creation);
  return status == eSuccess
             ? instance
             : ThrowError(
                   args.Env(),
                   "Unable to modify PDF file, make sure that output file "
                   "target is available and that it is not protected");
}

napi_value Recrypt(const CallbackArgs &args) {
  if (args.Length() < 2 || args.Length() > 3)
    return ThrowError(args.Env(),
                      "Wrong number of arguments, Provide one argument stating "
                      "the location of the source file, a second one for the "
                      "destination file, and an optional options object");
  if (!IsType(args.Env(), args[0], napi_string) &&
      !IsObject(args.Env(), args[0]))
    return ThrowError(args.Env(),
                      "Wrong arguments, please provide a path to a file as the "
                      "first argument or a stream object");
  if (!IsType(args.Env(), args[1], napi_string) &&
      !IsObject(args.Env(), args[1]))
    return ThrowError(args.Env(),
                      "Wrong arguments, please provide a path to a file as the "
                      "second argument or a stream object");
  if (IsObject(args.Env(), args[0]) != IsObject(args.Env(), args[1]))
    return ThrowError(args.Env(),
                      "Wrong arguments, please either provide two paths or two "
                      "stream objects for the first two arguments");
  EPDFVersion version = ePDFVersionUndefined;
  PDFCreationSettings creation(true, true);
  LogConfiguration log = LogConfiguration::DefaultLogConfiguration();
  std::string password;
  if (args.Length() == 3) {
    if (!ReadCreationOptions(args.Env(), args[2], version, log, creation, true))
      return nullptr;
    if (Has(args.Env(), args[2], "password") &&
        IsType(args.Env(), Get(args.Env(), args[2], "password"), napi_string))
      password =
          LegacyString(args.Env(), Get(args.Env(), args[2], "password"));
  }
  if (HasPendingException(args.Env()))
    return nullptr;
  EStatusCode status;
  if (IsObject(args.Env(), args[0])) {
    ObjectByteReaderWithPosition r(args.Env(), args[0]);
    ObjectByteWriterWithPosition w(args.Env(), args[1]);
    status = PDFWriter::RecryptPDF(&r, password, &w, log, creation, version);
  } else
    status = PDFWriter::RecryptPDF(
        LegacyString(args.Env(), args[0]), password,
        LegacyString(args.Env(), args[1]), log, creation, version);
  return status == eSuccess
             ? Undefined(args.Env())
             : ThrowError(args.Env(),
                          "Unable to recrypt files, check that input and "
                          "output files are clear and arguments are coool");
}

napi_value CreateReader(const CallbackArgs &args) {
  if (args.Length() < 1 || args.Length() > 2 ||
      (!IsType(args.Env(), args[0], napi_string) &&
       !IsObject(args.Env(), args[0])) ||
      (args.Length() >= 2 && !IsObject(args.Env(), args[1]))) {
    return ThrowError(
        args.Env(), "Wrong arguments, provide 1 string - path to file read, or "
                    "a read stream object, and optionally an options object");
  }
  ModuleState *state = ModuleState::Get(args.Env());
  napi_value instance = state->Constructors().GetNewPDFReader();
  PDFReaderDriver *driver = nullptr;
  if (!ObjectWrap::UnwrapNew(args.Env(), instance, &driver))
    return nullptr;
  PDFParsingOptions options;
  if (args.Length() >= 2 && Has(args.Env(), args[1], "password")) {
    napi_value password = Get(args.Env(), args[1], "password");
    if (IsType(args.Env(), password, napi_string))
      options.Password = LegacyString(args.Env(), password);
  }
  if (HasPendingException(args.Env()))
    return nullptr;
  PDFHummus::EStatusCode status =
      IsType(args.Env(), args[0], napi_string)
          ? driver->StartPDFParsing(LegacyString(args.Env(), args[0]), options)
          : driver->StartPDFParsing(args.Env(), args[0], options);
  return status == PDFHummus::eSuccess
             ? instance
             : ThrowError(args.Env(), "Unable to start parsing PDF file");
}

napi_value GetTypeLabel(const CallbackArgs &args) {
  if (args.Length() != 1 || !IsType(args.Env(), args[0], napi_number)) {
    return ThrowError(args.Env(), "Wrong arguments, provide a single "
                                  "enumerator value of a PDF Object type");
  }
  uint32_t value = ToUint32(args.Env(), args[0]);
  if (value > PDFObject::ePDFObjectSymbol) {
    return ThrowError(args.Env(), "Wrong arguments, provide a single "
                                  "enumerator value of a PDF Object type");
  }
  return String(args.Env(), PDFObject::scPDFObjectTypeLabel(
                                static_cast<PDFObject::EPDFObjectType>(value)));
}

bool ExportFunction(ModuleState &state, napi_value exports, const char *name,
                    Callback callback) {
  napi_value function = nullptr;
  return Check(state.Env(),
               napi_create_function(
                   state.Env(), name, NAPI_AUTO_LENGTH, Dispatch,
                   state.AddCallback(callback, nullptr), &function)) &&
         Set(state.Env(), exports, name, function);
}

bool Initialize(ModuleState &state, napi_value exports) {
  if (!PDFWriterDriver::Init(state, exports) ||
      !PDFTextStringDriver::Init(state, exports) ||
      !PDFDateDriver::Init(state, exports) ||
      !PDFIndirectObjectReferenceDriver::Init(state, exports) ||
      !PDFBooleanDriver::Init(state, exports) ||
      !PDFLiteralStringDriver::Init(state, exports) ||
      !PDFHexStringDriver::Init(state, exports) ||
      !PDFNullDriver::Init(state, exports) ||
      !PDFNameDriver::Init(state, exports) ||
      !PDFIntegerDriver::Init(state, exports) ||
      !PDFRealDriver::Init(state, exports) ||
      !PDFSymbolDriver::Init(state, exports) ||
      !PDFArrayDriver::Init(state, exports) ||
      !PDFDictionaryDriver::Init(state, exports) ||
      !PDFStreamInputDriver::Init(state, exports) ||
      !PDFObjectParserDriver::Init(state, exports) ||
      !PDFPageInputDriver::Init(state, exports) ||
      !ByteReaderDriver::Init(state, exports) ||
      !ByteReaderWithPositionDriver::Init(state, exports) ||
      !ByteWriterDriver::Init(state, exports) ||
      !ByteWriterWithPositionDriver::Init(state, exports) ||
      !PDFStreamDriver::Init(state, exports) ||
      !PDFReaderDriver::Init(state, exports) ||
      !InputFileDriver::Init(state, exports) ||
      !OutputFileDriver::Init(state, exports) ||
      !InfoDictionaryDriver::Init(state, exports) ||
      !DictionaryContextDriver::Init(state, exports) ||
      !ObjectsContextDriver::Init(state, exports) ||
      !DocumentCopyingContextDriver::Init(state, exports) ||
      !DocumentContextDriver::Init(state, exports) ||
      !ImageXObjectDriver::Init(state, exports) ||
      !UsedFontDriver::Init(state, exports) ||
      !ResourcesDictionaryDriver::Init(state, exports) ||
      !FormXObjectDriver::Init(state, exports) ||
      !XObjectContentContextDriver::Init(state, exports) ||
      !PageContentContextDriver::Init(state, exports) ||
      !PDFPageDriver::Init(state, exports) ||
      !PDFPageModifierDriver::Init(state, exports)) {
    return false;
  }

  if (!ExportFunction(state, exports, "createWriter", CreateWriter) ||
      !ExportFunction(state, exports, "createWriterToContinue",
                      CreateWriterToContinue) ||
      !ExportFunction(state, exports, "createWriterToModify",
                      CreateWriterToModify) ||
      !ExportFunction(state, exports, "createReader", CreateReader) ||
      !ExportFunction(state, exports, "recrypt", Recrypt) ||
      !ExportFunction(state, exports, "getTypeLabel", GetTypeLabel)) {
    return false;
  }

  auto number = [&](const char *name, double value) {
    return Set(state.Env(), exports, name, Number(state.Env(), value));
  };
  auto string = [&](const char *name, const std::string &value) {
    return Set(state.Env(), exports, name, String(state.Env(), value));
  };

  return number("ePDFVersion10", ePDFVersion10) &&
         number("ePDFVersion11", ePDFVersion11) &&
         number("ePDFVersion12", ePDFVersion12) &&
         number("ePDFVersion13", ePDFVersion13) &&
         number("ePDFVersion14", ePDFVersion14) &&
         number("ePDFVersion15", ePDFVersion15) &&
         number("ePDFVersion16", ePDFVersion16) &&
         number("ePDFVersion17", ePDFVersion17) &&
         number("ePDFVersion20", ePDFVersion20) &&
         number("ePDFVersionUndefined", ePDFVersionUndefined) &&
         string("KProcsetImageB", KProcsetImageB) &&
         string("KProcsetImageC", KProcsetImageC) &&
         string("KProcsetImageI", KProcsetImageI) &&
         string("kProcsetPDF", KProcsetPDF) &&
         string("kProcsetText", KProcsetText) &&
         number("eRangeTypeAll", PDFPageRange::eRangeTypeAll) &&
         number("eRangeTypeSpecific", PDFPageRange::eRangeTypeSpecific) &&
         number("ePDFPageBoxMediaBox", ePDFPageBoxMediaBox) &&
         number("ePDFPageBoxCropBox", ePDFPageBoxCropBox) &&
         number("ePDFPageBoxBleedBox", ePDFPageBoxBleedBox) &&
         number("ePDFPageBoxTrimBox", ePDFPageBoxTrimBox) &&
         number("ePDFPageBoxArtBox", ePDFPageBoxArtBox) &&
         number("ePDFObjectBoolean", PDFObject::ePDFObjectBoolean) &&
         number("ePDFObjectLiteralString",
                PDFObject::ePDFObjectLiteralString) &&
         number("ePDFObjectHexString", PDFObject::ePDFObjectHexString) &&
         number("ePDFObjectNull", PDFObject::ePDFObjectNull) &&
         number("ePDFObjectName", PDFObject::ePDFObjectName) &&
         number("ePDFObjectInteger", PDFObject::ePDFObjectInteger) &&
         number("ePDFObjectReal", PDFObject::ePDFObjectReal) &&
         number("ePDFObjectArray", PDFObject::ePDFObjectArray) &&
         number("ePDFObjectDictionary", PDFObject::ePDFObjectDictionary) &&
         number("ePDFObjectIndirectObjectReference",
                PDFObject::ePDFObjectIndirectObjectReference) &&
         number("ePDFObjectStream", PDFObject::ePDFObjectStream) &&
         number("ePDFObjectSymbol", PDFObject::ePDFObjectSymbol) &&
         number("ePDFPageContentItemText", ePDFPageContentItemText) &&
         number("ePDFPageContentItemPath", ePDFPageContentItemPath) &&
         number("ePDFPageContentItemXObject", ePDFPageContentItemXObject) &&
         number("ePDFPageContentItemShading", ePDFPageContentItemShading) &&
         number("eTokenSeparatorSpace", eTokenSeparatorSpace) &&
         number("eTokenSeparatorEndLine", eTokenSeparatorEndLine) &&
         number("eTokenSeparatorNone", eTokenSeparatorNone) &&
         number("eXrefEntryExisting", eXrefEntryExisting) &&
         number("eXrefEntryDelete", eXrefEntryDelete) &&
         number("eXrefEntryStreamObject", eXrefEntryStreamObject) &&
         number("eXrefEntryUndefined", eXrefEntryUndefined) &&
         number("EInfoTrappedTrue", EInfoTrappedTrue) &&
         number("EInfoTrappedFalse", EInfoTrappedFalse) &&
         number("EInfoTrappedUnknown", EInfoTrappedUnknown);
}

napi_value Init(napi_env env, napi_value exports) {
  return InitializeModule(env, exports, Initialize);
}

} // namespace

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
