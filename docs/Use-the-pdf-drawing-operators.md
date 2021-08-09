Sometimes you will to display content on a page which is beyond what the existing module operations around images, text and primitives provide. No worries. You can add PDF operators to the page content directly and draw whatever you want. Just create a content context to a page, using the regular method  - `var cxt = pdfWriter.startPageContentContext(page)` - and you can make calls to it with function names fitting operators in PDF.     
Note that in PDF modification scenarios, you will need alternative method to create content contexts for page. read [here](./Modification.md#adding-content-to-existing-pages) for info.

for the full list of PDF operators check out the PDF reference. You can grab it from my stash [here](https://www.box.com/s/vz6lewz3eitovlvsshgr).

A useful example can be found [here](../tests/SimpleContentPageTest.js).

# Why do this?

For example, you would normally want to draw graphics using a certain transformation matrix, and encapsulate that in a graphic state save and restore. In PDF that would mean using the `q`, `cm` and `Q` operators. like this:

```javascript
var cxt = pdfWriter.startPageContentContext(page);
cxt.q()
   .cm(2,0,0,2,0,0)
/* draw something */
   .Q();
```

The above code calls `q` to save the current graphic context. Then `cm` with a simple scaling matrix for 2X2. Then will follow some drawing operators, and then a final `Q` to restore the state.

The next passages will provide the full list of available operators, and discuss their interface. The later section will discuss notable operator (where the interface needs explaining).

# Operators list

The full operators list is provide below. All are operators on a Content Context (page or form). The parameters method normally fits how it is done in PDF, simply in javascript equivalents. The text placement operator have special care, in allowing you to pass text instead of encoded PDF strings. font setting with `Tf` receives a font object etc. Important! all methods return the context object, so you can chain them.

Now, for the list:

```javascript
// PDF Operators. For explanations on the meanings of each operator read Appendix A "Operator Summary" of the PDF Reference Manual (1.7)

	// path stroke/fill
        b();
	B();
	bStar();  // equivalent of b*
	BStar();  // equivalent of B*
	s();
	S();
	f();
	F();
	fStar(); // equivalent of f*
	n();  

	// path construction (all parameters are "double" numbers)
	m(inX,inY);
	l(inX,inY);
	c(inX1,inY1,inX2,inY2,inX3,inY3);
	v(inX2,inY2,inX3,inY3);
	y(inX1,inY1,inX3,inY3);
	h();
	re(inLeft,inBottom,inWidth,inHeight);

	// graphic state
	q();
	Q(); 
	cm(inA,inB,inC,inD,inE,inF);
	w(inLineWidth);
	J(inLineCapStyle);
	j(inLineJoinStyle);
	M(inMiterLimit);
	d(inDashArray,int inDashPhase); // inDashArray is an array
	ri(inRenderingIntentName);
	i(inFlatness);
	gs(inGraphicStateName);

	// color operators
	CS(inColorSpaceName);
	cs(inColorSpaceName);
	SC(c1,c2,c3...); // variable number, according to desirable color component count
	SCN(c1,c2,c3...);
	SCN(c1,c2,c3....,inPatternName);
	sc(c1,c2,c3...);
	scn(c1,c2,c3...);
	scn(c1,c2,c3...,inPatternName);
	G(inGray);
	g(inGray);
	RG(inR,inG,inB);
	rg(inR,inG,inB);
	K(inC,inM,inY,inK);
	k(inC,inM,inY,inK);

	// clip operators
	W();
	WStar(); // equivalent to W*

	// XObject usage
	doXObject(inXObjectName || inXObjectForm || inXObjectImage); 

	// Text state operators
	Tc(inCharacterSpace);
	Tw(inWordSpace);
	Tz(inHorizontalScaling);
	TL(inTextLeading);
	Tr(inRenderingMode);
	Ts(inFontRise);

	// Text object operators
	BT();
	ET();

	// Text positioning operators
	Td(inTx,inTy);
	TD(inTx,inTy);
	Tm(inA,inB, inC, inD, inE, inF);
	TStar(); // equivalent to T*

	// Text showing operators
	Tf(inFontObject,inFontSize);
	Tj(inText || inArray,[{options}]);
        Quote(inText || inArray,[{options}]); // equivalent to '
	DoubleQuote(inWordSpacing, inCharacterSpacing,inText || inArray,[{options}]); // equivalent to ''
	TJ(inTextAndSpacing || inGlyphsAndSpacing); 
```

# Notable operators


## doXObject

The most notable operators deal with xobjects and texts.

the `doXObject` operator accepts either a string or form or image. You can see examples of using it with form and image with the advanced tiff and jpg options in [here](./Show-images.md#advanced-options).

The option to pass string has to do with this being a resource name, that is found in the object (page or form) resources dictionary. You can get new names to forms and image and procsets by getting the resource dictionary for the object (page or form) and calling its register*** methods. But what i currently implement is only for images or forms registerting, so why bother. just pass them directly to the `doXObject` operator and it will do it for you. PDFHummus supports more than that (also registering graphic states, for instance), i'll expose it sometimes.

## BT and ET

`BT` is an operator that should be called to whenever you start placing text operators. It maintains a certain text state. When you finish placing the text call `ET`.

## Tm

When placing text you can set a font matrix, to determine the font size, rotation and such. The method accepts  6 numbers which are the transformation matrix

## Tf

The Tf operator receives a font object ,created with `pdfWriter.getFontForFile` and a font size, setting it up for following text placement commands

## Tj

Simplest text showing operator. provide either a text or an array of glyph IDs+unicode values to place as text. if you are providing a text as a parameter than you may (optionally!) also add a 2nd parameter which is an options object.

if you don't provide an object, the text provided is considered to be a UTF8 text string that should be encoded to glyphs and then to PDF char codes. the library does that for you. worry not. If you are by some reason not happy with the glyphs encoding, you can place the glyphs directly by using glyphs index - which is when you'll provide an array of glyphs+unicode values. 

The way the array of glyphs+unicode values is formatted is this - it's an array of arrays. each sub-array represents a glyph and its unicode value. it's unicode value may be more than one number, hence the need for multiple numbers array. So it's an array of arrays, where each subarray's first element is the glyph id, and the rest of the numbers form the unicode number (normally one, for them low-order high-order unicodes, provide 2 numbers or more where needed)

You may not be even happy with how the glyph->PDF encoding works, in which case i'll even let you use the PDF operators directly and the text would be considered encoded PDF text. You can then add the options object, providing a single property in it called "encoding". Its value may be either "hex", "code", or "text.
If it is "code" than the regular tf operator with a literal string is used. if "hex", the input text is written as hex values (where each byte is a hex value). "text" is the default of utf8 text, which is when the module will do all the encoding for you.

## Quote

`Quote` which is the equivalent of ' in PDF, moves to the next line and shows the text. it's input parameters are the same as `Tj`

## DoubleQuote

`DoubleQuote` which is the equivalent of '' in PDF operators, receives two initial numbers, and then text/glyphs array and optional encoding options object. The first two parameters are word spacing and character spacing. the other parameters are the same as in `Tj`

## TJ

`TJ` is a wonderful operator when you want to control character spacing directly. Good for justification scenarios, or implementing kerning/tracking.

TJ accepts a variable number of parameters, like `TJ('H',3,'ES')` which would place H and then ES, and the distance between them is 3. instead of a string, as is the case for all operators, you can provide an array of arrays being a direct glyph placement. If you do provide a string a last optional options array determines the meaning of the input text, and so the actual operator that wil be used (text, hex or code)