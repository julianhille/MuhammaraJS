The PDFHummus c++ library, and so also The Hummus NodeJS PDF module include a lot work around custom streams. Hummus allows input and output from and to custom streams that you can implement, for any purpose that you have in mind.

This is kind of good, because the native file usage of PDFHummus, is the regular OS files usage with some buffering and decent decoding...but still it's not the nodeJS nice non-blocking IO. Where makes sense (especially with writing...not so with reading), implementing custom streams can help resolve this problem. But not just. You may have various sources for images that are not in files (say...in the DB), or your target may not necessarily be a PDF file, but rather the response object, as is shown in [[How to serve dynamically created pdf]].

This section describes how to create custom streams. For writing to, and then for reading from.

# Writing streams

The Hummus.createWriter method can receive a custom stream object instead of a file path. This stream object is simply...and object, that should implement these two functions:

```javascript
write(inArrayOfBytes)
getCurrentPosition()
```

The `write` function should write the byte in the input array of bytes. It should return the number of bytes written out of the array. Since hummus does not repeat itself, for performance reasons, the number of written bytes better be equal to the length of the array. alright?!

The `getCurrentPosition()` function should return the current writing position. If you've been good kids, it's ok to simply sum up the number of bytes written from all the `write` calls so far, and you should be fine.

To see an example implementation see what i did for the response stream [here](../PDFStreamForResponse.js).


# Reading streams

You can use read streams in various functionalities around the module, mainly when importing PDF, JPG or TIFF images. Now...unfortunately these usages require that:
1. They get random access
2. They have the full stream available once you call the relevant hummus method. sync usage that is.

So simple getting of images from a request object won't do, probably.

Still, if you want to use this, just pass an object that has the following functions:
* `read(inAmount)`, returns an array of bytes read from the current position in the stream, that contains up to inAmount bytes.
* `notEnded()`, returns a boolean specifying whether the stream is finished or not.
* `setPosition(inPosition)`, set the read cursor position to the input position, from the start of the stream
* `setPositionFromEnd(inPosition)`, set the read cursor position to the input position, from the end of the stream
* `skip(inAmount)`, skip inAmount number of bytes.
* `getCurrentPosition()`, get the current read position in the stream.


# Available streams

Hummus has ready implementations of the custom streams interface. There are objects that are constructed per the specific scenario and can be passed as streams:

- `hummus.PDFStreamForResponse` - a write stream that can write to an http response object. Its constructor accepts a response object and later pdf writing actions are done directly on the stream. Note that you should set up the headers yourself and call `end` on the response object. Like this:

````javascript
    res.writeHead(200, {'Content-Type': 'application/pdf'});
    
    var pdfWriter = hummus.createWriter(new hummus.PDFStreamForResponse(res));
    /** use pdfwriter to write pdf content **/

    res.end();
````

**IMPORTANT!** since the impelemntation of `hummus.PDFStreamForResponse` uses the basic `Stream.writable` methods, you can actually use it with ANY `writable`, not just the response stream.

- `hummus.PDFRStreamForFile` - a read stream for a file. Its constructor receives a file path, and once create can be passed as a read stream.

- `hummus.PDFWStreamForFile` - a write stream for a file. Its constructor receives a file path, and once create can be passed as a write stream.