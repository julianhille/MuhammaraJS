# API Reference

# Classes

<dl>
<dt><a href="#PDFRStreamForBuffer">PDFRStreamForBuffer</a></dt>
<dd><p>Browser-safe random-access equivalent of PDFRStreamForBuffer.</p>
</dd>
<dt><a href="#PDFWStreamForBuffer">PDFWStreamForBuffer</a></dt>
<dd><p>Browser-safe accumulating equivalent of PDFWStreamForBuffer.</p>
</dd>
<dt><a href="#ByteReader">ByteReader</a></dt>
<dd><p>Compatibility byte reader.</p>
</dd>
<dt><a href="#ByteReaderWithPosition">ByteReaderWithPosition</a></dt>
<dd><p>Compatibility positioned byte reader.</p>
</dd>
<dt><a href="#ByteWriter">ByteWriter</a></dt>
<dd><p>Compatibility byte writer.</p>
</dd>
<dt><a href="#ByteWriterWithPosition">ByteWriterWithPosition</a></dt>
<dd><p>Compatibility positioned byte writer.</p>
</dd>
<dt><a href="#Word">Word</a></dt>
<dd><p>A measurable text fragment used by Recipe layout.</p>
</dd>
<dt><a href="#Line">Line</a></dt>
<dd><p>A width-constrained collection of measurable text fragments.</p>
</dd>
<dt><a href="#Column">Column</a></dt>
<dd><p>A rectangular text column used by Recipe layout.</p>
</dd>
</dl>

# Members

<dl>
<dt><a href="#encoder">encoder</a></dt>
<dd><p>UTF-8 encoder shared by WASM byte utilities.</p>
</dd>
<dt><a href="#constants">constants</a></dt>
<dd><p>Native Muhammara constants exposed by the WASM bridge.</p>
</dd>
<dt><a href="#knownColors">knownColors</a></dt>
<dd><p>Built-in Recipe colors grouped by color space.</p>
</dd>
<dt><a href="#coordinateMethods">coordinateMethods</a></dt>
<dd><p>Recipe coordinate conversion methods.</p>
</dd>
<dt><a href="#mediumSizes">mediumSizes</a></dt>
<dd><p>Standard page sizes in PDF points.</p>
</dd>
</dl>

# Functions

