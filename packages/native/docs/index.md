# MuhammaraJS Native Node.js

The `@muhammara/native` package is the native Node.js library for creating,
reading, and modifying PDF files and streams. It is the maintained successor and
drop-in replacement for HummusJS. The unscoped `muhammara` package remains a
compatibility name during the transition to the `@muhammara` organization.

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
