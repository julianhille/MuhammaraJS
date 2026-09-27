#include "ObjectsContext.h"
#include "OutputStringBufferStream.h"

#include <iostream>

int main() {
  OutputStringBufferStream output;
  ObjectsContext objects;
  objects.SetOutputStream(&output);
  objects.StartDictionary();
  objects.StartDictionary();
  objects.Cleanup();

  // Open dictionaries are released without writing: when a writer ends or
  // aborts, its output stream may already be closed.
  if (output.ToString() != "<<\r\n<<\r\n") {
    std::cerr << "ObjectsContext::Cleanup wrote to the output stream\n";
    return 1;
  }

  objects.Cleanup();
  if (output.ToString() != "<<\r\n<<\r\n") {
    std::cerr << "ObjectsContext::Cleanup was not idempotent\n";
    return 1;
  }

  return 0;
}
