# Draw in Gray and CMYK

Print workflows often need gray or CMYK colors instead of RGB. Both the
low-level content context and Recipe draw in the `DeviceGray` and `DeviceCMYK`
color spaces; they differ in how the color value selects the space.

## Low Level

Set `colorspace` to a `DeviceColorSpace` value and pass the color as a
number. A gray color is one byte, from `0x00` (black) to `0xff` (white). A CMYK
color packs its four components as `0xCCMMYYKK`, so `0x00ff0000` is full
magenta:

```javascript
import { createMuhammaraWasm, DeviceColorSpace } from "@muhammara/wasm";

var muhammara = await createMuhammaraWasm();
var writer = muhammara.createWriter();
var page = writer.createPage(0, 0, 595, 842);

writer
  .startPageContentContext(page)
  .drawRectangle(72, 700, 100, 50, {
    type: "fill",
    colorspace: DeviceColorSpace.GRAY,
    color: 0x80,
  })
  .drawRectangle(200, 700, 100, 50, {
    type: "fill",
    colorspace: DeviceColorSpace.CMYK,
    color: 0x00ff0000,
  })
  .drawRectangle(328, 700, 100, 50, { type: "fill", color: "teal" });

writer.writePage(page);
var outputBytes = writer.end();
```

A CSS color name such as `"teal"`, a `#rrggbb` string, or an `[r, g, b]` array is
always RGB. Combining one with the gray or CMYK colorspace throws
`TypeError: only a numeric color can use the gray or cmyk colorspace` before
anything is drawn; convert the color to a gray or CMYK number instead.
`writeText()` follows the same rules.

## Recipe

Recipe reads the color space from the color itself. A hex color with two digits
or a one-number array is gray, and one with eight digits or a four-number array
is CMYK:

```javascript
import { createRecipe } from "@muhammara/wasm";

var Recipe = await createRecipe();
var outputBytes = new Recipe()
  .createPage(595, 842)
  .rectangle(72, 72, 100, 50, { fill: "#80" })
  .rectangle(200, 72, 100, 50, { fill: "#00ff0000" })
  .rectangle(328, 72, 100, 50, { fill: [0, 0, 0, 255] })
  .endPage()
  .endPDF();
```

Register a name for a gray or CMYK color with `chroma()`, and see
[Colors, Shapes, and Vectors](../recipe/colors-shapes-and-vectors.md) for
Separation (spot) colors.
