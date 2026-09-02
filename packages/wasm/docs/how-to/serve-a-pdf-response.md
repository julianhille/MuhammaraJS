# Preview, Download, Or Upload A PDF

WebAssembly returns owned PDF bytes rather than writing to a Node HTTP response.
Convert the result to a `Blob` for a browser preview or download:

```javascript
import { createMuhammaraWasm } from "@muhammara/wasm";

var muhammara = await createMuhammaraWasm();
var writer = muhammara.createWriter();
writer.writePage(writer.createPage(0, 0, 595, 842));
var bytes = writer.end();

var blob = new Blob([bytes], { type: "application/pdf" });
var url = URL.createObjectURL(blob);
preview.src = url;
download.href = url;
download.download = "document.pdf";
```

Revoke the object URL before replacing it or when the page is discarded:

```javascript
URL.revokeObjectURL(url);
```

Upload the same bytes without converting them to a base64 string:

```javascript
await fetch("/documents", {
  method: "POST",
  headers: { "content-type": "application/pdf" },
  body: bytes,
});
```

Returning a PDF from a server remains a server-side responsibility. Use the
native package there if direct response streaming is required. See the
[interactive application](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/wasm/examples/browser/app.mjs)
for preview replacement and cleanup.
