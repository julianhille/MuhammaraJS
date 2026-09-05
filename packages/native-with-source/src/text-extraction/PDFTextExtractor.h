#pragma once

#include <cstddef>
#include <string>
#include <vector>

class PDFParser;
class PDFDictionary;

struct PDFTextElement
{
  std::string content;
  std::string fontResource;
  double fontSize;
  double textMatrix[6];
};

enum EPDFPageContentItemType
{
  ePDFPageContentItemText,
  ePDFPageContentItemPath,
  ePDFPageContentItemXObject,
  ePDFPageContentItemShading
};

struct PDFPageContentItem
{
  EPDFPageContentItemType type;
  std::string operation;
};

// Hard ceilings for content-stream extraction. Callers may request lower
// values, but never higher ones: these bound the memory a hostile page can
// make the extractors allocate, so they are clamps rather than defaults.
const size_t kMaxExtractedElements = 100000;
const size_t kMaxOperands = 1024;
const size_t kMaxExtractedTextBytes = 16 * 1024 * 1024;
const size_t kMaxParsedObjects = 1000000;

// Per-call extraction budget. A default-constructed instance uses the ceilings
// above. Clamp() folds a caller's request into them.
struct PDFExtractionLimits
{
  PDFExtractionLimits()
    : maxElements(kMaxExtractedElements),
      maxOperands(kMaxOperands),
      maxTextBytes(kMaxExtractedTextBytes),
      maxParsedObjects(kMaxParsedObjects)
  {
  }

  // Lowers every field to the built-in ceiling. Zero means "unspecified" and
  // leaves the ceiling in place.
  void Clamp();

  size_t maxElements;
  size_t maxOperands;
  size_t maxTextBytes;
  size_t maxParsedObjects;
};

class PDFTextExtractor
{
public:
  bool Extract(
    PDFParser* inParser,
    PDFDictionary* inPage,
    std::vector<PDFTextElement>& outElements,
    const PDFExtractionLimits& inLimits = PDFExtractionLimits()
  );
  // inLimits.maxTextBytes is not used here: content items carry an operator
  // name rather than accumulated text.
  bool ExtractPageContentItems(
    PDFParser* inParser,
    PDFDictionary* inPage,
    std::vector<PDFPageContentItem>& outItems,
    const PDFExtractionLimits& inLimits = PDFExtractionLimits()
  );
};
