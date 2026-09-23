# Draw Text

Create a page content context with `startPageContentContext`, load a font, and
write text with coordinates measured in PDF points.

```javascript
var context = pdfWriter.startPageContentContext(page);
var font = pdfWriter.getFontForFile("./fonts/arial.ttf");

context.writeText("Hello, world", 72, 720, {
  font: font,
  size: 14,
  colorspace: "gray",
  color: 0x00,
});
```

`size`, not `fontSize`, controls the font size. Supported color spaces are
`rgb`, `cmyk`, and `gray`. Use `q()` and `Q()` to scope graphics-state changes,
such as `setOpacity(0.5)`.

Use `font.calculateTextDimensions(text, size)` when positioning needs the text
bounds.

`writeText` reads and converts text, coordinates, font size, color, and underline
options before emitting `BT` or changing graphics state. If a getter or
conversion throws, the original exception is propagated and the call emits no
partial text or underline. Correct the input before retrying. This also applies
to form contexts and writers modifying existing PDFs.
