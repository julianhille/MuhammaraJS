The hummus module can place JPG, PNG and TIFF images. In addition you can also use PDF file page as if they were images.
PNG support allows for transparent images, and in that it's unique among the supported images types.  
Tiff support provides some cool effects you can use with the color values of the image mapped to particular colours. try it out. There's also a method for fitting an image in a box, and a way to get the image dimensions, to create nifty frames. This passage will discuss all those options.

There are some examples of using the module for placing images [here](../tests/HighLevelImages.js).

# Simple image drawing

To draw an image on a page you need to first create a content context for this page (as you would for placing text, primitives or anything else). Then use the `drawImage` method of the context:

```javascript
var cxt = pdfWriter.startPageContentContext(page);

// simple image placement
cxt
  .drawImage(10, 10, "./TestMaterials/Images/soundcloud_logo.jpg")
  .drawImage(10, 500, "./TestMaterials/images/tiff/cramps.tif")
  .drawImage(200, 500, "./TestMaterials/images/png/original.png")
  .drawImage(0, 0, "./TestMaterials/XObjectContent.PDF");
```

The drawImage requires 3 parameters - the first 2 are coordinates (bottom left corner) and the third is an image path. Unfortunately, currently, just because, there's no custom stream input. However, the format-specific-advanced image drawing methods that are described below, do allow custom streams, so you can use them instead. sorry...simply forgot about it. will complete, sometime.

Optionally there's a 4th parameter which is an options object. The object may have the following properties, to modify the default image placement behaviour:

- `index` - for multi-page image formats (tiff, PDF), `index` determines the page to show. Default is the first image in the collection.
- `transformation` - transformation method. Can be either a array or an object. If it is a array, then transformation will be a 6 numbers matrix, allowing you to scale, rotate, translate or whatnot. If it is an object, than it is meant for defining an image fitting behaviour. You will define bounding with/height, and the module will scale the image in accordance. the object may have the following attributes:
  - `width` - required, width of bounding box
  - `height` - required, height of bounding box
  - `proportional` - boolean, should the fit method maintain the image proportions?
  - `fit` - either `always` or `overflow`. If `always` Fit may always happen scaling up or down. If `overflow` fit will scale only if the image dimensions overflow the box.

Examples:

```javascript
cxt
  .drawImage(10, 10, "./TestMaterials/images/tiff/multipage.tif", { index: 2 })
  .drawImage(10, 10, "./TestMaterials/Images/soundcloud_logo.jpg", {
    transformation: [0.25, 0, 0, 0.25, 0, 0],
  })
  .drawImage(0, 0, "./TestMaterials/XObjectContent.PDF", {
    transformation: { width: 100, height: 100 },
  })
  .drawImage(100, 100, "./TestMaterials/XObjectContent.PDF", {
    transformation: { width: 100, height: 100, proportional: true },
  });
```

