import { createMuhammaraWasm, createRecipe } from "../../index.js";
import type {
  XrefEntryType,
  PDFObjectType,
  ETokenSeparator,
  EInfoTrapped,
  DrawingPathType,
  PDFPageContentItemType,
  RecipeArcOptions,
  RecipeArrowOptions,
  RecipeColorSpace,
  RecipeDeviceColorSpace,
  RecipeExtension,
  RecipeLayoutOptions,
  RecipeLineStyleOptions,
  RecipeMetadata,
  RecipeNGonOptions,
  RecipePageInfo,
  RecipePageSelection,
  RecipePdfInspection,
  RecipePermission,
  RecipePermissionName,
  RecipePosition,
  RecipeRectangleOptions,
  RecipeSplitResult,
  RecipeStructure,
  RecipeStructureFormat,
  Recipe,
  RecipeTableColumnOptions,
  RecipeTableOptions,
  RecipeTableRow,
  RecipeTextBox,
  RecipeTextMarkupOptions,
  RecipeTriangleOptions,
  RecipeTrianglePosition,
  RecipeTriangleTrait,
} from "../../index.js";
import { PDFPage } from "../../index.js";

// @ts-expect-error PDFPage is available only from a loaded runtime instance.
void PDFPage;

var pathTypes: DrawingPathType[] = ["stroke", "fill", "clip", null];
void pathTypes;
// @ts-expect-error Drawing paint modes are a closed set.
var invalidPathType: DrawingPathType = "future-paint-mode";
void invalidPathType;

