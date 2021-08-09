So, let's see how to use Hummus to build a PDF, and write it directly to the stream.
The example shows basics of using Hummus, creating a PDF stream, adding a page to it, and some text.  

The full code listing is in [here](../samples/PDFServer.js).  

We'll start by creating a new script file, name it PDFServer.js.    
use npm install to get express and hummus:    

    npm install express
    npm install hummus


Now let's write some basic server code using express. This parts is plain express, so just grab it as is:    

```javascript
var express = require('express');
var app = express();
app.get('/', function(req, res){
    res.writeHead(200, {'Content-Type': 'application/pdf'});
        
    /** here we will place the pdf building code **/
        
    res.end();
});
app.listen(3000);
```

This code simply creates a server that listens to port 3000. Note that the response content type is set to `application/pdf` so that the placed PDF content is interpreted as such.    

Now, we'll write some PDF code.  The following should be placed where the comment is.   

start by fetching the hummus module and create a PDF writer:

```javascript
var hummus = require('hummus');
var pdfWriter = hummus.createWriter(new hummus.PDFStreamForResponse(res));
```

The code uses `hummus.createWriter` method to create a PDF file writer. This method can receive either a string denoting a file path, or an object. The object, if provided, is a custom stream object. In this case it's an instance of `PDFStreamForResponse` class, which is an implementation of a custom stream writing to the server response object.

Next, we'll start a page:

```javascript
 var page = pdfWriter.createPage(0,0,595,842);
```

Not much to say about this. using the writer to create an A4 sized page. Dimensions, as is the case for the whole module, as in points (1/72 of an inch, the basic PDF measurement unit).   
There are 4 numbers (and not 2), cause we're providing the full media box of the page. It can be non-zero if you want margins.   

Now, let's add some text:

```javascript
pdfWriter.startPageContentContext(page).writeText(
   'Hello ' + (req.query.id ? req.query.id : 'World'),
    0,400,
    {
       font:pdfWriter.getFontForFile('./fonts/arial.ttf'),
       size:50,
       colorspace:'gray',
       color:0x00
    });
```

k. quite a bit happens here, so let's explain slowly.   
`pdfWriter.startPageContentContext(page)` creates a content context to the page, which is what you have to create in order to draw anything on top of it. This object has lot's of methods, allowing to add images, text, primitives, and use any of the PDF commands to draw anything. All it's methods are chain-able.   

Then, its `WriteText` command is used to write some text.
The first parameter is the text to write. In this case - `'Hello ' + (req.query.id ? req.query.id : 'World')` - is simply Hello with the value of the url parameter *id*.  
The 2nd and 3rd parameters are the X and Y coordinates in which to place the text.    
The 4th object is a style descriptor, which holds the font info, the color and font size:
```javascript
{
    font:pdfWriter.getFontForFile('./fonts/arial.ttf'),
    size:50,
    colorspace:'gray',
    color:0x00
}
```

The `font` entry uses `pdfWriter.getFontForFile` method to create a font object based on the font in the input path. In this case it's arial.ttf.    
`size` is, well, size.   
`colorspace` is the color space to use. There's `gray`, `cmyk` or `rgb`. Then comes `color` which has the color values written as a hex encoded color value. For each color component (number varying per the colorspace) there's a pair of hex values, from - 00 to FF. In this case it's 0x00 cause we want black. If it were an rgb color space we'll have something like 0xFE34DF, which means - 3 color components.

k. now let's just finish that Page, and the PDF with the following:

```javascript
pdfWriter.writePage(page);
pdfWriter.end();
```

the `writePage` command finishes a page, which means you don't get to write to it after calling this. `end` will finish the PDF and make it available (it won't do much, just add the font definition, mainly).

Done. We got a dynamically created PDF served directly to the response. Neat.

Learn about more feature of the module in [[Features]]