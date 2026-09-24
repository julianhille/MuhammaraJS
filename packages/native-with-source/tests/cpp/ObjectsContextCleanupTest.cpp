#include "ObjectsContext.h"
#include "OutputStringBufferStream.h"

#include <iostream>

int main() {
  OutputStringBufferStream output;
  ObjectsContext objects;
  objects.SetOutputStream(&output);
  objects.StartDictionary();
  objects.Cleanup();

  if (output.ToString() != "<<\r\n>>\r\n") {
    std::cerr << "ObjectsContext::Cleanup did not close the active dictionary\n";
    return 1;
  }

  objects.Cleanup();
  if (output.ToString() != "<<\r\n>>\r\n") {
    std::cerr << "ObjectsContext::Cleanup was not idempotent\n";
    return 1;
  }

  return 0;
}
