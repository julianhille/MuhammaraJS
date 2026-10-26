// Merges packages/native-with-source/tests/recipe/layout.js and the layout
// cases of the Wasm text-layout-table.test.mjs.
import assert from "node:assert/strict";
import path from "node:path";
import { describeEnds, writeOutput } from "../support/ends.mjs";
import {
  annotations,
  pageCount,
  textRuns,
  withReader,
} from "../support/pdf.mjs";
import { BUNDLED_FONTS, registerFont, runFonts } from "../support/text.mjs";

var title =
  "Trace-based Just-in-Time Type Specialization for Dynamic Languages";
var authors =
  "Andreas Gal*+, Brendan Eich*, Mike Shaver*, David Anderson*, David Mandelin*,\n" +
  "Mohammad R. Haghighat$, Blake Kaplan*, Graydon Hoare*, Boris Zbarsky*, Jason Orendorff*,\n" +
  "Jesse Ruderman*, Edwin Smith#, Rick Reitmaier#, Michael Bebenita+, Mason Chang+#, Michael Franz+";
var emails = [
  {
    org: "Mozilla Corporation*",
    address:
      "{gal,brendan,shaver,danderson,dmandelin,mrbkap,graydon,bz,jorendorff,jruderman}@mozilla.com",
  },
  {
    org: "Adobe Corporation#",
    address: "{edwsmith,rreitmai}@adobe.com",
  },
  {
    org: "Intel Corporation$",
    address: "{mohammad.r.haghighat}@intel.com",
  },
  {
    org: "University of California, Irvine+",
    address: "{mbebenit,changm,franz}@uci.edu",
  },
];

var abstract =
  "Dynamic languages such as JavaScript are more difficult to compile \
than statically typed ones. Since no concrete type information \
is available, traditional compilers need to emit generic code that can \
handle all possible type combinations at runtime.We present an alternative \
compilation technique for dynamically-typed languages \
that identifies frequently executed loop traces at run-time and then \
generates machine code on the fly that is specialized for the actual \
dynamic types occurring on each path through the loop. Our \
method provides cheap inter-procedural type specialization, and an \
elegant and efficient way of incrementally compiling lazily discovered \
alternative paths through nested loops. We have implemented \
a dynamic compiler for JavaScript based on our technique and we \
have measured speedups of 10x and more for certain benchmark programs.";

var article =
  "such as JavaScript, Python, and Ruby, are popular \
since they are expressive, accessible to non-experts, and make \
deployment as easy as distributing a source file. They are used for \
small scripts as well as for complex applications. JavaScript, for \
example, is the de facto standard for client-side web programming \
and is used for the application logic of browser-based productivity \
applications such as Google Mail, Google Docs and Zimbra Collaboration \
Suite. In this domain, in order to provide a fluid user \
experience and enable a new generation of applications, virtual machines \
must provide a low startup time and high performance.\n\
    Compilers for statically typed languages rely on type information \
to generate efficient machine code. In a dynamically typed programming \
language such as JavaScript, the types of expressions \
may vary at runtime. This means that the compiler can no longer \
easily transform operations into machine instructions that operate \
on one specific type. Without exact type information, the compiler \
must emit slower generalized machine code that can deal with all \
potential type combinations. While compile-time static type inference \
might be able to gather type information to generate optimized \
machine code, traditional static analysis is very expensive \
and hence not well suited for the highly interactive environment of \
a web browser.\n\
    We present a trace-based compilation technique for dynamic \
languages that reconciles speed of compilation with excellent performance \
of the generated machine code. Our system uses a mixedmode \
execution approach: the system starts running JavaScript in a \
fast-starting bytecode interpreter. As the program runs, the system \
identifies hot (frequently executed) bytecode sequences, records \
them, and compiles them to fast native code. We call such a sequence \
of instructions a trace.\n\
    Unlike method-based dynamic compilers, our dynamic compiler \
operates at the granularity of individual loops. This design \
choice is based on the expectation that programs spend most of \
their time in hot loops. Even in dynamically typed languages, we \
expect hot loops to be mostly type-stable, meaning that the types of \
values are invariant. (12) For example, we would expect loop counters \
that start as integers to remain integers for all iterations. When \
both of these expectations hold, a trace-based compiler can cover \
the program execution with a small number of type-specialized, efficiently \
compiled traces.\n\
    Each compiled trace covers one path through the program with \
one mapping of values to types. When the VM executes a compiled \
trace, it cannot guarantee that the same path will be followed \
or that the same types will occur in subsequent loop iterations. \
";

var footnote =
  "Permission to make digital or hard copies of all or part of this work for personal or \
classroom use is granted without fee provided that copies are not made or distributed \
for profit or commercial advantage and that copies bear this notice and the full citation \
on the first page. To copy otherwise, to republish, to post on servers or to redistribute \
to lists, requires prior specific permission and/or a fee.";

var copyright =
  "PLDI’09, June 15–20, 2009, Dublin, Ireland.\nCopyright c 2009 ACM 978-1-60558-392-1/09/06. . . $5.00";