async function usesLowLevelSurface() {
  var muhammara = await createMuhammaraWasm();
  muhammara.registerFont("font", new Uint8Array());
  await muhammara.registerFontAsync("font-async", new Blob());
  var writer = muhammara.createWriter({
    version: muhammara.ePDFVersion20,
    compress: false,
  });
  var page = writer.createPage();
  muhammara.KProcsetImageB;
  muhammara.KProcsetImageC;
  muhammara.KProcsetImageI;
  muhammara.kProcsetPDF;
  muhammara.kProcsetText;
  var font = writer.getFontForBytes("font", 0);
  var metrics = font.getFontMetrics(12);
  metrics.pixelsPerEm.x;
  metrics.ascender;
  metrics.descender;
  metrics.height;
  metrics.max_advance;
  writer.requireCatalogUpdate();
  var context = writer.startPageContentContext(page);
  context
    .q()
    .drawRectangle(0, 0, 50, 50, { type: "clip" })
    .drawCircle(25, 25, 10, { type: "clip" })
    .drawSquare(0, 0, 20, { type: "clip", close: true })
    .drawPath(0, 0, 20, 20, { type: "clip", close: true })
    .drawRectangle(0, 0, 50, 50, { type: "stroke" })
    .drawCircle(25, 25, 10, { type: "fill" })
    .drawRectangle(0, 0, 20, 20, { type: null })
    // @ts-expect-error Unknown paint modes are not supported inputs; they silently leave the path unpainted.
    .drawCircle(25, 25, 10, { type: "future-paint-mode" })
    .drawPath(
      [
        [0, 0],
        [20, 20],
      ],
      { width: 2 },
    )
    .writeText("Finite geometry", 10, 20, {
      font,
      size: 12,
      underline: true,
    })
    .Q();
  context
    .q()
    .d([1, 2])
    .rg(1, 0, 0)
    .m(0, 0)
    .l(10, 10)
    .drawPath(0, 0, 10, 10, 20, 20, { color: "#000000" })
    .S()
    .BT()
    .Tf(font, 12)
    .Tm(1, 0, 0, 1, 10, 10)
    .Tj("text", { encoding: "text" })
    .Tj([[1, 65]])
    .TJ("more", -20, "text")
    .ET()
    .Q();
  // @ts-expect-error Glyphs do not accept string encoding options.
  context.Tj([[1, 65]], { encoding: "hex" });
  // @ts-expect-error TJ requires at least one text or spacing item.
  context.TJ();
  // @ts-expect-error TJ options must be the final item.
  context.TJ({ encoding: "text" }, "text");
  await context.drawImageAsync(0, 0, new Blob());
  var objects = writer.getObjectsContext();
  var objectId = objects.allocateNewObjectID();
  objects
    .startNewIndirectObject(objectId)
    .startDictionary()
    .writeKey("Type")
    .writeNameValue("Example");
  writer.writePage(page);
  var source = writer.end();
  var encrypted = muhammara.recrypt(source, {
    userPassword: "viewer",
    ownerPassword: "owner",
    userProtectionFlag: 4,
    version: muhammara.ePDFVersion17,
  });
  muhammara.recrypt(encrypted, { password: "viewer", version: 0 });
  // @ts-expect-error WebAssembly recrypt does not support PDF 2.0/AES-256.
  muhammara.recrypt(source, { version: muhammara.ePDFVersion20 });
  var reader = muhammara.createReader(source);
  var textElement = reader.extractPageText(0)[0];
  textElement.content;
  textElement.fontResource;
  textElement.fontSize;
  textElement.textMatrix[5];
  var boundedText = reader.extractPageText(0, { maxElements: 10 })[0];
  boundedText.content;
  var contentItem = reader.extractPageContentItems(0)[0];
  contentItem.type;
  contentItem.operation;
  var itemType: PDFPageContentItemType = muhammara.ePDFPageContentItemPath;
  itemType = muhammara.ePDFPageContentItemText;
  itemType = muhammara.ePDFPageContentItemXObject;
  itemType = muhammara.ePDFPageContentItemShading;
  contentItem.type === itemType;
  var boundedItem = reader.extractPageContentItems(0, {
    maxElements: 10,
    maxOperands: 16,
    maxTextBytes: 1024,
    maxParsedObjects: 100,
  })[0];
  boundedItem.operation;
  reader.end();
  var sourceBlob = new Blob([source.buffer as ArrayBuffer]);
  var input = new muhammara.PDFRStreamForBuffer(source);
  var firstBytes: Uint8Array = input.read(5);
  // @ts-expect-error PDFRStreamForBuffer reads return Uint8Arrays, not number arrays.
  var firstByteArray: number[] = input.read(5);
  void firstBytes;
  void firstByteArray;
  input.setPosition(0);
  var output = new muhammara.PDFWStreamForBuffer();
  output.write(source);
  output.buffer;
  muhammara.createReader(input);
  output.toBlob().slice(0, 1).arrayBuffer();
  var formWriter = muhammara.createWriter();
  var form = formWriter.createFormXObject(0, 0, 1, 1);
  form.getResourcesDictinary();
  // @ts-expect-error Writer forms are closed by the owning writer.
  form.end();
  formWriter.endFormXObject(form);
  formWriter.end();
  var completedForm = formWriter.createFormXObjectFromJPGBytes("image");
  completedForm.id;
  // @ts-expect-error Image-derived forms cannot receive content.
  completedForm.getContentContext();
  var mergeWriter = muhammara.createWriter();
  var mergePage = mergeWriter.createPage();
  mergeWriter.mergePDFPagesToPage(mergePage, source, function () {
    var callbackThis: typeof globalThis = this;
    void callbackThis;
  });
  mergeWriter.mergePDFPagesToPage(mergePage, source, {}, function () {});
  await mergeWriter.mergePDFPagesToPageAsync(
    mergePage,
    sourceBlob,
    function () {},
  );
  await mergeWriter.mergePDFPagesToPageAsync(
    mergePage,
    sourceBlob,
    {},
    function () {},
  );
  await mergeWriter.createFormXObjectsFromPDFAsync(sourceBlob);
  await mergeWriter.createFormXObjectFromTIFFAsync(new Blob());
  await mergeWriter.createFormXObjectFromTIFFBytesAsync(new Blob());
  await mergeWriter.getImageTypeAsync(new Blob());
  await mergeWriter.getImagePagesCountAsync(new Blob());
  await mergeWriter.retrieveJPGImageInformationAsync(new Blob());
  mergeWriter.writePage(mergePage);
  mergeWriter.end();
  var modifier = await muhammara.createWriterToModifyAsync(
    new Blob([new ArrayBuffer(0)]),
    { version: muhammara.ePDFVersion17, compress: false },
  );
  var syncModifier = muhammara.createWriterToModify(source, {
    version: muhammara.ePDFVersion17,
    compress: false,
  });
  muhammara
    .createModifier(source)
    .startPage(0)
    .rectangle(0, 0, 1, 1, { fill: "#dbeafe" })
    .circle(1, 1, 1, { stroke: "#000000" })
    .line(0, 0, 1, 1, { lineWidth: 1 })
    .text("text", 0, 0, { font: "font" })
    .image("image", 0, 0, 1, 1)
    .endPage()
    .end();
  syncModifier.end();
  modifier.requireCatalogUpdate();
  modifier.getDocumentContext().getInfoDictionary().title = "modified";
  modifier.createPDFTextString("text");
  modifier.createPDFDate();
  modifier.createPageModifier();
  modifier.createPageModifier(0, true);
  var modifiedPage = modifier.createPage();
  var modifiedContext = modifier.startPageContentContext(modifiedPage);
  modifiedContext.getAssociatedPage?.();
  modifiedContext.getCurrentPageContentStream?.().getWriteStream();
  modifier.pausePageContentContext(modifiedContext);
  modifier.attachURLLinktoCurrentPage("https://example.test", 0, 0, 1, 1);
  modifier.createAnnotation("Text", 0, 0, 1, 1);
  modifier.createAnnotation("Text", 0, 0, 1, 1, { color: [0, 0, 0] });
  // @ts-expect-error Annotation colors have one, three, or four components.
  modifier.createAnnotation("Text", 0, 0, 1, 1, { color: [0, 0] });
  modifier.registerAnnotationReferenceForNextPageWrite(1);
  modifier.writePageAndReturnID(modifiedPage);
  modifier.appendPDFPagesFromPDF(source);
  modifier.appendPDFPagesFromPDF(source, {
    type: 1,
    specificRanges: [[0, 0]],
  });
  // @ts-expect-error Specific page ranges cannot be empty.
  modifier.appendPDFPagesFromPDF(source, { type: 1 });
  // @ts-expect-error Only all-pages and specific-pages range types exist.
  modifier.appendPDFPagesFromPDF(source, { type: 2 });
  await modifier.appendPDFPagesFromPDFAsync(
    new Blob([source.buffer as ArrayBuffer]),
  );
  modifier.getImageDimensions(source);
  await modifier.getImageDimensionsAsync(
    new Blob([source.buffer as ArrayBuffer]),
  );
  modifier.getImageType(source);
  await modifier.getImageTypeAsync(sourceBlob);
  modifier.getImagePagesCount(source);
  await modifier.getImagePagesCountAsync(sourceBlob);
  modifier.retrieveJPGImageInformation(source);
  await modifier.retrieveJPGImageInformationAsync(sourceBlob);
  modifier.createFormXObjectsFromPDF(source);
  await modifier.createFormXObjectsFromPDFAsync(sourceBlob);
  var modifierForm = modifier.createFormXObject(0, 0, 1, 1, 10);
  modifierForm
    .getContentContext()
    .q()
    .d([1, 2])
    .ri("RelativeColorimetric")
    .BT()
    .Tf(modifier.getFontForBytes("font"), 12)
    .Tj("text")
    .ET()
    .drawRectangle(0, 0, 1, 1)
    .doXObject(1);
  modifierForm.getContentStream().getWriteStream().write(new Uint8Array());
  modifierForm.getResourcesDictionary().addFontMapping(1);
  var modifierMetrics = modifier.getFontForBytes("font").getFontMetrics(12);
  modifierMetrics.pixelsPerEm.y;
  modifierMetrics.height;
  var directlyEndedModifierForm = modifier.createFormXObject(0, 0, 1, 1);
  directlyEndedModifierForm.end();
  modifier.endFormXObject(modifierForm);
  modifier.createFormXObjectFromTIFF(source, { pageIndex: 0, objectId: 11 });
  modifier.createFormXObjectFromTIFFBytes(source, {
    bwTreatment: { asImageMask: true, oneColor: [0, 0, 0] },
    grayscaleTreatment: { asColorMap: true, oneColor: [0, 0, 0, 0] },
  });
  modifier.createFormXObjectFromTIFFBytes(source, {
    // @ts-expect-error TIFF treatment colors have three or four components.
    bwTreatment: { oneColor: [0, 0] },
  });
  await modifier.createFormXObjectFromTIFFAsync(sourceBlob);
  await modifier.createFormXObjectFromTIFFBytesAsync(sourceBlob);
  modifier.mergePDFPagesToPage(modifiedPage, source, function () {
    var callbackThis: typeof globalThis = this;
    void callbackThis;
  });
  modifier.mergePDFPagesToPage(modifiedPage, source, {}, function () {});
  await modifier.mergePDFPagesToPageAsync(
    modifiedPage,
    sourceBlob,
    function () {},
  );
  await modifier.mergePDFPagesToPageAsync(
    modifiedPage,
    sourceBlob,
    {},
    function () {},
  );
  var parser = modifier.getModifiedFileParser();
  var parserBytes: Uint8Array = parser.getParserStream().read(5);
  void parserBytes;
  var pageInput = parser.parsePage(0);
  pageInput.getDictionary().toJSObject();
  pageInput.getMediaBox();
  parser.getParserStream().setPosition(0).dispose();
  mergeWriter
    .createPDFCopyingContext(source)
    .getSourceDocumentParser()
    .getSourceDocumentStream()
    .dispose()
    .read(1);
  parser.getXrefEntry(parser.getPageObjectID(0));
  modifier.replaceObject(0, parser.getPageObjectID(0), 11, { scope: "global" });
  modifier.end();
  var Recipe = await createRecipe();
  Recipe.registerFont("regular", new Uint8Array(), "regular");
  await Recipe.registerFontAsync("bold", new Blob(), "bold");
  Recipe.registerImage("image", new Uint8Array(), "png");
  await Recipe.registerImageAsync("image-async", new Blob(), "tiff");
  Recipe.registerPdf("pdf", source);
  await Recipe.registerPdfAsync("pdf-async", sourceBlob);
  var inspection: RecipePdfInspection = Recipe.inspectPdf("pdf");
  inspection[1].offsetX;
  var splitResults: RecipeSplitResult[] = Recipe.splitPdf("pdf", "part");
  splitResults[0].bytes;
  var permission: RecipePermission = "print, copy";
  var permissionName: RecipePermissionName = "print";
  var arbitraryPermissionList: string = "print, copy, edit";
  Recipe.permission(permission);
  Recipe.permission(arbitraryPermissionList);
  var colorSpace: RecipeColorSpace = "rgb";
  var pageSelection: RecipePageSelection = [1, [2, 3]];
  var rectangleOptions: RecipeRectangleOptions = { borderRadius: [1, 2] };
  var arcOptions: RecipeArcOptions = { sector: true };
  var ngonOptions: RecipeNGonOptions = { rotationVertice: 1 };
  var arrowOptions: RecipeArrowOptions = { type: "kite", at: "head" };
  var triangleOptions: RecipeTriangleOptions = {
    traitID: "sss",
    position: "centroid",
  };
  var lineStyleOptions: RecipeLineStyleOptions = { dash: [1, 2] };
  var layoutOptions: RecipeLayoutOptions = { columns: 2, gap: 18 };
  var structureFormat: RecipeStructureFormat = { json: true };
  var position: RecipePosition = [10, 20];
  var row: RecipeTableRow = { name: "Ada" };
  var triangleTrait: RecipeTriangleTrait = "sss";
  var trianglePosition: RecipeTrianglePosition = "centroid";
  void permissionName;
  void colorSpace;
  void pageSelection;
  void rectangleOptions;
  void arcOptions;
  void ngonOptions;
  void arrowOptions;
  void triangleOptions;
  void lineStyleOptions;
  void layoutOptions;
  void structureFormat;
  void position;
  void row;
  void triangleTrait;
  void trianglePosition;
  var recipe = new Recipe({ version: 1.7, compress: false, title: "Byte PDF" });
  recipe
    .createPage()
    .setPageBox(muhammara.ePDFPageBoxCropBox, 18, 18, 594, 774)
    .endPage();
  var defaultFontBytes: Uint8Array = new Recipe()
    .createPage("letter")
    .text("Hello", 72, 72)
    .text("Roboto", { font: "Roboto" })
    .endPage()
    .endPDF();
  recipe.textDimensions("Hello").width;
  var tableClippingBox: RecipeTextBox = {
    height: 14,
    clipIfExceedsBox: true,
    /** Declarative table callbacks receive a Recipe and the clipping result. */
    onClip(currentRecipe, result) {
      var remainder: string = result.remainder;
      void currentRecipe;
      void remainder;
    },
  };
  recipe.table(20, 20, [{ value: "one\ntwo" }], {
    textBox: tableClippingBox,
    columns: [
      {
        name: "value",
        cell: tableClippingBox,
        header: { textBox: tableClippingBox },
        hcell: tableClippingBox,
      },
    ],
    header: { cell: tableClippingBox },
    row: { cell: tableClippingBox },
  });
  recipe.table(20, 20, [{ value: "first" }], {
    // @ts-expect-error Native Recipe ignores a table-level cell.
    cell: { padding: 0 },
  });
  recipe.table(20, 20, [{ value: "first", optional: "second" }], {
    header: {
      font: "arial",
      size: 12,
      alignToData: true,
      cell: { padding: 2 },
    },
    columns: [
      {
        name: "value",
        cell: { padding: 4, minHeight: 40 },
        header: { size: 18, textBox: { style: { stroke: "blue" } } },
        hcell: { height: 60 },
        /** Exercises renderer-controlled table box sizing. */
        renderer: () => ({ textBox: { minHeight: 80 } }),
      },
      { name: "optional", header: false },
      // @ts-expect-error A column's body text box is `cell`, as in native.
      { name: "boxed", textBox: { padding: 0 } },
    ],
    /** The callback receiver and first argument both expose Recipe methods. */
    overflow: function (currentRecipe, row) {
      var callbackThis: InstanceType<typeof Recipe> = this;
      callbackThis.endPage().createPage("letter");
      void currentRecipe;
      return row > 10 ? true : { position: [20, 20] };
    },
  });
  var markup: RecipeTextMarkupOptions = {
    text: "Review",
    color: "#ff0000",
    opacity: 0.4,
    replies: [{ text: "Done", title: "Editor" }],
  };
  recipe.text("Marked", 20, 20, {
    highlight: true,
    underline: markup,
    strikeOut: { text: "cut" },
    squiggly: true,
    title: "Reviewer",
    subject: "Check",
  });
  void defaultFontBytes;
  await createMuhammaraWasm({ wasmBinary: new Uint8Array() });
  await createMuhammaraWasm({ wasmBinary: new ArrayBuffer(0) });
  await createRecipe({
    wasmBinary: new Uint8Array(),
    locateFile: (path, prefix) => prefix + path,
  });
  // @ts-expect-error Other views are converted element by element, not copied.
  await createMuhammaraWasm({ wasmBinary: new Uint16Array() });
  // @ts-expect-error Read Blob and File input with arrayBuffer() first.
  await createRecipe({ wasmBinary: new Blob() });
  // @ts-expect-error Use locateFile to load the binary from a URL.
  await createMuhammaraWasm({ wasmBinary: "muhammara-wasm.wasm" });
  await createRecipe({ defaultFont: new Uint8Array() });
  await createRecipe({ defaultFont: new ArrayBuffer(0) });
  await createRecipe({ defaultFont: new Blob() });
  await createRecipe({ defaultFont: new File([], "body.ttf") });
  await createRecipe({ defaultFont: false });
  // @ts-expect-error A default font is byte data or false, not a path.
  await createRecipe({ defaultFont: "body.ttf" });
  // @ts-expect-error Omit the option to use bundled Roboto.
  await createRecipe({ defaultFont: true });
  new Recipe({ version: 17 });
  new Recipe({ version: 2 });
  new Recipe({ version: 20 });
  // @ts-expect-error PDF 1.8 is not a real PDF version.
  new Recipe({ version: 1.8 });
  recipe.endPDF((bytes) => bytes.byteLength);
  // @ts-expect-error Recipe.fillOpacity() was removed in v7.
  recipe.fillOpacity(0.5);
  recipe.registerFont("instance-font", new Uint8Array());
  await recipe.registerFontAsync("instance-font-async", new Blob());
  recipe.htmlToTextObjects("<b>text</b>")[0].styles.bold;
  recipe.htmlToTextObjects("<ul><li><b>text</b></li></ul>")[0].indent;
  recipe
    .register("extension", function () {
      return this;
    })
    .createPage("letter", 90, { left: 36 })
    .text("Default size", 72, 72, { link: "https://text.example.test" })
    .text("Explicit size", 72, 100, { size: 12 })
    .text("Explicit fontSize", 72, 128, { fontSize: 12 })
    .margins(36, 36, 72, 72)
    .rotateContent(15, 10, 10)
    .lineStyle({
      width: 1,
      cap: 1,
      join: 1,
      miterLimit: 2,
      dash: [1],
      dashPhase: 1,
    })
    .lineWidth(2)
    .opacity(0.5)
    .chroma("brand", "#001122", "rgb")
    .line(0, 0, 10, 10, { lineCap: "round", lineJoin: "bevel" })
    .line(
      [
        [0, 0],
        [10, 10],
      ],
      { stroke: "brand" },
    )
    .moveTo(0, 0)
    .lineTo(10, 10, { stroke: "#000000" })
    .polygon(
      [
        [0, 0],
        [10, 0],
      ],
      { fill: "#000000" },
    )
    .rectangle(0, 0, 10, 10, {
      borderRadius: [1, 2, 3, 4],
      link: "https://shape.example.test",
    })
    .circle(10, 10, 5)
    .ellipse(10, 10, 5, 2)
    .arc(10, 10, 5, 0, 90, { sector: true })
    .pie(10, 10, 5)
    .n_gon(10, 10, 5, 3, { rotationVertice: 1 })
    .n_gon(10, 10, 5, { fill: "#000000" })
    .star(10, 10, 5, 5)
    .star(10, 10, 5, { fill: "#000000" })
    .arrow(10, 10, {
      type: "kite",
      head: [5, 10, 0],
      shaft: [10, 2],
      double: true,
      at: "head",
      debug: 2,
    })
    .triangle(10, 10, [3, 4, 5], {
      traitID: "sss",
      position: "circumcenter",
      flipX: true,
      flipY: true,
    })
    .triangle(
      10,
      10,
      [
        [0, 0],
        [1, 1],
        [2, 0],
      ],
      { traitsID: "vtx" },
    )
    .fill()
    .stroke()
    .fillAndStroke()
    .image("image", 10, 10, {
      index: 1,
      align: "center center",
      link: "https://image.example.test",
    })
    .appendPage("pdf", [1, [2, 3]])
    .overlay("pdf", { page: 1, fitWidth: true })
    .overlay("pdf", 10, { page: 1 })
    .overlay("pdf", 10, 10, {
      page: 1,
      fitHeight: true,
      keepAspectRatio: false,
    })
    .link("https://example.test", 0, 0, 10, 10)
    .comment("comment", "center", "center", {
      richText: true,
      replies: [{ text: "reply" }],
    })
    .annot(0, 0, "Square", { width: 10, height: 10, flag: "print" })
    .annot(100, 200, "Highlight", { width: 200, height: 14, opacity: 0.45 })
    .annot(100, 230, "Highlight", { width: 200, height: 14, opacity: 0 })
    .info({
      author: "author",
      keywords: ["one", "two"],
      ReportId: "X-123",
      "2.16.76.1.4.2.2.1": "oid-professional",
      Labels: ["one", "two"],
    })
    .custom("ReportId", "X-456")
    .info({ ReportId: "X-789" })
    .custom("custom", "value")
    .insertPage(0, "pdf", 1);
  recipe.knownColors.rgb.blue;
  recipe.margins().left;
  var textWidth: number = recipe.textDimensions("text").width;
  recipe.textDimensions("text", { size: 12 }).width;
  recipe.textDimensions("text", { fontSize: 12 }).width;
  void textWidth;
  recipe.pageInfo(1)?.mediaBox[3];
  var pageInfo: RecipePageInfo | null = recipe.pageInfo(1);
  pageInfo?.width;
  recipe.getCurrentPageInfo()?.mediaBox[3];
  recipe.endPage().endPDF();
  var byteRecipe = new Recipe(source, { compress: false });
  byteRecipe.replaceText("Before", "After", 1);
  // @ts-expect-error replaceText requires a one-based page number.
  byteRecipe.replaceText("Before", "After");
  byteRecipe.removeText(1).removeText(1, { forms: true });
  // @ts-expect-error removeText requires a one-based page number.
  byteRecipe.removeText();
  // @ts-expect-error forms must be a boolean.
  byteRecipe.removeText(1, { forms: "yes" });
  byteRecipe.getPageInfo();
  byteRecipe.getCurrentPageInfo()?.rotate;
  byteRecipe
    .editPage(1)
    .pauseContext()
    .resumeContext()
    .endPage()
    .deletePage([2, 3])
    .deletePage(1)
    .endPDF();
  var asyncByteRecipe = new Recipe();
  var metadata: RecipeMetadata = await asyncByteRecipe.readAsync(sourceBlob);
  metadata[1].width;
  asyncByteRecipe.editPage(1).endPage().endPDF();
  var structure = recipe.structure("json");
  if (typeof structure !== "string") {
    var typedStructure: RecipeStructure = structure;
    typedStructure.objects;
  }
}

