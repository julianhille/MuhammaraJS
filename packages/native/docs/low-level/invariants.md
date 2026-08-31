# Low-Level API Invariants

- Call `end()` exactly once after completing a writer, reader, or copying context.
- Finish page content before `writePage(page)`; a written page is no longer editable
  through that context.
- Pause an active page context before creating image XObjects or attaching URL
  links, then resume it only by using the context again.
- Finish a form XObject with `endFormXObject(form)` before placing it with
  `doXObject`.
- Reader, image, and copying input streams are synchronous and random access;
  they must implement the complete read-stream contract and have all bytes
  available when called.
- PDF coordinates in the low-level API use the PDF bottom-left origin. Page boxes
  are `[left, bottom, right, top]`.
- `PDFPageModifier` page indexes are zero-based, while Recipe page numbers are
  one-based.
- Low-level object streams must be created inside an indirect object and ended
  with `endPDFStream`; do not call `endIndirectObject` afterward.

These constraints are verified by the writer, image, links, stream, form,
modification, and object-writing tests referenced by the low-level guides.