describeEnds("Recipe layout", function (end) {
  it("flows text into column layouts", function () {
    var times = "times";
    var courier = "courier new";
    var recipe = end.newRecipe();
    // Checked-in fonts, so rendering does not depend on the runner image.
    [
      ["Helvetica.ttf", "regular"],
      ["Helvetica-bold.ttf", "bold"],
      ["Helvetica-italic.ttf", "italic"],
      ["Helvetica-bold-italic.ttf", "bold-italic"],
    ].forEach(([file, style]) =>
      registerFont(end, recipe, times, path.join(BUNDLED_FONTS, file), style),
    );
    registerFont(
      end,
      recipe,
      courier,
      path.join(BUNDLED_FONTS, "Courier New.ttf"),
    );

    var y = 75;
    var box = {};
    var pagesAdded = 0;

    /**
     * Continue the article on a new two-column page.
     * @param {object} self - The Recipe.
     * @returns {object} The order to continue in the page layout.
     */
    var nextPage = (self) => {
      pagesAdded++;
      self.endPage();
      self.createPage("letter", 0, { left: 55, right: 55 });
      self.layout("page", 0, 0, 0, 0, { reset: true, columns: 2, gap: 20 });
      return { layout: "page" };
    };

    recipe
      .chroma("black", "#000000", "rgb")
      .createPage("letter", 0, { left: 55, right: 55, bottom: 55 })
      .text(title, 55, y, {
        color: "black",
        size: 18,
        font: times,
        bold: true,
        flow: true,
        textBox: { textAlign: "center" },
      })
      .movedown(3)
      .text(authors, { size: 11, bold: false, textBox: { lineHeight: 14 } })
      .movedown(1);

    for (var email of emails) {
      recipe
        .text(email.org, { size: 9, font: times, textBox: { lineHeight: 10 } })
        .movedown()
        .text(email.address, {
          size: 8,
          font: courier,
          textBox: { lineHeight: 10 },
        })
        .movedown(1.5);
    }
    recipe.text("", { flow: false, textBox: { box } });

    recipe
      .text(footnote, 55, 668, {
        flow: true,
        color: "black",
        font: times,
        size: 7,
        textBox: { textAlign: "justify", width: 245, lineHeight: 8 },
      })
      .movedown(1.2)
      .text(copyright, { textBox: { textAlign: "left" } })
      .text("", { flow: false, textBox: { box } });

    recipe
      .layout(1, 55, 330, 245, 320)
      .layout(1, 320, 330)
      .text("Abstract", {
        layout: 1,
        size: 12,
        color: "black",
        font: times,
        bold: true,
        textBox: { lineHeight: 13 },
      })
      .movedown(1.5)
      .text(abstract, {
        size: 9,
        bold: false,
        textBox: { textAlign: "justify", lineHeight: 11 },
      })
      .movedown(1.5)
      .text("Categories and Subject Descriptors ", {
        size: 8,
        bold: true,
        italic: true,
        textBox: { textAlign: "left" },
      })
      .text(
        "D.3.4 [Programming Languages]: Processors — Incremental compilers, code generation.",
        { bold: false },
      )
      .movedown(1.5)
      .text("General Terms ", { bold: true, italic: true })
      .text("Design, Experimentation, Measurement, Performance.", {
        bold: false,
        italic: false,
      })
      .movedown(1.5)
      .text("Keywords ", { bold: true, italic: true })
      .text("JavaScript, just-in-time compilation, trace trees.", {
        font: times,
        bold: false,
        italic: false,
      })
      .movedown(2)
      .text("1.  Introduction", {
        font: times,
        bold: true,
        italic: false,
        size: 12,
      })
      .movedown(1.5)
      .text("Dynamic languages ", { bold: false, italic: true, size: 9 })
      .text(article, {
        italic: false,
        overflow: nextPage,
        textBox: { textAlign: "justify", lineHeight: 10 },
      })
      .text("", { flow: false, textBox: { box } });

    var bytes = recipe.endPage().endPDF();
    writeOutput(end, "layout-paper", bytes);

    assert.ok(pagesAdded > 0, "the article overflows onto a new page");
    assert.equal(pageCount(end, bytes), 1 + pagesAdded);
    var fonts = runFonts(end, bytes);
    assert.match(fonts[0].font, /Bold/, "the title is bold");
    assert.match(
      fonts.find((run) => run.text.startsWith("{edwsmith")).font,
      /Courier/,
    );
    // The abstract fills both columns of layout 1, at x 55 and x 320.
    var first = textRuns(end, bytes);
    var abstractTop = first.find((run) => run.text === "Abstract").y;
    var columns = new Set(
      first
        .filter((run) => run.y <= abstractTop && run.text.trim())
        .map((run) => Math.round(run.x)),
    );
    assert.ok(
      columns.has(55) && columns.has(320),
      JSON.stringify([...columns]),
    );
    // The new page continues in its first column, (612 - 2 * 55 - 20) / 2
    // points wide inside the margins.
    var next = textRuns(end, bytes, 1).map((run) => run.x);
    assert.ok(next.length > 0);
    assert.equal(Math.min(...next), 55);
    assert.ok(
      next.every((x) => x < 55 + 241),
      JSON.stringify(next),
    );
  });

  it("stops flowing when overflow returns true", function () {
    var lorem =
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam in suscipit purus. ".repeat(
        30,
      );
    var overflows = 0;
    var recipe = end
      .newRecipe()
      .createPage("letter")
      .layout("stop-test", 72, 72, 200, 100, { columns: 2, gap: 10 })
      .text(lorem, {
        layout: "stop-test",
        flow: false,
        overflow: () => {
          overflows++;
          return true;
        },
        textBox: { textAlign: "justify" },
      });
    var bytes = recipe.endPage().endPDF();
    writeOutput(end, "layout-stop", bytes);
    assert.equal(overflows, 1);
    assert.equal(pageCount(end, bytes), 1);
    // Both columns are filled, then the rest of the text is dropped.
    var runs = textRuns(end, bytes);
    assert.ok(runs.some((run) => Math.round(run.x) === 72));
    assert.ok(runs.some((run) => Math.round(run.x) === 72 + 105));
    runs.forEach((run) => assert.ok(run.y >= 792 - 72 - 100 - 0.01));
  });

  it("flows HTML with markup annotations into columns", function () {
    var recipe = end
      .newRecipe()
      .createPage(300, 300)
      .layout("body", 20, 20, 250, 80, { columns: 2, gap: 10 });
    recipe.text(
      '<b>bold</b> <i>italic</i><br><span style="color:#ff0000">red</span>',
      {
        font: "arial",
        html: true,
        flow: true,
        layout: "body",
        highlight: true,
        underline: true,
      },
    );
    var coords = recipe.movedown(1, true);
    assert.equal(coords.length, 2);
    var bytes = recipe.endPage().endPDF();
    writeOutput(end, "layout-html-flow-columns", bytes);
    var subtypes = annotations(end, bytes).map(
      (annotation) => annotation.Subtype,
    );
    assert.ok(subtypes.includes("Highlight"), JSON.stringify(subtypes));
    assert.ok(subtypes.includes("Underline"), JSON.stringify(subtypes));
    assert.deepEqual(
      textRuns(end, bytes)
        .map((run) => run.text.trim())
        .filter(Boolean),
      ["bold", "italic", "red"],
    );
  });

  it("keeps text-box truncation modes, justification, hilite and layout orders distinct", function () {
    var overflow = 0;
    var overflowThis;
    var recipe = end
      .newRecipe()
      .createPage(300, 300)
      .layout("first", 10, 10, 100, 22, { columns: 2, gap: 10 })
      .layout("second", 10, 100, 100, 60, { columns: 1 });
    recipe
      .text("one two three four", 10, 10, {
        font: "arial",
        size: 12,
        textBox: { width: 35, wrap: "clip" },
      })
      .text("one two three four", 10, 35, {
        font: "arial",
        size: 12,
        textBox: { width: 35, wrap: "trim" },
      })
      .text("one two three four", 10, 60, {
        font: "arial",
        size: 12,
        textBox: { width: 35, wrap: "ellipsis" },
      })
      .text("one two three four five", 10, 85, {
        font: "arial",
        size: 12,
        hilite: { color: "#00ff00", opacity: 0.25 },
        textBox: { width: 100, textAlign: "justify top" },
      })
      .text("a\nb\nc", {
        font: "arial",
        size: 12,
        layout: "first",
        overflow: function () {
          overflow++;
          overflowThis = this;
          return { layout: "second", column: 0 };
        },
      })
      .endPage();
    var bytes = recipe.endPDF();
    writeOutput(end, "layout-truncation-modes", bytes);
    withReader(end, bytes, (reader) => {
      var text = reader.extractPageText(0);
      assert.ok(
        text.length >= 7,
        "clip and justified words remain separate output",
      );
      var mediaBox = reader
        .queryDictionaryObject(reader.parsePageDictionary(0), "MediaBox")
        .toPDFArray()
        .toJSArray()
        .map((value) => value.value);
      assert.equal(mediaBox[2] - mediaBox[0], 300);
    });
    assert.equal(overflow, 1);
    assert.equal(overflowThis, recipe, "overflow is called on the Recipe");
    // "c" overflows the two columns of "first" into layout "second".
    var c = textRuns(end, bytes).find((run) => run.text === "c");
    assert.ok(Math.abs(c.x - 10) < 0.01 && c.y < 300 - 100, JSON.stringify(c));
  });

  it("ignores an unknown layout", function () {
    /**
     * Draw "a" at the margins and "b" at 10, 50.
     * @param {object} [options] - The text options.
     * @returns {Uint8Array} The PDF.
     */
    function draw(options) {
      return end
        .newRecipe()
        .createPage(200, 200)
        .text("a", options)
        .text("b", 10, 50, options)
        .endPage()
        .endPDF();
    }
    var bytes = draw({ layout: "nope" });
    writeOutput(end, "layout-unknown", bytes);
    assert.deepEqual(textRuns(end, bytes), textRuns(end, draw({})));
  });
});
