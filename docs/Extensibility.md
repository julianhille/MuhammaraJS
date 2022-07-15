Most of the exentsibility options around hummus revolve around being able to create new element types.    
Sure hummus does decent work with images, text, drawng primitives etc. but there's more to PDF. like annotations, comments, links, u3ds, etc.   
Unfortunately, I didn't implement all (contribs are welcome :)), fortunately, you can build these elements using the basic PDF building blocks yourself. 

The hummus module provide simple methods to create PDF objects such as dictionaries, strings, numbers, streams (encoded or not), arrays etc. Using these methods you should be able to implement any type of objects. Hummus also lets you hook these objects to the existing structures in the PDF. You can do this in two ways - if you are looking to add annotations, you can create them and link them to pages. Or you can listen on page and catalog writes and add object references (or direct objects) there. These are normally the main areas where you will want to extend. However, The PDFHummus library, that hummus uses as back-end, allows for many more "hooks" into the PDF structures. So, If you want me to add hooks to existing structures, it's probably already done in PDFHummus, so i just have to expose it via the module - let me know and i will. 

Note that for modification scenarios (explained in [Modification](./Modification.md)) you can modify existing objects, so no problem hooking to whatever you want.

K. let's get to being familiar with the hummus module basic building blocks building functionality.

# The Objects Context

The main guy for writing the basic PDF elements is the *Objects Contextstart*. You can get the current written document *Objects Context* via the PDFWriter object with `var objCxt = pdfWriter.getObjectsContext()`

# basic objects creation with Objects Context

Once you got the objects context you can use the following methods to start and end PDF objects (in PDF language these would create `X X obj` and `endobj`):

```javascript
startNewIndirectObject([inObjectID])
endIndirectObject()
allocateNewObjectID()
```

`startNewIndirectObject` starts a new indirect object writing. Those objects have IDs, and can be referred from other objects. You can call the method with no arguments, and it will create a new object and return the object ID to you, so you can use it later for reference. Then write the object content and end the writing with `endIndirectObject`. Simple.

Now, if you want to first refer to an object from somewhere, and only later write the actual object, call the Objects Context method `allocateNewObjectID`. This one will allocate an object ID and return it to you. Make sure to write the actual object sometime. In this case you would pass the ID as a single argument to `startNewIndirectObject`.

## Primitives 

Basic objects are easy to write with the hummus module. The following lists the available methods for primitives:

* `writeName(inName)` - accepts a string and writes it as a PDF name (with initial '/')
* `writeLiteralString(inString/Array[bytes])` - accepts a string or an array of bytes and writes it as a literal string (with enclosing `(` and `)`). 
* `writeHexString(inString/Array[bytes])` - accepts a string or an array of bytes and writes it as a hex string (with enclosing `<` and `>`)
* `writeBoolean(inBoolean)` - accepts a boolean and writes it as a PDF boolean
* `writeKeyword(inKeyword)` - accepts a keyword (a PDF command. like `endobj`) and writes it. 
* `writeComment(inComment)` - accepts a string and writes it as a comment line
* `writeNumber(inNumber)` - accepts a number and write it
* `writeIndirectObjectReference(inObjectID,[inGenerationNumber])` - write an object reference to inObjectID. For a particular version reference use a second parameter passing the required generation number.

All but `writeKeyword` add a space after the primitive, so you can write multiples. `writeKeyword` is assumed to be used for commands, so hummus moves to the next line after them. If you wish to force a newline, call `endLine()`.

# Writing dictionaries

Most objects in the PDF world are formed off dictionaries. Dictionaries are key value pairs, where the key is a certain name primitive, and the object is anything, including a reference to another object. 

You start writing a dictionary by calling `var dict = objCxt.startDictionary()`.
The `startDictionary()` method creates a dictionary object, and writes the dictionary starter code to the PDF file. You can now add keys and values to it by either using the objects context command, or using the returned `DictionaryContext` object. This object has the following methods:

