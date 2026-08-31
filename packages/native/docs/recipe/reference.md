# Classes

<dl>
<dt><a href="#Recipe">Recipe</a></dt>
<dd></dd>
</dl>

# Functions

<dl>
<dt><a href="#getFlagBitNumberByName">getFlagBitNumberByName(name)</a></dt>
<dd><p>12.5.3 Annotation Flags</p>
</dd>
<dt><a href="#contentToRC">contentToRC(content)</a></dt>
<dd><p>Support CSS2 Style: &#39;text-align&#39; | &#39;vertical-align&#39; | &#39;font-size&#39; | &#39;font-style&#39; | &#39;font-weight&#39; | &#39;font-family&#39; | &#39;font&#39; | &#39;color&#39; | &#39;text-decoration&#39; | &#39;font-stretch&#39;</p>
</dd>
<dt><a href="#toColorModel">toColorModel(code, colorspace, colorName)</a> ⇒ <code>any</code></dt>
<dd><p>Convert given color code int color model object</p>
<p>ColorModel consists of: {
  color: number,
  colorspace: string {&#39;rgb&#39;, &#39;cmyk&#39;, &#39;gray&#39;},
  (colorspace == &#39;rgb&#39;)  r, g, b
  (colorspace == &#39;cmyk&#39;) c, m, y, k
  (colorspace == &#39;gray&#39;) gray
}</p>
<p>where r,g,b,c,m,y,k,gray are all numbers between 0 and 1</p>
</dd>
<dt><a href="#percentToHex">percentToHex(code)</a> ⇒ <code>string</code></dt>
<dd><p>Convert percentage string into hex string (x / 100 * 255)</p>
</dd>
<dt><a href="#_transformColor">_transformColor(code)</a></dt>
<dd><p>Transform color code into numeric value or colorModel</p>
</dd>
<dt><a href="#_getTextBoxOffset">_getTextBoxOffset()</a></dt>
<dd></dd>
<dt><a href="#justify">justify(left, x, wto, textBox, [position])</a></dt>
<dd><p>Justify text in a line.</p>
</dd>
<dt><a href="#appendPDFPageFromPDFWithAnnotations">appendPDFPageFromPDFWithAnnotations(pdfWriter, sourcePDFPath, pageNumber, [options])</a></dt>
<dd><p>Append PDF Page with annotations.</p>
</dd>
<dt><a href="#appendPDFPagesFromPDFWithAnnotations">appendPDFPagesFromPDFWithAnnotations(pdfWriter, sourcePDFPath, [options])</a></dt>
<dd><p>Append PDF Pages with annotations.</p>
</dd>
</dl>

<a name="Recipe"></a>

# Recipe

**Kind**: global class

- [Recipe](#Recipe)
  - [new Recipe(src, [output], [options])](#new_Recipe_new)
  - _instance_
    - [.endPDF(callback)](#Recipe+endPDF)
    - [.register(key, callback)](#Recipe+register)
  - _static_
    - `.comment(text, x, y, [options])`
    - `.annot(x, y, subtype, [options])`
    - `.appendPage(pdfSrc, pages)`
    - `.chroma(name, value, colorspace)`
    - `.permission(flags)`
    - `.encrypt(options)`
    - `.registerFont(fontName, fontSrcPath, [type])`
    - `.image(imgSrc, x, y, [options])`
    - `.info([options])`
    - `.custom([key], [value])`
    - `.insertPage(afterPageNumber, pdfSrc, srcPageNumber)`
    - `.overlay(pdfSrc, x, y)`
    - `.createPage([pageWidth], [pageHeight], [margins])`
    - `.endPage()`
    - `.editPage(pageNumber)`
    - `.pageInfo(pageNumber)`
    - `.margins([left], [right], [top], [bottom])` ⇒ <code>object</code>
    - `.n_gon(cx, cy, radius, [sides], [options])`
    - `.star(cx, cy, [points], [options])`
    - `.triangle(x, y, traits, [options])`
    - `.arrow(x, y, [options])`
    - `.split(outputDir, prefix)`
    - `.table(x, y, contents, [options])`
    - `.textDimensions(text, [options])` ⇒ <code>Object</code>
    - `.text(text, x, y, [options])`
    - `.movedown([lines], [returnCoords])` ⇒ <code>Object</code> \| <code>Array.&lt;number&gt;</code>
    - `.layout(id, x, y, width, height, [options])`
    - `.moveTo(x, y)`
    - `.lineTo(x, y, [options])`
    - `.line(coordinates, [options])`
    - `.polygon(coordinates, [options])`
    - `.circle(x, y, radius, [options])`
    - `.rectangle(x, y, width, height, [options])`
    - `.ellipse(cx, cy, rx, ry, options)`
    - `.arc(x, y, radius, [startAngle], [endAngle], [options])`

---

<a name="new_Recipe_new"></a>

## new Recipe(src, [output], [options])

Create a pdfDoc

**Params**

- src <code>string</code> - The file path or Buffer of the src file.
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

<a name="Recipe+endPDF"></a>

## recipe.endPDF(callback)

End the pdfDoc

**Kind**: instance method of [<code>Recipe</code>](#Recipe)
**Params**

- callback <code>function</code> - The callback function.

---

<a name="Recipe+register"></a>

## recipe.register(key, callback)

Register callback procedure with hummus-recipe.

**Kind**: instance method of [<code>Recipe</code>](#Recipe)
**Params**

- key <code>string</code> - name assigned to given callback. Note that if an actual function is being
  registered, and its given name is what is to be used to access it, the key is unnecessary.
- callback <code>function</code> - procedure that can be accessed through hummus-recipe

---

<a name="recipe-comment"></a>

## recipe-comment(text, x, y, [options])

Create a comment annotation

**Kind**: static method of [<code>Recipe</code>](#Recipe)
**Params**

- text <code>string</code> - The text content
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

## recipe-annot(x, y, subtype, [options])

Create an annotation

**Kind**: static method of [<code>Recipe</code>](#Recipe)
**Todo**

- [ ] support for rich text RC
- [ ] support for opacity CA

**Params**

- x <code>number</code> - The coordinate x
- y <code>number</code> - The coordinate y
- subtype <code>string</code> - The markup annotation type 'Text'|'Link'|'FreeText'|'Line'|'Square'|'Circle'|'Polygon'|'PolyLine'|'Highlight'|'Underline'|'Squiggly'|'StrikeOut'|'Caret'|'Stamp'|'Ink'|'Popup'|'FileAttachment'|'Sound'|'Movie'|'Screen'|'Widget'|'PrinterMark'|'TrapNet'|'Watermark'|'3D'|'Redact'|'Projection'|'RichMedia'
- [options] <code>Object</code> - The options
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

---

<a name="recipe-appendPage"></a>

## recipe-appendPage(pdfSrc, pages)

Append pages from the other pdf to the current pdf

**Kind**: static method of [<code>Recipe</code>](#Recipe)
**Params**

- pdfSrc <code>string</code> - The path for the other pdf.
- pages <code>number</code> | <code>Array.&lt;number&gt;</code> - The page number or the array of page numbers to be appended.

---

<a name="recipe-chroma"></a>

## recipe-chroma(name, value, colorspace)

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
**Params**

- name <code>string</code> - the name to be associated to given color value, or '!load'
- value <code>string</code> | <code>Array.&lt;number&gt;</code> - the color value (HexColor, DecimalColor, or PercentColor), or name of '!load' file
- colorspace <code>string</code> - one of the followning: 'rgb', 'cmyk', 'gray', 'separation';

---

<a name="recipe-permission"></a>

## recipe-permission(flags)

Encryption user access permissions

This function supplies the numeric value for the encrypt function's 'userProtectionFlag'
option. When no argument is given, the default 'print' value is used.

**Kind**: static method of [<code>Recipe</code>](#Recipe)
**Params**

- flags <code>string</code> - from the list print, modify, copy, edit, fillform, extract, assemble, and printbest
  More than one may be specified by using a comma to separate the names in the input string.

---

<a name="recipe-encrypt"></a>

## recipe-encrypt(options)

Encrypt the pdf

**Kind**: static method of [<code>Recipe</code>](#Recipe)
**Params**

- options <code>Object</code> - The options
  - [.password] <code>string</code> - The permission password.
  - [.ownerPassword] <code>string</code> - The password for editing.
  - [.userPassword] <code>string</code> - The password for viewing & encryption.
  - [.userProtectionFlag] <code>number</code> - The flag for the security level.

---

<a name="recipe-registerFont"></a>

## recipe-registerFont(fontName, fontSrcPath, [type])

Register a custom font

**Kind**: static method of [<code>Recipe</code>](#Recipe)
**Params**

- fontName <code>string</code> - The font name will be used in text
- fontSrcPath <code>string</code> - The path to the font file.
- [type] <code>string</code> <code> = &quot;&#x27;regular&#x27;&quot;</code> - The font type, one of 'bold', 'bold-italic', 'italic'

---

<a name="recipe-image"></a>

## recipe-image(imgSrc, x, y, [options])

Place images to pdf

**Kind**: static method of [<code>Recipe</code>](#Recipe)
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

## recipe-info([options])

Add new PDF information, or retrieve existing PDF information.

**Kind**: static method of [<code>Recipe</code>](#Recipe)
**Params**

- [options] <code>Object</code> - The options (when missing obtains existing PDF information)
  - [.version] <code>number</code> - The pdf version
  - [.author] <code>string</code> - The author
  - [.title] <code>string</code> - The title
  - [.subject] <code>string</code> - The subject
  - [.keywords] <code>Array.&lt;string&gt;</code> - The array of keywords

---

<a name="recipe-custom"></a>

## recipe-custom([key], [value])

Add custom information to pdf

**Kind**: static method of [<code>Recipe</code>](#Recipe)
**Params**

- [key] <code>string</code> - The key
- [value] <code>string</code> - The value

---

<a name="recipe-insertPage"></a>

## recipe-insertPage(afterPageNumber, pdfSrc, srcPageNumber)

Insert a page from the other pdf

**Kind**: static method of [<code>Recipe</code>](#Recipe)
**Params**

- afterPageNumber <code>number</code> - The page number for insertion.
- pdfSrc <code>string</code> - The path for the other pdf
- srcPageNumber <code>number</code> - The page number to be insterted from the other pdf.

---

<a name="recipe-overlay"></a>

## recipe-overlay(pdfSrc, x, y)

Overlay a pdf to the current pdf

**Kind**: static method of [<code>Recipe</code>](#Recipe)
**Params**

- pdfSrc <code>string</code> - The path for the overlay pdf
- x <code>number</code> - The coordinate x
- y <code>number</code> - The coordinate y
  - [.scale] <code>number</code> - Scale the overlay pdf, default is 1
  - [.page] <code>number</code> - Page of the overlay pdf, default is 1
  - [.keepAspectRatio] <code>boolean</code> - To keep the aspect ratio when scaling, default is true
  - [.fitWidth] <code>boolean</code> - To set the width to 100% (use with keepAspectRatio=true)
  - [.fitHeight] <code>boolean</code> - To set the height to 100% (use with keepAspectRatio=true)

---

<a name="recipe-createPage"></a>

## recipe-createPage([pageWidth], [pageHeight], [margins])

Create a new page, specifying either actual width and height, or the name
of a supported page size (eg. 'letter', 'letter-size')
'-size' will be removed from string but is discouraged to use.

**Kind**: static method of [<code>Recipe</code>](#Recipe)
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

## recipe-endPage()

Finish a page

**Kind**: static method of [<code>Recipe</code>](#Recipe)

---

<a name="recipe-editPage"></a>

## recipe-editPage(pageNumber)

Start editing a page

**Kind**: static method of [<code>Recipe</code>](#Recipe)
**Params**

- pageNumber <code>number</code> - The page number to be edited.

---

<a name="recipe-pageInfo"></a>

## recipe-pageInfo(pageNumber)

Get page information

**Kind**: static method of [<code>Recipe</code>](#Recipe)
**Params**

- pageNumber <code>number</code> - The page number.

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

## recipe-n\_gon(cx, cy, radius, [sides], [options])

Draw an N-sided regular polygon

**Kind**: static method of [<code>Recipe</code>](#Recipe)
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

## recipe-star(cx, cy, [points], [options])

Draw an N pointed star

**Kind**: static method of [<code>Recipe</code>](#Recipe)
**Params**

- cx <code>number</code> - x-coordinate of center point of regular polygon
- cy <code>number</code> - y-coordinate of center point of regular polygon
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

## recipe-triangle(x, y, traits, [options])

Draw a triangle, by specifying three side lengths, two side lengths and one inclusive angle, one side length and two adjacent angles, or with a set of vertices.

**Kind**: static method of [<code>Recipe</code>](#Recipe)
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

## recipe-arrow(x, y, [options])

Draw an arrow

**Kind**: static method of [<code>Recipe</code>](#Recipe)
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

## recipe-split(outputDir, prefix)

Split the pdf

**Kind**: static method of [<code>Recipe</code>](#Recipe)
**Params**

- outputDir <code>string</code> - The path for the output pdfs.
- prefix <code>string</code> - `${prefix}-${i+1}.pdf`.

---

<a name="recipe-table"></a>

## recipe-table(x, y, contents, [options])

Display text data in tabular form

**Kind**: static method of [<code>Recipe</code>](#Recipe)
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
      table cell. The function is called with the parameters (text, data), where 'text' is the text to be written in the cell and
      'data' is an object holding all the text elements in the table row. The function returns an object with the text attributes that
      are to be modified for the table cell.
  - [.header] <code>object</code> | <code>boolean</code> <code> = false</code> - When true, the column name associated with a column will
    appear at the top of the column. When presented as an object it is the set of unique options to be applied to column headers.
    All 'text' interface options can be used.
    - [.cell] <code>object</code> - All textBox options from the 'text' interface can be used here.
  - [.border] <code>object</code> - Used to define table and cell border characteristics
    - [.width] <code>number</code> <code> = .5</code> - thickness of lines used in border.Array
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

## recipe-text(text, x, y, [options])

Write text elements

**Kind**: static method of [<code>Recipe</code>](#Recipe)
**Todo**

- [ ] support break words

**Params**

- text <code>string</code> - The text content
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
      where horizontal is one of: 'left', 'center', 'right', 'justify' and veritical is one of: 'top', 'center', 'bottom'.
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
  - [.flag] <code>AnnotOptionsFlag</code> - The flag property of annotation
  - [.icon] <code>AnnotOptionsIcon</code> <code> = &#x27;Note&#x27;</code> - The icon of annotation. Specific to text annotations. Default value: 'Note'
  - [.date] <code>string</code> - Date of text to show up on annotation
  - [.subject] <code>string</code> - Subject of annotation
    When true is given, the default radius size for all corners is 5. A four number array may be used to give specific sizees to each
    corner. The numbering starts from the top, left corner, and goes clockwise around the text box.

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

## recipe-layout(id, x, y, width, height, [options])

Define text column layout

**Kind**: static method of [<code>Recipe</code>](#Recipe)
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

## recipe-moveTo(x, y)

move the current position to target position

**Kind**: static method of [<code>Recipe</code>](#Recipe)
**Params**

- x <code>number</code> - The coordinate x
- y <code>number</code> - The coordinate y

---

<a name="recipe-lineTo"></a>

## recipe-lineTo(x, y, [options])

Draw a line from current position

**Kind**: static method of [<code>Recipe</code>](#Recipe)
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

## recipe-line(coordinates, [options])

Draw a line

**Kind**: static method of [<code>Recipe</code>](#Recipe)
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

## recipe-polygon(coordinates, [options])

Draw a polygon

**Kind**: static method of [<code>Recipe</code>](#Recipe)
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

## recipe-circle(x, y, radius, [options])

Draw a circle

**Kind**: static method of [<code>Recipe</code>](#Recipe)
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

## recipe-rectangle(x, y, width, height, [options])

Draw a rectangle

**Kind**: static method of [<code>Recipe</code>](#Recipe)
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
  - [.borderRadius] <code>number</code> | <code>Array.&lt;number&gt;</code> - radius size for rounded corners.Error
    When a one to four number array can be used to give specific sizees to each corner.
    The numbering starts from the top, left corner, and goes clockwise around the text box.
    Missing values in the array are filled in by opposite corner values.

---

<a name="recipe-ellipse"></a>

## recipe-ellipse(cx, cy, rx, ry, options)

Draw an ellipse

**Kind**: static method of [<code>Recipe</code>](#Recipe)
**Params**

- cx <code>number</code> - x-coordinate of center point of ellipse
- cy <code>number</code> - y-coordinate of center point of ellipse
- rx <code>number</code> - radius length from the center point along x-axis
- ry <code>number</code> - radius length from the center point along y-axis
- options <code>Object</code>
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

## recipe-arc(x, y, radius, [startAngle], [endAngle], [options])

Draw an arc of a circle.

**Kind**: static method of [<code>Recipe</code>](#Recipe)
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

<a name="getFlagBitNumberByName"></a>

# getFlagBitNumberByName(name)

12.5.3 Annotation Flags

**Kind**: global function
**Params**

- name <code>string</code>

---

<a name="contentToRC"></a>

# contentToRC(content)

Support CSS2 Style: 'text-align' | 'vertical-align' | 'font-size' | 'font-style' | 'font-weight' | 'font-family' | 'font' | 'color' | 'text-decoration' | 'font-stretch'

**Kind**: global function
**Todo**

- [ ] Fix display issue for ol/ul in richText

**Params**

- content <code>string</code>

---

<a name="toColorModel"></a>

# toColorModel(code, colorspace, colorName) ⇒ <code>any</code>

Convert given color code int color model object

ColorModel consists of: {
color: number,
colorspace: string {'rgb', 'cmyk', 'gray'},
(colorspace == 'rgb') r, g, b
(colorspace == 'cmyk') c, m, y, k
(colorspace == 'gray') gray
}

where r,g,b,c,m,y,k,gray are all numbers between 0 and 1

**Kind**: global function
**Returns**: <code>any</code> - the color model
**Params**

- code <code>string</code> - the color encoding as HexColor
- colorspace <code>string</code> - the name of the colorspace of given color code
- colorName <code>string</code> - the name to be associated with given color code

---

<a name="percentToHex"></a>

# percentToHex(code) ⇒ <code>string</code>

Convert percentage string into hex string (x / 100 * 255)

**Kind**: global function
**Returns**: <code>string</code> - massaged hexadecimal string that can be used as input to hexToArray.
**Params**

- code <code>string</code> - numbers separated by commas with values ranging between 0-100.

---

<a name="_transformColor"></a>

# \_transformColor(code)

Transform color code into numeric value or colorModel

**Kind**: global function
**Params**

- code - color specification in form of HexColor (string, begins with '#'),
  DecimalColor (1, 3, or 4 element array with values between 0-255),
  PercentColor (string, begins with '%' followed by values separated
  by commas with values between 0-100)

---

<a name="_getTextBoxOffset"></a>

# \_getTextBoxOffset()

**Kind**: global function
**Todo**

- [ ] handle page margin and padding

---

<a name="justify"></a>

# justify(left, x, wto, textBox, [position])

Justify text in a line.

**Kind**: global function
**Params**

- left <code>number</code> - is position of left hand side of text box
- x <code>number</code> - is starting position for text placement
- wto <code>Array.&lt;Object&gt;</code> - is a write object
- textBox <code>Object</code> - holds text box properties
- [position] <code>function</code> - used to place given word at a postion on the line

---

<a name="appendPDFPageFromPDFWithAnnotations"></a>

# appendPDFPageFromPDFWithAnnotations(pdfWriter, sourcePDFPath, pageNumber, [options])

Append PDF Page with annotations.

**Kind**: global function
**Params**

- pdfWriter <code>any</code> - Hummus writer.
- sourcePDFPath <code>string</code> | <code>any</code> - The path for the output pdfs or Reader stream.
- pageNumber <code>number</code> - page number.
- [options] <code>any</code> <code> = {}</code> - appendPDFPageFromPDF options

---

<a name="appendPDFPagesFromPDFWithAnnotations"></a>

# appendPDFPagesFromPDFWithAnnotations(pdfWriter, sourcePDFPath, [options])

Append PDF Pages with annotations.

**Kind**: global function
**Params**

- pdfWriter <code>any</code> - Hummus writer.
- sourcePDFPath <code>string</code> | <code>any</code> - The path for the output pdfs or Reader stream.
- [options] <code>any</code> <code> = {}</code> - appendPDFPagesFromPDF options

---
