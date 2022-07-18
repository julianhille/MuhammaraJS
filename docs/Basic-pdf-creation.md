This passage will discuss the basics of PDF creation:
* how to create PDF files, and streams using `hummus.createWriter`. then finishing them.
* adding pages with and writing them

a short example on how to do both is available [here](../tests/EmptyPagesPDF.js)

# Create PDFs

The hummus module has `createWriter` method is used for starting a PDF file or stream:

```javascript
createWriter(inFileName,[inOptions]);
createWriter(inStreamObject,[inOptions]);
```
The method returns a PDFWriter object that you can now use to add pages and content.

The method has possible first parameters. You can either choose to write to a file, in which case you'll pass a string leading to this file path (it is utf8 encoded, like all strings used in the module).  
You can alternatively pass a stream object, which is simply an object implementing two methods (write and getCurrentPosition). The Hummus module comes with `Hummus.PDFStreamForResponse` which is a class implementing such a stream object, that can be used for writing directly to the response stream for a server. For more information about custom streams, visit [Custom streams](./Custom-streams.md);   

The second, optional, object provide options for the PDF file creation. It may have the following members:

* `version` - a number value stating the version of the desired PDF. default is 13 (PDF 1.3). Any number between 10 and 17 works. You can use `hummus. ePDFVersion10` to `hummus.ePDFVersion13` if you prefer nice symbols.
* `compress` - the PDF streams are normally compressed using flate compression. If you want to cancel this (maybe for debugging, or whatnot), set this member value to false.
* `log` - For debugging purposes, if something goes wrong, use this option to allow the internal library to provide some log notes. log parameter should be set to a file path where the end result log should reside in.Note! when using the log the module/library is no longer thread safe. So unless for debugging, avoid.

To finish a PDF file simply call the created PDFWriter `end` method. Like this:

```javascript
pdfWriter.end()
```

# Add and write pages

To start writing a PDF page, use the `createPage` method of the PDFWriter object, passing 4 numbers that serve as the page media box, like this:
```javascript
pdfWriter.createPage(0,0,595,842)
```

The method will return a PDFPage object that you can later use to add context to.    
The PDFPage object has a property `mediaBox` that can be used to get or set an array of 4 numbers, used as the page media box. Note that because of that it's perfectly OK to pass nothing to `createPage` and set the media box later.

When done providing content to a page, write it with `pdfWriter.writePage(aPage)`.
