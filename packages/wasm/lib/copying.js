/**
 * Creates low-level helpers for copying objects between PDF documents.
 * @param {{module: object}} dependencies - Emscripten module.
 * @returns {{copyingObjectOperations: Function}} The helpers.
 */
export function createCopyingHelpers({ module }) {
  function copyingObjectOperations(copying, requireCopying) {
    function requireObjectId(value, label) {
      if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
        throw new RangeError(`${label} must be a non-negative object ID`);
      }
    }

    function requireSourceObject(object) {
      if (!object || object._copyingContext !== copying) {
        throw new TypeError(
          "PDF object must originate from this source document parser",
        );
      }
    }

    return {
      /**
       * Copies a source object, and the objects it references, into the output.
       * @param {number} sourceObjectId - Object ID in the source document.
       * @returns {number} Object ID of the copy in the output.
       * @throws {RangeError} If the ID is not an unsigned 32-bit integer or the object cannot be copied.
       * @throws {Error} If the copying context has ended.
       */
      copyObject: function (sourceObjectId) {
        requireCopying();
        requireObjectId(sourceObjectId, "Source object ID");
        var resultPointer = module._malloc(4);
        try {
          if (
            !module._muhammara_wasm_copying_context_copy_object(
              copying,
              sourceObjectId,
              resultPointer,
            )
          ) {
            throw new RangeError(`Unable to copy object ${sourceObjectId}`);
          }
          return module.HEAPU32[resultPointer >>> 2];
        } finally {
          module._free(resultPointer);
        }
      },
      /**
       * Writes a direct source object into the current output position and
       * schedules the indirect objects it references.
       * @param {PDFObject} object - Object parsed by this copying context's source parser.
       * @returns {number[]} Source object IDs still to copy with `copyNewObjectsForDirectObject()`.
       * @throws {TypeError} If the object comes from another parser.
       * @throws {Error} If the context has ended or the object cannot be copied.
       */
      copyDirectObjectWithDeepCopy: function (object) {
        requireCopying();
        requireSourceObject(object);
        var countPointer = module._malloc(4);
        var idsPointerPointer = module._malloc(4);
        try {
          if (
            !module._muhammara_wasm_copying_context_copy_direct_object_with_deep_copy(
              copying,
              object._handle,
              idsPointerPointer,
              countPointer,
            )
          )
            throw new Error("Unable to copy PDF object");
          var idsPointer = module.HEAPU32[idsPointerPointer >>> 2];
          var count = module.HEAPU32[countPointer >>> 2];
          try {
            return idsPointer
              ? Array.from(
                  module.HEAPU32.subarray(
                    idsPointer >>> 2,
                    (idsPointer >>> 2) + count,
                  ),
                )
              : [];
          } finally {
            if (idsPointer) module._muhammara_wasm_free(idsPointer);
          }
        } finally {
          module._free(idsPointerPointer);
          module._free(countPointer);
        }
      },
      /**
       * Copies the source objects a deep-copied direct object refers to.
       * @param {number[]} ids - Source object IDs from `copyDirectObjectWithDeepCopy()`.
       * @returns {this} The copying context.
       * @throws {TypeError} If `ids` is not an array.
       * @throws {RangeError} If an ID is invalid or repeated.
       * @throws {Error} If the context has ended or copying fails.
       */
      copyNewObjectsForDirectObject: function (ids) {
        requireCopying();
        if (!Array.isArray(ids))
          throw new TypeError("Object IDs must be an array");
        ids.forEach((id) => requireObjectId(id, "Object ID"));
        if (new Set(ids).size !== ids.length)
          throw new RangeError("Object IDs must not contain duplicates");
        var idsPointer = ids.length ? module._malloc(ids.length * 4) : 0;
        try {
          if (idsPointer) module.HEAPU32.set(ids, idsPointer >>> 2);
          if (
            !module._muhammara_wasm_copying_context_copy_new_objects_for_direct_object(
              copying,
              idsPointer,
              ids.length,
            )
          )
            throw new Error("Unable to copy referenced PDF objects");
        } finally {
          if (idsPointer) module._free(idsPointer);
        }
        return this;
      },
      /**
       * Looks up the output ID of an already copied source object.
       * @param {number} sourceObjectId - Object ID in the source document.
       * @returns {number} Object ID of the copy in the output.
       * @throws {RangeError} If the ID is invalid or the object was not copied.
       * @throws {Error} If the copying context has ended.
       */
      getCopiedObjectID: function (sourceObjectId) {
        requireCopying();
        requireObjectId(sourceObjectId, "Source object ID");
        var resultPointer = module._malloc(4);
        try {
          if (
            !module._muhammara_wasm_copying_context_get_copied_object_id(
              copying,
              sourceObjectId,
              resultPointer,
            )
          )
            throw new RangeError(`No copied object for ${sourceObjectId}`);
          return module.HEAPU32[resultPointer >>> 2];
        } finally {
          module._free(resultPointer);
        }
      },
      /**
       * Lists every source object copied so far.
       * @returns {Record<string, number>} Output object IDs keyed by source object ID.
       * @throws {Error} If the context has ended or the mapping cannot be read.
       */
      getCopiedObjects: function () {
        requireCopying();
        var countPointer = module._malloc(4);
        var sourcesPointerPointer = module._malloc(4);
        var copiesPointerPointer = module._malloc(4);
        try {
          if (
            !module._muhammara_wasm_copying_context_get_copied_objects(
              copying,
              sourcesPointerPointer,
              copiesPointerPointer,
              countPointer,
            )
          )
            throw new Error("Unable to get copied PDF objects");
          var sourcesPointer = module.HEAPU32[sourcesPointerPointer >>> 2];
          var copiesPointer = module.HEAPU32[copiesPointerPointer >>> 2];
          var count = module.HEAPU32[countPointer >>> 2];
          try {
            var result = {};
            for (var index = 0; index < count; ++index)
              result[module.HEAPU32[(sourcesPointer >>> 2) + index]] =
                module.HEAPU32[(copiesPointer >>> 2) + index];
            return result;
          } finally {
            if (sourcesPointer) module._muhammara_wasm_free(sourcesPointer);
            if (copiesPointer) module._muhammara_wasm_free(copiesPointer);
          }
        } finally {
          module._free(copiesPointerPointer);
          module._free(sourcesPointerPointer);
          module._free(countPointer);
        }
      },
      /**
       * Makes later copies reference existing output objects instead of copying
       * the given source objects.
       * @param {Record<string, number>} mapping - Output object IDs keyed by source object ID.
       * @returns {this} The copying context.
       * @throws {TypeError} If `mapping` is not a plain object.
       * @throws {RangeError} If a key or value is not an object ID.
       * @throws {Error} If the context has ended or the replacement fails.
       */
      replaceSourceObjects: function (mapping) {
        requireCopying();
        if (!mapping || typeof mapping !== "object" || Array.isArray(mapping))
          throw new TypeError("Object replacement mapping must be an object");
        var entries = Object.entries(mapping);
        var sources = entries.map(([source]) => {
          if (!/^(0|[1-9]\d*)$/.test(source) || Number(source) > 0xffffffff)
            throw new RangeError("Replacement source keys must be object IDs");
          return Number(source);
        });
        var copies = entries.map(([, replacement]) => {
          requireObjectId(replacement, "Replacement object ID");
          return replacement;
        });
        var sourcesPointer = sources.length
          ? module._malloc(sources.length * 4)
          : 0;
        var copiesPointer = copies.length
          ? module._malloc(copies.length * 4)
          : 0;
        try {
          if (sourcesPointer) module.HEAPU32.set(sources, sourcesPointer >>> 2);
          if (copiesPointer) module.HEAPU32.set(copies, copiesPointer >>> 2);
          if (
            !module._muhammara_wasm_copying_context_replace_source_objects(
              copying,
              sourcesPointer,
              copiesPointer,
              sources.length,
            )
          )
            throw new Error("Unable to replace source PDF objects");
        } finally {
          if (copiesPointer) module._free(copiesPointer);
          if (sourcesPointer) module._free(sourcesPointer);
        }
        return this;
      },
    };
  }
  return { copyingObjectOperations };
}
