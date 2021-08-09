Once a Page is created you can use its content context to add images, text and primitives. This passage explains about the high level methods available for drawing primitives. Note that in addition to what's described here there are methods to draw primitives using all the PDF operators, explained in [[Use the PDF drawing operators]]

A code sample for using the methods explained here is available in [here](../tests/HighLevelContentContext.js).

You can draw the following primitives:
* Rectangles
* Squares
* Circles
* Paths (meaning, any combination of lines)
With each you can either stroke (draw) it or fill according to it.

# Create a context

To place any content on a page, you must first create a content context for it. You do so by using the following code:

```javascript
var cxt = pdfWriter.startPageContentContext(page);
```

Pass a page to `startPageContentContext` and you should be ready. The content context object can now be used to place content on a page. Let's go.

# Rectangles

The content context `drawRectangle` method can be used to draw a rectangle:

```javascript
cxt.drawRectangle(left,bottom,width,height,[{options}])
```

The first 4 parameters provide for left,bottom coordinate and the width and height of the rectangle. The optional 5th parameter provides drawing options. The options are as follows:

* `type` - either `stroke` or `fill`, for either drawing the rectangle, or filling it
* `colorspace` - `rgb`, `cmyk` or `gray`, for either colorspace. default is rgb.
* `color` - a number of the form 0xXXXXX, where each pair defines a color component. A Pair is a number between 0..255 encoded in hexadecimal numbers (meaning 00..FF). The number of components is dependent on the colorspace chosen. For example, for RGB you'll have something like 0xFF45DE, which would mean 255 for Red, 69 for Green, and 222 for Blue.
* `width` - if you chose `stroke` for `type`, then this would provide the width of the line

# Squares

For squares, use `drawSquare`. It has the same parameters set as for `drawRectangle`, but without the height. cause it's the same as width. that's why. it's a square.

# Circles

For Circles use `drawCircle`:
```javascript
cxt.drawCircle(centerX,centerY,radius,[{options}])
```

First 3 parameters are the center coordinates, and the radius. The 4th optional parameters provides drawing options. Same as for rectangles.

# Paths

To draw any polygonal path, use the `drawPath` method:
```javascript
cxt.drawPath(x1,y1,x2,y2.....,[{options}])
``` 

You can provide a variable length list of pairs of coordinates, each time passing the X and Y of it. The last optional parameter is a style parameter, with the same options as explained for rectangles, with One additional option - `close`. Pass true as the `close` property value, to automatically close the path. If you are using `fill` type, the path will automatically be close regardless of y'r request.



That's all folks. You can obviously draw a lot more, like images and text, or just use any PDF command to manipulate the drawing (for instance, rotate and scale using the `cm` PDF commands). More about these commands in [[Use the PDF drawing operators]]