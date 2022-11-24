Say you have this particular graphics that you draw multiple times on a page. It will be a waste of good PDF file size to replace the drawing commands every time. PDF has a mechanism called "form xobjects" that allows you to draw graphics in an object that may be later placed many times.

If you saw the tiff and jpg images handling than forms were used already there. Forms are rather easy to create and use, you can see an example [here](../tests/FormXObjectTest.js).

The usage sequence is something like this:

```javascript
// define a form
var xobjectForm = pdfWriter.createFormXObject(0, 0, 200, 100);
xobjectForm
  .getContentContext()
  .q()
  .k(0, 100, 100, 0)
  .re(0, 0, 200, 100)
  .f()
  .Q();
pdfWriter.endFormXObject(xobjectForm);

// start a page
var page = pdfWriter.createPage(0, 0, 595, 842);
var pageContent = pdfWriter.startPageContentContext(page);

// draw some graphics using the form
pageContent.q().cm(1, 0, 0, 1, 200, 600).doXObject(xobjectForm).Q();
```

First, you create a form XObject using `var xobjectForm = pdfWriter.createFormXObject(0,0,200,100);`
The parameters for the `createFormXObject` method form its bounding box (normally just 0,0,width,height).

Then you get the form content context using `xobjectForm.getContentContext()`. No need to create it, as oppose to a page content context. nevermind why.
From here just use it as a regular content context with both high level methods and low level PDF operators. simple.

When done, call `pdfWriter.endFormXObject(xobjectForm);` to finish off the form.

Placing the form in either another form context or a page context is then done by calling the context `doXObject` method, passing the create form object.

Last but not least, and it's kind of important for some advanced implementations. You can get the form object id using the form `id` property (`xobjectForm.id`).
