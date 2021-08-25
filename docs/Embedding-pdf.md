The hummus module has quite a lot of capabilities around embedding other PDF files into the written file. This is very useful when you are trying to merge pages of multiple PDFs into a single PDF, or impose one or more PDF files unto larget target pages. You can use the source pages as either complete pages, or placeable entities (in the form of form xobjects). The hummus module also allows you to copy lower-level objects from the source PDF in order to implement more complex algorithms, such as creating a PDF file which is a lower resolution representation of an original PDF. all in all...very neat.

The basic methods are provided as *PDFWriter* methods, the more complex ones require the creation of a *DocumentCopyingContext*

# Basic page appending

If you simply want to take pages from an original PDF and put them in the target PDF use `pdfWriter. appendPDFPagesFromPDF(inSourcePDFFilePath || inSourcePDFFileStream, [{PageRange}])`

The first parameter to the method is either a path to a source PDF file or a PDF file stream object. To read about stream objects go to [[Custom streams]].

The second parameter is optional and provide information about the range of pages to include. If not provided all the source PDF pages are appended to the PDF file. If it is provided it has the following properties:
* `type` - enumerator. either `hummus.eRangeTypeAll` or `hummus.eRangeTypeSpecific`. If you bother with this object than you will want to use `hummus.eRangeTypeSpecific`. The other option is kind of irrelevant (and the default).
* `specificRanges` - array of pairs. each pair signify a page range to append. the first parameter is an index of the first page to include in this range, and the second is the last page to include. For example, pass [ [ 1,3 ],[ 7,10 ] ] to append pages 2..4 and then 8..11 (it's 0 based, yeah...i know. hey, we're in computers, no? that's the way things are here. i guess).

A simple usage example can be found [here](../tests/AppendPagesTest.js).


# merging a page content to another page content

It is sometimes useful to merge one or more pages from a source to a single page. This is good when you are writing an imposition implementation and want to place several pages contents on a single page.

To go about this use the `PDFWriter` `mergePDFPagesToPage` method. There's an example [here](../tests/MergePDFPages.js) which shows all the various options. check it out.

a call to `mergePDFPagesToPage` looks like this:

```javascript
pdfWriter.mergePDFPagesToPage(inTargetPage,inSourcePDFFilePath,[inOptionsObject/inInterPagesCallback])
```

K. The first parameter is the page to merge the contents to. The 2nd parameter is the source PDF file path (sorry...forgot to include streams here). The 3rd parameter may be either an options object, providing for the range of pages to merge - using the same method as with appending - or a callback. The callback will be called between every pages that are being merged, allowing you to push code. hint...probably some positioning code, to place the soon to be merged page in some place. Note that it is being called AFTER every page. The callback receives no parameters and is not expected to return anything. it's OK to use both options object and callback, and their order in the parameters list doesn't matter.

# create form xobjects from source pages

Say that merging is not enough, and you want more control over placing source pages. All fair and square. In that case create form XObjects from the original pages and use them later per your discretion anywhere on any page.

Do this by using the `createFormXObjectsFromPDF` method of `PDFWriter`. There's an example [here](../tests/PDFEmbedTest.js)

The method call looks like this:

```javascript
pdfWriter.createFormXObjectsFromPDF(inSourceFilePath,
                                    [inFormBox || inSourcePageBoxEnum],
                                    [inPageRangeObject]);
```

First parameter is the source file path (sorry, forgot streams. again).
Second parameter determines the box of the create form. You can choose between passing a 4 numbers array, which will be the form box, or use an enumerator value to pick a source page box. Pick one of:

```javascript
hummus.ePDFPageBoxMediaBox
hummus.ePDFPageBoxCropBox
hummus.ePDFPageBoxBleedBox
hummus.ePDFPageBoxTrimBox
hummus.ePDFPageBoxArtBox
```

The 3rd optional parameter is the range object determining which pages to create forms off of.

(there are other parameters, but they are not really interesting)

Once you got the pages as forms use an pages/form content context `doXObject` method to place them anyway you feel like.

# Advanced PDF embedding with DocumentCopyingContext

The `DocumentCopyingContext` object can be created for a source PDF file, and allow you high flexibility and granularity on copying anything out of a source PDF to the target written PDF. Another cool facet of using `DocumentCopyingContext` is that you can open several of those at once and interleave content from different PDFs into the target PDF. 

You create a copying context for a source PDF using the following PDFWriter method:

```javascript
var cpyCxt = pdfWriter.createPDFCopyingContext(inSourceFilePDF || inSourceFileStream)
```

You can create a context to either a PDF file, passing it's path, or to a source custom stream object.

Once you have the copying context, there's lot's you can do. Let's review its various methods.

## Appending, Merging, and creating forms

The copying context has equivalents to the `PDFWriter` appending/copying and merging methods, allowing to do this for individual pages each time, so there's more control on what's done between the calls. In addition, the copying context has an option to merge a page into a form, rather than a page, where this makes sense.

The following methods are available for these purposes:

```javascript
cpyCxt.appendPDFPageFromPDF(inSourcePageIndex)
cpyCxt.createFormXObjectFromPDFPage(inSourcePageIndex,inFormBox || inPageBoxEnum)
cpyCxt.mergePDFPageToPage(inTargetPage,inSourcePageIndex)
cpyCxt.mergePDFPageToFormXObject(inTargetForm,inSourcePageIndex)
```

`appendPDFPageFromPDF` accepts a single parameter which is the source page index.
`createFormXObjectFromPDFPage` accepts the source page index, and either an array of 4 numbers forming a form box, or an enum specifying which source page box to use as the form box (same enum values as the PDFWriter equivalent). it returns a form XObject that you ca now place.
`mergePDFPageToPage` accepts a traget page object, and a source page index, and merges the source page content to the target page content.
`mergePDFPageToFormXObject` does the same with a form. Pass a form as the first parameter and a source page index as the second one.

## Getting info about the source document

All this activity with so little knowledge...i mean, how will you even know how many pages the source document has?!?!?!

Easy. you can get two things from the copying context using these two methods:

```javascript
cpyCxt.getSourceDocumentParser()
cpyCxt.getSourceDocumentStream()
```

you can get access to the source document reader/parser using `cpyCxt.getSourceDocumentParser`. The parser is quite useful in providing you some basic high level information and access to the low level building blocks of the source PDF. For example, to get the number of pages, go `cpyCxt.getSourceDocumentParser().getPagesCount()`. For more info about what you can do with a parser go to [[Parsing]].

If you really must, you can even get access to the source document stream. This is done using `cpyCxt.getSourceDocumentStream()`. Reading bytes from a stream is really simple and explained in [[Streams]], so i wont bother with this here.

## Low levels

The copying context allows you to copy individual low level objects (like streams, dictionaries, strings, whatnot) from the source PDF. These capabilities make it possible to implement complex algorithms like creating a low-res representation of a PDF file, or create a PDF file with just the images or text form the source document or a file without the comments, and so on and so forth. (for the last one i'd use modification...unless you don't want to bother with PDF incremental changes). This stuff is fairly advanced, so be warned if you are not familiar with PDF.

```javascript
cpyCxt.copyObject(inObjectIndex)
cpyCxt.copyDirectObjectWithDeepCopy(inDirectObject)
cpyCxt.copyNewObjectsForDirectObject(inDirectObjectInDirectObjectsList)
```

`copyObject` gets an object index, in the source document indexing range, and copies it to the target document. Any indirect object, can be copied this way. The copy is always deep copy, so any attached object are copied as well.

`copyDirectObjectWithDeepCopy` receives an actual object, normally a "direct" object that you got by traversing some container object form the source document parser. This method copies the direct object WITHOUT interrupting the flow of copying of the container object. For example, if this direct object has indirect object references...it won't start ruining your target PDF by writing them now. Rather, this method returns an array of the indirect object indexes that are referenced from the direct object that still require later copying. When comfortable (after done with the writing of the container object), use the return value as an input parameter to a call to `copyNewObjectsForDirectObject` to complete the copying of the direct object with copying the accompanying indirect object references.
Now, if you are copying several direct objects, it's ok to join their lists and call once to `copyNewObjectsForDirectObject`. It will realize duplicates...so don't worry about that. 

Now, for some info about the copied objects:

```javascript
cpyCxt.getCopiedObjectID(inSourceObjectID)
cpyCxt.getCopiedObjects()
```

To get the ID of a source object ID in the target PDF (it won't be the same, normally) use `getCopiedObjectID` and pass the source object ID.
If you want to know this info for all copied objects, call `getCopiedObject` which will return an object where each property name is a source object ID, and its value is a target object ID.


```javascript
cpyCxt.replaceSourceObjects(inReplacementDictionary)
```
k. say you want to create a new PDF, where some of the old objects have new representatives. The best example is when you create a new PDF out of an old ones, and has low-res images ready to replace the original images. what you would do then is call `replaceSourceObjects` passing an object having as keys (properties) the source document object IDs, and as values the new low-res images object IDs. Then just copy the whole document into the target document (well, just append all the pages, annotations and such if you will. catalog is and pages tree are probably less desirable)...and you are done. The replaced objects will simply not be copied, and any object referring to them will simply use the defined IDs. It's perfectly OK to make multiple calls to this method.


```javascript
cpyCxt.copyDirectObjectAsIs(inSourceObject)
```
This last one is unique for modification usage scenarios, as oppose to the embedding scenarios described earlier.
`copyDirectObjectAsIs` copies a DIRECT object to the current position in the target PDF. You can get such direct objects by traversing the source document with the source document parser. This method copies the object without "deep copying" which means any attached indirect objects will not be copied as well. In addition any indirect object IDs remain with their source document pointing. This method is MAINLY good for copying in a file modification scenarios, where keeping old IDs make sense. For import/embed scenarios, you will use `copyDirectObjectWithDeepCopy`.

## Examples

There are some examples in the github project that can be useful if you are looking into using the copying context.    

Check out [PDFCopyingContextTest](../tests/PDFCopyingContextTest.js) for simple appending.

[MergeToPDFForm](../tests/MergeToPDFForm.js) shows how to merge a source PDF to a form object.

[MergePDFPages](../tests/MergePDFPages.js) shows merging pages options, including one with the copying context.