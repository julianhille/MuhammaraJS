/** Creates low-level helpers for copying objects between PDF documents. */
export function createCopyingHelpers({ module, constants, withString }) {
  function copyingSourceParser(copying, requireCopying) {
    var parser =
      module._muhammara_wasm_copying_context_get_source_document_parser(
        copying,
      );
    var ended = false;
    if (!parser) throw new Error("Unable to get source document parser");

    function requireParser() {
      requireCopying();
      if (ended) throw new Error("Source document parser has ended");
    }

    function objectKeys(handle) {
      var lengthPointer = module._malloc(4);
      try {
        var pointer = module._muhammara_wasm_object_dictionary_keys(
          handle,
          lengthPointer,
        );
        var length = module.HEAPU32[lengthPointer >>> 2];
        if (!pointer && length)
          throw new Error("Unable to read PDF dictionary");
        try {
          return pointer
            ? new TextDecoder()
                .decode(module.HEAPU8.slice(pointer, pointer + length))
                .split("\0")
                .filter(Boolean)
            : [];
        } finally {
          if (pointer) module._muhammara_wasm_free(pointer);
        }
      } finally {
        module._free(lengthPointer);
      }
    }

    function wrapObject(handle) {
      if (!handle) return undefined;
      var object = {
        _handle: handle,
        _copyingContext: copying,
        getType: function () {
          requireParser();
          return module._muhammara_wasm_object_get_type(handle);
        },
        toPDFArray: function () {
          return object.getType() === constants.ePDFObjectArray
            ? object
            : undefined;
        },
        toPDFDictionary: function () {
          return object.getType() === constants.ePDFObjectDictionary
            ? object
            : undefined;
        },
      };
      if (object.getType() === constants.ePDFObjectArray) {
        object.getLength = function () {
          requireParser();
          return module._muhammara_wasm_object_array_length(handle);
        };
        object.queryObject = function (index) {
          if (!Number.isInteger(index) || index < 0) {
            throw new RangeError("Array index must be a non-negative integer");
          }
          requireParser();
          return wrapObject(
            module._muhammara_wasm_copying_parser_query_array_object(
              parser,
              handle,
              index,
            ),
          );
        };
        object.toJSArray = function () {
          return Array.from({ length: object.getLength() }, (_, index) =>
            object.queryObject(index),
          );
        };
      }
      if (object.getType() === constants.ePDFObjectDictionary) {
        object.queryObject = function (key) {
          if (typeof key !== "string") {
            throw new TypeError("Dictionary key must be a string");
          }
          requireParser();
          var result = withString(key, (pointer) =>
            module._muhammara_wasm_copying_parser_query_dictionary_object(
              parser,
              handle,
              pointer,
            ),
          );
          if (!result) throw new Error("key not found");
          return wrapObject(result);
        };
        object.toJSObject = function () {
          requireParser();
          return Object.fromEntries(
            objectKeys(handle).map((key) => [key, object.queryObject(key)]),
          );
        };
      }
      return object;
    }

    return {
      _end: function () {
        ended = true;
      },
      getPagesCount: function () {
        requireParser();
        return module._muhammara_wasm_copying_parser_get_pages_count(parser);
      },
      getPageObjectID: function (index) {
        requireParser();
        if (!Number.isInteger(index) || index < 0) {
          throw new TypeError("Page index must be a non-negative integer");
        }
        var id = module._muhammara_wasm_copying_parser_get_page_object_id(
          parser,
          index,
        );
        if (!id) throw new RangeError(`Unable to read page ${index}`);
        return id;
      },
      parsePage: function (index) {
        requireParser();
        if (!Number.isInteger(index) || index < 0) {
          throw new TypeError("Page index must be a non-negative integer");
        }
        var object = wrapObject(
          module._muhammara_wasm_copying_parser_parse_page(parser, index),
        );
        if (!object) throw new RangeError(`Unable to read page ${index}`);
        return object;
      },
      parsePageDictionary: function (index) {
        return this.parsePage(index);
      },
    };
  }

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
  return { copyingSourceParser, copyingObjectOperations };
}
