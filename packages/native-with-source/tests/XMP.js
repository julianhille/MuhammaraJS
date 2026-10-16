var assert = require("node:assert");
var fs = require("node:fs");
var path = require("node:path");
var muhammara = require("@muhammara/native-with-source");
var { buildXmpPacket, pdfDateToXmp } = require("../../native-core/lib/xmp");

var Recipe = muhammara.Recipe;
var out = function (name) {
  var file = path.join(__dirname, "output", name + ".pdf");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  return file;
};

/**
 * Creates a one page PDF with a Recipe.
 * @param {string} name Output name.
 * @param {Object} [options] The Recipe options.
 * @param {function(Recipe): void} [setup] Called before the PDF ends.
 * @returns {string} The path of the PDF.
 */
function create(name, options, setup) {
  var file = out(name);
  var recipe = new Recipe("new", file, options);
  recipe.createPage("letter").endPage();
  if (setup) setup(recipe);
  recipe.endPDF();
  return file;
}

/**
 * Reads the XMP packet of a PDF.
 * @param {string} file The PDF.
 * @returns {string|undefined} The packet.
 */
function xmpOf(file) {
  var recipe = new Recipe(file, out("XMPRead"));
  try {
    return recipe.xmp();
  } finally {
    recipe.endPDF();
  }
}

/**
 * Reads the Info dictionary of a PDF as text.
 * @param {string} file The PDF.
 * @returns {Object<string, string>} The entries.
 */
function infoOf(file) {
  var reader = muhammara.createReader(file);
  try {
    var dictionary = reader
      .queryDictionaryObject(reader.getTrailer(), "Info")
      .toJSObject();
    return Object.fromEntries(
      Object.entries(dictionary).map(function ([key, value]) {
        return [key, value.toText ? value.toText() : value.value];
      }),
    );
  } finally {
    reader.end();
  }
}

