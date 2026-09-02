<a name="Recipe"></a>

# Recipe

**Kind**: global class

- [Recipe](#Recipe)
  - [new Recipe(src, [output], [options])](#new_Recipe_new)
  - _instance_
    - [.read([inSrc])](#Recipe+read) ⇒ <code>Object</code>
    - [.endPDF([callback])](#Recipe+endPDF) ⇒ <code>\*</code>
    - [.register(key, [callback])](#Recipe+register) ⇒ <code>void</code>
  - _static_
    - `.Word`
      - [new Word(word, pathOptions)](#new_recipe-Word_new)
    - `.Line`
      - [new Line(width, height, size, pathOptions)](#new_recipe-Line_new)
    - `.Column`
      - [new Column(x, y, width, height, [text], [field], [options])](#new_recipe-Column_new)
    - `.comment([text], x, y, [options])` ⇒ [<code>Recipe</code>](#Recipe)
    - `.annot(x, y, subtype, [options])` ⇒ [<code>Recipe</code>](#Recipe)
    - `.appendPage(pdfSrc, [pages])` ⇒ [<code>Recipe</code>](#Recipe)
    - `.chroma(name, value, [colorspace])` ⇒ [<code>Recipe</code>](#Recipe)
    - `.permission([flags])` ⇒ <code>number</code>
    - `.encrypt([options])` ⇒ [<code>Recipe</code>](#Recipe)
    - `.registerFont([fontName], [fontSrcPath], [type])` ⇒ [<code>Recipe</code>](#Recipe)
    - `.htmlToTextObjects(htmlCodes, [options])` ⇒ <code>Array.&lt;Object&gt;</code>
    - `.image(imgSrc, x, y, [options])` ⇒ [<code>Recipe</code>](#Recipe)
    - `.info([options])` ⇒ <code>Object</code> \| [<code>Recipe</code>](#Recipe)
    - `.custom([key], [value])` ⇒ [<code>Recipe</code>](#Recipe)
    - `.structure(output)` ⇒ [<code>Recipe</code>](#Recipe)
    - `.insertPage(afterPageNumber, pdfSrc, srcPageNumber)` ⇒ [<code>Recipe</code>](#Recipe)
    - `.overlay(pdfSrc, [x], [y], [options])` ⇒ [<code>Recipe</code>](#Recipe)
    - `.createPage([pageWidth], [pageHeight], [margins])` ⇒ [<code>Recipe</code>](#Recipe)
    - `.endPage()` ⇒ [<code>Recipe</code>](#Recipe)
    - `.editPage(pageNumber)` ⇒ [<code>Recipe</code>](#Recipe)
    - `.pageInfo(pageNumber)` ⇒ <code>Object</code>
    - `.pauseContext()` ⇒ <code>void</code>
    - `.resumeContext()` ⇒ <code>void</code>
    - `.getPageInfo()` ⇒ <code>Object</code>
    - `.margins([left], [right], [top], [bottom])` ⇒ <code>object</code>
    - `.n_gon(cx, cy, radius, [sides], [options])` ⇒ [<code>Recipe</code>](#Recipe)
    - `.star(cx, cy, radius, [points], [options])` ⇒ [<code>Recipe</code>](#Recipe)
    - `.triangle(x, y, traits, [options])` ⇒ [<code>Recipe</code>](#Recipe)
    - `.arrow(x, y, [options])` ⇒ [<code>Recipe</code>](#Recipe)
    - `.split([outputDir], [prefix])` ⇒ [<code>Recipe</code>](#Recipe)
    - `.table(x, y, contents, [options])` ⇒ [<code>Recipe</code>](#Recipe)
    - `.textDimensions(text, [options])` ⇒ <code>Object</code>
    - `.text([text], x, y, [options])` ⇒ [<code>Recipe</code>](#Recipe)
    - `.movedown([lines], [returnCoords])` ⇒ <code>Object</code> \| <code>Array.&lt;number&gt;</code>
    - `.layout(id, x, y, width, height, [options])` ⇒ [<code>Recipe</code>](#Recipe)
    - `.moveTo(x, y)` ⇒ [<code>Recipe</code>](#Recipe)
    - `.lineTo(x, y, [options])` ⇒ [<code>Recipe</code>](#Recipe)
    - `.line(coordinates, [options])` ⇒ [<code>Recipe</code>](#Recipe)
    - `.polygon(coordinates, [options])` ⇒ [<code>Recipe</code>](#Recipe)
    - `.circle(x, y, radius, [options])` ⇒ [<code>Recipe</code>](#Recipe)
    - `.rectangle(x, y, width, height, [options])` ⇒ [<code>Recipe</code>](#Recipe)
    - `.ellipse(cx, cy, rx, ry, [options])` ⇒ [<code>Recipe</code>](#Recipe)
    - `.arc(x, y, radius, [startAngle], [endAngle], [options])` ⇒ [<code>Recipe</code>](#Recipe)
    - `.lineWidth(width)` ⇒ [<code>Recipe</code>](#Recipe)
    - `.fillOpacity(opacity)` ⇒ [<code>Recipe</code>](#Recipe)
    - `.fill([color])` ⇒ [<code>Recipe</code>](#Recipe)
    - `.stroke([color])` ⇒ [<code>Recipe</code>](#Recipe)
    - `.fillAndStroke()` ⇒ [<code>Recipe</code>](#Recipe)

---

<a name="new_Recipe_new"></a>

## new Recipe(src, [output], [options])

Create a pdfDoc

**Params**

- src <code>string</code> | <code>Buffer</code> - The file path or Buffer of the source file.
- [output] <code>string</code> - The path of the output file uses src if its not a buffer.
- [options] <code>Object</code> - The options for pdfDoc
  - [.version] <code>number</code> - The pdf version
  - [.author] <code>string</code> - The author
  - [.title] <code>string</code> - The title
  - [.subject] <code>string</code> - The subject
  - [.colorspace] <code>string</code> - The default colorspace: rgb, cmyk, gray
  - [.keywords] <code>Array.&lt;string&gt;</code> - The array of keywords
  - [.password] <code>string</code> - permission password
  - [.userPassword] <code>string</code> - this 'view' password also enables encryption
  - [.ownerPassword] <code>string</code> - this allows owner to 'edit' file
  - [.userProtectionFlag] <code>string</code> - encryption security level (see permissions)
  - [.fontSrcPath] <code>string</code> | <code>Array.&lt;string&gt;</code> - directory location(s) of additional fonts

---

<a name="Recipe+read"></a>

## recipe.read([inSrc]) ⇒ <code>Object</code>

Read PDF metadata.

**Kind**: instance method of [<code>Recipe</code>](#Recipe)
**Returns**: <code>Object</code> - The PDF metadata.
**Throws**:

- <code>Error</code> If the PDF cannot be read.

**Params**

- [inSrc] <code>string</code> | <code>Buffer</code> - An optional PDF source to read instead of the recipe source.

---

<a name="Recipe+endPDF"></a>

## recipe.endPDF([callback]) ⇒ <code>\*</code>

End the pdfDoc

**Kind**: instance method of [<code>Recipe</code>](#Recipe)
**Returns**: <code>\*</code> - The callback result, if a callback is provided.
**Params**

- [callback] <code>function</code> - The callback function.

---

<a name="Recipe+register"></a>

## recipe.register(key, [callback]) ⇒ <code>void</code>

Register a callback procedure with MuhammaraJS.

**Kind**: instance method of [<code>Recipe</code>](#Recipe)
**Throws**:

- <code>Error</code> If the callback function is unnamed when no key is provided.
- <code>Error</code> If the key conflicts with an existing Recipe prototype member.
- <code>Error</code> If the callback is not a function.

**Params**

- key <code>string</code> | <code>function</code> - Name assigned to the callback. When a named function is
  registered, and its given name is what is to be used to access it, the key is unnecessary.
- [callback] <code>function</code> - Callback procedure that can be accessed through MuhammaraJS.

---

<a name="recipe-Word"></a>

## recipe-Word

**Kind**: static class of [<code>Recipe</code>](#Recipe)

---

<a name="new_recipe-Word_new"></a>

### new Word(word, pathOptions)

A word used by Recipe text layout.

**Params**

- word <code>string</code> - The word value.
- pathOptions <code>Object</code> - The resolved text options.

---

<a name="recipe-Line"></a>

## recipe-Line

**Kind**: static class of [<code>Recipe</code>](#Recipe)

---

<a name="new_recipe-Line_new"></a>

### new Line(width, height, size, pathOptions)

A line used by Recipe text layout.

**Params**

- width <code>number</code> - The line width.
- height <code>number</code> - The line height.
- size <code>number</code> - The font size.
- pathOptions <code>Object</code> - The resolved text options.

---

<a name="recipe-Column"></a>

## recipe-Column

**Kind**: static class of [<code>Recipe</code>](#Recipe)

---

<a name="new_recipe-Column_new"></a>

### new Column(x, y, width, height, [text], [field], [options])

A column used by Recipe text layouts.

**Params**

- x <code>number</code> - The x coordinate.
- y <code>number</code> - The y coordinate.
- width <code>number</code> - The column width.
- height <code>number</code> - The column height.
- [text] <code>string</code> <code> = &quot;&#x27;&#x27;&quot;</code> - The column heading.
- [field] <code>string</code> <code> = &quot;&#x27;&#x27;&quot;</code> - The associated data field.
- [options] <code>Object</code> - The column options.

---

<a name="recipe-comment"></a>

## recipe-comment([text], x, y, [options]) ⇒ [<code>Recipe</code>](#Recipe)

Create a comment annotation

**Kind**: static method of [<code>Recipe</code>](#Recipe)
**Returns**: [<code>Recipe</code>](#Recipe) - The recipe instance.
**Params**

- [text] <code>string</code> <code> = &quot;&#x27;&#x27;&quot;</code> - The text content
- x <code>number</code> - The coordinate x
- y <code>number</code> - The coordinate y
- [options] <code>Object</code> - The options
  - [.title] <code>string</code> - The title.
  - [.date] <code>string</code> - The date.
  - [.open] <code>boolean</code> <code> = false</code> - Open the annotation by default?
  - [.richText] <code>boolean</code> - Display with rich text format, text will be transformed automatically, or you may pass in your own rich text starts with "<?xml..."
  - [.flag] <code>&#x27;invisible&#x27;</code> | <code>&#x27;hidden&#x27;</code> | <code>&#x27;print&#x27;</code> | <code>&#x27;nozoom&#x27;</code> | <code>&#x27;norotate&#x27;</code> | <code>&#x27;noview&#x27;</code> | <code>&#x27;readonly&#x27;</code> | <code>&#x27;locked&#x27;</code> | <code>&#x27;togglenoview&#x27;</code> - The flag property

---

<a name="recipe-annot"></a>

## recipe-annot(x, y, subtype, [options]) ⇒ [<code>Recipe</code>](#Recipe)

Create an annotation

**Kind**: static method of [<code>Recipe</code>](#Recipe)
**Returns**: [<code>Recipe</code>](#Recipe) - The recipe instance.
**Todo**

- [ ] support for rich text RC
- [ ] support for opacity CA

**Params**

- x <code>number</code> - The coordinate x
- y <code>number</code> - The coordinate y
- subtype <code>string</code> - The markup annotation type 'Text'|'Link'|'FreeText'|'Line'|'Square'|'Circle'|'Polygon'|'PolyLine'|'Highlight'|'Underline'|'Squiggly'|'StrikeOut'|'Caret'|'Stamp'|'Ink'|'Popup'|'FileAttachment'|'Sound'|'Movie'|'Screen'|'Widget'|'PrinterMark'|'TrapNet'|'Watermark'|'3D'|'Redact'|'Projection'|'RichMedia'
- [options] <code>Object</code> - The options
  - [.text] <code>string</code> <code> = &quot;&#x27;&#x27;&quot;</code> - The annotation content.
  - [.title] <code>string</code> - The title.
  - [.open] <code>boolean</code> <code> = false</code> - Open the annotation. Annotation will be closed by default. Specific to text annotations; subtype='Text'
  - [.richText] <code>boolean</code> - Rich text
  - [.flag] <code>&#x27;invisible&#x27;</code> | <code>&#x27;hidden&#x27;</code> | <code>&#x27;print&#x27;</code> | <code>&#x27;nozoom&#x27;</code> | <code>&#x27;norotate&#x27;</code> | <code>&#x27;noview&#x27;</code> | <code>&#x27;readonly&#x27;</code> | <code>&#x27;locked&#x27;</code> | <code>&#x27;togglenoview&#x27;</code> - The flag property
  - [.icon] <code>&#x27;Comment&#x27;</code> | <code>&#x27;Key&#x27;</code> | <code>&#x27;Note&#x27;</code> | <code>&#x27;Help&#x27;</code> | <code>&#x27;NewParagraph&#x27;</code> | <code>&#x27;Paragraph&#x27;</code> | <code>&#x27;Insert&#x27;</code> <code> = &#x27;Note&#x27;</code> - The icon of annotation. Specific to text annotations. Default value: 'Note'
  - [.width] <code>number</code> - Width
  - [.height] <code>number</code> - Height
  - [.date] <code>string</code> - Date of annotation
  - [.subject] <code>string</code> - The subject.
  - [.replies] <code>Array</code> - Array of annotation replies
  - [.border] <code>number</code> - The border width.
  - [.color] <code>string</code> | <code>Array.&lt;number&gt;</code> - The annotation color.
  - [.followOriginalPageRotation] <code>boolean</code> <code> = false</code> - Preserve the original page rotation when positioning the annotation.

---

<a name="recipe-appendPage"></a>

## recipe-appendPage(pdfSrc, [pages]) ⇒ [<code>Recipe</code>](#Recipe)

Append pages from the other pdf to the current pdf

**Kind**: static method of [<code>Recipe</code>](#Recipe)
**Returns**: [<code>Recipe</code>](#Recipe) - The recipe instance.
**Params**

- pdfSrc <code>string</code> - The path for the other pdf.
- [pages] <code>number</code> | <code>Array.&lt;number&gt;</code> <code> = []</code> - The page number or array of page numbers to append. Omitting it appends all pages.

---

<a name="recipe-chroma"></a>

## recipe-chroma(name, value, [colorspace]) ⇒ [<code>Recipe</code>](#Recipe)

Associate color values to names

The colorspace parameter is optional. When it is missing, the colorspace
is automatically determined by the given color value. Note that the special
PDF color space called 'separation' may also be used. The color value is then
treated as the alternative color when the named 'separation' color is unavailable.

If the 'name' parameter is '!load', the second parameter is the name of a JSON
formatted file containing a formatted list of defined colors associated with the
color spaces rgb, cmyk, gray, or separation (think PANTONE color definitions).
This file will be merged with existing set of known colors. The color values
must be specified as hex values.

For example,
{
'rgb': {'purple':'ff00ff', 'red':'#ff0000'},
'cmyk': {'cyan':'ff000000', 'magenta':'%0,100,0,0'},
'gray': {'grey':'#33'}
}

**Kind**: static method of [<code>Recipe</code>](#Recipe)
**Returns**: [<code>Recipe</code>](#Recipe) - The recipe instance.
**Throws**:

- <code>Error</code> If a loaded color definition has an unrecognized colorspace.
- <code>Error</code> If a color value has an invalid size.
- <code>Error</code> If the colorspace is unknown.

**Params**

- name <code>string</code> - the name to be associated to given color value, or '!load'
- value <code>string</code> | <code>Array.&lt;number&gt;</code> - the color value (HexColor, DecimalColor, or PercentColor), or name of '!load' file
- [colorspace] <code>string</code> <code> = &quot;&#x27;&#x27;&quot;</code> - One of: 'rgb', 'cmyk', 'gray', 'separation'.

---

<a name="recipe-permission"></a>

## recipe-permission([flags]) ⇒ <code>number</code>

Encryption user access permissions

This function supplies the numeric value for the encrypt function's 'userProtectionFlag'
option. When no argument is given, the default 'print' value is used.

**Kind**: static method of [<code>Recipe</code>](#Recipe)
**Returns**: <code>number</code> - The numeric user protection flag.
**Params**

- [flags] <code>string</code> <code> = &quot;&#x27;print&#x27;&quot;</code> - From the list print, modify, copy, edit, fillform, extract, assemble, and printbest.
  More than one may be specified by using a comma to separate the names in the input string.

---

<a name="recipe-encrypt"></a>

## recipe-encrypt([options]) ⇒ [<code>Recipe</code>](#Recipe)

Encrypt the pdf

**Kind**: static method of [<code>Recipe</code>](#Recipe)
**Returns**: [<code>Recipe</code>](#Recipe) - The recipe instance.
**Params**

- [options] <code>Object</code> - The options
  - [.password] <code>string</code> - The permission password.
  - [.ownerPassword] <code>string</code> - The password for editing.
  - [.userPassword] <code>string</code> - The password for viewing & encryption.
  - [.userProtectionFlag] <code>number</code> - The flag for the security level.

---

<a name="recipe-registerFont"></a>

## recipe-registerFont([fontName], [fontSrcPath], [type]) ⇒ [<code>Recipe</code>](#Recipe)

Register a custom font

**Kind**: static method of [<code>Recipe</code>](#Recipe)
**Returns**: [<code>Recipe</code>](#Recipe) - The recipe instance.
**Params**

- [fontName] <code>string</code> <code> = &quot;&#x27;&#x27;&quot;</code> - The font name used in text.
- [fontSrcPath] <code>string</code> <code> = &quot;&#x27;&#x27;&quot;</code> - The path to the font file.
- [type] <code>string</code> <code> = &quot;&#x27;regular&#x27;&quot;</code> - The font type, one of 'bold', 'bold-italic', 'italic'

---

<a name="recipe-htmlToTextObjects"></a>

## recipe-htmlToTextObjects(htmlCodes, [options]) ⇒ <code>Array.&lt;Object&gt;</code>

Convert HTML into Recipe text layout objects.

**Kind**: static method of [<code>Recipe</code>](#Recipe)
**Returns**: <code>Array.&lt;Object&gt;</code> - The parsed text layout objects.
**Params**

- htmlCodes <code>string</code> - The HTML source.
- [options] <code>Object</code> - Text options used to initialize the objects.

---

<a name="recipe-image"></a>

## recipe-image(imgSrc, x, y, [options]) ⇒ [<code>Recipe</code>](#Recipe)

Place images to pdf

**Kind**: static method of [<code>Recipe</code>](#Recipe)
**Returns**: [<code>Recipe</code>](#Recipe) - The recipe instance.
**Params**

- imgSrc <code>string</code> - The path for the image. [JPEG, PNG, TIFF]
- x <code>number</code> - The coordinate x
- y <code>number</code> - The coordinate y
- [options] <code>Object</code> - The options
  - [.width] <code>number</code> - The new width
  - [.height] <code>number</code> - The new height
  - [.scale] <code>number</code> - Scale the image from the original width and height.
  - [.keepAspectRatio] <code>boolean</code> <code> = true</code> - Keep the aspect ratio.
  - [.opacity] <code>number</code> - The opacity.
  - [.align] <code>string</code> - 'center center'...

---

<a name="recipe-info"></a>

## recipe-info([options]) ⇒ <code>Object</code> \| [<code>Recipe</code>](#Recipe)

Add new PDF information, or retrieve existing PDF information.

**Kind**: static method of [<code>Recipe</code>](#Recipe)
**Returns**: <code>Object</code> \| [<code>Recipe</code>](#Recipe) - The existing information dictionary when options are omitted, otherwise the recipe instance.
**Params**

- [options] <code>Object</code> - The options (when missing obtains existing PDF information)
  - [.version] <code>number</code> - The pdf version
  - [.author] <code>string</code> - The author
  - [.title] <code>string</code> - The title
  - [.subject] <code>string</code> - The subject
  - [.keywords] <code>Array.&lt;string&gt;</code> - The array of keywords

---

<a name="recipe-custom"></a>

## recipe-custom([key], [value]) ⇒ [<code>Recipe</code>](#Recipe)

Add custom information to pdf

**Kind**: static method of [<code>Recipe</code>](#Recipe)
**Returns**: [<code>Recipe</code>](#Recipe) - The recipe instance.
**Params**

- [key] <code>string</code> - The key
- [value] <code>string</code> - The value

---

<a name="recipe-structure"></a>

## recipe-structure(output) ⇒ [<code>Recipe</code>](#Recipe)

Write the PDF object structure to a file.

**Kind**: static method of [<code>Recipe</code>](#Recipe)
**Returns**: [<code>Recipe</code>](#Recipe) - The recipe instance.
**Params**

- output <code>string</code> - The output file path.

---

<a name="recipe-insertPage"></a>

## recipe-insertPage(afterPageNumber, pdfSrc, srcPageNumber) ⇒ [<code>Recipe</code>](#Recipe)

Insert a page from the other pdf

**Kind**: static method of [<code>Recipe</code>](#Recipe)
**Returns**: [<code>Recipe</code>](#Recipe) - The recipe instance.
**Throws**:

- <code>Error</code> If afterPageNumber is not a number.

**Params**

- afterPageNumber <code>number</code> - The page number for insertion.
- pdfSrc <code>string</code> - The path for the other pdf
- srcPageNumber <code>number</code> - The page number to be insterted from the other pdf.

---

<a name="recipe-overlay"></a>

## recipe-overlay(pdfSrc, [x], [y], [options]) ⇒ [<code>Recipe</code>](#Recipe)

Overlay a pdf to the current pdf

**Kind**: static method of [<code>Recipe</code>](#Recipe)
**Returns**: [<code>Recipe</code>](#Recipe) - The recipe instance.
**Params**

- pdfSrc <code>string</code> - The path for the overlay pdf
- [x] <code>number</code> | <code>Object</code> <code> = 0</code> - The x coordinate, or options when using the two-argument form.
- [y] <code>number</code> <code> = 0</code> - The y coordinate.
- [options] <code>Object</code> - The options.
  - [.scale] <code>number</code> - Scale the overlay pdf, default is 1
  - [.page] <code>number</code> - Page of the overlay pdf, default is 1
  - [.keepAspectRatio] <code>boolean</code> - To keep the aspect ratio when scaling, default is true
  - [.fitWidth] <code>boolean</code> - To set the width to 100% (use with keepAspectRatio=true)
  - [.fitHeight] <code>boolean</code> - To set the height to 100% (use with keepAspectRatio=true)

---

<a name="recipe-createPage"></a>

## recipe-createPage([pageWidth], [pageHeight], [margins]) ⇒ [<code>Recipe</code>](#Recipe)

Create a new page, specifying either actual width and height, or the name
of a supported page size (eg. 'letter', 'letter-size')
'-size' will be removed from string but is discouraged to use.

**Kind**: static method of [<code>Recipe</code>](#Recipe)
**Returns**: [<code>Recipe</code>](#Recipe) - The recipe instance.
**Params**

- [pageWidth] <code>number</code> | <code>string</code> - The page width, or name of medium size.
  Known named medium sizes: executive, folio, legal, letter, ledger, tabloid, a0-a10, b0-b10, c0-c10, ra0-ra4, sra0-ara4
- [pageHeight] <code>number</code> - The page height, or rotation (90) when page size name given.
- [margins] <code>object</code> - page margin definitions.
  - [.left] <code>number</code> - Left margin.
  - [.right] <code>number</code> - Right margin.
  - [.top] <code>number</code> - Top margin.
  - [.bottom] <code>number</code> - Bottom margin.

---

<a name="recipe-endPage"></a>

## recipe-endPage() ⇒ [<code>Recipe</code>](#Recipe)

Finish a page

**Kind**: static method of [<code>Recipe</code>](#Recipe)
**Returns**: [<code>Recipe</code>](#Recipe) - The recipe instance.

---

<a name="recipe-editPage"></a>

## recipe-editPage(pageNumber) ⇒ [<code>Recipe</code>](#Recipe)

Start editing a page

**Kind**: static method of [<code>Recipe</code>](#Recipe)
**Returns**: [<code>Recipe</code>](#Recipe) - The recipe instance.
**Params**

- pageNumber <code>number</code> - The page number to be edited.

---

<a name="recipe-pageInfo"></a>

## recipe-pageInfo(pageNumber) ⇒ <code>Object</code>

Get page information

**Kind**: static method of [<code>Recipe</code>](#Recipe)
**Returns**: <code>Object</code> - The page information.
**Params**

- pageNumber <code>number</code> - The page number.

---

<a name="recipe-pauseContext"></a>

## recipe-pauseContext() ⇒ <code>void</code>

Pause the current page content context.

**Kind**: static method of [<code>Recipe</code>](#Recipe)

---

<a name="recipe-resumeContext"></a>

## recipe-resumeContext() ⇒ <code>void</code>

Resume the current page content context after it has been paused.

**Kind**: static method of [<code>Recipe</code>](#Recipe)

---

<a name="recipe-getPageInfo"></a>

## recipe-getPageInfo() ⇒ <code>Object</code>

Get the document information dictionary.

**Kind**: static method of [<code>Recipe</code>](#Recipe)
**Returns**: <code>Object</code> - The document information dictionary.

---

<a name="recipe-margins"></a>

## recipe-margins([left], [right], [top], [bottom]) ⇒ <code>object</code>

Set/Get current page margins.

**Kind**: static method of [<code>Recipe</code>](#Recipe)
**Returns**: <code>object</code> - When parameters are given, the value returned is the recipe handle. When no
parameters given, the return value is the current page margin object.
**Params**

- [left] <code>number</code> | <code>object</code> - Left margin width or an object holding margin properties to be set.
  Valid margin property names are: left, right, top, bottom.
- [right] <code>number</code> - Right margin width.
- [top] <code>number</code> - Top margin height.
- [bottom] <code>number</code> - Bottom margin height.

---

<a name="recipe-n_gon"></a>

## recipe-n\_gon(cx, cy, radius, [sides], [options]) ⇒ [<code>Recipe</code>](#Recipe)

Draw an N-sided regular polygon

**Kind**: static method of [<code>Recipe</code>](#Recipe)
**Returns**: [<code>Recipe</code>](#Recipe) - The recipe instance.
**Params**

- cx <code>number</code> - x-coordinate of center point of regular polygon
- cy <code>number</code> - y-coordinate of center point of regular polygon
- radius <code>number</code> - The radius, distance from the center of the polygon to a vertice.
- [sides] <code>number</code> <code> = 3</code> - the number of sides of the regular polygon
- [options] <code>Object</code> - The options
  - [.color] <code>string</code> | <code>Array.&lt;number&gt;</code> - HexColor or DecimalColor
  - [.stroke] <code>string</code> | <code>Array.&lt;number&gt;</code> - HexColor or DecimalColor
  - [.fill] <code>string</code> | <code>Array.&lt;number&gt;</code> - HexColor or DecimalColor
  - [.lineWidth] <code>number</code> - The line width
  - [.opacity] <code>number</code> - The opacity
  - [.dash] <code>Array.&lt;number&gt;</code> - The dash style [number, number]
  - [.rotation] <code>number</code> <code> = 0</code> - Accept: +/- 0 through 360.
  - [.rotationOrigin] <code>Array.&lt;number&gt;</code> <code> = [cx,cy]</code> - [originX, originY]
  - [.rotationVertice] <code>number</code> - the number of the vertice to be used as rotation origin
  - [.skewX] <code>number</code> - the angle skew off the x-axis
  - [.skewY] <code>number</code> - the angle skew off the y-axis.

---

<a name="recipe-star"></a>

## recipe-star(cx, cy, radius, [points], [options]) ⇒ [<code>Recipe</code>](#Recipe)

Draw an N pointed star

**Kind**: static method of [<code>Recipe</code>](#Recipe)
**Returns**: [<code>Recipe</code>](#Recipe) - The recipe instance.
**Params**

- cx <code>number</code> - x-coordinate of center point of regular polygon
- cy <code>number</code> - y-coordinate of center point of regular polygon
- radius <code>number</code> - The radius, distance from the center to a star point.
- [points] <code>number</code> <code> = 5</code> - number of points on star
- [options] <code>Object</code> - The options
  - [.color] <code>string</code> | <code>Array.&lt;number&gt;</code> - HexColor or DecimalColor
  - [.stroke] <code>string</code> | <code>Array.&lt;number&gt;</code> - HexColor or DecimalColor
  - [.fill] <code>string</code> | <code>Array.&lt;number&gt;</code> - HexColor or DecimalColor
  - [.lineWidth] <code>number</code> - The line width
  - [.opacity] <code>number</code> - The opacity
  - [.dash] <code>Array.&lt;number&gt;</code> - The dash style [number, number]
  - [.rotation] <code>number</code> - Accept: +/- 0 through 360. Default: 0
  - [.rotationOrigin] <code>Array.&lt;number&gt;</code> - [originX, originY] Default: x, y
  - [.skewX] <code>number</code> - the angle skew off the x-axis
  - [.skewY] <code>number</code> - the angle skew off the y-axis.

---

<a name="recipe-triangle"></a>

## recipe-triangle(x, y, traits, [options]) ⇒ [<code>Recipe</code>](#Recipe)

Draw a triangle, by specifying three side lengths, two side lengths and one inclusive angle, one side length and two adjacent angles, or with a set of vertices.

**Kind**: static method of [<code>Recipe</code>](#Recipe)
**Returns**: [<code>Recipe</code>](#Recipe) - The recipe instance.
**Throws**:

- <code>Error</code> If traits does not contain three values or does not define a valid triangle.

**Params**

- x <code>number</code> - x-coordinate used to position triangle, by default associated with left vertex of triangle base.
- y <code>number</code> - y-coordinate used to position triangle, by default associated with left vertex of triangle base.
- traits <code>Array.&lt;number&gt;</code> - the data defining the triangle. Angles are specified as degrees, sides in units of points (1/72 in.).
- [options] <code>Object</code> - The options
  - [.traitID] <code>string</code> <code> = &quot;&#x27;sss&#x27;&quot;</code> - indicates what type of data is being passed in the traits parameter.
    ('sss'- three side lengths, 'sas' - side-angle-side (sideA, <C, sideB), 'asa' - angle-side-angle (<B, sideC, <A),
    or 'vtx' - three vertex points [x,y])
  - [.position] <code>string</code> <code> = &quot;&#x27;b&#x27;&quot;</code> - the position of the triangle to be set at the given x,y coordinates.
    The values can be one of: 'A' - the A vertex (right vertex of triangle base), 'B' - the B vertex (left vertex of triangle base),
    'C' - the C vertex (apex of triangle), 'centroid', 'circumcenter', or 'incenter' of the triangle.
  - [.flipX] <code>Boolean</code> <code> = false</code> - flip triangle up to down through rotation point.
  - [.flipY] <code>Boolean</code> <code> = false</code> - flip triangle right to left through rotation point.
  - [.color] <code>string</code> | <code>Array.&lt;number&gt;</code> - HexColor or DecimalColor
  - [.stroke] <code>string</code> | <code>Array.&lt;number&gt;</code> - HexColor or DecimalColor
  - [.fill] <code>string</code> | <code>Array.&lt;number&gt;</code> - HexColor or DecimalColor
  - [.lineWidth] <code>number</code> - The line width
  - [.opacity] <code>number</code> - The opacity
  - [.dash] <code>Array.&lt;number&gt;</code> - The dash style [number, number]
  - [.rotation] <code>number</code> - Accept: +/- 0 through 360. Default: 0
  - [.rotationOrigin] <code>Array.&lt;number&gt;</code> - [originX, originY] Default: x, y
  - [.skewX] <code>number</code> - the angle skew off the x-axis
  - [.skewY] <code>number</code> - the angle skew off the y-axis.

---

<a name="recipe-arrow"></a>

## recipe-arrow(x, y, [options]) ⇒ [<code>Recipe</code>](#Recipe)

Draw an arrow

**Kind**: static method of [<code>Recipe</code>](#Recipe)
**Returns**: [<code>Recipe</code>](#Recipe) - The recipe instance.
**Params**

- x <code>number</code> - x-coordinate position
- y <code>number</code> - y-coordinate position
- [options] <code>Object</code> - arrow and polygon options
  - [.type] <code>number</code> <code> = 0</code> - indicates the type of arrow head to produce. (0-'triangle', 1-'dart', 2-'kite')
    Number or name may be used. Note, that the value of base offset in head option overrides this value.
  - [.head] <code>number</code> | <code>Array.&lt;number&gt;</code> <code> = [10,20,0]</code> - defines the length, width and base offset of arrow head.
    A single number can be used to assign both the length and width of arrow, giving the base offset value as zero.
  - [.shaft] <code>number</code> | <code>Array.&lt;number&gt;</code> <code> = [10,10]</code> - defines the length and width of the arrow shaft.
  - [.double] <code>Boolean</code> <code> = false</code> - indicate double headed arrow production.
  - [.at] <code>string</code> - position and/or rotate at "head" or "tail" of arrow instead of at center.

---

<a name="recipe-split"></a>

## recipe-split([outputDir], [prefix]) ⇒ [<code>Recipe</code>](#Recipe)

Split the pdf

**Kind**: static method of [<code>Recipe</code>](#Recipe)
**Returns**: [<code>Recipe</code>](#Recipe) - The recipe instance.
**Params**

- [outputDir] <code>string</code> <code> = &quot;&#x27;&#x27;&quot;</code> - The path for the output PDFs.
- [prefix] <code>string</code> - The output filename prefix. Defaults to the source filename.

---

<a name="recipe-table"></a>

## recipe-table(x, y, contents, [options]) ⇒ [<code>Recipe</code>](#Recipe)

Display text data in tabular form

**Kind**: static method of [<code>Recipe</code>](#Recipe)
**Returns**: [<code>Recipe</code>](#Recipe) - The recipe instance.
**Params**

- x <code>number</code> - The coordinate x used to position table on page
- y <code>number</code> - The coordinate y used to position table on page
- contents <code>Array.&lt;object&gt;</code> - the data to be placed into the table
- [options] <code>object</code> - The options
  - [.height] <code>number</code> - The height designation of the table
  - [.order] <code>string</code> | <code>Array.&lt;string&gt;</code> - Defines the order of the named columns in the table.
    It can also be used to choose a subset of the actual data found in the given contents.
  - [.columns] <code>Array.&lt;object&gt;</code> - Holds the defining options for columns in the table.
    - [.name] <code>string</code> - The name of the content data field to be associated with the column.
      This field is mandatory when supplying column options.
    - [.text] <code>string</code> - The title to be applied to the column header.
      When missing, the data field name is used.
    - [.width] <code>number</code> <code> = 100</code> - The width of table column.
    - [.cell] <code>object</code> - Holds the options to be applied to a column table cell.
      All textBox options from the 'text' interface can be used here.
    - [.color] <code>string</code> | <code>Array.&lt;number&gt;</code> - Text color (HexColor, PercentColor or DecimalColor)
    - [.opacity] <code>number</code> <code> = 1</code> - opacity
    - [.font] <code>string</code> <code> = &quot;Helvetica&quot;</code> - The font. 'Arial', 'Helvetica'...
    - [.size] <code>number</code> <code> = 14</code> - The font size
    - [.renderer] <code>function</code> - function to be called which can be used to modify the text options for a particular
      table cell. The function is called with `(text, data, field, row)`, where `text` is the text to be written in the cell,
      `data` holds the text elements in the table row, `field` is the column field, and `row` is the one-based row number. The function returns an object with the text attributes that
      are to be modified for the table cell.
  - [.header] <code>object</code> | <code>boolean</code> <code> = false</code> - When true, the column name associated with a column will
    appear at the top of the column. When presented as an object it is the set of unique options to be applied to column headers.
    All 'text' interface options can be used.
    - [.cell] <code>object</code> - All textBox options from the 'text' interface can be used here.
  - [.border] <code>object</code> - Used to define table and cell border characteristics
    - [.width] <code>number</code> <code> = .5</code> - Thickness of lines used in the border.
    - [.stroke] <code>string</code> | <code>Array.&lt;number&gt;</code> - line color (HexColor, PercentColor or DecimalColor)
  - [.overflow] <code>function</code> - Called when the next table entry is going to expand the table
    beyond the given height or page boundary. Its parameters are (self, row) where 'self' is the recipe handle so
    that other recipe interfaces can be called, and the row number of the data which caused the data overflow.
    The return value can be 'true' which indicates that data processing should stop, or 'false' which indicates that
    the data should continue being processed with the original [x,y] coordinates, or it can be an object containing
    a 'position' property indicating the [x,y] coordinates where the next table for the remaining data should start.
  - [.row] <code>object</code> - text properties to be applied to all cells in a table row.
    - [.cell] <code>object</code> - All textBox options from the 'text' interface can be used here.
    - [.nth] <code>string</code> - 'even|odd', indicating that the properties should be applied only to
      'even' or 'odd' rows.

---

<a name="recipe-textDimensions"></a>

## recipe-textDimensions(text, [options]) ⇒ <code>Object</code>

Get text dimensions

**Kind**: static method of [<code>Recipe</code>](#Recipe)
**Returns**: <code>Object</code> - measurement components of given text: width, height, xMin, xMax, yMin, yMax
**Params**

- text <code>string</code> - text to be measured
- [options] <code>Object</code> - The options
  - [.font] <code>string</code> <code> = &quot;&#x27;helvetica&#x27;&quot;</code> - name of font from which measurements are to be taken
  - [.size] <code>number</code> <code> = 14</code> - size of font to be used in taking measurements
  - [.charSpace] <code>number</code> <code> = 0</code> - character spacing being applied to the given text.

---

<a name="recipe-text"></a>

## recipe-text([text], x, y, [options]) ⇒ [<code>Recipe</code>](#Recipe)

Write text elements

**Kind**: static method of [<code>Recipe</code>](#Recipe)
**Returns**: [<code>Recipe</code>](#Recipe) - The recipe instance.
**Todo**

- [ ] support break words

**Params**

- [text] <code>string</code> <code> = &quot;&#x27;&#x27;&quot;</code> - The text content
- x <code>number</code> - The coordinate x
- y <code>number</code> - The coordinate y
- [options] <code>Object</code> - The options
  - [.color] <code>string</code> | <code>Array.&lt;number&gt;</code> - Text color (HexColor, PercentColor or DecimalColor)
  - [.opacity] <code>number</code> <code> = 1</code> - opacity
  - [.rotation] <code>number</code> <code> = 0</code> - Accept: +/- 0 through 360.
  - [.rotationOrigin] <code>Array.&lt;number&gt;</code> <code> = [x,y]</code> - [originX, originY]
  - [.font] <code>string</code> <code> = &quot;Helvetica&quot;</code> - The font. 'Arial', 'Helvetica'...
  - [.size] <code>number</code> <code> = 14</code> - The font size
  - [.charSpace] <code>number</code> <code> = 0</code> - space to be added between characters, units in points.
  - [.align] <code>string</code> <code> = &quot;&#x27;left top&#x27;&quot;</code> - This is the alignment of the text in relationship to its position
    coordinates, specified as 'horizontal vertical', where horizontal is either 'left', 'center' or 'right
    and vertical is either 'top', 'center' or bottom.
  - [.highlight] <code>Object</code> | <code>Boolean</code> - Text markup annotation.
  - [.underline] <code>Object</code> | <code>Boolean</code> - Text markup annotation.
  - [.strikeOut] <code>Object</code> | <code>Boolean</code> - Text markup annotation.
  - [.html] <code>Boolean</code> - Interpret text as html
  - [.flow] <code>Boolean</code> <code> = false</code> - Used to activate/deactivate text flow which is the
    ability to use multiple calls to 'text' to create an overall text box.
  - [.layout] <code>number</code> | <code>string</code> - An identifier of the layout to be associated with given text.
  - [.overflow] <code>function</code> - Called when the text is going to exceed the area
    of the given text object. Intended for column layouts. Its parameter is (self) where 'self' is the recipe handle so
    that other recipe interfaces can be called. The return value can be 'true' which indicates that text processing
    should stop, or 'false' which indicates that the text should continue being processed with the original [x,y]
    coordinates, or it can be an object containing a 'column' property indicating either a layout column index
    or a set of [x,y] coordinates where the next set of layout columns should be positioned for the remaining text.
  - [.hilite] <code>Boolean</code> | <code>Object</code> <code> = false</code> - Used to hilite given text.
    - [.color] <code>string</code> | <code>Array.&lt;number&gt;</code> <code> = &quot;yellow&quot;</code> - text hilite color (HexColor, PercentColor or DecimalColor)
    - [.opacity] <code>number</code> <code> = .5</code> - text hilite color opacity
  - [.textBox] <code>Object</code> - Text Box to fit in.
    - [.width] <code>number</code> <code> = 100</code> - Text Box width
    - [.height] <code>number</code> - Text Box fixed height
    - [.minHeight] <code>number</code> <code> = 0</code> - Text Box minimum height
    - [.padding] <code>number</code> | <code>Array.&lt;number&gt;</code> <code> = 0</code> - Text Box padding, [top, right, bottom, left]
    - [.lineHeight] <code>number</code> <code> = 0</code> - Text Box line height
    - [.wrap] <code>string</code> | <code>Boolean</code> <code> = &quot;&#x27;auto&#x27;&quot;</code> - Text wrapping mechanism, may be true, false,
      'auto', 'clip', 'trim', 'ellipsis'. All the option values that are not equivalent to 'auto' dictate
      how the text which does not fit on a line is to be truncated. True is equivalent to 'auto'. False is equivalent to 'ellipsis'.
    - [.textAlign] <code>string</code> <code> = &quot;&#x27;left top&#x27;&quot;</code> - Alignment inside text box, specified as 'horizontal vertical',
      where horizontal is one of: 'left', 'center', 'right', 'justify' and vertical is one of: 'top', 'center', 'bottom'.
    - [.clipIfExceedsBox] <code>boolean</code> <code> = false</code> - Render only complete lines that fit within the text box height.
    - [.onClip] <code>function</code> - Called as onClip(recipe, result) when clipping leaves text unrendered.
      Do not call endPage() or endPDF() in this callback because the text operation is still active.
    - [.style] <code>Object</code> - Text Box styles
      - [.lineWidth] <code>number</code> <code> = 2</code> - Text Box border width
      - [.stroke] <code>string</code> | <code>Array.&lt;number&gt;</code> - Text Box border color (HexColor, PercentColor or DecimalColor)
      - [.dash] <code>Array.&lt;number&gt;</code> <code> = []</code> - Text Box border border dash style [number, number]
      - [.fill] <code>string</code> | <code>Array.&lt;number&gt;</code> - Text Box border background color (HexColor, PercentColor or DecimalColor)
      - [.opacity] <code>number</code> <code> = 1</code> - Text Box border background opacity
      - [.borderRadius] <code>boolean</code> | <code>number</code> | <code>Array.&lt;number&gt;</code> <code> = 0</code> - Border radius to apply to get rounded corners.
  - [.title] <code>string</code> - Title of annotation
  - [.open] <code>boolean</code> <code> = false</code> - Open the annotation. Annotation will be closed by default. Specific to text annotations; subtype='Text'
  - [.richText] <code>boolean</code> - Rich text in annotation
  - [.flag] <code>&#x27;invisible&#x27;</code> | <code>&#x27;hidden&#x27;</code> | <code>&#x27;print&#x27;</code> | <code>&#x27;nozoom&#x27;</code> | <code>&#x27;norotate&#x27;</code> | <code>&#x27;noview&#x27;</code> | <code>&#x27;readonly&#x27;</code> | <code>&#x27;locked&#x27;</code> | <code>&#x27;togglenoview&#x27;</code> - The annotation flag.
  - [.icon] <code>&#x27;Comment&#x27;</code> | <code>&#x27;Key&#x27;</code> | <code>&#x27;Note&#x27;</code> | <code>&#x27;Help&#x27;</code> | <code>&#x27;NewParagraph&#x27;</code> | <code>&#x27;Paragraph&#x27;</code> | <code>&#x27;Insert&#x27;</code> <code> = &#x27;Note&#x27;</code> - The icon of annotation. Specific to text annotations.
  - [.date] <code>string</code> - Date of text to show up on annotation
  - [.subject] <code>string</code> - Subject of annotation.

---

<a name="recipe-movedown"></a>

## recipe-movedown([lines], [returnCoords]) ⇒ <code>Object</code> \| <code>Array.&lt;number&gt;</code>

Move text positioning down N lines in text box

**Kind**: static method of [<code>Recipe</code>](#Recipe)
**Returns**: <code>Object</code> \| <code>Array.&lt;number&gt;</code> - - when returnCoord false, the recipe object, when true, the new [x,y] coordinates.
**Params**

- [lines] <code>number</code> <code> = 1</code> - the number of lines to reposition x and y coordinates
- [returnCoords] <code>Boolean</code> <code> = false</code> - indicate whether or not to return [x,y] coordinates

---

<a name="recipe-layout"></a>

## recipe-layout(id, x, y, width, height, [options]) ⇒ [<code>Recipe</code>](#Recipe)

Define text column layout

**Kind**: static method of [<code>Recipe</code>](#Recipe)
**Returns**: [<code>Recipe</code>](#Recipe) - The recipe instance.
**Params**

- id <code>number</code> | <code>string</code> - The identifier to be associated with the layout. (See 'text' layout option)
- x <code>number</code> - The coordinate x used to position text columns on page. When zero, left margin used.
- y <code>number</code> - The coordinate y used to position text columns on page. When zero, top margin used.
- width <code>number</code> - The width of a text column. When zero, space between left and right margin used.
- height <code>number</code> - The height of a text column. When zero, space between top and bottom margin used.
- [options] <code>object</code> - The options.
  - [.columns] <code>number</code> - Represents the number of columns in which to divide the given width.
  - [.gap] <code>number</code> <code> = 18</code> - Defines the separation between layout columns, units in points.
  - [.reset] <code>boolean</code> - True indicates that the a new layout should be produced for the given
    layout id, so any previous layout associated with the given id will be lost.

---

<a name="recipe-moveTo"></a>

## recipe-moveTo(x, y) ⇒ [<code>Recipe</code>](#Recipe)

move the current position to target position

**Kind**: static method of [<code>Recipe</code>](#Recipe)
**Returns**: [<code>Recipe</code>](#Recipe) - The recipe instance.
**Params**

- x <code>number</code> - The coordinate x
- y <code>number</code> - The coordinate y

---

<a name="recipe-lineTo"></a>

## recipe-lineTo(x, y, [options]) ⇒ [<code>Recipe</code>](#Recipe)

Draw a line from current position

**Kind**: static method of [<code>Recipe</code>](#Recipe)
**Returns**: [<code>Recipe</code>](#Recipe) - The recipe instance.
**Params**

- x <code>number</code> - The coordinate x
- y <code>number</code> - The coordinate y
- [options] <code>Object</code> - The options
  - [.color] <code>string</code> | <code>Array.&lt;number&gt;</code> - HexColor, PercentColor or DecimalColor
  - [.stroke] <code>string</code> | <code>Array.&lt;number&gt;</code> - HexColor, PercentColor or DecimalColor
  - [.lineWidth] <code>number</code> - The line width
  - [.opacity] <code>number</code> - how transparent should line be, from 0: invisible to 1: opaque
  - [.dash] <code>Array.&lt;number&gt;</code> - The dash pattern [dashSize, gapSize] or [dashAndGapSize]
  - [.dashPhase] <code>number</code> - distance into dash pattern at which to start dash (default: 0, immediately)
  - [.lineCap] <code>string</code> - open line end style, 'butt', 'round', or 'square' (default: 'round')
  - [.lineJoin] <code>string</code> - joined line end style, 'miter', 'round', or 'bevel' (default: 'round')
  - [.miterLimit] <code>number</code> - limit at which 'miter' joins are forced to 'bevel' (default: 1.414)

---

<a name="recipe-line"></a>

## recipe-line(coordinates, [options]) ⇒ [<code>Recipe</code>](#Recipe)

Draw a line

**Kind**: static method of [<code>Recipe</code>](#Recipe)
**Returns**: [<code>Recipe</code>](#Recipe) - The recipe instance.
**Params**

- coordinates <code>Array.&lt;number&gt;</code> - The array of coordinate [[x,y], [m,n]]
- [options] <code>Object</code> - The options
  - [.color] <code>string</code> | <code>Array.&lt;number&gt;</code> - HexColor, PercentColor or DecimalColor
  - [.stroke] <code>string</code> | <code>Array.&lt;number&gt;</code> - HexColor, PercentColor or DecimalColor
  - [.lineWidth] <code>number</code> - The line width
  - [.opacity] <code>number</code> - how transparent should line be, from 0: invisible to 1: opaque
  - [.dash] <code>Array.&lt;number&gt;</code> - The dash pattern [dashSize, gapSize] or [dashAndGapSize]
  - [.dashPhase] <code>number</code> - distance into dash pattern at which to start dash (default: 0, immediately)
  - [.lineCap] <code>string</code> - open line end style, 'butt', 'round', or 'square' (default: 'round')
  - [.lineJoin] <code>string</code> - joined line end style, 'miter', 'round', or 'bevel' (default: 'round')
  - [.miterLimit] <code>number</code> - limit at which 'miter' joins are forced to 'bevel' (default: 1.414)

---

<a name="recipe-polygon"></a>

## recipe-polygon(coordinates, [options]) ⇒ [<code>Recipe</code>](#Recipe)

Draw a polygon

**Kind**: static method of [<code>Recipe</code>](#Recipe)
**Returns**: [<code>Recipe</code>](#Recipe) - The recipe instance.
**Params**

- coordinates <code>Array.&lt;number&gt;</code> - The array of coordinate [[x,y], ... [m,n]]
- [options] <code>Object</code> - The options
  - [.color] <code>string</code> | <code>Array.&lt;number&gt;</code> - HexColor, PercentColor or DecimalColor
  - [.stroke] <code>string</code> | <code>Array.&lt;number&gt;</code> - HexColor, PercentColor or DecimalColor
  - [.fill] <code>string</code> | <code>Array.&lt;number&gt;</code> - HexColor, PercentColor or DecimalColor
  - [.lineWidth] <code>number</code> - The line width
  - [.opacity] <code>number</code> - The opacity
  - [.dash] <code>Array.&lt;number&gt;</code> - The dash pattern [dashSize, gapSize] or [dashAndGapSize]
  - [.dashPhase] <code>number</code> - distance into dash pattern at which to start dash (default: 0, immediately)
  - [.rotation] <code>number</code> - Accept: +/- 0 through 360. Default: 0
  - [.rotationOrigin] <code>Array.&lt;number&gt;</code> - [originX, originY] Default: x, y
  - [.lineCap] <code>string</code> - open line end style, 'butt', 'round', or 'square' (default: 'round')
  - [.lineJoin] <code>string</code> - joined line end style, 'miter', 'round', or 'bevel' (default: 'round')
  - [.miterLimit] <code>number</code> - limit at which 'miter' joins are forced to 'bevel' (default: 1.414)

---

<a name="recipe-circle"></a>

## recipe-circle(x, y, radius, [options]) ⇒ [<code>Recipe</code>](#Recipe)

Draw a circle

**Kind**: static method of [<code>Recipe</code>](#Recipe)
**Returns**: [<code>Recipe</code>](#Recipe) - The recipe instance.
**Params**

- x <code>number</code> - The coordinate x
- y <code>number</code> - The coordinate y
- radius <code>number</code> - The radius
- [options] <code>Object</code> - The options
  - [.color] <code>string</code> | <code>Array.&lt;number&gt;</code> - HexColor, PercentColor or DecimalColor
  - [.stroke] <code>string</code> | <code>Array.&lt;number&gt;</code> - HexColor, PercentColor or DecimalColor
  - [.fill] <code>string</code> | <code>Array.&lt;number&gt;</code> - HexColor, PercentColor or DecimalColor
  - [.lineWidth] <code>number</code> - The line width
  - [.opacity] <code>number</code> - The opacity
  - [.dash] <code>Array.&lt;number&gt;</code> - The dash style [number, number]

---

<a name="recipe-rectangle"></a>

## recipe-rectangle(x, y, width, height, [options]) ⇒ [<code>Recipe</code>](#Recipe)

Draw a rectangle

**Kind**: static method of [<code>Recipe</code>](#Recipe)
**Returns**: [<code>Recipe</code>](#Recipe) - The recipe instance.
**Params**

- x <code>number</code> - The coordinate x
- y <code>number</code> - The coordinate y
- width <code>number</code> - The width
- height <code>number</code> - The height
- [options] <code>Object</code> - The options
  - [.color] <code>string</code> | <code>Array.&lt;number&gt;</code> - HexColor, PercentColor or DecimalColor
  - [.stroke] <code>string</code> | <code>Array.&lt;number&gt;</code> - HexColor, PercentColor or DecimalColor
  - [.fill] <code>string</code> | <code>Array.&lt;number&gt;</code> - HexColor, PercentColor or DecimalColor
  - [.lineWidth] <code>number</code> - The line width
  - [.opacity] <code>number</code> - The opacity
  - [.dash] <code>Array.&lt;number&gt;</code> - The dash style [number, number]
  - [.rotation] <code>number</code> - Accept: +/- 0 through 360. Default: 0
  - [.rotationOrigin] <code>Array.&lt;number&gt;</code> - [originX, originY] Default: x, y
  - [.borderRadius] <code>number</code> | <code>Array.&lt;number&gt;</code> - Radius size for rounded corners.
    When a one to four number array can be used to give specific sizees to each corner.
    The numbering starts from the top, left corner, and goes clockwise around the text box.
    Missing values in the array are filled in by opposite corner values.

---

<a name="recipe-ellipse"></a>

## recipe-ellipse(cx, cy, rx, ry, [options]) ⇒ [<code>Recipe</code>](#Recipe)

Draw an ellipse

**Kind**: static method of [<code>Recipe</code>](#Recipe)
**Returns**: [<code>Recipe</code>](#Recipe) - The recipe instance.
**Params**

- cx <code>number</code> - x-coordinate of center point of ellipse
- cy <code>number</code> - y-coordinate of center point of ellipse
- rx <code>number</code> - radius length from the center point along x-axis
- ry <code>number</code> - radius length from the center point along y-axis
- [options] <code>Object</code>
  - [.color] <code>string</code> | <code>Array.&lt;number&gt;</code> - HexColor, PercentColor or DecimalColor
  - [.stroke] <code>string</code> | <code>Array.&lt;number&gt;</code> - HexColor, PercentColor or DecimalColor
  - [.fill] <code>string</code> | <code>Array.&lt;number&gt;</code> - HexColor, PercentColor or DecimalColor
  - [.lineWidth] <code>number</code> - The line width
  - [.opacity] <code>number</code> - The opacity
  - [.dash] <code>Array.&lt;number&gt;</code> - The dash style [number, number]
  - [.rotation] <code>number</code> - Accept: +/- 0 through 360. Default: 0
  - [.rotationOrigin] <code>Array.&lt;number&gt;</code> - [originX, originY] Default: x, y

---

<a name="recipe-arc"></a>

## recipe-arc(x, y, radius, [startAngle], [endAngle], [options]) ⇒ [<code>Recipe</code>](#Recipe)

Draw an arc of a circle.

**Kind**: static method of [<code>Recipe</code>](#Recipe)
**Returns**: [<code>Recipe</code>](#Recipe) - The recipe instance.
**Params**

- x <code>number</code> - the x coordinate of the arc center point
- y <code>number</code> - the y coordinate of the arc center point
- radius <code>number</code> - the distance from the given x,y coordinates from which to produce the arc
- [startAngle] <code>number</code> <code> = 0</code> - the start of the arc in degree units +/- 0 through 360. Positive values go clockwise, Negative values, counterclockwise.
- [endAngle] <code>number</code> <code> = 360</code> - the end of the arc in degree units +/- 0 through 360. Positive values go clockwise, Negative values, counterclockwise.
- [options] <code>Object</code>
  - [.color] <code>string</code> | <code>Array.&lt;number&gt;</code> - HexColor, PercentColor or DecimalColor
  - [.stroke] <code>string</code> | <code>Array.&lt;number&gt;</code> - HexColor, PercentColor or DecimalColor
  - [.fill] <code>string</code> | <code>Array.&lt;number&gt;</code> - HexColor, PercentColor or DecimalColor
  - [.lineWidth] <code>number</code> - The line width
  - [.opacity] <code>number</code> - The opacity
  - [.dash] <code>Array.&lt;number&gt;</code> - The dash style [number, number]
  - [.rotation] <code>number</code> <code> = 0</code> - Accept: +/- 0 through 360.
  - [.rotationOrigin] <code>Array.&lt;number&gt;</code> - [originX, originY] Default: x, y

---

<a name="recipe-lineWidth"></a>

## recipe-lineWidth(width) ⇒ [<code>Recipe</code>](#Recipe)

Set the line width.

This compatibility method currently has no effect.

**Kind**: static method of [<code>Recipe</code>](#Recipe)
**Returns**: [<code>Recipe</code>](#Recipe) - The recipe instance.
**Params**

- width <code>number</code> - The requested line width.

---

<a name="recipe-fillOpacity"></a>

## recipe-fillOpacity(opacity) ⇒ [<code>Recipe</code>](#Recipe)

Set the fill opacity.

This compatibility method currently has no effect.

**Kind**: static method of [<code>Recipe</code>](#Recipe)
**Returns**: [<code>Recipe</code>](#Recipe) - The recipe instance.
**Params**

- opacity <code>number</code> - The requested fill opacity.

---

<a name="recipe-fill"></a>

## recipe-fill([color]) ⇒ [<code>Recipe</code>](#Recipe)

Fill the current path.

This compatibility method currently has no effect.

**Kind**: static method of [<code>Recipe</code>](#Recipe)
**Returns**: [<code>Recipe</code>](#Recipe) - The recipe instance.
**Params**

- [color] <code>string</code> | <code>Array.&lt;number&gt;</code> - The requested fill color.

---

<a name="recipe-stroke"></a>

## recipe-stroke([color]) ⇒ [<code>Recipe</code>](#Recipe)

Stroke the current path.

This compatibility method currently has no effect.

**Kind**: static method of [<code>Recipe</code>](#Recipe)
**Returns**: [<code>Recipe</code>](#Recipe) - The recipe instance.
**Params**

- [color] <code>string</code> | <code>Array.&lt;number&gt;</code> - The requested stroke color.

---

<a name="recipe-fillAndStroke"></a>

## recipe-fillAndStroke() ⇒ [<code>Recipe</code>](#Recipe)

Fill and stroke the current path.

This compatibility method currently has no effect.

**Kind**: static method of [<code>Recipe</code>](#Recipe)
**Returns**: [<code>Recipe</code>](#Recipe) - The recipe instance.

---
