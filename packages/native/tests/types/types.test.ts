import muhammara = require("@muhammara/native");
import nativeCore = require("@muhammara/native-core");

declare const writer: muhammara.PDFWriter;
declare const recipe: muhammara.Recipe;
declare const objects: muhammara.ObjectsContext;
var page: muhammara.PDFPage = writer.createPage(0, 0, 595, 842);
var context: muhammara.PageContentContext =
  writer.startPageContentContext(page);
var api: typeof muhammara = nativeCore.createMuhammara({});

context.m(0, 0).l(100, 100).S();
context.c(0, 0, 1, 1, 2, 2).S();
context.drawCircle(10, 10, 5).drawSquare(10, 10, 5);
api.createWriter("output.pdf");
api.getTypeLabel(api.ePDFObjectArray);
api.EInfoTrappedTrue;
api.ePDFVersionUndefined;
api.KProcsetImageB;
api.KProcsetImageC;
api.KProcsetImageI;
api.kProcsetPDF;
api.kProcsetText;
api.eXrefEntryExisting;
api.eXrefEntryDelete;
api.eXrefEntryStreamObject;
api.eXrefEntryUndefined;
context.J(api.LineCapStyle.LINECAP_BUTT).j(2);
objects.endArray(api.ETokenSeparator.eTokenSeparatorEndLine);
recipe.read();
recipe
  .link("https://example.com", 100, 200, 160, 24)
  .comment("Please review.", 300, 100, {
    title: "Review",
    replies: [{ text: "Confirmed.", title: "Reviewer" }],
  })
  .annot(100, 200, "Highlight", { width: 200, height: 14, opacity: 0.45 })
  .annot(100, 230, "Highlight", { width: 200, height: 14, opacity: 0 });
var info: muhammara.Recipe.InfoOptions = {
  author: "A",
  keywords: ["one", "two"],
  ReportId: "X-123",
  "2.16.76.1.4.2.2.1": "oid-professional",
  Labels: ["one", "two"],
};
recipe.info(info).custom("ReportId", "X-456").info({ ReportId: "X-789" });
recipe.lineStyle({
  width: 1,
  lineWidth: 2,
  cap: 1,
  join: 1,
  miterLimit: 2,
  dash: [1],
  dashPhase: 1,
});
recipe.register("example", function () {});
recipe.createPage(595, 842, { left: 36 }).margins({ top: 36 });
var pageBox: muhammara.PDFPageBoxType = muhammara.ePDFPageBoxCropBox;
recipe.setPageBox(pageBox, 10, 20, 585, 822);
recipe.setPageBox(muhammara.ePDFPageBoxMediaBox, 0, 0, 595, 842);
recipe.rotate(90).endPage();
var margins: Required<muhammara.Recipe.RecipeMargins> = recipe.margins();
var title: string = recipe.getPageInfo().title;
var textWidth: number = recipe.textDimensions("text").width;
recipe.textDimensions("text", { size: 12 }).width;
recipe
  .text("Default size", 72, 72, { link: "https://text.example.com" })
  .text("Explicit size", 72, 100, { size: 12 });
recipe
  .registerFont("body", "./fonts/body-bold.ttf", "bold")
  .editPage(1)
  .overlay("overlay.pdf")
  .text("Flowing text", { layout: "article", flow: false })
  .text("Centered text", "center", "center")
  .image("photo.jpg", "center", "center");
var pages: number = recipe.metadata.pages;
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
var coordinates: muhammara.Recipe | number[] = recipe.movedown(1, Boolean(1));
recipe.structure("structure.json").endPDF();
recipe
  .table(0, 0, [{}])
  .ellipse(10, 10, 5, 3)
  .arc(10, 10, 5)
  .pie(10, 10, 5)
  .n_gon(10, 10, 5, { fill: "#000000" })
  .star(10, 10, 5, { fill: "#000000" })
  .triangle(10, 10, [1, 2, 3])
  .arrow(10, 10)
  .fill()
  .stroke()
  .fillAndStroke();
recipe.opacity(0.5);
// @ts-expect-error Recipe.fillOpacity() was removed in v7.
recipe.fillOpacity(0.5);
recipe.htmlToTextObjects("<p>text</p>");
recipe.endPDF();
var callbackResult: string = recipe.endPDF(function () {
  return "result";
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
        var name: string = record.name;
        var scoreField: "score" = field;
        void name;
        void score;
        void scoreField;
      },
    },
  ],
});

var metadata: muhammara.Recipe.Metadata = recipe.read();
var metadataPage: muhammara.Recipe.MetadataPage = metadata[1];
var htmlTextObject: muhammara.Recipe.HtmlTextObject =
  recipe.htmlToTextObjects("<b>text</b>")[0];
metadataPage.mediaBox;
htmlTextObject.styles;
htmlTextObject.childs;

var deviceColorspace: muhammara.Recipe.DeviceColorspace = "cmyk";
var colorspace: muhammara.Recipe.Colorspace = "separation";
var recipeOptions: muhammara.Recipe.RecipeOptions = { colorspace: "rgb" };
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
// @ts-expect-error Unknown Recipe colorspace.
recipe.chroma("invalid", "#ff0000", "lab");
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
// @ts-expect-error Unsupported arrow head type.
recipe.arrow(20, 20, { type: "diamond" });

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
  traitsID: "sas",
  position: "B",
});
// @ts-expect-error Unsupported triangle trait encoding.
recipe.triangle(20, 20, [30, 40, 50], { traitID: "ssa" });

void callbackResult;
void margins;
void title;
void textWidth;
void pages;
void coordinates;
void pageBox;
void recipeOptions;
void invalidColorspace;
void invalidPermission;
