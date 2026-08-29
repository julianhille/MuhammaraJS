# Place And Transform Images

Recipe can center, scale, rotate, skew, and apply opacity to images while
editing an existing PDF.

```javascript
pdfDoc
  .editPage(1)
  .image("photo.jpg", "center", "center", {
    width: 300,
    height: 300,
    align: "center center",
    opacity: 0.6,
  })
  .image("logo.png", "center", 600, {
    scale: 0.1,
    rotation: 45,
    rotationOrigin: [270, 550],
    skewY: 10,
  })
  .endPage()
  .endPDF();
```

Use `keepAspectRatio` when fitting an image to explicit dimensions. See
`tests/recipe/images.js` for tested JPG and PNG placement and transforms.
