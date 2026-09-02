# Draw Images

`drawImage` places JPG, PNG, TIFF, or a page from a PDF at the supplied
bottom-left coordinates.

```javascript
var context = pdfWriter.startPageContentContext(page);
context.drawImage(72, 72, "./image.jpg");
```

Pass an `index` for a page in a multi-page TIFF or PDF. The optional
`transformation` is either a six-value PDF matrix or an object with `width`,
`height`, and optional `proportional` and `fit` values for fitting an image in a
box.

`pdfWriter.getImageDimensions(path)` returns an object with `width` and
`height`. Reusable JPG, PNG, and TIFF forms are covered in
[Form XObjects](form-xobjects.md). Tested image placement examples are in
`tests/HighLevelImages.js`, `tests/BasicJPGImagesTest.js`, and
`tests/TiffImageTest.js`.
