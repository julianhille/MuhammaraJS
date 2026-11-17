#pragma once

// Info dictionary entries, shared by the native addon and the Wasm glue.
//
// CopyModifiedFileInfo(): PDFWriter starts the incremental update of a
// modified PDF with an empty Info dictionary that only gets a new ModDate, and
// readers follow the newest trailer, so the modified PDF lost the Title,
// Author and other Info entries of its source. This copies them into the
// writer's Info dictionary when the update starts, where later changes replace
// them. The Info dictionary holds text strings, a CreationDate and the Trapped
// state: text keeps its bytes, CreationDate is parsed as a PDF date, and
// entries of other types, a /Trapped that is not a name, and /Trapped /Unknown
// (the default), are left out.
//
// AddCustomInfoEntry(): how every writer adds a custom entry. PDFWriter writes
// the fields first and the custom entries after them, so a custom entry under
// the key of a field repeated that key; the repeated key was refused but its
// value still written, which left the Info dictionary unreadable.

#include <string>

#include "InfoDictionary.h"
#include "PDFDictionary.h"
#include "PDFHexString.h"
#include "PDFLiteralString.h"
#include "PDFName.h"
#include "PDFObjectCast.h"
#include "PDFParser.h"
#include "PDFWriter.h"
#include "RefCountPtr.h"

// The text field the Info dictionary writes under an Info key, if any.
inline PDFTextString *InfoTextField(InfoDictionary &inInfo,
                                    const std::string &inKey) {
  if (inKey == "Title")
    return &inInfo.Title;
  if (inKey == "Author")
    return &inInfo.Author;
  if (inKey == "Subject")
    return &inInfo.Subject;
  if (inKey == "Keywords")
    return &inInfo.Keywords;
  if (inKey == "Creator")
    return &inInfo.Creator;
  if (inKey == "Producer")
    return &inInfo.Producer;
  return nullptr;
}

// Adds a custom entry. One under a key the Info dictionary writes itself, such
// as Title or CreationDate, takes the place of that entry.
inline void AddCustomInfoEntry(InfoDictionary &inInfo, const std::string &inKey,
                               const PDFTextString &inValue) {
  if (PDFTextString *field = InfoTextField(inInfo, inKey))
    *field = PDFTextString();
  else if (inKey == "CreationDate")
    inInfo.CreationDate = PDFDate();
  else if (inKey == "ModDate")
    inInfo.ModDate = PDFDate();
  else if (inKey == "Trapped")
    inInfo.Trapped = EInfoTrappedUnknown;
  inInfo.AddAdditionalInfoEntry(inKey, inValue);
}

inline void CopyModifiedFileInfo(PDFWriter &inWriter) {
  PDFParser &parser = inWriter.GetModifiedFileParser();
  // only when the source can be read
  if (parser.IsEncrypted() && !parser.IsEncryptionSupported())
    return;
  PDFObjectCastPtr<PDFDictionary> source(
      parser.QueryDictionaryObject(parser.GetTrailer(), "Info"));
  if (!source)
    return;
  InfoDictionary &info =
      inWriter.GetDocumentContext().GetTrailerInformation().GetInfo();
  MapIterator<PDFNameToPDFObjectMap> it = source->GetIterator();
  while (it.MoveNext()) {
    std::string key = it.GetKey()->GetValue();
    RefCountPtr<PDFObject> value(
        parser.QueryDictionaryObject(source.GetPtr(), key));
    if (!value)
      continue;
    if (key == "Trapped") {
      std::string trapped = value->GetType() == PDFObject::ePDFObjectName
                                ? ((PDFName *)value.GetPtr())->GetValue()
                                : "";
      if (trapped == "True")
        info.Trapped = EInfoTrappedTrue;
      else if (trapped == "False")
        info.Trapped = EInfoTrappedFalse;
      continue;
    }
    std::string text;
    if (value->GetType() == PDFObject::ePDFObjectLiteralString)
      text = ((PDFLiteralString *)value.GetPtr())->GetValue();
    else if (value->GetType() == PDFObject::ePDFObjectHexString)
      text = ((PDFHexString *)value.GetPtr())->GetValue();
    else
      continue;
    if (PDFTextString *field = InfoTextField(info, key))
      *field = PDFTextString(text);
    else if (key == "CreationDate")
      info.CreationDate.ParseString(text);
    // the writer has set the date of this update
    else if (key != "ModDate")
      info.AddAdditionalInfoEntry(key, PDFTextString(text));
  }
}