describe("XMP metadata", function () {
  describe("packet", function () {
    it("mirrors the values", function () {
      var packet = buildXmpPacket({
        title: "Tom & <Jerry>",
        author: "An Author",
        subject: "About things",
        keywords: "a, b",
        creator: "A Creator",
        producer: "A Producer",
        createDate: "2020-01-02T03:04:05+01:30",
        modifyDate: "2021-02-03T04:05:06Z",
      });
      assert.ok(
        packet.includes(
          '<rdf:li xml:lang="x-default">Tom &amp; &lt;Jerry&gt;</rdf:li>',
        ),
      );
      assert.ok(packet.includes("<rdf:li>An Author</rdf:li>"));
      assert.ok(packet.includes(">About things</rdf:li>"));
      assert.ok(packet.includes("<pdf:Keywords>a, b</pdf:Keywords>"));
      assert.ok(packet.includes("<pdf:Producer>A Producer</pdf:Producer>"));
      assert.ok(
        packet.includes("<xmp:CreatorTool>A Creator</xmp:CreatorTool>"),
      );
      assert.ok(
        packet.includes(
          "<xmp:CreateDate>2020-01-02T03:04:05+01:30</xmp:CreateDate>",
        ),
      );
      assert.ok(
        packet.includes(
          "<xmp:ModifyDate>2021-02-03T04:05:06Z</xmp:ModifyDate>",
        ),
      );
      assert.ok(
        packet.includes(
          "<xmp:MetadataDate>2021-02-03T04:05:06Z</xmp:MetadataDate>",
        ),
      );
      assert.ok(packet.startsWith('<?xpacket begin="\ufeff"'));
      assert.ok(packet.endsWith('<?xpacket end="w"?>'));
    });

    it("drops characters XML cannot hold", function () {
      assert.ok(
        buildXmpPacket({ title: "a\u0001b\u0000c" }).includes(">abc</rdf:li>"),
      );
    });

    it("identifies a PDF/A document", function () {
      assert.ok(
        buildXmpPacket({ pdfa: { part: 1, conformance: "B" } }).includes(
          '<rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"><pdfaid:part>1</pdfaid:part><pdfaid:conformance>B</pdfaid:conformance></rdf:Description>',
        ),
      );
      assert.ok(
        buildXmpPacket({ pdfa: { part: 4, revision: 2020 } }).includes(
          "<pdfaid:part>4</pdfaid:part><pdfaid:rev>2020</pdfaid:rev>",
        ),
      );
      assert.ok(!buildXmpPacket({ title: "T" }).includes("pdfaid"));
    });

    it("is valid without values", function () {
      assert.ok(buildXmpPacket({}).includes('<rdf:Description rdf:about=""/>'));
    });

    it("leaves out empty values", function () {
      var packet = buildXmpPacket({
        title: "",
        author: undefined,
        producer: null,
      });
      assert.ok(!packet.includes("dc:title"));
      assert.ok(!packet.includes("pdf:Producer"));
    });

    it("converts PDF dates", function () {
      assert.strictEqual(
        pdfDateToXmp("D:20200102030405Z"),
        "2020-01-02T03:04:05Z",
      );
      assert.strictEqual(
        pdfDateToXmp("D:20200102030405+01'30'"),
        "2020-01-02T03:04:05+01:30",
      );
      assert.strictEqual(
        pdfDateToXmp("D:20200102030405-05'00'"),
        "2020-01-02T03:04:05-05:00",
      );
      assert.strictEqual(
        pdfDateToXmp("D:20200102030405"),
        "2020-01-02T03:04:05",
      );
      assert.strictEqual(pdfDateToXmp("D:2020"), "2020");
      // the writer does not take a date without D: either
      assert.strictEqual(pdfDateToXmp("20200102"), undefined);
      assert.strictEqual(pdfDateToXmp("D:20200102"), "2020-01-02");
      assert.strictEqual(pdfDateToXmp("not a date"), undefined);
    });
  });

  describe("Recipe", function () {
    it("writes a packet that mirrors the Info dictionary of a new PDF", function () {
      var file = create("XMPNew", { xmp: true }, function (recipe) {
        recipe.info({
          title: "Recipe Title",
          author: "Someone",
          keywords: ["a", "b"],
        });
      });
      var packet = xmpOf(file);
      assert.ok(packet.includes(">Recipe Title</rdf:li>"));
      assert.ok(packet.includes("<rdf:li>Someone</rdf:li>"));
      assert.ok(packet.includes("<pdf:Keywords>a, b</pdf:Keywords>"));
      var info = infoOf(file);
      assert.strictEqual(info.Keywords, "a, b");
      assert.ok(
        packet.includes("<pdf:Producer>" + info.Producer + "</pdf:Producer>"),
      );
      assert.ok(
        packet.includes(
          "<xmp:CreatorTool>" + info.Creator + "</xmp:CreatorTool>",
        ),
      );
      // the Info dates and the XMP dates are the same instants
      [
        ["CreationDate", "CreateDate"],
        ["ModDate", "ModifyDate"],
      ].forEach(function ([key, xmpKey]) {
        var xmp = packet.match(new RegExp("<xmp:" + xmpKey + ">(.*?)<"))[1];
        assert.strictEqual(
          Date.parse(xmp),
          Date.parse(pdfDateToXmp(info[key])),
          key + " " + xmp + " vs " + info[key],
        );
      });
      assert.ok(fs.readFileSync(file, "latin1").includes("/Subtype /XML"));
      // unfiltered, so that tools which know nothing about PDF find it
      assert.ok(
        fs.readFileSync(file, "latin1").includes(">Recipe Title</rdf:li>"),
      );
    });

    it("reads the packet after endPDF", function () {
      var source = create("XMPAfterEnd", { xmp: true });
      var recipe = new Recipe(source, out("XMPAfterEndEdit"));
      var before = recipe.xmp();
      recipe.endPDF();
      assert.ok(before.includes("<?xpacket"));
      assert.equal(recipe.xmp(), before);
    });

    it("writes no packet by default or when false", function () {
      assert.strictEqual(xmpOf(create("XMPOff")), undefined);
      assert.strictEqual(xmpOf(create("XMPFalse", { xmp: false })), undefined);
    });

    it("returns undefined for a new PDF", function () {
      var recipe = new Recipe("new", out("XMPNone"));
      assert.strictEqual(recipe.xmp(), undefined);
      recipe.createPage("letter").endPage().endPDF();
    });

    it("keeps the packet when the PDF is edited", function () {
      var file = create("XMPKeep", { xmp: true }, function (recipe) {
        recipe.info({ title: "Kept" });
      });
      var before = xmpOf(file);
      assert.ok(before.includes(">Kept</rdf:li>"));
      var edited = out("XMPKept");
      new Recipe(file, edited).endPDF();
      assert.strictEqual(xmpOf(edited), before);
    });

    it("mirrors the title of the Info dictionary, not a custom entry", function () {
      // the source also has a custom /title
      var edited = out("XMPMixed");
      new Recipe(
        path.join(__dirname, "TestMaterials/recipe/info-mixed.pdf"),
        edited,
        { xmp: true },
      ).endPDF();
      assert.ok(xmpOf(edited).includes(">Indirect title</rdf:li>"));
      assert.equal(infoOf(edited).Title, "Indirect title");
    });

    it("takes the Info title of a low-level change", function () {
      var source = create("XMPLowSource", {}, function (recipe) {
        recipe.info({ title: "Source" });
      });
      var edited = out("XMPLow");
      var recipe = new Recipe(source, edited, { xmp: true });
      recipe.writer.getDocumentContext().getInfoDictionary().title = "LowLevel";
      recipe.endPDF();
      assert.strictEqual(infoOf(edited).Title, "LowLevel");
      assert.ok(xmpOf(edited).includes(">LowLevel</rdf:li>"));
    });

    it("refuses the packet of a PDF whose metadata is not encrypted", function () {
      var message =
        "Recipe cannot read or write the XMP of a PDF whose metadata is not encrypted";
      // the reader and writer would decrypt and encrypt it all the same
      var source = path.join(
        __dirname,
        "TestMaterials",
        "recipe",
        "xmp-plain-metadata.pdf",
      );
      var recipe = new Recipe(source, out("XMPPlain"), { xmp: true });
      assert.strictEqual(recipe.info().title, "Plain");
      assert.throws(() => recipe.xmp(), { message });
      assert.throws(() => recipe.endPDF(), { message });
    });

    it("replaces the packet of an edited PDF with the xmp option", function () {
      var file = create("XMPSource", { xmp: true }, function (recipe) {
        recipe.info({ title: "Before" });
      });
      var edited = out("XMPFollow");
      var recipe = new Recipe(file, edited, { xmp: true });
      recipe.info({ title: "After", author: "Someone", ReportId: "X-1" });
      recipe.endPDF();
      var packet = xmpOf(edited);
      assert.ok(packet.includes(">After</rdf:li>"));
      assert.ok(packet.includes("<rdf:li>Someone</rdf:li>"));
      assert.ok(!packet.includes("Before"));
      assert.ok(!packet.includes("ReportId"));
      var info = infoOf(edited);
      assert.strictEqual(info.Title, "After");
      assert.strictEqual(info.ReportId, "X-1");
    });

    it("carries the values of the source into the packet", function () {
      var file = create("XMPCarrySource", {}, function (recipe) {
        recipe.info({ title: "From source", subject: "S" });
      });
      var edited = out("XMPCarry");
      new Recipe(file, edited, { xmp: true }).endPDF();
      var packet = xmpOf(edited);
      assert.ok(packet.includes(">From source</rdf:li>"));
      assert.ok(packet.includes(">S</rdf:li>"));
      // the creation date of the source
      assert.ok(
        packet.includes(
          "<xmp:CreateDate>" +
            pdfDateToXmp(infoOf(edited).CreationDate) +
            "</xmp:CreateDate>",
        ),
      );
    });

    it("writes the packet again after the annotation pass", function () {
      var file = create("XMPAnnotSource");
      var edited = out("XMPAnnot");
      var recipe = new Recipe(file, edited, { xmp: true });
      recipe.info({ title: "Annotated", ReportId: "X-1" }).custom("Dept", "Y");
      recipe
        .editPage(1)
        .comment("A comment", "center", 100, { title: "Note" })
        .endPage();
      recipe.endPDF();
      var packet = xmpOf(edited);
      assert.ok(packet.includes(">Annotated</rdf:li>"));
      var info = infoOf(edited);
      assert.strictEqual(info.Title, "Annotated");
      assert.strictEqual(info.ReportId, "X-1");
      assert.strictEqual(info.Dept, "Y");
      assert.ok(fs.readFileSync(edited, "latin1").includes("/Annot"));
    });
  });
});