* `writeKey(inKey)` - write a key. you'll normally have pairs of things, the first being written with this method.
* `writeNameValue(inName)` - write a name value. as oppose to using the objects context method, it will move to the next line, rather than writing a space
* `writeRectangleValue(inLeft,inBottom,inRight,inTop)` - write an array of 4 numbers forming a rectangle. newline after it
* `writeLiteralStringValue(inString/Array[Bytes])` - write a literal string value. newline
* `writeBooleanValue(inBoolean)` - write a boolean value
* `writeObjectReferenceValue(inObjectID)` - write an object reference, pass ID. newline

You are very welcome to write dictionary objects not just with the Dictionary Context, but also with the Object Context. It's as valid. It's OK to also nest dictionaries.

End a dictionary with `objCxt.endDictionary(dict)`

# Writing arrays

you start writing an array by calling the object context `startArray()` method. The write as many objects as you want, and then `endArray()`. You can optionally provide a parameter to `endArray` noting what you would like to be done afterwords. Pass `hummus.eTokenSeparatorSpace` to write a space. Pass `hummus.eTokenSeparatorEndLine` to add a newline. Pass `hummus.eTokenSepratorNone` to do nothing.

# PDF Streams

Most of the really complex objects writing (like 3d objects, fonts etc.) require writing streams. No problem for Hummus.

To start writing a stream call `var streamCxt = objCxt.startPDFStream()`. The returned object is a PDF stream object (not to be confused with the other streams in hummus) that you can use for writing the stream data to.
This object has a single method called `getWriteStream()`, which returns a ByteWriter stream object. You can read about how to use streams in [Streams](./Streams.md) or just read here that it has a single method `write`, to which you can pass an array of byte values, in which case it'll write the bytes, encoding them to flate, or whatever it used for encoding, and return the number of elements of the array that it wrote (normally it'll write all of them, unless an error happens). You can also used the objects context to write commands and values, for cases like writing a content stream, or anything else that needs the same primitive writing caps as what PDF does. it will work perfectly.

To end stream writing call the object context `endPDFStream(inStream)`, passing the stream object that you received initially from `startPDFStream()`. The ending command will take care of writing the length key, so don't worry about it.

**Important** - Streams MUST always be written inside an indirect object definition. So make sure to call `startNewIndirectObject` (or when modifying, `startModifiedIndirectObject`), before starting the stream, and make sure you are clear of any object writing at the time. Also, `endPDFStream` will take care of ending the indirect object (mainly to write another object, the length), so DO NOT call `endIndirectObject` after calling `endPDFStream`. don't worry about it - the stream indirect will be ended internally.

Note that the stream will be encoded in flate, and the encoders will be written to the stream dictionary. If you are not happy about it, and want your own encoding, then call `startUnfilteredPDFStream` instead of `startPDFStream`. If you want all future streams to be non-compressed, call the objects context `setCompressStream(inCompress)`, with `false`. you can later call it again with `true`, to turn compression back on.

Now. 99% of the use cases would require that you write your own keys into the stream dictionary object. Easy. Start a dictionary, add keys and values to it and then call `startPDFStream` (or `startUnfilteredPDFStreams`) passing the dictionary as a parameter. Don't bother closing the dictionary - it will be taken care of - once the module writes its own require keys into the stream dictionary (length and the flate encoder).

# Oh I really need to do my own thing

If you are NOT happy with how hummus writes things, and you want to write directly to the stream, you can do that. Use the objects context `startFreeContext` like this - `var writeStream = objCxt.startFreeContext()`. It will return a `ByteWriterWithPosition` stream object that you can use (read about streams in [Streams](./Streams.md)). It has the same `write(inBytesArray)` method as `ByteWriter`, and also another method - `getCurrentPosition()` that returns the current byte position. Good luck :).
To finish a free writing context, call `objCxt.endFreeContext()`, to set control back to hummus.

# listening on events

The pdfWriter object has a member that is a plain NodeJS `EventsEmitter`. You can access it through `pdfWriter.getEvents()` method.

This object can now be used with `on` and `once` to setup handlers for events that `pdfWriter` emits. For example, you can listen on page writes with: 

