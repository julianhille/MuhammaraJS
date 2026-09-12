import muhammara = require("@muhammara/native-with-source");

declare const writer: muhammara.PDFWriter;

var page: muhammara.PDFPage = writer.createPage(0, 0, 595, 842);
writer.startPageContentContext(page).c(0, 0, 1, 1, 2, 2).S();

declare const recipe: muhammara.Recipe;
recipe
  .link("https://example.com", 100, 200, 160, 24)
  .comment("Please review.", 300, 100, {
    title: "Review",
    replies: [{ text: "Confirmed.", title: "Reviewer" }],
  })
  .annot(100, 200, "Highlight", { width: 200, height: 14, opacity: 0.45 })
  .annot(100, 230, "Highlight", { width: 200, height: 14, opacity: 0 });
recipe.opacity(0.5);
// @ts-expect-error Recipe.fillOpacity() was removed in v7.
recipe.fillOpacity(0.5);

recipe
  .text("Default size", 72, 72, { link: "https://text.example.com" })
  .text("Explicit size", 72, 100, { size: 12 })
  .pie(100, 100, 50, 20, 220, { fill: "#000000" });
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
var pages: number = recipe.metadata.pages;
recipe.createPage(595, 842).rotate(90).endPage();
void textWidth;
void pages;
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
recipe.register(function drawNamedMarker(x: number, y: number) {
  this.moveTo(x, y).lineTo(x + 10, y + 10);
});
var broadExtension: Function = function () {};
// @ts-expect-error register() requires a concrete callable signature.
recipe.register("broadExtension", broadExtension);

type TableRecord = { name: string; score: number };
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
var tableLayoutOptions: muhammara.Recipe.LayoutOptions<TableRecord> = {
  columns: [
    {
      name: "score",
      renderer: (text, record) => {
        void text;
        return { size: record.score };
      },
    },
  ],
};
function applyTableLayout(
  options: muhammara.Recipe.LayoutOptions<TableRecord>,
): void {
  recipe.layout("table-columns", 10, 10, 200, 100, options);
}
applyTableLayout(tableLayoutOptions);

var tableOptions: muhammara.Recipe.TableOptions<TableRecord> = {
  order: ["name", "score"],
  columns: [
    {
      name: "name",
      text: "Name",
      cell: { padding: 4 },
      header: true,
      renderer: (text, record, field, row) => {
        void text;
        var score: number = record.score;
        void field;
        void score;
        return row % 2 ? { color: "blue" } : undefined;
      },
    },
  ],
  header: { alignToData: true, cell: { padding: 2 } },
  border: { width: 0.5, lineCap: "butt" },
  row: { nth: "odd", cell: { padding: 2 } },
  overflow: (currentRecipe, row) => {
    currentRecipe.createPage("letter");
    return row > 10 ? true : { position: [10, 10] };
  },
};
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
type OptionalTableRecord = { name: string; score?: number };
var optionalTableOptions: muhammara.Recipe.TableOptions<OptionalTableRecord> = {
  columns: [
    {
      name: "score",
      renderer: (text) => {
        var score: number | "" = text;
        void score;
      },
    },
  ],
};
var invalidTableOptions: muhammara.Recipe.TableOptions<TableRecord> = {
  columns: [
    {
      // @ts-expect-error A table column must name a field in the record.
      name: "missing",
    },
  ],
  // @ts-expect-error Row selectors are limited to even and odd.
  row: { nth: "first" },
  // @ts-expect-error Overflow callbacks return a boolean or new position.
  overflow: () => ({ page: 2 }),
};

var metadata: muhammara.Recipe.Metadata = recipe.read();
var metadataPage: muhammara.Recipe.MetadataPage = metadata[1];
var htmlTextObject: muhammara.Recipe.HtmlTextObject =
  recipe.htmlToTextObjects("<b>text</b>")[0];
metadataPage.mediaBox;
htmlTextObject.styles;
htmlTextObject.childs;

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

var triangleTrait: muhammara.Recipe.TriangleTrait = "Sas";
var trianglePosition: muhammara.Recipe.TrianglePosition = "Centroid";
var triangleOptions: muhammara.Recipe.TriangleOptions = {
  traitID: "sss",
  position: "centroid",
  flipX: true,
  flipY: false,
};
function drawTriangle(options: muhammara.Recipe.TriangleOptions): void {
  recipe.triangle(20, 20, [30, 40, 50], options);
}
drawTriangle(triangleOptions);
recipe.triangle(20, 20, [30, 40, 50], {
  traitsID: "SAS",
  position: "CENTROID",
});
var broadTriangleTrait: string = "sas";
// @ts-expect-error Triangle traits use finite runtime values.
recipe.triangle(20, 20, [30, 40, 50], { traitID: broadTriangleTrait });
// @ts-expect-error Unsupported triangle trait encoding.
recipe.triangle(20, 20, [30, 40, 50], { traitID: "ssa" });
// @ts-expect-error Unsupported triangle position.
recipe.triangle(20, 20, [30, 40, 50], { position: "middle" });

void recipeOptions;
void invalidLayoutOptions;
void optionalTableOptions;
void invalidTableOptions;
void triangleTrait;
void trianglePosition;
void invalidColorspace;
void invalidPermission;