<dl>
<dt><a href="#createRuntime">createRuntime()</a></dt>
<dd><p>Loads the Muhammara WebAssembly module and its byte-first PDF API.</p>
</dd>
<dt><a href="#createMuhammaraWasm">createMuhammaraWasm([options])</a> ⇒ <code>Promise.&lt;object&gt;</code></dt>
<dd><p>Loads the browser-safe Muhammara API for reading, creating, modifying, and
composing PDFs entirely from bytes.</p>
</dd>
<dt><a href="#createRecipe">createRecipe([options])</a> ⇒ <code>Promise.&lt;function()&gt;</code></dt>
<dd><p>Loads the browser-native Recipe constructor. Inputs and outputs are bytes,
not Node paths or streams; callers register fonts and other assets as bytes.</p>
</dd>
<dt><a href="#normalizeBytes">normalizeBytes()</a></dt>
<dd><p>Normalizes supported synchronous byte inputs into an owned Uint8Array copy.</p>
</dd>
<dt><a href="#normalizeBytesAsync">normalizeBytesAsync()</a></dt>
<dd><p>Normalizes byte inputs, awaiting Blob and File data when necessary.</p>
</dd>
<dt><a href="#colorValue">colorValue()</a></dt>
<dd><p>Converts a named, hexadecimal, RGB, or numeric color to a 24-bit integer.</p>
</dd>
<dt><a href="#createCopyingHelpers">createCopyingHelpers()</a></dt>
<dd><p>Creates low-level helpers for copying objects between PDF documents.</p>
</dd>
<dt><a href="#createHelpers">createHelpers()</a></dt>
<dd><p>Creates memory-safe utility functions around a loaded WASM module.</p>
</dd>
<dt><a href="#createChildLifecycle">createChildLifecycle()</a></dt>
<dd><p>Creates a tracker that disposes owned child resources together.</p>
</dd>
<dt><a href="#createModifierFactory">createModifierFactory()</a></dt>
<dd><p>Creates a factory for low-level PDF modifiers.</p>
</dd>
<dt><a href="#createRawObjectsContext">createRawObjectsContext()</a></dt>
<dd><p>Creates a low-level context for writing raw PDF objects.</p>
</dd>
<dt><a href="#createReaderFactory">createReaderFactory()</a></dt>
<dd><p>Creates a factory for low-level PDF readers.</p>
</dd>
<dt><a href="#createRecipeFactory">createRecipeFactory()</a></dt>
<dd><p>Creates the high-level Recipe PDF composition factory.</p>
</dd>
<dt><a href="#createAnnotationMethods">createAnnotationMethods()</a></dt>
<dd><p>Creates Recipe annotation methods.</p>
</dd>
<dt><a href="#colorModel">colorModel()</a></dt>
<dd><p>Resolves a Recipe color value to a native color-space model.</p>
</dd>
<dt><a href="#createColorMethods">createColorMethods()</a></dt>
<dd><p>Creates Recipe color registration methods.</p>
</dd>
<dt><a href="#createCompositionMethods">createCompositionMethods()</a></dt>
<dd><p>Creates Recipe methods for composing registered PDF files.</p>
</dd>
<dt><a href="#createEndPDF">createEndPDF()</a></dt>
<dd><p>Creates Recipe&#39;s endPDF implementation, including deferred page insertions.</p>
</dd>
<dt><a href="#createSplitPdf">createSplitPdf()</a></dt>
<dd><p>Creates a function that splits a registered PDF into one-page outputs.</p>
</dd>
<dt><a href="#createStructure">createStructure()</a></dt>
<dd><p>Creates a function that reports basic structure for the finished PDF.</p>
</dd>
<dt><a href="#endPDF">endPDF()</a></dt>
<dd><p>Finalizes a Recipe and returns its cached PDF bytes on subsequent calls.</p>
</dd>
<dt><a href="#registerFont">registerFont()</a> ⇒ <code>string</code> | <code>undefined</code></dt>
<dd><p>Registers a font path for a family and style.</p>
</dd>
<dt><a href="#getFont">getFont()</a></dt>
<dd><p>Resolves the best registered font path for the requested style.</p>
</dd>
<dt><a href="#htmlToTextObjects">htmlToTextObjects()</a></dt>
<dd><p>Converts supported HTML into styled Recipe text objects.</p>
</dd>
<dt><a href="#createImageMethods">createImageMethods()</a></dt>
<dd><p>Creates Recipe image placement methods.</p>
</dd>
<dt><a href="#createInfoMethods">createInfoMethods()</a></dt>
<dd><p>Creates Recipe document-information methods.</p>
</dd>
<dt><a href="#createInspectPdf">createInspectPdf()</a></dt>
<dd><p>Creates a function that inspects a registered PDF&#39;s metadata and pages.</p>
</dd>
<dt><a href="#pageRecord">pageRecord()</a></dt>
<dd><p>Creates normalized Recipe metadata for a PDF page.</p>
</dd>
<dt><a href="#createPageMethods">createPageMethods()</a></dt>
<dd><p>Creates Recipe page creation, inspection, and editing methods.</p>
</dd>
<dt><a href="#getCurrentPageInfo">getCurrentPageInfo()</a></dt>
<dd><p>Returns Recipe&#39;s page geometry for the active page, unlike getPageInfo().</p>
</dd>
<dt><a href="#updateMediaBox">updateMediaBox()</a></dt>
<dd><p>Updates the active Recipe page metadata after changing its media box.</p>
</dd>
<dt><a href="#recipeVersion">recipeVersion()</a></dt>
<dd><p>Normalizes a Recipe PDF version to a supported native version number.</p>
</dd>
<dt><a href="#initializeRecipe">initializeRecipe()</a></dt>
<dd><p>Initializes mutable state for a newly created Recipe instance.</p>
</dd>
<dt><a href="#createRegistrationMethods">createRegistrationMethods()</a></dt>
<dd><p>Creates Recipe asset registration and removal methods.</p>
</dd>
<dt><a href="#permission">permission()</a></dt>
<dd><p>Converts comma-separated PDF permission names to a bitmask.</p>
</dd>
<dt><a href="#createSecurityMethods">createSecurityMethods()</a></dt>
<dd><p>Creates Recipe security methods, including unsupported-operation reporting.</p>
</dd>
<dt><a href="#createShapeMethods">createShapeMethods()</a></dt>
<dd><p>Creates Recipe methods for geometric shapes.</p>
</dd>
<dt><a href="#createTableMethods">createTableMethods()</a></dt>
<dd><p>Creates Recipe table layout methods.</p>
</dd>
<dt><a href="#charSpacing">charSpacing()</a></dt>
<dd><p>Calculates total character spacing for non-whitespace text.</p>
</dd>
<dt><a href="#createTextMethods">createTextMethods()</a></dt>
<dd><p>Creates Recipe text measurement, layout, and drawing methods.</p>
</dd>
<dt><a href="#createLineMethods">createLineMethods()</a></dt>
<dd><p>Creates Recipe line and path methods.</p>
</dd>
<dt><a href="#createPolygonMethods">createPolygonMethods()</a></dt>
<dd><p>Creates Recipe polygon drawing methods.</p>
</dd>
<dt><a href="#createVectorHelpers">createVectorHelpers()</a></dt>
<dd><p>Creates shared Recipe vector drawing helpers.</p>
</dd>
<dt><a href="#createVectorMethods">createVectorMethods()</a></dt>
<dd><p>Creates Recipe vector shape and path methods.</p>
</dd>
<dt><a href="#createValueTypes">createValueTypes()</a></dt>
<dd><p>Creates PDF value encoders and constructors backed by the WASM module.</p>
</dd>
<dt><a href="#createWriterToModifyFactory">createWriterToModifyFactory()</a></dt>
<dd><p>Creates a factory for writers that modify an existing PDF.</p>
</dd>
<dt><a href="#createWriterSupport">createWriterSupport()</a></dt>
<dd><p>Creates shared support functions used by low-level PDF writers.</p>
</dd>
<dt><a href="#createWriterFactory">createWriterFactory()</a></dt>
<dd><p>Creates the low-level PDF writer factory.</p>
</dd>
</dl>

