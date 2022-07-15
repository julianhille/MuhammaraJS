Hello and welcome to the Muhammara Wiki.   
Muhammara is a NodeJS module for Creating, Parsing and Modifying PDF files and streams.  Install by simply going `npm install muhammara`.   

The module has the following set of features:

1. Create new PDF files, Modify existing ones.
2. Display JPG, PNG and TIFF images. 1 BIT tiffs and grayscale may be used as image and color maps for fancy display. Transparent PNG images are supported.
3. Show text using True Type, Open Type and Type 1 fonts (that's ttf,otf, pfb/pfm, dfont, ttc).
4. Draw primitives.
5. Define reusable graphics using XObject Forms.
6. Embed other PDF files into your PDF with _many_ options around how to do that. From simple appending of pages from another PDF, through creating re-placable content out of pages from another PDF, to copying basic building blocks of the other PDF. And it's OK to merge and interleave content from multiple PDFs. no problem.
7. Parse PDFs  
    1. Get basic info about the PDF file and it's pages.
    2. Read form values. see [here](http://pdfhummus.com/post/154893591116/parsing-pdf-digital-form-values). 
    3. Read all text from a PDF file. see [here](http://pdfhummus.com/post/156548561656/extracting-text-from-pdf-files).
    4. Access the lower level PDF constructs, to allow you to read anything inside the PDF file.
8. When modifying a PDF you can add new pages to it with new content, or place content on top of existing page content. And much more - for example [this](http://pdfhummus.com/post/161128437261/a-good-day-to-everyone-today-we-will-discuss-a) explains how to fill PDF forms with modification.
9. You can write to either file or stream. Particularly you can write directly to the response stream, saving you the need to maintain files for dynamically generated PDFs. You can implement your own custom streams
10. You can also read JPGs, TIFFS, PDFs from custom streams implementations. natively the library supports files, but you don't have to stick just to that (unfortunately, fonts, at this point must still be files).
11. In addition to the high level features the module provides powerful access to the low level building blocks of the PDF in both reading and writing, so essentially you can do anything PDF.

Getting Started - [How to serve dynamically created pdf](./How-to-serve-dynamically-created-pdf.md).   
Feature documentation and Reference - [Features](./Features.md).  


Muhammara is also very fast, using a unique model of one-off writing.  
It is built on top of the [PDFHummus](https://github.com/galkahana/PDF-Writer) library, a powerful, fast and free XPlatform C++ PDF library.   
It is absolutely free. Apache 2 is the license, so you can use it safely for both commercial and non-commercial purposes.


Any suggestions for additions are welcome. Contributions are also welcome (both in JS and C++).

# Index

- [Basic pdf creation](./Basic-pdf-creation.md)
- [Custom streams](./Custom-streams.md)
- [Embedding pdf](./Embedding-pdf.md)
- [Extensibility](./Extensibility.md)
- [Features](./Features.md)
- [How to serve dynamically created pdf](How-to-serve-dynamically-created-pdf.md)
- [Modification](./Modification.md)
- [Parsing](./Parsing.md)
- [Reusable forms](Reusable-forms.md)
- [Show images](./Show-images.md)
- [Show primitives](Show-primitives.md)
- [Show text](./Show-text.md)
- [Streams](./Streams.md)
- [Use the pdf drawing operators](./Use-the-pdf-drawing-operators.md)