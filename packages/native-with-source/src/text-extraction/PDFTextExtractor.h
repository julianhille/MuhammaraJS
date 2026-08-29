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

struct PDFPageContentItem
{
  std::string type;
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
