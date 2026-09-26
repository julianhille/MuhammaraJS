import muhammara = require("@muhammara/native-with-source");

var continuationOptions: muhammara.PDFWriterToContinueOptions = {
  log: {
    /** Accept synchronous log bytes and report the number written. */
    write(bytes: Buffer): number {
      return bytes.length;
    },
  },
};
muhammara.createWriterToContinue(
  "output.pdf",
  "state.txt",
  continuationOptions,
);
muhammara.createWriterToContinue("output.pdf", "state.txt", {
  log: "writer.log",
});
muhammara.createWriterToContinue("output.pdf", "state.txt", {
  log: new muhammara.PDFWStreamForBuffer(),
});
// @ts-expect-error Log streams must return a byte count, not a Node Writable boolean.
var invalidContinuationLog: muhammara.ByteWriter = { write: () => true };
void invalidContinuationLog;

var imageTransformation: muhammara.TransformationObject = {
  width: 100,
  height: 50,
  fit: muhammara.ImageFit.ALWAYS,
};
void imageTransformation;
var replacementScope: muhammara.ObjectReplacementScope =
  muhammara.ObjectReplacementScope.GLOBAL;
var replacementOptions: muhammara.ObjectReplacementOptions = {
  scope: replacementScope,
};
var deviceColorSpace: muhammara.DeviceColorSpace =
  muhammara.DeviceColorSpace.CMYK;
var pageBoxName: muhammara.PageBox = muhammara.PageBox.TRIM;
var imageKind: muhammara.PDFImageType = muhammara.PDFImageType.PNG;
var textEncoding: muhammara.EEncoding = muhammara.EEncoding.HEX;
var colorOptions: muhammara.ColorOptions = { colorspace: deviceColorSpace };
void [pageBoxName, imageKind, textEncoding, colorOptions];
var pathTypes: muhammara.DrawingPathType[] = ["stroke", "fill", "clip", null];
void pathTypes;
// @ts-expect-error Drawing paint modes are a closed set.
var invalidPathType: muhammara.DrawingPathType = "future-paint-mode";
void invalidPathType;

declare const writer: muhammara.PDFWriter;

var page: muhammara.PDFPage = writer.createPage(0, 0, 595, 842);
writer.mergePDFPagesToPage(page, "source.pdf", function () {
  var callbackThis: typeof globalThis = this;
  void callbackThis;
});
writer.mergePDFPagesToPage(page, "source.pdf", {}, function () {});
writer.startPageContentContext(page).c(0, 0, 1, 1, 2, 2).S();
writer
  .startPageContentContext(page)
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
    font: writer.getFontForFile("font.ttf"),
    size: 12,
    underline: true,
  })
  .Q();

declare const recipe: muhammara.Recipe;
recipe
  .link("https://example.com", 100, 200, 160, 24)
  .comment("Please review.", 300, 100, {
    title: "Review",
    replies: [{ text: "Confirmed.", title: "Reviewer", opacity: 0.5 }],
  })
  .annot(100, 200, "Highlight", { width: 200, height: 14, opacity: 0.45 })
  .annot(100, 230, "Highlight", { width: 200, height: 14, opacity: 0 });
var readonlyReplies = [{ text: "Confirmed." }] as const;
recipe.comment("Readonly replies", 300, 140, { replies: readonlyReplies });
recipe.annot(100, 260, "Highlight", {
  width: 200,
  height: 14,
  replies: readonlyReplies,
});
recipe.opacity(0.5);
recipe.fill().stroke().fillAndStroke();
// @ts-expect-error Recipe.fill() takes no color; set colors through shape options.
recipe.fill("#ff0000");
// @ts-expect-error Recipe.stroke() takes no color; set colors through shape options.
recipe.stroke([0, 0, 0] as const);
// @ts-expect-error Recipe.fillAndStroke() takes no colors; set colors through shape options.
recipe.fillAndStroke("#ffffff", [255, 255, 255] as const);
// @ts-expect-error Recipe.fillOpacity() was removed in v7.
recipe.fillOpacity(0.5);

recipe
  .text("Default size", 72, 72, { link: "https://text.example.com" })
  .text("Explicit size", 72, 100, { size: 12 })
  .text("Overflow", {
    layout: "article",
    overflow: function (currentRecipe) {
      var callbackThis: muhammara.Recipe = this;
      void callbackThis;
      currentRecipe.endPage().createPage("letter");
      return { layout: "article", column: [72, 72] };
    },
  })
  .text("Squiggly", { squiggly: { color: "red", opacity: 0.5 } })
  .pie(100, 100, 50, 20, 220, { fill: "#000000" });
