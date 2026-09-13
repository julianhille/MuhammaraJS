# Render HTML Lists

Pass `html: true` to `text()` to render ordered, unordered, nested, formatted,
and linked lists without a DOM. Recipe adds visual markers and hanging
indentation while using the same text-box wrapping options as plain text.

```javascript
import { createRecipe } from "@muhammara/wasm";

var Recipe = await createRecipe();
var html = `
  <ul>
    <li>Review the draft</li>
    <li><b>Publish</b> the approved copy</li>
    <li>
      Notify readers
      <ol>
        <li><a href="https://example.com/news">Post the announcement</a></li>
        <li>Send the newsletter</li>
      </ol>
    </li>
  </ul>`;

var pdf = new Recipe()
  .createPage("letter")
  .text(html, 54, 72, {
    html: true,
    fontSize: 12,
    textBox: { width: 360, wrap: "auto" },
  })
  .endPage();
var outputBytes = pdf.endPDF();

pdf.dispose();
Recipe.disposeAssets();
```

List markers inherit the formatting and URL of leading item content. Wrapped
lines use hanging indentation beneath the item text. The DOM-free parser also
recovers when an HTML `</li>` end tag is omitted, unlike native's XML-strict
parser.

The generated PDF contains visual list text rather than semantic tagged-PDF
list structure. The browser example's **HTML lists** tab runs this workflow on
the main thread or in a module Worker. See
[Text And Fonts](../recipe/text-and-fonts.md) for the supported HTML subset and
other text-box options.
