Muhammara allows you to read and parse an existing PDF file.
The capabilities of the parser provide for top level information about the PDF, information about page boxes, and access to the lower level objects of the PDF. It ain't the strongest part of the module. Meaning - you have access to everything. And some high level caps, but not much. For instance, if you are looking for querying the images, or the text or these kind of high level methods, they are not there. You can build them using the parser, and it will take you some of the way (for instance, you can get a good decoded content stream reader, and you can get easy access and simple object read for dictionaries, strings, numbers etc), but you'll have to understand some PDF. I would love contributions here.

Parsing is very important not just for reading scenarios, but also for advanced copying and modifying scenarios. You'll use the parser in these cases to learn about the source, or existing PDF in order to determine what to copy, or manipulate.

There is an example of how to use the parser [here](../tests/PDFParser.js) with some high level and low level parsing.

The following passage explains about the parser. There parts - creation of parser and high level methods, then pages methods, and then low-level objects methods.


# Creating a parser object and high level functions

OK. First, you can get a PDFReader object (that's the proper name of the parser object) when modifying a file, or copying from it using the copying context. How to do this is explained in the relevant documentation chapters. But, you can also create a parser for a regular PDF file. You do it via the main muhammara module:

```javascript
var muhammara = require('muhammara');
var pdfReader = muhammara.createReader('./TestMaterials/XObjectContent.PDF');
```

the `createReader` method returns a parser object, provided that the PDF is ok. well, at least what parts it needs initially to read.

The reader object can provide the following high levels:

* `getPDFLevel()` - get the PDF level as a number. like, 1.3
* `getPagesCount()` - get the pages count
* `getTrailer()` - get the PDF trailer object (for info). it's a PDFDictionary. explained below.
* `getPageObjectID(inPageIndex)` - get the page dictionary object ID for a given page index.
* `parsePage(inPageIndex)` - returns a page info object of PDFPageInput type. can give you various boxes of the page and its dictionary. see below.
* `parsePageDictionary(inPageIndex)` - returns a page dictionary object, of type PDFDictionary. see below for usage details.
* `getObjectsCount()` - get the total count of the PDF object in the PDF file
* `isEncrypted()` - is the file encrypted? kind of important. Cause if it is the library won't be able to parse too much of it (it doesn't know encrypted files) or modify it.
* `getXrefSize()` - if you know what an Xref table is in a PDF, then this one will provide it's size
* `getXrefEntry(inObjectID)` - get an xref entry. returns an object with `objectPosition`, `revision` and `type`, for an input object ID. type can be hummus.eXrefEntryExisting, hummus.eXrefEntryDelete or hummus.eXrefEntryStreamObject, according to the possible xref values.
* `getXrefPosition()` - get the file position of the xref table (the last one, for modified files)
* `getParserStream()` - get the read stream for the parser. It is of type ByteReaderStreamWithPosition. If you wish to read from it directly, check [this](./Streams.md#bytereaderwithposition) for details.


# Page info objects

If you used `parsePage` to get a page info object, you will receive an object that can provide information about the various boxes of the page. If the boxes values are inherited by deducing from other boxes, it will return the deduced value. The following methods are available:

```javascript
getMediaBox()
getCropBox()
getTrimBox()
getBleedBox()
getArtBox()
```

each method returns an array of 4 numbers, providing the box left,bottom,right, top.

In addition to getting the boxes, you can get the page dictionary object with `getDictionary`. Dictionary objects are explained below.

Page rotation can be retrieved with `getRotate`. Values will normally be 0,90,180,270 or null.

# Low level objects

In addition to the hight level objects, the parser can read low levels. I guess that's its mainly current usage. The parser can read all of the low leve object types, and provide simple interface for their values.

The following object types are being read:

```javascript
hummus.ePDFObjectBoolean
hummus.ePDFObjectLiteralString
hummus.ePDFObjectHexString
hummus.ePDFObjectNull
hummus.ePDFObjectName
hummus.ePDFObjectInteger
hummus.ePDFObjectReal
hummus.ePDFObjectArray
hummus.ePDFObjectDictionary
hummus.ePDFObjectIndirectObjectReference
hummus.ePDFObjectStream
hummus.ePDFObjectSymbol
```

Any parsed object is derived from PDFObject, and has a member method named `getType` that can get you the type.

You get to the parsed objects by either iterating objects, or parsing indirect objects by their ID, using the PDFReader `parseNewObject(inObjectID)` method, which receives an object ID and returns the object. The object is initially used via the PDFObject methods which are explained in the next section

## PDFObject

PDFObject is the parent class for all other objects. When you call `parseNewObject` or get an object from any other method, then this is the type you will see. You can get the actual type with the `getType` method. You can then change the object to be the actual type object (so you can use it's move relevant method) by using one of the following PDFObject methods:

```javascript
toPDFIndirectObjectReference()
toPDFArray()
toPDFDictionary()
toPDFStream()
toPDFBoolean()
toPDFLiteralString()
toPDFHexString()
toPDFNull()
toPDFName()
toPDFInteger()
toPDFReal()
toPDFSymbol()
```

Each of these methods converts the PDFObject to an an actual object. For example, calling toPDFName() will return a PDFName object, that you can now use its methods to get the name value.
If you expect a specific type, you can simply call the relevant type conversion method, and continue using the object with its actual methods. Each of the types will be explained below. (and don't forget to check the example so it will all make sense).

In addition to the conversion methods there are simple Javascript value getters, which are good for fast retrieval of javascript values from a PDFObject for known types:

```javascript
toNumber()
toString()
```

`toNumber()` will return a javascript number value for real and integer parsed objects. It will return null for anything else.
`toString()` will return an equivalent string value for names, literal and hex strings, real and integer numbers, symbols and booleans ('true' for true value, and 'false' for false values).


The next sections will discuss each type of object. Remember - you get to them by using the toXXXXXX methods. Dont' try to just call their methods directly when they are still PDFObject. Like in V8 programming - first convert, then use. alright?

## PDFInteger and PDFReal

Both PDFReal and PDFInteger objects have a single property named `value` that returns their number value. Hurrah. it'll be a javascript number.

## PDFLiteralString, PDFHexString, PDFName and PDFSymbol
All those objects have a single `value` property that will return the string value that they hold.

## PDFBoolean

PDFBoolean has a single property named `value` returning a javascript boolean value equal to what it holds

## PDFNull

PDFNull object represents a null PDF value. It has a single property named 'value' always returning javascript null.

## PDFIndirectObjectReference

PDFIndirectObjectReference represents an indirect object reference. It has two methods - `getObjectID` and `getObjectVersion` - to get the PDF object ID and version (in accordance).

## PDFArray

a PDFArray is an array of PDF objects. It has three methods:

* `toJSArray()` - returns a javascript array, containing the PDFArray objects
* `getLength()` - returns the number of items in the array
* `queryObject(inIndex)` - returns the PDFObject at the designated index.

`queryObject(inIndex)` returns the direct object in the designated index. If it is a PDFIndirectObjectReference it will return this object, not the referenced object.
If you want to get the referenced object, use instead the PDFReader method `queryArrayObject`, like this:

```javascript
var anObject = pdfReader.queryArrayObject(inArray,inIndex)
```

This one will behave like the array queryObject, but for the case of PDFIndirectObjectReference, in which case it will return the referenced object.

## PDFDictionary

a PDFDictionary is a map object, mapping name values (PDFName objects) to objects (PDFObject). It has the following methods:

* `toJSObject()` - return a javascript object, where the name values (keys) of the dictionary serve as property names, and the values (PDFObjects) serve as values.
* `exists(inName)` - pass a string value that is a name of a possible object to check if such exists in the dictionary.
* `queryObject(inName)` - pass a string name, to get back an object (PDFObject) from the dictionary

similarly to arrays, `queryObject` for dictionaries returns direct object. So if you want to get the actual referenced object for a case where it is referenced form the dictionary using a PDFIndirectObjectReference, call the PDFReader `queryDictionaryObject(inDictionary,inName)` which works the same, but for references returns the actual referenced object.

## PDFStreamInput

The PDFStreamInput (not called PDFStream, cause there's an object in the "writer" part that's called that way) is a stream in the PDF. A stream is constructed of a dictionary and a flow of bytes, which meaning is defined in the dictionary. the stream object has the following methods:

* `getDictionary()` - will return a dictionary object (PDFDictionary) that is the stream dictionary
* `getStreamContentStart()` - return the byte position in the read stream where the content of the stream starts. Using it, the stream length property and the decoders you should be able to read the stream.

HOWEVER, there is a convenience method in the parser to get a ByteReader object that will allow you to read from the stream as if it were plain text...because it does the decoding for you. it will also stop the reading when the stream ends. So basically if you want to read the stream use this method:

```javascript
var readStream = pdfReader.startReadingFromStream(inPDFStreamInput);
while(readStream.notEnded()
{
  var readData = readStream.read(10000);
  // do something with the data
}
```

the PDFReader `startReadingFromStream` receives a PDFStreamInput object as a parameter and returns a ByteReader stream that you can read from. Although it's fairly clear from the example how reading works, you can still read more about it if you are not satisfied in [[Streams]].