// @ts-expect-error Text overflow callbacks must return instructions.
recipe.text("Invalid overflow", { overflow: () => {} });
recipe.text("Continue overflow", { overflow: () => false });
recipe
  .registerFont("body", "./fonts/body-bold.ttf", "bold")
  .editPage(1)
  .overlay("overlay.pdf")
  .text("Flowing text", { layout: "article", flow: false })
  .text("Centered text", "center", "center")
  .image("photo.jpg", "center", "center");
recipe
  .text("Explicit styled size", 72, 100, {
    fontSize: 12,
    bold: true,
    italic: true,
  })
  .image("image.png", 72, 128, {
    link: "https://image.example.com",
    rotation: 45,
    rotationOrigin: [72, 128],
    skewX: 10,
    skewY: 5,
  })
  .rectangle(72, 180, 100, 20, { link: "https://shape.example.com" });
var textWidth: number = recipe.textDimensions("text").width;
recipe.textDimensions("text", { size: 12 }).width;
var pages: number | undefined = recipe.metadata.pages;
var pageCount: number | undefined = recipe.metadata.pageCount;
recipe.createPage(595, 842).rotate(90).endPage();
void textWidth;
void pages;
void pageCount;
var currentPageInfo = recipe.getCurrentPageInfo();
var pageInfo: muhammara.RecipePageInfo = recipe.pageInfo(1);
currentPageInfo?.width;
currentPageInfo?.height;
currentPageInfo?.rotate;
currentPageInfo?.pageNumber;
pageInfo.width;

var info: muhammara.Recipe.InfoOptions = {
  author: "A",
  keywords: ["one", "two"],
  ReportId: "X-123",
  "2.16.76.1.4.2.2.1": "oid-professional",
  Labels: ["one", "two"],
};
recipe.info(info).custom("ReportId", "X-456").info({ ReportId: "X-789" });

recipe
  .register("drawMarker", function () {})
  .pauseContext()
  .resumeContext();
recipe
  .register(function drawNamedMarker() {})
  .pauseContext()
  .resumeContext();

var pageBox: muhammara.PDFPageBoxType = muhammara.ePDFPageBoxCropBox;
recipe.setPageBox(pageBox, 10, 20, 585, 822);
recipe.setPageBox(muhammara.ePDFPageBoxMediaBox, 0, 0, 595, 842);
void pageBox;
recipe.replaceText("Before", "After", 1);
// @ts-expect-error replaceText requires a one-based page number.
recipe.replaceText("Before", "After");
recipe.removeText(1).removeText(2, { forms: true });
// @ts-expect-error removeText requires a one-based page number.
recipe.removeText();
// @ts-expect-error forms must be a boolean.
recipe.removeText(1, { forms: "yes" });
recipe.rotateContent(45, 10, 20);
recipe.lineStyle({
  width: 1,
  lineWidth: 2,
  cap: 1,
  join: 1,
  miterLimit: 2,
  dash: [1],
  dashPhase: 1,
});
var extension: muhammara.Recipe.ExtensionCallback<
  [number, number],
  muhammara.Recipe
> = function (x, y) {
  return this.moveTo(x, y).lineTo(x + 10, y + 10);
};
function registerExtension(
  callback: muhammara.Recipe.ExtensionCallback<
    [number, number],
    muhammara.Recipe
  >,
): void {
  recipe.register("drawMarker", callback);
}
registerExtension(extension);
var namedExtension: muhammara.Recipe.ExtensionCallback<[number, number], void> =
  function drawNamedMarker(x, y) {
    this.moveTo(x, y).lineTo(x + 10, y + 10);
  };
recipe.register(namedExtension);
var broadExtension: Function = function () {};
// @ts-expect-error register() requires a concrete callable signature.
recipe.register("broadExtension", broadExtension);

type TableRecord = { name: string; score: number };
var tableField: muhammara.Recipe.TableField<TableRecord> = "score";
var tableFieldValue: muhammara.Recipe.TableFieldValue<TableRecord, "score"> =
  10;
