# Content Contexts

`startPageContentContext(page)` returns a page content context. Form XObjects
provide their context through `form.getContentContext()`. Contexts offer helper
methods for `writeText`, `drawImage`, `drawRectangle`, `drawSquare`,
`drawCircle`, and `drawPath` plus chainable PDF drawing operators.

Use `q()` and `Q()` to scope graphics state and `cm()` for transformations.
`doXObject()` places form or image XObjects. `pausePageContentContext(context)`
is required before operations that create image objects or attach low-level page
links while a page context is active.

Text options use `size`, `font`, `colorspace`, and `color`; opacity is controlled
with `setOpacity`. Primitive options include fill or stroke type, color, and
line width. Raw operators cover path construction and painting, graphics state,
color, clipping, text, and XObject placement.

See [Draw Text](../low-level/text.md),
[Draw Primitives](../low-level/drawing-primitives.md), and
[PDF Drawing Operators](../low-level/pdf-operators.md) for examples.
