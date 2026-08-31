#include "PDFTextExtractor.h"

#include "PDFArray.h"
#include "PDFHexString.h"
#include "PDFInteger.h"
#include "PDFLiteralString.h"
#include "PDFName.h"
#include "PDFObject.h"
#include "PDFObjectParser.h"
#include "PDFParser.h"
#include "PDFReal.h"
#include "PDFStreamInput.h"
#include "PDFSymbol.h"
#include "RefCountPtr.h"

namespace
{
const size_t kMaxExtractedElements = 100000;
const size_t kMaxOperands = 1024;
const size_t kMaxExtractedTextBytes = 16 * 1024 * 1024;
const size_t kMaxParsedObjects = 1000000;

double GetNumber(PDFObject* inObject)
{
  if (inObject->GetType() == PDFObject::ePDFObjectInteger)
    return static_cast<double>(static_cast<PDFInteger*>(inObject)->GetValue());
  if (inObject->GetType() == PDFObject::ePDFObjectReal)
    return static_cast<PDFReal*>(inObject)->GetValue();
  return 0;
}

bool IsTextString(PDFObject* inObject)
{
  return inObject &&
         (inObject->GetType() == PDFObject::ePDFObjectLiteralString ||
          inObject->GetType() == PDFObject::ePDFObjectHexString);
}

std::string GetTextString(PDFObject* inObject)
{
  if (inObject->GetType() == PDFObject::ePDFObjectLiteralString)
    return static_cast<PDFLiteralString*>(inObject)->GetValue();
  return static_cast<PDFHexString*>(inObject)->GetValue();
}

std::string GetTextArray(PDFArray* inArray)
{
  std::string result;
  for (unsigned long i = 0; i < inArray->GetLength(); ++i)
  {
    RefCountPtr<PDFObject> item(inArray->QueryObject(i));
    if (IsTextString(item.GetPtr()))
      result += GetTextString(item.GetPtr());
  }
  return result;
}

void SetMatrix(double outMatrix[6], const std::vector<RefCountPtr<PDFObject> >& inOperands)
{
  if (inOperands.size() != 6)
    return;
  for (size_t i = 0; i < 6; ++i)
    outMatrix[i] = GetNumber(inOperands[i].GetPtr());
}
}

bool PDFTextExtractor::Extract(
  PDFParser* inParser,
  PDFDictionary* inPage,
  std::vector<PDFTextElement>& outElements
)
{
  RefCountPtr<PDFObject> contents(inParser->QueryDictionaryObject(inPage, "Contents"));
  if (!contents)
    return true;

  PDFObjectParser* objectParser = NULL;
  if (contents->GetType() == PDFObject::ePDFObjectStream)
    objectParser = inParser->StartReadingObjectsFromStream(static_cast<PDFStreamInput*>(contents.GetPtr()));
  else if (contents->GetType() == PDFObject::ePDFObjectArray)
    objectParser = inParser->StartReadingObjectsFromStreams(static_cast<PDFArray*>(contents.GetPtr()));
  if (!objectParser)
    return true;

  bool inTextObject = false;
  std::string fontResource;
  double fontSize = 0;
  double textMatrix[] = {1, 0, 0, 1, 0, 0};
  std::vector<RefCountPtr<PDFObject> > operands;
  PDFObject* object = NULL;
  size_t extractedTextBytes = 0;
  size_t parsedObjects = 0;
  bool withinLimits = true;

  while (withinLimits && (object = objectParser->ParseNewObject()) != NULL)
  {
    RefCountPtr<PDFObject> objectHolder(object);
    if (++parsedObjects > kMaxParsedObjects)
    {
      withinLimits = false;
      break;
    }
    if (object->GetType() != PDFObject::ePDFObjectSymbol)
    {
      if (operands.size() == kMaxOperands)
      {
        withinLimits = false;
        break;
      }
      operands.push_back(objectHolder);
      continue;
    }

    std::string operation = static_cast<PDFSymbol*>(object)->GetValue();
    if (operation == "BT")
      inTextObject = true;
    else if (operation == "ET")
      inTextObject = false;
    else if (operation == "Tf" && operands.size() == 2)
    {
      if (operands[0]->GetType() == PDFObject::ePDFObjectName)
        fontResource = static_cast<PDFName*>(operands[0].GetPtr())->GetValue();
      fontSize = GetNumber(operands[1].GetPtr());
    }
    else if (operation == "Tm")
      SetMatrix(textMatrix, operands);
    else if (inTextObject && (operation == "Tj" || operation == "'" || operation == "\"" || operation == "TJ"))
    {
      std::string content;
      if (operation == "TJ" && operands.size() == 1 && operands[0]->GetType() == PDFObject::ePDFObjectArray)
        content = GetTextArray(static_cast<PDFArray*>(operands[0].GetPtr()));
      else if (!operands.empty() && IsTextString(operands.back().GetPtr()))
        content = GetTextString(operands.back().GetPtr());

      if (!content.empty())
      {
        if (outElements.size() == kMaxExtractedElements ||
            content.size() > kMaxExtractedTextBytes - extractedTextBytes)
        {
          withinLimits = false;
          break;
        }
        PDFTextElement element;
        element.content = content;
        element.fontResource = fontResource;
        element.fontSize = fontSize;
        for (size_t i = 0; i < 6; ++i)
          element.textMatrix[i] = textMatrix[i];
        outElements.push_back(element);
        extractedTextBytes += content.size();
      }
    }
    operands.clear();
  }

  delete objectParser;
  return withinLimits;
}
