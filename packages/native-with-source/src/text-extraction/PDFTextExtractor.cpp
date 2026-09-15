#include "PDFTextExtractor.h"

#include "IByteReader.h"
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
double GetNumber(PDFObject* inObject)
{
  if (inObject->GetType() == PDFObject::ePDFObjectInteger)
    return static_cast<double>(static_cast<PDFInteger*>(inObject)->GetValue());
  if (inObject->GetType() == PDFObject::ePDFObjectReal)
    return static_cast<PDFReal*>(inObject)->GetValue();
  return 0;
}

bool IsNumber(PDFObject* inObject)
{
  return inObject &&
         (inObject->GetType() == PDFObject::ePDFObjectInteger ||
          inObject->GetType() == PDFObject::ePDFObjectReal);
}

bool AreNumbers(const std::vector<RefCountPtr<PDFObject> >& inOperands, size_t inCount)
{
  if (inOperands.size() != inCount)
    return false;
  for (size_t i = 0; i < inCount; ++i)
  {
    if (!IsNumber(inOperands[i].GetPtr()))
      return false;
  }
  return true;
}

bool IsTextString(PDFObject* inObject)
{
  return inObject &&
         (inObject->GetType() == PDFObject::ePDFObjectLiteralString ||
          inObject->GetType() == PDFObject::ePDFObjectHexString);
}

bool IsValidQuote(const std::vector<RefCountPtr<PDFObject> >& inOperands)
{
  return inOperands.size() == 1 && IsTextString(inOperands[0].GetPtr());
}

bool IsValidDoubleQuote(const std::vector<RefCountPtr<PDFObject> >& inOperands)
{
  return inOperands.size() == 3 &&
         IsNumber(inOperands[0].GetPtr()) && IsNumber(inOperands[1].GetPtr()) &&
         IsTextString(inOperands[2].GetPtr());
}

bool IsVisibleTextRenderingMode(int inRenderingMode)
{
  return inRenderingMode != 3 && inRenderingMode != 7;
}

bool IsInlineImageWhitespace(IOBasicTypes::Byte inByte)
{
  return inByte == 0x00 || inByte == 0x09 || inByte == 0x0A ||
         inByte == 0x0C || inByte == 0x0D || inByte == 0x20;
}

// Consumes an inline image's binary payload, which the tokenizer cannot read:
// the bytes are arbitrary and lex as operators, inventing page marks and
// burning the parsed-object budget. Reads raw bytes up to the EI delimiter
// instead. EI must be surrounded by whitespace, the same heuristic every PDF
// consumer uses, since nothing records the payload length.
void SkipInlineImageData(PDFObjectParser* inObjectParser)
{
  IByteReader* stream = inObjectParser->StartExternalRead();
  if (stream != NULL)
  {
    // The byte before the payload was the whitespace that follows ID, so an
    // empty image still matches on its very first EI.
    IOBasicTypes::Byte window[3] = {0x20, 0x20, 0x20};
    IOBasicTypes::Byte current = 0;
    while (stream->NotEnded())
    {
      if (stream->Read(&current, 1) != 1)
        break;
      if (IsInlineImageWhitespace(window[0]) && window[1] == 'E' &&
          window[2] == 'I' && IsInlineImageWhitespace(current))
        break;
      window[0] = window[1];
      window[1] = window[2];
      window[2] = current;
    }
  }
  inObjectParser->EndExternalRead();
}

bool IsPathPaintingOperation(const std::string& inOperation)
{
  return inOperation == "S" || inOperation == "s" || inOperation == "f" ||
         inOperation == "F" || inOperation == "f*" || inOperation == "B" ||
         inOperation == "B*" || inOperation == "b" || inOperation == "b*";
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

bool HasText(const std::vector<RefCountPtr<PDFObject> >& inOperands, const std::string& inOperation)
{
  if (inOperation == "TJ" && inOperands.size() == 1 && inOperands[0].GetPtr()->GetType() == PDFObject::ePDFObjectArray)
    return !GetTextArray(static_cast<PDFArray*>(inOperands[0].GetPtr())).empty();
  return !inOperands.empty() && IsTextString(inOperands.back().GetPtr()) &&
         !GetTextString(inOperands.back().GetPtr()).empty();
}

void SetMatrix(double outMatrix[6], const std::vector<RefCountPtr<PDFObject> >& inOperands)
{
  if (inOperands.size() != 6)
    return;
  for (size_t i = 0; i < 6; ++i)
    outMatrix[i] = GetNumber(inOperands[i].GetPtr());
}

void SetIdentityMatrix(double outMatrix[6])
{
  const double identity[] = {1, 0, 0, 1, 0, 0};
  for (size_t i = 0; i < 6; ++i)
    outMatrix[i] = identity[i];
}

void CopyMatrix(double outMatrix[6], const double inMatrix[6])
{
  for (size_t i = 0; i < 6; ++i)
    outMatrix[i] = inMatrix[i];
}

void MultiplyMatrices(double outMatrix[6], const double inLeft[6], const double inRight[6])
{
  double result[] = {
    inLeft[0] * inRight[0] + inLeft[1] * inRight[2],
    inLeft[0] * inRight[1] + inLeft[1] * inRight[3],
    inLeft[2] * inRight[0] + inLeft[3] * inRight[2],
    inLeft[2] * inRight[1] + inLeft[3] * inRight[3],
    inLeft[4] * inRight[0] + inLeft[5] * inRight[2] + inRight[4],
    inLeft[4] * inRight[1] + inLeft[5] * inRight[3] + inRight[5]
  };
  CopyMatrix(outMatrix, result);
}

void MoveTextLine(double outTextMatrix[6], double ioTextLineMatrix[6], double inX, double inY)
{
  ioTextLineMatrix[4] += inX * ioTextLineMatrix[0] + inY * ioTextLineMatrix[2];
  ioTextLineMatrix[5] += inX * ioTextLineMatrix[1] + inY * ioTextLineMatrix[3];
  CopyMatrix(outTextMatrix, ioTextLineMatrix);
}

struct ExtractedTextState
{
  std::string fontResource;
  double fontSize;
  double leading;
  double ctm[6];
};
}

