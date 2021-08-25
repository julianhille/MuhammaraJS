This page serves as TOC for the hummus module documentation.

The hummus module provide the following features:

1. [[Basic PDF Creation]] - create a PDF in a file or a stream, add pages
2. [[Show primitives]] - draw lines, rectangles, triangles and circles on a page
3. [[Show text]] - place text on a page. You can also place glyphs according to their IDs if you need to.
4. [[Show images]] - place images of JPG and TIFF types (PDF is explained below)
5. [[Use the PDF drawing operators]] - In addition to the top level functionality, you can also use the full list of PDF operators to draw anything.
6. [[Reusable forms]] - create graphics once, display many times.
7. [[Embedding PDF]] - merge PDF content into pages, use PDF pages as forms, copy PDF elements from another PDF...the works.
8. [[Streams]] - the module returns special stream objects, every now and then for you to either write to or read from. This passage explains how to use them.
9. [[Parsing]] - how to parse a PDF using the module.
10. [[Modification]] - how to modify an existing PDF.
11. [[Custom streams]] - more info about reading and writing from custom streams.
12. [[Extensibility]] - some notes about the extensibility options of the library.

In addition to what's explained here, there are more advanced features that i didn't yet have time to write about (like being able to place glyphs by ID instead of using text), and then there's more that's possible, either by exposing more of the PDFHummus C++ library, or by using the existing building blocks. So, if it's not there, ask me. Maybe there's a trick ;)