# High-Level Recipe

`require("muhammara").Recipe` is the high-level, chainable API for common PDF
creation and modification tasks. This section will provide tested guides for
pages, text, images, annotations, document composition, buffers, and
encryption.

Recipe uses a top-left coordinate origin. Use its named page sizes and chainable
methods when they fit your task; use the [Low-Level API](../low-level/index.md)
when you need direct PDF constructs.

The [generated API reference](reference.md) is built from the Recipe JSDoc.