void usesLowLevelSurface;

interface Invoice {
  id: number;
  customer: string;
  note?: string;
  paid: string | null;
}

/**
 * Parameters keep their declared types at the call sites below; initialized
 * variables would be narrowed to their literals and hide declaration bugs.
 */
function usesRecipeDeclarations(
  recipe: Recipe,
  invoices: readonly Invoice[],
  deviceColorSpace: RecipeDeviceColorSpace,
  colorSpace: RecipeColorSpace,
  markup: RecipeTextMarkupOptions,
  extension: RecipeExtension<[prefix: string], string>,
  columns: readonly RecipeTableColumnOptions<Invoice>[],
  tableOptions: RecipeTableOptions<Invoice>,
) {
  recipe.chroma("brand", "#001122", deviceColorSpace);
  recipe.chroma("inferred", "#001122", "");
  // @ts-expect-error Separation colors are unsupported in WebAssembly Recipe.
  recipe.chroma("spot", [0, 255, 0, 0], colorSpace);
  // @ts-expect-error Separation colors are unsupported in WebAssembly Recipe.
  recipe.rectangle(0, 0, 10, 10, { colorspace: "separation" });

  recipe.register("describe", extension);
  recipe.register(function summarize(this: Recipe, count: number) {
    return count;
  });
  recipe.register("chain", function (this: Recipe, label: string): Recipe {
    return this.text(label);
  });

  recipe.text("Marked", 10, 10, {
    highlight: markup,
    underline: { text: "Check.", color: "#0000ff", opacity: 0.5 },
    strikeOut: true,
    squiggly: { replies: [{ text: "Reply.", title: "Reviewer" }] },
    title: "Reviewer",
    open: true,
    date: new Date(),
  });
  recipe.text("Wrapped", 10, 10, {
    textBox: { width: 100, height: 50, wrap: "ellipsis" },
  });
  // @ts-expect-error Markup options are annotation options, not path options.
  recipe.text("Marked", 10, 10, { underline: { lineWidth: 2 } });

  recipe.table(10, 10, invoices, {
    order: ["customer", "id"],
    columns: [
      {
        name: "id",
        renderer: (text, record, field, row) => {
          var id: number = text;
          var customer: string = record.customer;
          var name: "id" = field;
          void [id, customer, name, row];
          return { color: "#ff0000" };
        },
      },
      {
        name: "note",
        renderer: (text) => {
          var note: string = text;
          void note;
          return null;
        },
      },
      {
        name: "paid",
        renderer: (text) => {
          // Missing and null values arrive as "".
          var paid: string = text;
          void paid;
        },
      },
    ],
    row: { nth: "even", cell: { padding: 2 } },
    overflow: function (currentRecipe) {
      var receiver: Recipe = this;
      void currentRecipe;
      receiver.endPage().createPage(300, 300);
      return { position: [10, 10] };
    },
  });
  recipe.table(10, 10, invoices, { columns, ...tableOptions });
  recipe.table(10, 10, [{ a: 1 }, { a: 2, b: "x" }]);
  // @ts-expect-error Columns name record fields.
  recipe.table(10, 10, invoices, { columns: [{ name: "total" }] });
  // @ts-expect-error Order names record fields.
  recipe.table(10, 10, invoices, { order: ["total"] });

  recipe.layout("columns", 0, 0, 0, 0, { columns: 2, gap: 12 });
  // @ts-expect-error Layout columns is a column count.
  recipe.layout("columns", 0, 0, 0, 0, { columns: [{ name: "a" }] });

  recipe.arrow(10, 10, { type: 2, head: [5, 10], shaft: 3 });
  // @ts-expect-error Arrow types are 0, 1, 2, triangle, dart, or kite.
  recipe.arrow(10, 10, { type: 3 });
  // @ts-expect-error An arrow head has at most three dimensions.
  recipe.arrow(10, 10, { head: [1, 2, 3, 4] });

  recipe.triangle(10, 10, [3, 4, 5], { traitID: "SAS", position: "Centroid" });
  var vertices = [
    [0, 0],
    [1, 1],
    [2, 0],
  ] as const;
  recipe.triangle(10, 10, vertices, { traitID: "vtx" });
  // @ts-expect-error Readonly vertices cannot be repositioned.
  recipe.triangle(10, 10, vertices, { traitID: "vtx", position: "a" });
  // @ts-expect-error Measurements need a measurement trait.
  recipe.triangle(10, 10, [3, 4, 5], { traitID: "vtx" });
}