The first call displays the 3rd (it's 0 based) image in multipage.tif.
The second call, scale souncloud_logo.jpg to a quarter of its size.
The 3rd call fits XObjectContent.pdf into a 100X100 box, not maintaining proportions. The 4th call does the same while maintaining the proportions of the image.

# Getting image measurements

Usually you'd like to draw frames around images, or fit them. For this you'll need the image dimensions. you can get them by using the `PDFWriter` `getImageDimensions` method:

```javascript
var jpgDimensions = pdfWriter.getImageDimensions(
  "./TestMaterials/Images/soundcloud_logo.jpg"
);
```

The returned jpgDimensions has two members - `width` and `height` with the image dimensions.

# Advanced options

Each image type, provides some special methods, that allow you to do more advanced things with it. JPG and TIFF images options will be explained here. As for PDF embedding, it is explained in [Embedding PDF](./Embedding-pdf.md). Note that the advanced options around images, require a little bit of PDF operators usage...i'll explained everything that i use here :), worry not.

## JPG

For JPG you can create a form or an image PDF objects to display them, then use them like plain PDF objects. In addition to using image files, you can also use image streams. (yeah, not very interesting. it gets better with tiff).

You can see the advanced options used [here](../tests/BasicJPGImagesTest.js).

To create and use a PDF image object from a JPG do the following:

```javascript
var imageXObject = pdfWriter.createImageXObjectFromJPG(
  "./TestMaterials/images/otherStage.JPG"
);
var cxt = pdfWriter.startPageContentContext(page);
cxt.q().cm(500, 0, 0, 400, 0, 0).doXObject(imageXObject).Q();
```

K. that was a bit of PDF hupla. you begin by creating an image object (xobject) from the image, by providing a path to an image to the `PDFWriter` method `createImageXObjectFromJPG`. In turn you get an object that you can place using the context `doXObject` method (which is similar to the PDF `do` command) as is shown.  
Now. you see there also calls to `q`, `Q` and `cm`. These are PDF operators that means:

- `q` - save the current graphic state. any matrix, color or whatnot changes done are should be forgotten when a call to `Q` will happen. very good for encapsulating some graphic placement.
- `Q` - restores a graphic state to what it was before the previous `q`. `q` and `Q` calls may be nested.
- `cm` - sets the current matrix to be a 6 numbers transformation matrix. in the case above it sets the scale to 500X400 which is the desirable image measures on the PDF file.

**Important!**  
When creating an image object there should be no "active" context. Meaning, if you started a context (calling `pdfwriter.startPageContentContext` you must PAUSE it before you call the image creation command. Do this by calling `pdfwriter.pausePageContentContext(cxt)`. You can later continue using it, by making any call to it, which would make it "active" again (in the [example](../tests/BasicJPGImagesTest.js) you can see pausing used).

If you don't wish to have an image object, but would rather a form object, that is already scaled to the image dimensions, use the PDFWriter `createFormXObjectFromJPG`, instead, like this:

```javascript
var formXObject = pdfWriter.createFormXObjectFromJPG(
  "./TestMaterials/images/otherStage.JPG"
);
```

Then use the formXObject just like you'd you the image XObject with the `doXObject` operator. this time you don't have to scale the form.

Note that for both usages you can reuse the formXObject and imageXObject for placement anytime during the creation of the PDF file.

## Streams

For either of the methods described for JPG, and the following for TIFF, you can pass a stream object instead of the image file path. By using a stream object you expend the library capabilities to support not just its internal files representation, but rather any NodeJS valid source. Note that you still need the image to function as a file, that can read properly, and you'll need to support some file positioning.

To do that pass an object instead of the path string. The object should have the following functions defined:

- `read(inAmount)`, returns an array of bytes read from the current position in the stream, that contains up to inAmount bytes.
- `notEnded()`, returns a boolean specifying whether the stream is finished or not.
- `setPosition(inPosition)`, set the read cursor position to the input position, from the start of the stream
- `setPositionFromEnd(inPosition)`, set the read cursor position to the input position, from the end of the stream
- `skip(inAmount)`, skip inAmount number of bytes.
- `getCurrentPosition()`, get the current read position in the stream.

## TIFF

Like for JPGs it is possible to create form object (though not image objects) with the PDFWriter. Use the
`createFormXObjectFromTIFF` method. It also accepts a path or a stream, and creates a form object you can later use with the context doXObject. Same rules.

You can see this usage [here](../tests/TiffImageTest.js).

BUT. The `createFormXObjectFromTIFF` allows also an optional 2nd parameter which is an options object. It has the following properties:

- `pageIndex` - the tiff image index in a multi-image TIFF file (0 based)
- `bwTreatment` - for black and white tiffs (0,1 not grayscale), you can use the TIFF image as an image mask, where its "1" values have a certain color and the "0"s will be transparent. the `bwTreatment` is set to an object defining this behaviour. It can have the following properties:
  - `asImageMask` : set to true to use the image as an image mask
  - `oneColor` : a 3 or 4 numbers array (0...255 values for each), which is the color to use for the "1" bit. 3 for RGB color, 4 for CMYK.
- `grayscaleTreatment` - for grayscale images, you can use the 0 and 1 values, and the values in-between as levels of passage between 1 color to another. do that using the `grayscaleTreatment` which is an object with the following properties:
  - `asColoMap` : set to true to use the image grayscale levels as a color map between two colours
  - `oneColor` : a 3 or 4 numbers array for the 1 color level. 3 for RGB, 4 for CMYK.
  - `zeroColor` : a 3 or 4 numbers array for the 0 color level. 3 for RGB, 4 for CMYK.

You can see the special options around TIFF used [here](../tests/TiffSpecialsTest.js)

## PNG

Well PNG has the same option for creating a reusable form XObject. `createFormXObjectFromPNG` is what you are looking for. Nothing special to say about this, but to reiterate - with PNG comes support for transparency.
