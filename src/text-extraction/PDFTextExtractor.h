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

class PDFTextExtractor
{
public:
  bool Extract(
    PDFParser* inParser,
    PDFDictionary* inPage,
    std::vector<PDFTextElement>& outElements
  );
};