void usesRecipeDeclarations;

async function usesAlignedDeclarations() {
  var muhammara = await createMuhammaraWasm();
  var writer = muhammara.createWriter();
  var page = writer.createPage();
  page.getResourcesDictionary().addFormXObjectMapping(1);
  var context = writer.startPageContentContext(page);
  context
    .drawPath(0, 0, 10, 10)
    .drawPath(0, 0, 10, 10, { type: "fill" })
    .SCN(1, 0, 0)
    .SCN(1, 0, 0, "P0")
    .scn([1, 0, 0], "P0");
  // @ts-expect-error A pattern name needs color components.
  context.SCN("P0");
  var font = writer.getFontForBytes("arial");
  var glyphWidth: number = font.calculateTextDimensions([43, 76], 12).width;
  void glyphWidth;
  var reader = muhammara.createReader(writer.end());
  var position: number = reader.getXrefEntry(1).objectPosition;
  void position;

  var Recipe = await createRecipe();
  new Recipe({})
    .createPage("A4")
    .text("centered", "center", "center")
    .image("logo", "center", "center", { width: 10 });
}

void usesAlignedDeclarations;

async function usesNamedValueSets() {
  var muhammara = await createMuhammaraWasm();
  var writer = muhammara.createWriter();
  var context = writer.startPageContentContext(writer.createPage());
  void context;
  context.J(2);
  // @ts-expect-error PDF line caps are 0 to 2.
  context.J(3);
  context.j(2);
  // @ts-expect-error PDF line joins are 0 to 2.
  context.j(3);
  context.Tr(7);
  // @ts-expect-error PDF text rendering modes are 0 to 7.
  context.Tr(8);
  var info = writer.getDocumentContext().getInfoDictionary();
  info.trapped = muhammara.EInfoTrappedTrue;
  var trapped: EInfoTrapped = info.trapped;
  void trapped;
  // @ts-expect-error Trapped accepts only the EInfoTrapped constants.
  info.trapped = 3;
  var objects = writer.getObjectsContext();
  var separator: ETokenSeparator = muhammara.eTokenSeparatorEndLine;
  objects.startArray().endArray(separator);
  // @ts-expect-error Separators are the eTokenSeparator constants.
  objects.startArray().endArray(3);
  var parsed = muhammara.createReader(muhammara.createBlankPdf(10, 10));
  var objectType: PDFObjectType = parsed.getTrailer().getType();
  var isDictionary: boolean = objectType === muhammara.ePDFObjectDictionary;
  void isDictionary;
  void muhammara.getTypeLabel(muhammara.ePDFObjectStream);
  // @ts-expect-error Labels exist only for the ePDFObject constants.
  muhammara.getTypeLabel(12);
  var rootType: PDFObjectType | null = parsed.getTrailerEntryType("Root");
  void rootType;
  var entryType: XrefEntryType = parsed.getXrefEntry(1).type;
  void (entryType === muhammara.eXrefEntryExisting);
}

void usesNamedValueSets;
