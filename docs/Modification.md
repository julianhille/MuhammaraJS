You can modify existing PDF files with hummus. It will use the incremental modification method of PDF files, so any signed files remain signed, with no issues (don't know why i said it, ppl think it's important, i have no idea.).

Modifying an existing file can simply mean adding new pages with new content. This is the simplest thing, and can be done very easily, without PDF heavy lifting. It is also relatively simple to add new content to existing pages like text, and graphics. It gets more interesting if you want to change some of the existing content, like adding comments to existing pages, or modifying some advanced existing page graphics. in which case you'll sometimes have to take care of some low level manipulation of objects. It's not too difficult, you just need to know a little bit about PDF.

This [example](../tests/BasicModification2.js) shows how to do the first kind of simple modification - just adding a new page.

This [example](../tests/ModifyExistingPageContent.js) shows how to add text content to an existing page using the *PDFPageModifier* class (explained later).

This [one](../tests/ModifyingExistingFileContent.js) modifies existing content.  `page size modification` test shows how a certain page dimensions can be changed. `adding comments` test shows something more cool, adding comments to existing pages. It's actually quite decent method to implement comments adding in general, and is worthwhile for regular scenarios where you want to add comments (regardless of modification).

K. after all this talk, let's see the available toolset for making modifications.

# Creating a writer for file modification

Your first stop for modifying files is the Hummus object. Similarly to using it's `createWriter` method to create a PDFWriter for writing files, you can use its 'createWriterToModify' method to create a writer to modify an existing file. The method has the following signature:

```javascript
var writer = hummus.createWriterToModify(inFilePath,[{inOptionsObject}])

OR

var writer = hummus.createWriterToModify(inSourceStream,inTargetStream,[{inOptionsObject}])
```

The first form of the method call receives a file path of the file to modify, and an optional options object. The options object is the same as the one for creating a new file, but it has an additional optional entry with the key `modifiedFilePath`. Provide it in the case that you don't want the original file to be overwritten, but rather use the provided path as the target of the modified PDF.

The second method uses streams. The first parameter is the modified file source stream, The second parameter is the modified file target stream. The source is copied to the target and then any additional changes are appended. The options object is the same as the one for the creation method. Note that when referring to streams, at this point, hummus refers to objects that implement the hummus custom streams interface, not the plain node streams. For files there are two ready implementations. `hummus.PDFRStreamForFile` constructor accepts a path to a file and serves as a read stream. `hummus.PDFWStreamForFile` is similar and can serve as a write stream. For more info about hummus streams read [here](./Custom-streams).

Once you have a PDFWriter object it behaves in the same manner as one for creation with the ability to add pages, draw primitives and whatever. However, in addition, you can make changes to the existing content. 

# PDFWriter a-la modification

The PDFWriter, when used for modification, has 3 more valid methods. These are:

```javascript
getModifiedFileParser()
getModifiedInputFile()
createPDFCopyingContextForModifiedFile()
```

If you are in the business of modifying the existing parts, what you will actually be doing is creating new objects, direct or indirect (low-level ones, the kind you can read on in [Extensibility](./Extensibility.md)) to replace existing ones. You will probably need to read a bit of the parts of the existing file. For this, use `getModifiedFileParser`, which will provide you with a parser for the existing parts of the file. It is a regular parser, that you can read about in [Parsing](./Parsing.md). Note that specifically for adding more content on top of an existing page there's a simple method to do that using the PDFPageModifier class, explained below. It provides a regular page content context, as one creates for a new page, for the user to add new graphics on top of the existing page graphics.

In addition you can use `getModifiedInputFile` to get an InputFile object that can get you the source file stream for reading and the source file path. Well...in case this is a modified file. if you used the stream input version...forget about it. 
`InputFile` has these three interesting methods (it has also open and close methods...but don't use them):

* `getFilePath` - which will return the file path
* `getInputStream` - which will return a stream of type ByteReaderWithPosition. you can read about stream reading in [here](./Streams.md#bytereaderwithposition)
* `getFileSize` - get the file size. 

well, i guess it's not too interesting...but if makes sense, go for it.

Now, during the modification process you will probably build new objects, and copy some existing object. For this purpose use `createPDFCopyingContextForModifiedFile()`, which will create a nifty copying context for you to use for copying objects from the original file. read about copying contexts in [here](./Embedding-pdf.md#advanced-pdf-embedding-with-documentcopyingcontext). Note that as oppose to regular copying, object references, unless looking at new objects, should retain their existing IDs, so when copying direct objects use `copyDirectObjectAsIs`. Go read the passage. You'll get the point.

Last but not least. You will obviously create some new objects, plain low-level objects, that has the difference from the original objects. For this purpose you will use the PDFWriter Objects Context. There is explanation of this objects context in [Extensibility](./Extensibility.md), but just think about it as an object that is your starting point for writing strings, dictionaries, streams and anything low level. You can get it using the PDFWriter `getObjectsContext` method. Using this object you can create new objects, obviously.

Particularly for the purpose of modification scenarios, the Objects Context has this method:

```javascript
objCxt.startModifiedIndirectObject(inObjectID)
```

`startModifiedIndirectObject` starts the definition of an indirect object of the input object ID. This is quite similar to starting a new object with `startIndirectObject`, however it requires receiving an object ID...cause the whole point is to change an existing object, for which you should already have an ID.
The modified object writing is finished with `endIndirectObject` as would a new object. Once there is a modified object definition, the original object is ignored.

Another method of the objects Context, particular for modification scenarios is:

```javascript
objCxt.deleteObject
```

# Adding content to existing pages

More than most times you will use the modification module in order to add content to existing pages. Tasks like form filling, or adding barcodes to pages. For this the Hummus module provides the `PDFPageModifier` class. The class constructor receives a `PDFWriter` targeted for modification, a page index and an optional flag Boolean flag:

````javascript
// default constructor method, graphics added reuses global graphic state setup
var pageModifier = new hummus.PDFPageModifier(pdfWriter,0);

// add 'true' so that the content that you introduce is independent of existing graphic state
var pageModifier = new hummus.PDFPageModifier(pdfWriter,0,true);
````

If you pass `true` as the last parameter to the constructor it will make sure that any graphics that you add will not be
affected by the graphic state of the existing content. This is very useful, for example, if the content is placed in an unnatural orientation.

Once created you can use it to create a page content context, like one that's being create for a new page with `pdfWriter.startPageContentContext(page)`, issuing text drawing commands, adding images etc.

It's interface is as follows:
* `startContext` - will start a new context, similar to calling `pdfWriter.startPageContentContext(page)` on a new page. (note that it returns the `PDFPageModifier` instance, and not the context).
* `getContext` - Once a context was started, call this to get the content context for the page.
* `endContext` - call this method to finalize the context, when done issuing drawing commands. Note that you can call this method and call `startContext` later again to create a new context for the same page. This allows you to stop writing for a page in order to add graphics outside of the graphic context, similar to the usage logic of `pdfWriter.pausePageContentContext(cxt)`
* `writePage` - when done writing commands call this method to write the modified page. After this point you should no longer use the `PDFPageModifier` instance as the page was finalized.

see [here](../tests/ModifyExistingPageContent.js) a usage example.

That's all. Now you know everything about modification.