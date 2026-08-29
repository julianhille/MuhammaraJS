# PDF Drawing Operators

Content contexts expose common PDF drawing operators as chainable methods. Use
them when the text, image, and primitive helpers are insufficient.

```javascript
var context = pdfWriter.startPageContentContext(page);
context.q().cm(2, 0, 0, 2, 0, 0).re(10, 10, 50, 50).S().Q();
```

The example saves the graphics state with `q`, applies a transformation with
`cm`, creates a rectangle with `re`, strokes it with `S`, and restores the
state with `Q`. The API also exposes path, color, clipping, text, and XObject
operators. Refer to the PDF specification for operator semantics and
`tests/SimpleContentPageTest.js` for tested usage.