namespace
{
size_t ClampLimit(size_t inRequested, size_t inCeiling)
{
  if (inRequested == 0 || inRequested > inCeiling)
    return inCeiling;
  return inRequested;
}
}

void PDFExtractionLimits::Clamp()
{
  maxElements = ClampLimit(maxElements, kMaxExtractedElements);
  maxOperands = ClampLimit(maxOperands, kMaxOperands);
  maxTextBytes = ClampLimit(maxTextBytes, kMaxExtractedTextBytes);
  maxParsedObjects = ClampLimit(maxParsedObjects, kMaxParsedObjects);
}

bool PDFTextExtractor::Extract(
  PDFParser* inParser,
  PDFDictionary* inPage,
  std::vector<PDFTextElement>& outElements,
  const PDFExtractionLimits& inLimits
)
{
  PDFExtractionLimits limits(inLimits);
  limits.Clamp();

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
  double textLineMatrix[] = {1, 0, 0, 1, 0, 0};
  double ctm[] = {1, 0, 0, 1, 0, 0};
  double textLeading = 0;
  std::vector<ExtractedTextState> textStateStack;
  std::vector<RefCountPtr<PDFObject> > operands;
  PDFObject* object = NULL;
  size_t extractedTextBytes = 0;
  size_t parsedObjects = 0;
  bool withinLimits = true;

  while (withinLimits && (object = objectParser->ParseNewObject()) != NULL)
  {
    RefCountPtr<PDFObject> objectHolder(object);
    if (++parsedObjects > limits.maxParsedObjects)
    {
      withinLimits = false;
      break;
    }
    if (object->GetType() != PDFObject::ePDFObjectSymbol)
    {
      if (operands.size() == limits.maxOperands)
      {
        withinLimits = false;
        break;
      }
      operands.push_back(objectHolder);
      continue;
    }

    std::string operation = static_cast<PDFSymbol*>(object)->GetValue();
    if (operation == "q" && operands.empty())
    {
      ExtractedTextState state;
      state.fontResource = fontResource;
      state.fontSize = fontSize;
      state.leading = textLeading;
      CopyMatrix(state.ctm, ctm);
      textStateStack.push_back(state);
    }
    else if (operation == "Q" && operands.empty() && !textStateStack.empty())
    {
      fontResource = textStateStack.back().fontResource;
      fontSize = textStateStack.back().fontSize;
      textLeading = textStateStack.back().leading;
      CopyMatrix(ctm, textStateStack.back().ctm);
      textStateStack.pop_back();
    }
    else if (operation == "cm" && AreNumbers(operands, 6))
    {
      double matrix[6];
      SetMatrix(matrix, operands);
      MultiplyMatrices(ctm, matrix, ctm);
    }
    else if (operation == "BT" && operands.empty() && !inTextObject)
    {
      inTextObject = true;
      SetIdentityMatrix(textMatrix);
      SetIdentityMatrix(textLineMatrix);
    }
    else if (operation == "ET" && operands.empty() && inTextObject)
      inTextObject = false;
    else if (operation == "Tf" && operands.size() == 2)
    {
      if (operands[0]->GetType() == PDFObject::ePDFObjectName)
        fontResource = static_cast<PDFName*>(operands[0].GetPtr())->GetValue();
      fontSize = GetNumber(operands[1].GetPtr());
    }
    else if (inTextObject && operation == "Tm" && AreNumbers(operands, 6))
    {
      SetMatrix(textMatrix, operands);
      CopyMatrix(textLineMatrix, textMatrix);
    }
    else if (inTextObject && (operation == "Td" || operation == "TD") && AreNumbers(operands, 2))
    {
      double x = GetNumber(operands[0].GetPtr());
      double y = GetNumber(operands[1].GetPtr());
      if (operation == "TD")
        textLeading = -y;
      MoveTextLine(textMatrix, textLineMatrix, x, y);
    }
    else if (inTextObject && operation == "TL" && AreNumbers(operands, 1))
      textLeading = GetNumber(operands[0].GetPtr());
    else if (inTextObject && operation == "T*" && operands.empty())
      MoveTextLine(textMatrix, textLineMatrix, 0, -textLeading);
    else if (operation == "ID")
    {
      SkipInlineImageData(objectParser);
      operands.clear();
      continue;
    }
    else if (inTextObject &&
             (operation == "Tj" || operation == "TJ" ||
              (operation == "'" && IsValidQuote(operands)) ||
              (operation == "\"" && IsValidDoubleQuote(operands))))
    {
      if (operation == "'" || operation == "\"")
        MoveTextLine(textMatrix, textLineMatrix, 0, -textLeading);

      std::string content;
      if (operation == "TJ" && operands.size() == 1 && operands[0]->GetType() == PDFObject::ePDFObjectArray)
        content = GetTextArray(static_cast<PDFArray*>(operands[0].GetPtr()));
      else if (!operands.empty() && IsTextString(operands.back().GetPtr()))
        content = GetTextString(operands.back().GetPtr());

      if (!content.empty())
      {
        if (outElements.size() == limits.maxElements ||
            content.size() > limits.maxTextBytes - extractedTextBytes)
        {
          withinLimits = false;
          break;
        }
        PDFTextElement element;
        element.content = content;
        element.fontResource = fontResource;
        element.fontSize = fontSize;
        MultiplyMatrices(element.textMatrix, textMatrix, ctm);
        outElements.push_back(element);
        extractedTextBytes += content.size();
      }
    }
    operands.clear();
  }

  delete objectParser;
  return withinLimits;
}