var layoutOptions: muhammara.Recipe.LayoutOptions = {
  columns: 2,
  gap: 12,
  reset: true,
};
function applyLayout(options: muhammara.Recipe.LayoutOptions): void {
  recipe.layout("columns", 10, 10, 200, 100, options);
}
applyLayout(layoutOptions);
var invalidLayoutOptions: muhammara.Recipe.LayoutOptions = {
  // @ts-expect-error Unknown layout option.
  direction: "horizontal",
};
var tableOptions: muhammara.Recipe.TableOptions<TableRecord> = {
  order: ["name", "score"],
  columns: [
    {
      name: "name",
      text: "Name",
      cell: {
        padding: 4,
        minHeight: 40,
        wrap: "ellipsis",
        style: { borderRadius: 4, colorspace: "gray", fill: "#00" },
      },
      header: true,
      hcell: { height: 60 },
      renderer: (text, record, field, row) => {
        void text;
        var score: number = record.score;
        void field;
        void score;
        return row % 2
          ? {
              color: "blue",
              underline: { text: "reviewed", color: "red" },
              textBox: { minHeight: 80 },
            }
          : undefined;
      },
    },
  ],
  header: { font: "arial", size: 12, alignToData: true, cell: { padding: 2 } },
  border: { width: 0.5, lineCap: "butt" },
  row: { nth: "odd", cell: { padding: 2 } },
  overflow: function (currentRecipe, row) {
    var callbackThis: muhammara.Recipe = this;
    void callbackThis;
    currentRecipe.endPage().createPage("letter");
    return row > 10 ? true : { position: [10, 10] };
  },
};
var tableClippingBox: muhammara.Recipe.TextBox = {
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
function applyTable(options: muhammara.Recipe.TableOptions<TableRecord>): void {
  recipe.table(10, 120, [{ name: "Ada", score: 10 }], options);
}
applyTable(tableOptions);
recipe.table(10, 120, [{ name: "Ada", score: 10 }], {
  columns: [
    {
      name: "score",
      renderer: (text, record, field) => {
        var score: number = text;
        text.toFixed();
        // @ts-expect-error A score renderer does not receive string text.
        text.toUpperCase();
        var name: string = record.name;
        var scoreField: "score" = field;
        void name;
        void score;
        void scoreField;
      },
    },
  ],
});
type OptionalTableRecord = { name: string; score?: number | null };
var optionalTableOptions: muhammara.Recipe.TableOptions<OptionalTableRecord> = {
  columns: [
    {
      name: "score",
      renderer: (text) => {
        var score: number | "" = text;
        // Missing and null values arrive as "".
        void score;
      },
    },
  ],
};
type HeterogeneousTableRecord =
  { kind: "score"; score: number } | { kind: "note"; note: string };
var heterogeneousTableOptions: muhammara.Recipe.TableOptions<HeterogeneousTableRecord> =
  {
    columns: [
      {
        name: "score",
        renderer: (text) => {
          var score: number | "" = text;
          void score;
        },
      },
      {
        name: "note",
        renderer: (text) => {
          var note: string | "" = text;
          void note;
        },
      },
    ],
  };
var invalidTableOptions: muhammara.Recipe.TableOptions<TableRecord> = {
  // @ts-expect-error Array-form order values must name record fields.
  order: ["missing"],
  columns: [
    {
      // @ts-expect-error A table column must name a field in the record.
      name: "missing",
    },
  ],
  // @ts-expect-error Row selectors are limited to even and odd.
  row: { nth: "first" },
};
var invalidTableCallbacks: muhammara.Recipe.TableOptions<TableRecord> = {
  columns: [
    {
      name: "score",
      // @ts-expect-error Renderers return text options or nothing.
      renderer: () => 123,
    },
  ],
  // @ts-expect-error Overflow callbacks return table instructions.
  overflow: () => "next",
};
var invalidTableColumn: muhammara.Recipe.TableColumnDefinition<
  TableRecord,
  "score"
> = {
  name: "score",
  // @ts-expect-error Table columns use cell instead of textBox.
  textBox: { padding: 2 },
};
var invalidNoReturnOverflow: muhammara.Recipe.TableOptions<TableRecord> = {
  // @ts-expect-error Overflow callbacks must return table instructions.
  overflow: () => {},
};
var continueTableOverflow: muhammara.Recipe.TableOptions<TableRecord> = {
  overflow: () => false,
};
var broadRows: object[] = [{ name: "Ada" }];
// @ts-expect-error Broad object rows cannot provide typed columns.
recipe.table(10, 120, broadRows, { columns: [{ name: "name" }] });
recipe.table(10, 120, [{ 0: 10 }], {
  columns: [
    {
      name: "0",
      renderer: (text) => {
        var numericValue: number = text;
        void numericValue;
      },
    },
  ],
});
recipe.table(10, 120, [["Ada", 10] as [string, number]], {
  columns: [{ name: "0" }, { name: "1" }],
  // @ts-expect-error Tuple array members are not table fields.
  order: ["length"],
});
recipe.table(10, 120, [["Ada", 10] as [string, number]], {
  // @ts-expect-error A two-item tuple has no field 2.
  columns: [{ name: "2" }],
});
var readonlyRows = [{ name: "Ada", score: 10 }] as const;
var readonlyColumns = [
  { name: "name", width: 100, cell: { padding: [2, 4] as const } },
] as const;
var readonlyOrder = ["name"] as const;
recipe.table(10, 120, readonlyRows, {
  columns: readonlyColumns,
  order: readonlyOrder,
});
var emptyReadonlyOrder = [] as const;
recipe.table(10, 120, readonlyRows, {
  // @ts-expect-error Runtime appends column names to an empty order array.
  order: emptyReadonlyOrder,
  columns: readonlyColumns,
});
recipe.table(10, 120, [{ "": "empty" }], {
  order: [""],
  columns: [
    // @ts-expect-error Empty field names cannot match custom columns at runtime.
    {
      name: "",
    },
  ],
});

var metadata: muhammara.Recipe.ReadMetadata = recipe.read();
var readPages: number = metadata.pages;
var metadataPage: muhammara.Recipe.ReadMetadataPage = metadata[1]!;
var metadataPageSize: number[] = metadataPage.size;
var metadataOffsetX: number = metadataPage.offsetX;
var htmlTextObject: muhammara.Recipe.HtmlTextObject =
  recipe.htmlToTextObjects("<b>text</b>")[0];
var lineBreak: boolean = recipe.htmlToTextObjects("a<br>b")[1].lineBreak;
void lineBreak;
metadataPage.mediaBox;
htmlTextObject.styles;
htmlTextObject.childs;
// @ts-expect-error A parsed page index may not exist.
recipe.read()[999].size;

var deviceColorspace: muhammara.Recipe.DeviceColorspace = "cmyk";
var colorspace: muhammara.Recipe.Colorspace = "separation";
var recipeOptions: muhammara.Recipe.RecipeOptions = {
  colorspace: "separation",
};
var dynamicColorspace: string = "gray";
var optionalColorspace: string | undefined = dynamicColorspace;
function applyColorspaces(
  device: muhammara.Recipe.DeviceColorspace,
  color: muhammara.Recipe.Colorspace,
  dynamic: string,
  optional: string | undefined,
): void {
  recipe.chroma("brand", "#ff0000", device);
  recipe.chroma("spot", [0, 255, 0, 0], color);
  recipe.chroma("dynamic", "#00", dynamic);
  recipe.chroma("optional", "#00", optional);
}
function applyRecipeOptions(options: muhammara.Recipe.RecipeOptions): void {
  new muhammara.Recipe("new", null, options);
}
applyColorspaces(
  deviceColorspace,
  colorspace,
  dynamicColorspace,
  optionalColorspace,
);
applyRecipeOptions(recipeOptions);
// @ts-expect-error Unknown constructor colorspace.
new muhammara.Recipe("new", null, { colorspace: "lab" });
// @ts-expect-error Unknown Recipe colorspace.
recipe.chroma("invalid", "#ff0000", "lab");
// @ts-expect-error Unknown text colorspace.
recipe.text("invalid", { colorspace: "lab" });
// @ts-expect-error Unknown drawing colorspace.
recipe.line([[0, 0]], { colorspace: "lab" });
recipe.polygon(
  [
    [0, 0],
    [10, 0],
    [10, 10],
  ],
  { colorspace: "cmyk", fill: [0, 255, 0, 0] },
);
var readonlyColor = [0, 255, 0, 0] as const;
var pathOptions: muhammara.Recipe.PathOptions = {
  color: readonlyColor,
  width: 2,
  dash: [2, 1] as const,
  dashPhase: 1,
  lineCap: "round",
  lineJoin: "bevel",
  miterLimit: 2,
};
var rendererThisOptions: muhammara.Recipe.TableColumnDefinition<
  TableRecord,
  "name"
> = {
  name: "name",
  renderer: function () {
    // @ts-expect-error Renderer this is an internal normalized options object.
    this.cell;
  },
};
var rendererWithReadonlyOptions: muhammara.Recipe.TableColumnDefinition<
  TableRecord,
  "name"
> = {
  name: "name",
  renderer: () => ({ rotationOrigin: [10, 10] as const }),
};
var rendererWithNoOptions: muhammara.Recipe.TableColumnDefinition<
  TableRecord,
  "name"
> = {
  name: "name",
  renderer: () => false,
};
var rendererWithEmptyText: muhammara.Recipe.TableColumnDefinition<
  TableRecord,
  "name"
> = {
  name: "name",
  renderer: () => "",
};
var rendererWithZero: muhammara.Recipe.TableColumnDefinition<
  TableRecord,
  "name"
> = {
  name: "name",
  renderer: () => 0,
};
// @ts-expect-error Lines cannot be filled.
recipe.lineTo(10, 10, { fill: "red" });
var widenedLineCap: string = "round";
// @ts-expect-error Line caps use finite runtime values.
recipe.line([[0, 0]], { lineCap: widenedLineCap });
var widenedRotationOrigin: number[] = [10, 10];
recipe.rectangle(10, 10, 100, 40, {
  // @ts-expect-error Rotation origins require exactly two coordinates.
  rotationOrigin: widenedRotationOrigin,
});
recipe
  .moveTo(0, 0)
  .lineTo(10, 10, pathOptions)
  .line([[0, 0]], { ...pathOptions, opacity: 0.5 })
  .circle(50, 50, 20, {
    color: readonlyColor,
    width: 2,
    dashPhase: 1,
    skewX: 5,
    skewY: 10,
  })
  .rectangle(10, 10, 100, 40, {
    color: readonlyColor,
    width: 2,
    dash: [2, 1] as const,
    dashPhase: 1,
    borderRadius: [5, 10] as const,
    rotationOrigin: [10, 10] as const,
  });
// @ts-expect-error Circle rotation is not supported consistently at runtime.
recipe.circle(50, 50, 20, { rotation: 45 });
// @ts-expect-error A circle has no configurable rotation origin.
recipe.circle(50, 50, 20, { rotationOrigin: [50, 50] });
recipe.ellipse(50, 50, 20, 10, {
  rotation: 45,
  rotationOrigin: [50, 50],
  skewX: 5,
});
recipe.arc(50, 50, 20, 0, 180, { rotation: 45 });
recipe.pie(50, 50, 20, 0, 180, { skewY: 5 });
// @ts-expect-error Rectangles do not apply path join styles.
recipe.rectangle(10, 10, 100, 40, { lineJoin: "bevel" });
// @ts-expect-error debug is available on shape helpers, not direct polygons.
recipe.polygon([[0, 0]], { debug: true });
recipe.n_gon(10, 10, 5, { debug: true, rotationVertice: 1 });
recipe.star(10, 10, 5, { debug: true });
var shapeOptions: muhammara.Recipe.ShapeOptions = { debug: true };
var ngonOptions: muhammara.Recipe.NGonOptions = { rotationVertice: 1 };
var markupOptions: muhammara.Recipe.TextMarkupOptions = {
  text: "reviewed",
  color: "red",
  opacity: 0.5,
};
var textBoxStyle: muhammara.Recipe.TextBoxStyle = {
  borderRadius: [1, 2, 3, 4] as const,
};
var invalidTextBoxStyle: muhammara.Recipe.TextBoxStyle = {
  // @ts-expect-error Rounded boxes support one to four corner radii.
  borderRadius: [],
};
var invalidMarkupOptions: muhammara.Recipe.TextMarkupOptions = {
  // @ts-expect-error Annotation metadata belongs on the outer text options.
  title: "Reviewer",
};
// @ts-expect-error Unknown Recipe colorspace.
var invalidColorspace: muhammara.Recipe.Colorspace = "lab";

var permissionName: muhammara.Recipe.PermissionName = "copy";
var permissionList: muhammara.Recipe.PermissionList = " print,\n copy ";
var dynamicPermissions: string = "print, copy";
var optionalPermissions: string | undefined = dynamicPermissions;
function applyPermissions(
  name: muhammara.Recipe.PermissionName,
  flags: muhammara.Recipe.PermissionList,
  dynamic: string,
  optional: string | undefined,
): void {
  recipe.permission(name);
  recipe.permission(flags);
  recipe.permission(dynamic);
  recipe.permission(optional);
}
recipe.permission("\tprint,\r\n copy ");
applyPermissions(
  permissionName,
  permissionList,
  dynamicPermissions,
  optionalPermissions,
);
// @ts-expect-error Unknown individual Recipe permission.
var invalidPermission: muhammara.Recipe.PermissionName = "delete";

var arrowOptions: muhammara.Recipe.ArrowOptions = {
  type: "dart",
  at: "head",
  head: [10, 5],
  shaft: 20,
  double: true,
};
var readonlyShaft = [20, 5] as const;
var readonlyHead = [10, 20, 0] as const;
recipe.arrow(20, 20, { head: readonlyHead, shaft: readonlyShaft });
// @ts-expect-error An empty shaft produces non-finite arrow geometry.
recipe.arrow(20, 20, { shaft: [] });
function drawArrow(options: muhammara.Recipe.ArrowOptions): void {
  recipe.arrow(20, 20, options);
}
drawArrow(arrowOptions);
recipe.arrow(20, 20, { type: 2 });
var broadArrowType: string = "dart";
// @ts-expect-error Arrow types use finite runtime values.
recipe.arrow(20, 20, { type: broadArrowType });
// @ts-expect-error Unsupported arrow head type.
recipe.arrow(20, 20, { type: "diamond" });
// @ts-expect-error Unsupported arrow anchor.
recipe.arrow(20, 20, { at: "center" });

var triangleTrait: muhammara.Recipe.TriangleTrait = "SAS";
var trianglePosition: muhammara.Recipe.TrianglePosition = "CENTROID";
var triangleOptions: muhammara.Recipe.TriangleMeasurementOptions = {
  traitID: "sss",
  position: "centroid",
  flipX: true,
  flipY: false,
};
function drawTriangle(
  options: muhammara.Recipe.TriangleMeasurementOptions,
): void {
  recipe.triangle(20, 20, [30, 40, 50], options);
}
drawTriangle(triangleOptions);
recipe.triangle(20, 20, [30, 40, 50], {
  traitsID: "SAS",
  position: "CENTROID",
});
recipe.triangle(
  20,
  20,
  [
    [0, 0],
    [30, 0],
    [0, 40],
  ],
  { traitID: "vtx" },
);
var readonlyVertices = [
  [0, 0],
  [30, 0],
  [0, 40],
] as const;
recipe.triangle(20, 20, readonlyVertices, { traitID: "vtx" });
// @ts-expect-error Positioned vertex triangles mutate their coordinates.
recipe.triangle(20, 20, readonlyVertices, {
  traitID: "vtx",
  position: "centroid",
});
// @ts-expect-error Flipped vertex triangles mutate their coordinates.
recipe.triangle(20, 20, readonlyVertices, { traitID: "vtx", flipX: true });
// @ts-expect-error Vertex traits require three coordinate pairs.
recipe.triangle(20, 20, [30, 40, 50], { traitID: "vtx" });
recipe.triangle(
  20,
  20,
  [
    [0, 0],
    [30, 0],
    [0, 40],
  ],
  // @ts-expect-error Measured traits require three numbers.
  { traitID: "sss" },
);
var broadTriangleTrait: string = "sas";
// @ts-expect-error Triangle traits use finite runtime values.
recipe.triangle(20, 20, [30, 40, 50], { traitID: broadTriangleTrait });
// @ts-expect-error Unsupported triangle trait encoding.
recipe.triangle(20, 20, [30, 40, 50], { traitID: "ssa" });
recipe.triangle(20, 20, [30, 40, 50], { traitID: "Sas" });
// @ts-expect-error Unsupported triangle position.
recipe.triangle(20, 20, [30, 40, 50], { position: "middle" });

void recipeOptions;
void invalidLayoutOptions;
void optionalTableOptions;
void heterogeneousTableOptions;
void invalidTableOptions;
void invalidTableCallbacks;
void invalidTableColumn;
void invalidNoReturnOverflow;
void continueTableOverflow;
void tableField;
void tableFieldValue;
void shapeOptions;
void ngonOptions;
void markupOptions;
void invalidMarkupOptions;
void textBoxStyle;
void invalidTextBoxStyle;
void pathOptions;
void readPages;
void metadataPageSize;
void metadataOffsetX;
void rendererWithReadonlyOptions;
void rendererWithNoOptions;
void rendererWithEmptyText;
void rendererWithZero;
void rendererThisOptions;
void triangleTrait;
void trianglePosition;
void invalidColorspace;
void invalidPermission;
recipe.deletePage(1).deletePage([2, 3]);

declare const callableReadStream: (() => void) & muhammara.ReadStream;
declare const callableWriteStream: (() => void) & muhammara.WriteStream;
var callableStreamWriter: muhammara.PDFWriter = muhammara.createWriterToModify(
  callableReadStream,
  callableWriteStream,
);
void callableStreamWriter;
void muhammara.createWriter(callableWriteStream);
void muhammara.createReader(callableReadStream);

// JavaScript streams receive written bytes as Buffers and may return read
// bytes as a Uint8Array or an array of byte values.
var bufferWriteStream: muhammara.WriteStream = {
  /** Accept one chunk of output bytes. */
  write(bytes: Buffer): number {
    return bytes.length;
  },
  /** Report the number of bytes written so far. */
  getCurrentPosition(): number {
    return 0;
  },
};
void muhammara.createWriter(bufferWriteStream);
var legacyWriteStream = {
  /** Accept output bytes in the removed number-array form. */
  write(bytes: number[]): number {
    return bytes.concat([]).length;
  },
  /** Report the number of bytes written so far. */
  getCurrentPosition(): number {
    return 0;
  },
};
// @ts-expect-error Write streams receive Buffers, not arrays of numbers.
void muhammara.createWriter(legacyWriteStream);
var readBytes: Buffer = new muhammara.PDFRStreamForBuffer(
  Buffer.from("%PDF-"),
).read(5);
void readBytes;
declare const customReadStream: muhammara.ReadStream;
var customRead: Uint8Array | number[] = customReadStream.read(5);
void customRead;
declare const pdfStreamReader: muhammara.ByteReader;
var pdfStreamBytes: Buffer = pdfStreamReader.read(16);
void pdfStreamBytes;
// @ts-expect-error PDF stream readers return Buffers, not number arrays.
var pdfStreamByteArray: number[] = pdfStreamReader.read(16);
void pdfStreamByteArray;

// Built-in write streams still accept arrays of byte values from direct callers.
const builtInWriteStream = new muhammara.PDFWStreamForBuffer();
const builtInWrittenCount: number =
  builtInWriteStream.write([37, 80]) +
  builtInWriteStream.write(Buffer.from("DF"));
void builtInWrittenCount;

// Low-level PDFWriter signatures match the arguments the binding accepts.
declare const signatureWriter: muhammara.PDFWriter;
declare const signatureStream: muhammara.ReadStream;
void signatureWriter.createFormXObjectFromJPG(signatureStream);
void signatureWriter.createFormXObjectFromTIFF("image.tif", {
  pageIndex: 1,
  bwTreatment: { asImageMask: true, oneColor: [255, 128, 0] },
  grayscaleTreatment: { asColorMap: true, zeroColor: [0, 0, 0, 255] },
});
void signatureWriter.createImageXObjectFromJPG(signatureStream, 12);
void signatureWriter.createFormXObjectFromPNG(signatureStream);
declare const signatureReader: muhammara.PDFReader;
void signatureWriter.createPDFCopyingContext(signatureReader);
void signatureWriter.createPDFCopyingContext("source.pdf", {
  password: "user",
});
var signatureDimensions: muhammara.RectangleDimension =
  signatureWriter.getImageDimensions("image.pdf", 1, { password: "user" });
void signatureDimensions;

// Dictionary entries are typed as PDF objects.
declare const signatureDictionary: muhammara.PDFDictionary;
var dictionaryEntries: { [key: string]: muhammara.PDFObject } =
  signatureDictionary.toJSObject();
void dictionaryEntries;

// Literal strings expose their raw bytes.
declare const signatureLiteral: muhammara.PDFLiteralString;
var literalBytes: number[] = signatureLiteral.toBytesArray();
void literalBytes;
