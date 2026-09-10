# Options And Constants

Writer, reader, modification, copying, image, text, and transformation options
are declared in `muhammara.d.ts`. Public constants include PDF versions
`ePDFVersion10` through `ePDFVersion17` plus `ePDFVersion20`, page-box and range
constants, `ePDFObject*` type constants, and `ePDFPageContentItem*` page-mark
types.

`LineCapStyle` provides `LINECAP_BUTT`, `LINECAP_ROUND`, and `LINECAP_SQUARE` for
content contexts. `ETokenSeparator` provides `eTokenSeparatorSpace`,
`eTokenSeparatorEndLine`, and `eTokenSeparatorNone` for low-level object-array
writing. `EInfoTrappedTrue`, `EInfoTrappedFalse`, and `EInfoTrappedUnknown` set
the Info dictionary's `trapped` field. `kProcsetPDF`, `kProcsetText`, and
`KProcsetImageB`/`C`/`I` name PDF resource procsets. `eXrefEntryExisting`,
`eXrefEntryDelete`, `eXrefEntryStreamObject`, and `eXrefEntryUndefined` describe
xref entry types.

`getTypeLabel(pdfObject.getType())` converts an `ePDFObject*` value into its
readable label while inspecting raw PDF objects.

Use the option descriptions on the corresponding guide pages rather than relying
on declaration fields alone. Advanced TIFF options and Recipe APIs are described
in their respective reference pages.

```javascript
var writer = muhammara.createWriter("output.pdf", {
  version: muhammara.ePDFVersion17,
});
```