bool PDFTextExtractor::ExtractPageContentItems(
  PDFParser* inParser,
  PDFDictionary* inPage,
  std::vector<PDFPageContentItem>& outItems,
  const PDFExtractionLimits& inLimits
)
{
  PDFExtractionLimits limits(inLimits);
  limits.Clamp();

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
  int textRenderingMode = 0;
  std::vector<int> textRenderingModes;
  std::vector<RefCountPtr<PDFObject> > operands;
  PDFObject* object = NULL;
  size_t parsedObjects = 0;
  bool withinLimits = true;

  while (withinLimits && (object = objectParser->ParseNewObject()) != NULL)
  {
    RefCountPtr<PDFObject> objectHolder(object);
    if (++parsedObjects > limits.maxParsedObjects)
    {
      withinLimits = false;
      break;
    }
    if (object->GetType() != PDFObject::ePDFObjectSymbol)
    {
      if (operands.size() == limits.maxOperands)
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
    else if (operation == "Tr" && operands.size() == 1)
      textRenderingMode = static_cast<int>(GetNumber(operands[0].GetPtr()));
    else if (operation == "q")
      textRenderingModes.push_back(textRenderingMode);
    else if (operation == "Q" && !textRenderingModes.empty())
    {
      textRenderingMode = textRenderingModes.back();
      textRenderingModes.pop_back();
    }
    else if (operation == "ID")
    {
      SkipInlineImageData(objectParser);
      operands.clear();
      continue;
    }

    EPDFPageContentItemType type = ePDFPageContentItemText;
    bool hasItem = false;
    if (operation == "BI")
    {
      // An inline image paints the page exactly as "Do" does; the operation
      // name tells the two apart.
      type = ePDFPageContentItemXObject;
      hasItem = true;
    }
    else if (inTextObject && IsVisibleTextRenderingMode(textRenderingMode) &&
        (operation == "Tj" || operation == "'" || operation == "\"" || operation == "TJ") &&
        HasText(operands, operation))
    {
      type = ePDFPageContentItemText;
      hasItem = true;
    }
    else if (IsPathPaintingOperation(operation))
    {
      type = ePDFPageContentItemPath;
      hasItem = true;
    }
    else if (operation == "Do" && operands.size() == 1 &&
             operands[0].GetPtr()->GetType() == PDFObject::ePDFObjectName)
    {
      type = ePDFPageContentItemXObject;
      hasItem = true;
    }
    else if (operation == "sh" && operands.size() == 1 &&
             operands[0].GetPtr()->GetType() == PDFObject::ePDFObjectName)
    {
      type = ePDFPageContentItemShading;
      hasItem = true;
    }

    if (hasItem)
    {
      if (outItems.size() == limits.maxElements)
      {
        withinLimits = false;
        break;
      }
      PDFPageContentItem item;
      item.type = type;
      item.operation = operation;
      outItems.push_back(item);
    }
    operands.clear();
  }

  delete objectParser;
  return withinLimits;
}
