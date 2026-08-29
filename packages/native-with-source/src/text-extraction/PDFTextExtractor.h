#pragma once

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

class PDFTextExtractor
{
public:
  bool Extract(
    PDFParser* inParser,
    PDFDictionary* inPage,
    std::vector<PDFTextElement>& outElements
  );
  bool ExtractPageContentItems(
    PDFParser* inParser,
    PDFDictionary* inPage,
    std::vector<PDFPageContentItem>& outItems
  );
};
