The hummus module may return at times stream objects, for you to either read from, or write to.
For instance, you may want to be able to manipulate the target PDF stream directly. In that case you can receive the output stream for writing. The parser provides a simple method to read content streams. All of these streams are coming from 4 types of stream objects that will be described here. The type of the stream will be provided as info where it is described that a stream is returned.

# ByteReader

The simplest reader stream is the byte reader. It has two supported methods that you can call:

* `read(inAmount)` - read up to the input number of bytes and return an array containing the read bytes.
* `notEnded()` - returns a boolean specifying whether the stream has more to read or not

so basically reading should look something like this:

```javascript
while(aStream.notEnded())
{
   var myBytes = aStream.read(myByteCount);
   // do something with the returned array of bytes
}
```

# ByteReaderWithPosition

`ByteReaderWithPosition` stream has the same methods as `ByteReader` and adds on top of them some random access capabilities:

* `setPosition(inPosition)` - set the current read position to the input number
* `setPositionFromEnd(inPosition)` - set the current read position from the end according to the input number. The new position will be the end position minus inPosition.
* `skip(inAmount)` - skip the inAmount number of bytes from the current position
* `getCurrentPosition()` - get the current read position


# ByteWriter

The `ByteWriter` is a simple writer stream. It has a single method:

* `write(inBytesArray)` - write the input array of bytes to the stream, return the number of bytes written from the input array

# ByteWriterWithPosition

The `ByteWriterWithPosition` streams has the `write` method of `ByteWriter`, and another method:

* `getCurrentPosition()` - gets the current write position of the stream

