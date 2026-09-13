# Render HTML Lists

Pass `html: true` to `text()` to render ordered, unordered, nested, formatted,
and linked lists. Recipe adds visual markers and hanging indentation while using
the same text-box wrapping options as plain text.

```javascript
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

new Recipe("new", "html-lists.pdf")
  .createPage("letter")
  .text(html, 54, 72, {
    html: true,
    size: 12,
    textBox: { width: 360, wrap: "auto" },
  })
  .endPage()
  .endPDF();
```

List markers inherit the formatting and URL of leading item content. Wrapped
lines use hanging indentation beneath the item text. Native parses this input
as XML, so close every `li`, `ul`, and `ol` element.

The generated PDF contains visual list text rather than semantic tagged-PDF
list structure. See [Text And Fonts](../recipe/text-and-fonts.md) for the other
supported HTML elements and text-box options.
