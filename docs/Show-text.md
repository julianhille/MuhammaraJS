Using a page content context, you can write text. To help you posit the text correctly, the module has a function to measure a text dimensions. The following explains how. 

You'll find useful examples here:
* [draw text and primitives](../tests/HighLevelContentContext.js)
* [draw text and use the text measurement method](../tests/TextMeasurementsTest.js)

# Writing Text

Ok. So assuming that you created a page content context (with `var cxt = pdfWriter.createContentContext(aPage)`) you can now use it for writing text. Here is how:

```javascript
cxt.writeText(text,x,y,[{options}])
```

The `writeText` method accepts a string of text as its first parameter, then the x and y coordinates for where to display it, and then options about the text style.  
The options object has the following properties:

* `fontSize` - the font size to use
* `colorspace` - `rgb`, `cmyk` or `gray`, for either colorspace. default is rgb.
* `color` - a number of the form 0xXXXXX, where each pair defines a color component. A Pair is a number between 0..255 encoded in hexadecimal numbers (meaning 00..FF). The number of components is dependent on the colorspace chosen. For example, for RGB you'll have something like 0xFF45DE, which would mean 255 for Red, 69 for Green, and 222 for Blue.
* `font` - a font object
* `underline` - boolean, whether the text should be underlined

The `font` property should be set to a font object. You can create one with the `PDFWriter.getFontForFile` method like this:   

```javascript
var arialFont = pdfWriter.getFontForFile('./TestMaterials/fonts/arial.ttf');
var textOptions = {font:arialFont,size:14,colorspace:'gray',color:0x00};
cxt.writeText('Paths',75,805,textOptions)
```

`getFontForFile` simply receives a path to a file for a font. Hummus supports ttf,otf,pfb/pfm,dfont and ttc.
for type 1 (pfb/pfm), pass two paths. first the pfb, then the other one (pfm, normally). 
dfont and ttc are font collections, so you can pass a 2nd parameter that will be the font index (if not, it'll take the first font in the colletion).

now keep that font object. you'll need it for the next passage :)

One thing of note for the heavy typographers amongst you - kerning is not supported by the module. If you want kerning, for now you'll have to do it yourself, getting the info somehow and using multiple calls or the advanced PDF commands, to place the text according to the fetched kerning.

In addition, you should know that using the advanced PDF operators there are some more options around placing characters. you'll be able to pass a text string, and it will treat it as unicode, but you can also pass an array of glyph codes, in case you are unhappy with the default encoding. All about this happiness in [[Use the PDF drawing operators]].  

# Measuring Text

So i got lazy and didn't provide you an easy method to fit text into a frame...but what i did do is to allow you to do it yourself, by providing a method to measure text. It's dead easy. If you got a font object (using `pdfWriter.getFontForFile`) do this:

```javascript
var textDimensions = arialFont.calculateTextDimensions('Hello World',14);

console.log(textDimensions.xMin)
console.log(textDimensions.yMin)
console.log(textDimensions.xMax)
console.log(textDimensions.yMax)
console.log(textDimensions.width)
console.log(textDimensions.height)
```

the `calculateTextDimensions` method of a font object accepts a string and a font size, and will return the measurement of the text using this font and size.

The returned object has the following properties:
* xMin - minimum x coordinate. may be sub zero, for characters that draw before the bearing (little do that)
* yMin - minimum y coordinate. may be sub zero, for descending characters (like j) 
* xMax - maximum x coordinate. 
* yMax - maximum y coordinate.
* width - width of text
* height - height of text



