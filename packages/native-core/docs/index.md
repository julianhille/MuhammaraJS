# MuhammaraJS Native Node.js

`@muhammara/native` is the small prebuilt-only native Node.js package for
creating, reading, and modifying PDF files and streams.
`@muhammara/native-with-source` exposes the same API and includes the C++ source
tree for local Node.js and Electron builds. The unscoped `muhammara` package is
deprecated and receives no further releases.

## Choose An API

- [High-Level Recipe](recipe/index.md) provides an approachable, chainable API
  for common PDF creation and editing tasks.
- [Low-Level API](low-level/index.md) exposes PDF writers, readers, content
  contexts, streams, forms, and PDF drawing operators.
- [API Reference](api/index.md) provides curated reference material verified
  against the current implementation and tests.

## Guide Organization

The [High-Level Recipe](recipe/index.md) section explains the `Recipe` API by
capability: creating pages, drawing text and shapes, composing documents, and
working with metadata. Use it when you are learning or choosing Recipe methods.

[How-To Guides](how-to/index.md) are organized by the result you want to
achieve, such as watermarking a document, creating a table, or adding a link.
They may use Recipe, the low-level API, or both, and focus on the complete
workflow rather than a single API surface.

## Security And Dependencies

Native dependencies are vendored with MuhammaraJS. See [Security and Vendored
Dependencies](../security.md) for their current upstream baselines, source links,
and dependency update guidance.
