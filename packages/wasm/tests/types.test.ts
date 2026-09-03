import { createMuhammaraWasm, createRecipe } from "../index.js";

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
    .d([1, 2])
    .rg(1, 0, 0)
    .m(0, 0)
    .l(10, 10)
    .S()
    .BT()
    .Tf(font, 12)
    .Tm(1, 0, 0, 1, 10, 10)
    .Tj("text", { encoding: "text" })
    .TJ("more", -20, "text")
    .ET()
    .Q();
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
  var reader = muhammara.createReader(source);
  var textElement = reader.extractPageText(0)[0];
  textElement.content;
  textElement.fontResource;
  textElement.fontSize;
  textElement.textMatrix[5];
  reader.end();
  var sourceBlob = new Blob([source.buffer as ArrayBuffer]);
  var output = new muhammara.PDFWStreamForBuffer();
  output.write(source);
  output.buffer;
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
  mergeWriter.mergePDFPagesToPage(mergePage, source, () => {});
  mergeWriter.mergePDFPagesToPage(mergePage, source, {}, () => {});
  await mergeWriter.mergePDFPagesToPageAsync(mergePage, sourceBlob, () => {});
  await mergeWriter.mergePDFPagesToPageAsync(
    mergePage,
    sourceBlob,
    {},
    () => {},
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
  modifier.registerAnnotationReferenceForNextPageWrite(1);
  modifier.writePageAndReturnID(modifiedPage);
  modifier.appendPDFPagesFromPDF(source);
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
  await modifier.createFormXObjectFromTIFFAsync(sourceBlob);
  await modifier.createFormXObjectFromTIFFBytesAsync(sourceBlob);
  modifier.mergePDFPagesToPage(modifiedPage, source, () => {});
  modifier.mergePDFPagesToPage(modifiedPage, source, {}, () => {});
  await modifier.mergePDFPagesToPageAsync(modifiedPage, sourceBlob, () => {});
  await modifier.mergePDFPagesToPageAsync(
    modifiedPage,
    sourceBlob,
    {},
    () => {},
  );
  var parser = modifier.getModifiedFileParser();
  var pageInput = parser.parsePage(0);
  pageInput.getDictionary().toJSObject();
  pageInput.getMediaBox();
  parser.getParserStream().setPosition(0).read(8);
  parser.getXrefEntry(parser.getPageObjectID(0));
  modifier.replaceObject(0, parser.getPageObjectID(0), 11);
  modifier.end();
  var Recipe = await createRecipe();
  Recipe.registerFont("regular", new Uint8Array(), "regular");
  await Recipe.registerFontAsync("bold", new Blob(), "bold");
  Recipe.registerImage("image", new Uint8Array(), "png");
  await Recipe.registerImageAsync("image-async", new Blob(), "tiff");
  Recipe.registerPdf("pdf", source);
  await Recipe.registerPdfAsync("pdf-async", sourceBlob);
  Recipe.inspectPdf("pdf")[1].offsetX;
  Recipe.splitPdf("pdf", "part")[0].bytes;
  Recipe.permission("print, copy");
  var recipe = new Recipe({ version: 1.7, compress: false, title: "Byte PDF" });
  recipe.endPDF((bytes) => bytes.byteLength);
  recipe.registerFont("instance-font", new Uint8Array());
  await recipe.registerFontAsync("instance-font-async", new Blob());
  recipe.htmlToTextObjects("<b>text</b>")[0].styles.bold;
  recipe
    .register("extension", function () {
      return this;
    })
    .createPage("letter", 90, { left: 36 })
    .margins(36, 36, 72, 72)
    .save()
    .transform(1, 0, 0, 1, 10, 10)
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
    .fillOpacity(0.5)
    .restore()
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
    .rectangle(0, 0, 10, 10, { borderRadius: [1, 2, 3, 4] })
    .circle(10, 10, 5)
    .ellipse(10, 10, 5, 2)
    .arc(10, 10, 5, 0, 90, { sector: true })
    .pie(10, 10, 5)
    .n_gon(10, 10, 5, 3, { rotationVertice: 1 })
    .star(10, 10, 5, 5)
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
    .image("image", 10, 10, { index: 1, align: "center center" })
    .appendPage("pdf", [1, [2, 3]])
    .overlay("pdf", { page: 1, fitWidth: true })
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
    .info({ author: "author" })
    .custom("custom", "value")
    .insertPage(0, "pdf", 1);
  recipe.knownColors.rgb.blue;
  recipe.margins().left;
  recipe.pageInfo(1)?.mediaBox[3];
  recipe.endPage().endPDF();
  var byteRecipe = new Recipe(source, { compress: false });
  byteRecipe.getPageInfo();
  byteRecipe.getCurrentPageInfo()?.rotate;
  byteRecipe.editPage(1).pauseContext().resumeContext().endPage().endPDF();
  var asyncByteRecipe = new Recipe();
  await asyncByteRecipe.readAsync(sourceBlob);
  asyncByteRecipe.editPage(1).endPage().endPDF();
}

void usesLowLevelSurface;
