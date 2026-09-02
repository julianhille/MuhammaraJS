# Place And Transform Images

Register JPEG, PNG, or TIFF browser bytes before placing the image. Recipe can
fit, align, rotate, skew, and apply opacity without exposing a filesystem path.

```javascript
import { createRecipe } from "@muhammara/wasm";

var Recipe = await createRecipe();
await Recipe.registerImageAsync("photo", imageFile, "jpeg");
var pdf = new Recipe(inputBytes);

var outputBytes = pdf
  .editPage(1)
  .image("photo", 300, 220, {
    width: 300,
    height: 300,
    align: "center center",
    keepAspectRatio: true,
    opacity: 0.6,
    rotation: 45,
    rotationOrigin: [300, 220],
    skewY: 10,
  })
  .endPage()
  .endPDF();

Recipe.unregisterImage("photo");
```

Pass the validated extension explicitly: `jpeg`, `jpg`, `png`, `tif`, or
`tiff`. Use `keepAspectRatio: false` only when deliberate stretching is wanted.
See [Byte Assets and Blob Input](../byte-assets.md) for synchronous and async
registration rules.
