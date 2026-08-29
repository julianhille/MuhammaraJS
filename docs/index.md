# MuhammaraJS Documentation

MuhammaraJS is a native Node.js library for creating, reading, and modifying
PDF files and streams. It is the maintained successor and drop-in replacement
for HummusJS.

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

## Documentation Versions

`latest` tracks the `develop` branch and can include unreleased behavior. Each
normal release tag has its own documentation version. After a release, its tag
is made the default Read the Docs version while `latest` continues to track
development.

For current release history, read the
[Changelog on GitHub](https://github.com/julianhille/MuhammaraJS/blob/develop/CHANGELOG.md).
