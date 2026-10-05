import {
  AnnotFlag,
  AnnotIcon,
  AnnotSubtype,
  ArrowAt,
  ArrowType,
  ChromaCommand,
  Colorspace,
  Coordinate,
  FontStyle,
  HorizontalAlign,
  LineCap,
  LineJoin,
  PageLayout,
  PageSize,
  Permission,
  StructureFormat,
  TableRowNth,
  TextAlign,
  TextWrap,
  TrianglePosition,
  TriangleTrait,
  VerticalAlign,
} from "../value-sets.js";

/**
 * Named values for Recipe string options, assigned to the Recipe class as
 * static properties with the native names, for example
 * `Recipe.AnnotFlag.PRINT`. The plain strings stay accepted.
 */
export var recipeConstants = Object.freeze({
  TextWrap,
  TextAlign,
  TableRowNth,
  LineCap,
  LineJoin,
  ArrowAt,
  ArrowType,
  TriangleTrait,
  TrianglePosition,
  PageLayout,
  PageSize,
  HorizontalAlign,
  VerticalAlign,
  FontStyle,
  Permission,
  Coordinate,
  Colorspace,
  AnnotSubtype,
  AnnotFlag,
  ChromaCommand,
  AnnotIcon,
  StructureFormat,
});
