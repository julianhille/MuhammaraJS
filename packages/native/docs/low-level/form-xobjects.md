# Form XObjects

A form XObject stores drawing commands once and can be placed repeatedly. This
reduces repeated content in a PDF and is also used when embedding images or PDF
pages.

```javascript
var form = pdfWriter.createFormXObject(0, 0, 200, 100);
form.getContentContext().drawRectangle(0, 0, 200, 100, { type: "fill" });
pdfWriter.endFormXObject(form);

pdfWriter
  .startPageContentContext(page)
  .q()
  .cm(1, 0, 0, 1, 72, 600)
  .doXObject(form)
  .Q();
```

Finish a form with `endFormXObject` before placing it. The `id` property is its
PDF object ID. See [`tests/FormXObjectTest.js`](https://github.com/julianhille/MuhammaraJS/blob/develop/packages/native-with-source/tests/FormXObjectTest.js) for the full lifecycle.
