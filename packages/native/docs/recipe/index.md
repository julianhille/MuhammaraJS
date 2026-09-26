# High-Level Recipe

`require("@muhammara/native").Recipe` is the high-level, chainable API for common PDF
creation and modification tasks. This section will provide tested guides for
pages, text, images, annotations, document composition, buffers, and
encryption.

Recipe uses a top-left coordinate origin. Use its named page sizes and chainable
methods when they fit your task; use the [Low-Level API](../low-level/index.md)
when you need direct PDF constructs.

The [generated API reference](reference.md) is built from the Recipe JSDoc.

## Named Option Values

Recipe string options have named values on the `Recipe` class, for example
`Recipe.TextWrap.ELLIPSIS`, `Recipe.AnnotFlag.PRINT`, and `Recipe.PageSize.A4`.
The plain strings stay accepted. Native and Wasm share these sets with the same
names and members: `TextWrap`, `TextAlign`, `HorizontalAlign`, `VerticalAlign`, `TableRowNth`,
`LineCap`, `LineJoin`, `ArrowAt`, `ArrowType`, `TriangleTrait`,
`TrianglePosition`, `PageLayout`, `PageSize`, `FontStyle`, `Permission`,
`Coordinate`, `Colorspace`, `AnnotSubtype`, `AnnotFlag`, `AnnotIcon`, and
`ChromaCommand`. Native also has `Recipe.Source.NEW`, the sentinel for creating a new PDF;
Wasm has no such sentinel and adds `Recipe.StructureFormat` instead.
