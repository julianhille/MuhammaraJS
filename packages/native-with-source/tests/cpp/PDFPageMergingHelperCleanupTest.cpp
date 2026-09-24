#include "InputStringStream.h"
#include "OutputStringBufferStream.h"
#include "PDFPage.h"
#include "PDFPageMergingHelper.h"
#include "PDFRectangle.h"
#include "PDFWriter.h"

#include <cstdio>
#include <fstream>
#include <iostream>
#include <string>

using namespace PDFHummus;

int main() {
  OutputStringBufferStream sourceOutput;
  PDFWriter sourceWriter;
  if (sourceWriter.StartPDFForStream(&sourceOutput, ePDFVersion14) != eSuccess) {
    std::cerr << "Unable to start source PDF\n";
    return 1;
  }

  PDFPage sourcePage;
  sourcePage.SetMediaBox(PDFRectangle(0, 0, 100, 100));
  if (sourceWriter.WritePage(&sourcePage) != eSuccess ||
      sourceWriter.EndPDFForStream() != eSuccess) {
    std::cerr << "Unable to create source PDF\n";
    return 1;
  }

  const std::string sourceBytes = sourceOutput.ToString();
  const std::string sourcePath = "PDFPageMergingHelperCleanupTest-input.pdf";
  std::ofstream sourceFile(sourcePath, std::ios::binary);
  sourceFile.write(sourceBytes.data(), sourceBytes.size());
  sourceFile.close();
  if (!sourceFile) {
    std::cerr << "Unable to write source PDF\n";
    return 1;
  }

  OutputStringBufferStream targetOutput;
  PDFWriter targetWriter;
  if (targetWriter.StartPDFForStream(&targetOutput, ePDFVersion14) != eSuccess) {
    std::remove(sourcePath.c_str());
    std::cerr << "Unable to start target PDF\n";
    return 1;
  }

  PDFPage targetPage;
  targetPage.SetMediaBox(PDFRectangle(0, 0, 100, 100));
  PDFPageMergingHelper helper(&targetPage);
  for (int index = 0; index < 8; ++index) {
    InputStringStream sourceStream(sourceBytes);
    if (helper.MergePageContent(&targetWriter, &sourceStream, 0) != eSuccess ||
        helper.MergePageContent(&targetWriter, sourcePath, 0) != eSuccess) {
      std::remove(sourcePath.c_str());
      std::cerr << "Unable to merge source PDF\n";
      return 1;
    }
  }

  std::remove(sourcePath.c_str());
  if (targetWriter.WritePage(&targetPage) != eSuccess ||
      targetWriter.EndPDFForStream() != eSuccess) {
    std::cerr << "Unable to finish target PDF\n";
    return 1;
  }

  return 0;
}
