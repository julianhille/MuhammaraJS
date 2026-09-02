# Requested Workflow Backlog

The following workflows need more implementation or focused verification before
they can be presented as supported browser how-tos:

- Opening, changing, or removing PDF passwords is unavailable because the Wasm
  build excludes encryption support.
- Persistent continuation-state files are unavailable because the public API is
  byte-first and does not expose Emscripten's internal filesystem.
- Deep preservation of an existing page's annotation graph while rebuilding or
  appending that page is not guaranteed.
- Visual Unicode text search and glyph bounding boxes require font-map and text
  layout support beyond raw content-stream extraction.

Use the native package in a trusted server environment when one of these
capabilities is required.
