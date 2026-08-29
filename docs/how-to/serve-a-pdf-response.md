# Serve A PDF Response

`PDFStreamForResponse` lets a PDF writer target an HTTP response. Set headers
before writing, finish the PDF writer, then end the response.

```javascript
var muhammara = require("muhammara");

res.writeHead(200, { "Content-Type": "application/pdf" });
var writer = muhammara.createWriter(new muhammara.PDFStreamForResponse(res));
var page = writer.createPage(0, 0, 595, 842);
writer.writePage(page);
writer.end();
res.end();
```

The response framework is your choice; this example does not require Express.
`PDFStreamForResponse` writes directly to the supplied response and does not
implement Node stream backpressure handling. The implementation and an Express
sample are in `lib/PDFStreamForResponse.js` and `samples/PDFServer.js`.
