#pragma once

// PDFWriter::RecryptPDF, which also keeps the source's Info dictionary.
// RecryptPDF deep-copies the catalog only, so a recrypted PDF lost its title,
// author and custom Info entries. This copy uses PDFWriter's public API and
// copies the trailer's /Info as it copies /Root. The Wasm glue includes this
// file too.

#include <string>

#include "InputFile.h"
#include "OutputFile.h"
#include "PDFDictionary.h"
#include "PDFDocumentCopyingContext.h"
#include "PDFIndirectObjectReference.h"
#include "PDFObjectCast.h"
#include "PDFParser.h"
#include "PDFParsingOptions.h"
#include "PDFWriter.h"

inline PDFHummus::EStatusCode RecryptPDFKeepingInfo(
    IByteReaderWithPosition* inOriginalPDFStream,
    const std::string& inOriginalPDFPassword,
    IByteWriterWithPosition* inNewPDFStream,
    const LogConfiguration& inLogConfiguration,
    const PDFCreationSettings& inPDFCreationSettings,
    EPDFVersion inOveridePDFVersion) {
  PDFWriter pdfWriter;
  PDFDocumentCopyingContext* copyingContext = pdfWriter.CreatePDFCopyingContext(
      inOriginalPDFStream, PDFParsingOptions(inOriginalPDFPassword));
  if (!copyingContext) return PDFHummus::eFailure;

  PDFHummus::EStatusCode status = pdfWriter.StartPDFForStream(
      inNewPDFStream,
      ePDFVersionUndefined == inOveridePDFVersion
          ? EPDFVersion(
                (int)(copyingContext->GetSourceDocumentParser()->GetPDFLevel() *
                      10))
          : inOveridePDFVersion,
      inLogConfiguration, inPDFCreationSettings);

  EStatusCodeAndObjectIDType root(PDFHummus::eFailure, 0);
  EStatusCodeAndObjectIDType info(PDFHummus::eFailure, 0);
  if (status == PDFHummus::eSuccess) {
    PDFDictionary* trailer =
        copyingContext->GetSourceDocumentParser()->GetTrailer();
    PDFObjectCastPtr<PDFIndirectObjectReference> rootReference(
        trailer->QueryDirectObject("Root"));
    if (!!rootReference) root = copyingContext->CopyObject(rootReference->mObjectID);
    PDFObjectCastPtr<PDFIndirectObjectReference> infoReference(
        trailer->QueryDirectObject("Info"));
    if (!!infoReference) info = copyingContext->CopyObject(infoReference->mObjectID);
    if (root.first != PDFHummus::eSuccess) status = PDFHummus::eFailure;
  }
  delete copyingContext;
  if (status != PDFHummus::eSuccess) return status;

  pdfWriter.GetDocumentContext().GetTrailerInformation().SetRoot(root.second);
  // The writer keeps this reference while its own Info dictionary is empty,
  // as a recrypting writer's is.
  if (info.first == PDFHummus::eSuccess) {
    pdfWriter.GetDocumentContext().GetTrailerInformation().SetInfoDictionaryReference(
        info.second);
  }
  return pdfWriter.EndPDFForStream();
}

inline PDFHummus::EStatusCode RecryptPDFKeepingInfo(
    const std::string& inOriginalPDFPath,
    const std::string& inOriginalPDFPassword,
    const std::string& inNewPDFPath,
    const LogConfiguration& inLogConfiguration,
    const PDFCreationSettings& inPDFCreationSettings,
    EPDFVersion inOveridePDFVersion) {
  InputFile originalPDF;
  OutputFile newPDF;
  PDFHummus::EStatusCode status = originalPDF.OpenFile(inOriginalPDFPath);
  if (status != PDFHummus::eSuccess) return status;
  status = newPDF.OpenFile(inNewPDFPath);
  if (status != PDFHummus::eSuccess) return status;
  return RecryptPDFKeepingInfo(originalPDF.GetInputStream(), inOriginalPDFPassword,
                               newPDF.GetOutputStream(), inLogConfiguration,
                               inPDFCreationSettings, inOveridePDFVersion);
}