<a name="ByteReader"></a>

# ByteReader

Compatibility byte reader.

**Kind**: global class

---

<a name="ByteReaderWithPosition"></a>

# ByteReaderWithPosition

Compatibility positioned byte reader.

**Kind**: global class

---

<a name="ByteWriter"></a>

# ByteWriter

Compatibility byte writer.

**Kind**: global class

---

<a name="ByteWriterWithPosition"></a>

# ByteWriterWithPosition

Compatibility positioned byte writer.

**Kind**: global class

---

<a name="encoder"></a>

# encoder

UTF-8 encoder shared by WASM byte utilities.

**Kind**: global variable

---

<a name="constants"></a>

# constants

Native Muhammara constants exposed by the WASM bridge.

**Kind**: global variable

---

<a name="knownColors"></a>

# knownColors

Built-in Recipe colors grouped by color space.

**Kind**: global variable

---

<a name="coordinateMethods"></a>

# coordinateMethods

Recipe coordinate conversion methods.

**Kind**: global variable

---

<a name="coordinateMethods._calibrateCoordinate"></a>

## coordinateMethods.\_calibrateCoordinate() ⇒ <code>Object</code>

Converts top-left Recipe coordinates to bottom-left PDF coordinates.

**Kind**: static method of [<code>coordinateMethods</code>](#coordinateMethods)
**Returns**: <code>Object</code> - Coordinates with the Y axis flipped.
**Throws**:

- <code>Error</code> When no target page is available.

---

<a name="mediumSizes"></a>

# mediumSizes

Standard page sizes in PDF points.

**Kind**: global variable

---

<a name="createRuntime"></a>

# createRuntime()

Loads the Muhammara WebAssembly module and its byte-first PDF API.

**Kind**: global function

---

<a name="createMuhammaraWasm"></a>

# createMuhammaraWasm([options]) ⇒ <code>Promise.&lt;object&gt;</code>

Loads the browser-safe Muhammara API for reading, creating, modifying, and
composing PDFs entirely from bytes.

**Kind**: global function
**Returns**: <code>Promise.&lt;object&gt;</code> - The initialized Muhammara API.
**Params**

- [options] <code>object</code> - Emscripten module options and optional byte limits.
  - [.limits] <code>object</code> - Limits for individual inputs and outputs.
    - [.maxInputBytes] <code>number</code> <code> = 268435456</code> - Maximum input size.
    - [.maxOutputBytes] <code>number</code> <code> = 268435456</code> - Maximum output size.

---

<a name="createRecipe"></a>

# createRecipe([options]) ⇒ <code>Promise.&lt;function()&gt;</code>

Loads the browser-native Recipe constructor. Inputs and outputs are bytes,
not Node paths or streams; callers register fonts and other assets as bytes.

**Kind**: global function
**Returns**: <code>Promise.&lt;function()&gt;</code> - The initialized Recipe constructor.
**Params**

- [options] <code>object</code> - Emscripten module options and optional byte limits.

---

<a name="normalizeBytes"></a>

# normalizeBytes()

Normalizes supported synchronous byte inputs into an owned Uint8Array copy.

**Kind**: global function

---

<a name="normalizeBytesAsync"></a>

# normalizeBytesAsync()

Normalizes byte inputs, awaiting Blob and File data when necessary.

**Kind**: global function

---

<a name="colorValue"></a>

# colorValue()

Converts a named, hexadecimal, RGB, or numeric color to a 24-bit integer.

**Kind**: global function

---

<a name="createCopyingHelpers"></a>

# createCopyingHelpers()

Creates low-level helpers for copying objects between PDF documents.

**Kind**: global function

---

<a name="createHelpers"></a>

# createHelpers()

Creates memory-safe utility functions around a loaded WASM module.

**Kind**: global function

---

<a name="createHelpers..withTJItems"></a>

## createHelpers~withTJItems(items, callback) ⇒ <code>\*</code>

Marshals TJ items into temporary WASM buffers.

**Kind**: inner method of [<code>createHelpers</code>](#createHelpers)
**Returns**: <code>\*</code> - The callback result before all temporary buffers are freed.
**Params**

- items <code>Array</code> - Text strings, spacing numbers, or glyph lists.
- callback <code>function</code> - Receives pointers in fixed order: types, numbers,
  string offsets, strings, glyph offsets, glyphs, then their four counts.

---

<a name="createChildLifecycle"></a>

# createChildLifecycle()

Creates a tracker that disposes owned child resources together.

**Kind**: global function

---

<a name="createModifierFactory"></a>

# createModifierFactory()

Creates a factory for low-level PDF modifiers.

**Kind**: global function

---

<a name="createRawObjectsContext"></a>

# createRawObjectsContext()

Creates a low-level context for writing raw PDF objects.

**Kind**: global function

---

<a name="createReaderFactory"></a>

# createReaderFactory()

Creates a factory for low-level PDF readers.

**Kind**: global function

---

<a name="createReaderFactory..createReader"></a>

## createReaderFactory~createReader(bytes, readerHandle, requireOwner, copyingContext, destroyReader) ⇒ <code>object</code>

Opens PDF bytes or wraps an existing native reader handle.

**Kind**: inner method of [<code>createReaderFactory</code>](#createReaderFactory)
**Returns**: <code>object</code> - A reader whose `end()` releases owned resources.
**Params**

- bytes <code>Uint8Array</code> | <code>ArrayBuffer</code> - PDF bytes when creating a reader.
- readerHandle <code>number</code> - Existing native reader handle; ownership remains
  with its caller unless `destroyReader` is true.
- requireOwner <code>function</code> - Verifies the owner of a borrowed handle remains open.
- copyingContext <code>number</code> - Borrowed native copying context for source streams.
- destroyReader <code>boolean</code> <code> = true</code> - Whether `end()` destroys `readerHandle`.

---

<a name="createRecipeFactory"></a>

# createRecipeFactory()

Creates the high-level Recipe PDF composition factory.

**Kind**: global function

---

<a name="createAnnotationMethods"></a>

# createAnnotationMethods()

Creates Recipe annotation methods.

**Kind**: global function

---

<a name="colorModel"></a>

# colorModel()

Resolves a Recipe color value to a native color-space model.

**Kind**: global function

---

<a name="createColorMethods"></a>

# createColorMethods()

Creates Recipe color registration methods.

**Kind**: global function

---

<a name="createCompositionMethods"></a>

# createCompositionMethods()

Creates Recipe methods for composing registered PDF files.

**Kind**: global function

---

<a name="createEndPDF"></a>

# createEndPDF()

Creates Recipe's endPDF implementation, including deferred page insertions.

**Kind**: global function

---

<a name="createSplitPdf"></a>

# createSplitPdf()

Creates a function that splits a registered PDF into one-page outputs.

**Kind**: global function

---

<a name="createStructure"></a>

# createStructure()

Creates a function that reports basic structure for the finished PDF.

**Kind**: global function

---

<a name="endPDF"></a>

# endPDF()

Finalizes a Recipe and returns its cached PDF bytes on subsequent calls.

**Kind**: global function

---

<a name="registerFont"></a>

# registerFont() ⇒ <code>string</code> \| <code>undefined</code>

Registers a font path for a family and style.

**Kind**: global function
**Returns**: <code>string</code> \| <code>undefined</code> - The previously registered path. The caller owns
cleanup of that replaced path.

---

<a name="getFont"></a>

# getFont()

Resolves the best registered font path for the requested style.

**Kind**: global function

---

<a name="htmlToTextObjects"></a>

# htmlToTextObjects()

Converts supported HTML into styled Recipe text objects.

**Kind**: global function

---

<a name="createImageMethods"></a>

# createImageMethods()

Creates Recipe image placement methods.

**Kind**: global function

---

<a name="createInfoMethods"></a>

# createInfoMethods()

Creates Recipe document-information methods.

**Kind**: global function

---

<a name="createInspectPdf"></a>

# createInspectPdf()

Creates a function that inspects a registered PDF's metadata and pages.

**Kind**: global function

---

<a name="pageRecord"></a>

# pageRecord()

Creates normalized Recipe metadata for a PDF page.

**Kind**: global function

---

<a name="createPageMethods"></a>

# createPageMethods()

Creates Recipe page creation, inspection, and editing methods.

**Kind**: global function

---

<a name="getCurrentPageInfo"></a>

# getCurrentPageInfo()

Returns Recipe's page geometry for the active page, unlike getPageInfo().

**Kind**: global function

---

<a name="updateMediaBox"></a>

# updateMediaBox()

Updates the active Recipe page metadata after changing its media box.

**Kind**: global function

---

<a name="recipeVersion"></a>

# recipeVersion()

Normalizes a Recipe PDF version to a supported native version number.

**Kind**: global function

---

<a name="initializeRecipe"></a>

# initializeRecipe()

Initializes mutable state for a newly created Recipe instance.

**Kind**: global function

---

<a name="createRegistrationMethods"></a>

# createRegistrationMethods()

Creates Recipe asset registration and removal methods.

**Kind**: global function

---

<a name="permission"></a>

# permission()

Converts comma-separated PDF permission names to a bitmask.

**Kind**: global function

---

<a name="createSecurityMethods"></a>

# createSecurityMethods()

Creates Recipe security methods, including unsupported-operation reporting.

**Kind**: global function

---

<a name="createShapeMethods"></a>

# createShapeMethods()

Creates Recipe methods for geometric shapes.

**Kind**: global function

---

<a name="createTableMethods"></a>

# createTableMethods()

Creates Recipe table layout methods.

**Kind**: global function

---

<a name="charSpacing"></a>

# charSpacing()

Calculates total character spacing for non-whitespace text.

**Kind**: global function

---

<a name="createTextMethods"></a>

# createTextMethods()

Creates Recipe text measurement, layout, and drawing methods.

**Kind**: global function

---

<a name="createLineMethods"></a>

# createLineMethods()

Creates Recipe line and path methods.

**Kind**: global function

---

<a name="createPolygonMethods"></a>

# createPolygonMethods()

Creates Recipe polygon drawing methods.

**Kind**: global function

---

<a name="createVectorHelpers"></a>

# createVectorHelpers()

Creates shared Recipe vector drawing helpers.

**Kind**: global function

---

<a name="createVectorMethods"></a>

# createVectorMethods()

Creates Recipe vector shape and path methods.

**Kind**: global function

---

<a name="createValueTypes"></a>

# createValueTypes()

Creates PDF value encoders and constructors backed by the WASM module.

**Kind**: global function

---

<a name="createWriterToModifyFactory"></a>

# createWriterToModifyFactory()

Creates a factory for writers that modify an existing PDF.

**Kind**: global function

---

<a name="createWriterSupport"></a>

# createWriterSupport()

Creates shared support functions used by low-level PDF writers.

**Kind**: global function

---

<a name="createWriterFactory"></a>

# createWriterFactory()

Creates the low-level PDF writer factory.

**Kind**: global function

---
