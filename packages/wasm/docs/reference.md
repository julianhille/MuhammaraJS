# API Reference

The canonical, complete API reference is the checked-in TypeScript declaration:
[packages/wasm/index.d.ts](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/wasm/index.d.ts).
It is shipped with the package and is the source of truth for exported names,
overloads, literal types, and async byte-source variants.

Use the declaration sections as an index:

- `MuhammaraWasm`: initialization, asset registration, writers, readers,
  modifiers, classes, and constants.
- `PDFWriter`, `PDFModifier`, and `DocumentCopyingContext`: writing, editing,
  copying, forms, images, and object operations.
- `PDFReader` and parsed object interfaces: document, page, xref, stream, and
  parser queries.
- `ContentContext`, `ObjectsContext`, and resource interfaces: drawing
  operators and raw PDF-object writing.
- `Recipe` and `RecipeConstructor`: high-level drawing, layout, composition,
  metadata, and asset registration.

The declaration is intentionally linked rather than copied into a generated
Markdown snapshot: its large overload surface changes with the package and the
source link always identifies the matching package file. Curated usage and
lifecycle guidance is in the adjacent guides.