`pdfWriter.getEvents().on('OnPageWrite',function(params){...})`

This event will be triggered near the end of the page write giving you the chance to add keys to the page dictionary (whatever pdfWriter does not handle. for example, in embedding scenarios the annotations are not handled).

All event handlers accept a single `params` object. This Object contain event particular objects that you can use for the sake of writing. Quite obvioulsy, the more global `objectsContext` and `documentContext` are available at all times via the `pdfWriter` object (i'm saying this cause you'll normally want to use the objects context to write objects).

The following provides a list of the available events and what their `params` contain.

## `OnPageWrite`

Called just before a page object dictionary is finished writing (after hummus wrote whatever it writes). This will be triggered in plain page writing cases, and also in PDF page embedding cases.

The params dict contains two members:

1. `page` - the `PDFPage` object. Use it for reading elements. not that changing properties on it won't help as all elements are already written.
2. `pageDictionaryContext` - the page dictionary context. With this one you can now add keys and elements to the page. That's why you are here for.


## `OnCatalogWrite`

Called just before the PDF writing is ended, as the Catalog object is written. You can use this event to add global elements such as an AcroForm or Intent elements, or PDF/VT elements or whatnot. Note that since this event is happening in the end of the page writing (triggered by `pdfWriter.end()` call) then any indirect objects that you want to refer from the catalog (like your precious AcroForm) should have already been written in advance.

The event `params` object has one element - `catalogDictionaryContext` - this is the dictionary context that you can use to add keys/elements to the catalog

__Important__. Catalog writing will always happen when creating a new PDF. However, when _modifying_ a PDF then unless new pages are written during modification, there will be NO catalog update as it is not required. However, you may still want a catalog write to add you own stuff. In this case use `pdfWriter.requireCatalogUpdate()`. This will let PDFWriter know that whether or not required, you want it to run the catalog write, so you can safely get a trigger of this event.

## `OnResourcesWrite`

Called when writing page resources dictionary. Just before its ended. Can be used to extend the types of resources that are being written. But you might want to check the regular usage of `ResourcesDictionary`. Might prove simpler.

The event `params` object has these two elements:

1. `resources` - the `ResourcesDictionary` object. Not much use. If i'll ever add reading methods from PDFWriter you can see which resources types where written already. 
2. `pageResourcesDictionaryContext` - the page resources dictionary context. With this you can add new resources categories by adding more keys/objects

## `OnResourceWrite`

Called when writing a particular page resource dictionary (xobject forms, patterns etc.). Let's you add more references on top of what the library handles by itself.

The event `params` object has these two elements:

1. `resourceDictionaryName` - The resource category name, for the category being written. 
2. `resourceDictionary` - the resource dictionary context for this category. With this you can add new resources by adding more keys/objects.

# So I wrote this object, what can I do with it?

K. You would normally write an object and then want to tie it to one of the object that the library manages, like pages, the PDF catalog etc. 
For example, you can create an annotation object and then attach it to a page, by calling the PDFWriter like this:

```javascript
pdfWriter.registerAnnotationReferenceForNextPageWrite(inAnnotationID);
```

Passing annotation ID to this method will make sure that this annotation is attached to the next page that gets written (next time `pdfWriter.writePage(aPage)` is called).

In modification scenarios, you will be modifying existing objects, and adding new ones, and you can easily update references to newly created objects this way.

You can also listen to the PDFWriter events to tie objects to the pages and catalogs (and there's more options if i add more handlers for the PDFWriter C++ library events. but most of what you will need is the existing events).

# Example

The [modifying existing file](../tests/ModifyingExistingFileContent.js) sample script shows how to modify an existing content. In it, in `testAddingComments` there's a neat example showing how to add comments to existing pages. You can use the same method, with `registerAnnotationReferenceForNextPageWrite` to add comments for newly created pages as well. It shows how to use the objects context to implement comments.

You can check also this one [here](../appending-pages-with-comments) to see how to use the `OnPageWrite` event to extend the embedding capability to include the page annotations.
Good luck :)