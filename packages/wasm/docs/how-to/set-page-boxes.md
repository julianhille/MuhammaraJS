# Set Page Boxes

Set page boxes before writing a new page. Every box is `[left, bottom, right,
top]` in low-level PDF coordinates.

```javascript
import { createMuhammaraWasm } from "@muhammara/wasm";

var muhammara = await createMuhammaraWasm();
var writer = muhammara.createWriter();
var page = writer.createPage(0, 0, 595, 842);

page.cropBox = [18, 18, 577, 824];
page.bleedBox = [0, 0, 595, 842];
page.trimBox = [18, 18, 577, 824];
page.artBox = [36, 36, 559, 806];

writer.writePage(page);
var outputBytes = writer.end();
```

The constructor or `createPage()` establishes `mediaBox`; it can also be
assigned explicitly. Unset optional boxes are `undefined`. This workflow covers
new pages. Replacing boxes on an existing page while preserving all annotations
requires separate application-level verification.
