cmake_minimum_required(VERSION 3.20)
project(MuhammaraWasm VERSION 6.0 LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
option(MUHAMMARA_WASM_SANITIZE "Build with Emscripten LeakSanitizer" OFF)
if(MUHAMMARA_WASM_SANITIZE)
  add_compile_options("-fsanitize=leak")
  add_link_options("-fsanitize=leak" "-sEXIT_RUNTIME=1")
endif()
set(PDFHummus_VERSION_MAJOR ${PROJECT_VERSION_MAJOR})
set(PDFHummus_VERSION_MINOR ${PROJECT_VERSION_MINOR})

# Browsers have no OpenSSL runtime. PDF generation remains available, while
# OpenSSL-backed encryption is deliberately excluded from this target.
set(PDFHUMMUS_NO_OPENSSL ON)

set(MUHAMMARA_NATIVE_SOURCE_DIR ${CMAKE_CURRENT_SOURCE_DIR}/../native-with-source/src)
add_subdirectory(${MUHAMMARA_NATIVE_SOURCE_DIR}/deps/LibAesgm LibAesgm)
add_subdirectory(${MUHAMMARA_NATIVE_SOURCE_DIR}/deps/Zlib Zlib)
add_subdirectory(${MUHAMMARA_NATIVE_SOURCE_DIR}/deps/FreeType FreeType)
add_subdirectory(${MUHAMMARA_NATIVE_SOURCE_DIR}/deps/LibJpeg LibJpeg)
add_subdirectory(${MUHAMMARA_NATIVE_SOURCE_DIR}/deps/LibPng LibPng)
add_subdirectory(${MUHAMMARA_NATIVE_SOURCE_DIR}/deps/LibTiff LibTiff)
add_subdirectory(${MUHAMMARA_NATIVE_SOURCE_DIR}/deps/PDFWriter PDFWriter)

add_executable(muhammara-wasm
  src/wasm_api.cpp
  src/wasm_api_support.cpp
  src/wasm_api_recipe.cpp
  src/wasm_api_reader.cpp
  src/wasm_api_modifier.cpp
  src/wasm_api_copying.cpp
)
target_link_libraries(muhammara-wasm PRIVATE PDFHummus::PDFWriter)

if(EMSCRIPTEN)
  set_target_properties(muhammara-wasm PROPERTIES SUFFIX ".js")
  target_link_options(muhammara-wasm PRIVATE
    "-sMODULARIZE=1"
    "-sEXPORT_ES6=1"
    "-sENVIRONMENT=web,worker,node"
    "-sALLOW_MEMORY_GROWTH=1"
    "-sMAXIMUM_MEMORY=536870912"
    "-sFORCE_FILESYSTEM=1"
    "-sEXPORTED_RUNTIME_METHODS=['FS']"
    "-sEXPORTED_FUNCTIONS=['_malloc','_free','_muhammara_wasm_create_blank_pdf','_muhammara_wasm_free','_muhammara_wasm_recipe_create','_muhammara_wasm_recipe_destroy','_muhammara_wasm_recipe_add_page','_muhammara_wasm_recipe_add_page_with_box','_muhammara_wasm_recipe_end_page','_muhammara_wasm_recipe_pause_page','_muhammara_wasm_recipe_set_page_box','_muhammara_wasm_recipe_set_page_rotation','_muhammara_wasm_recipe_rectangle','_muhammara_wasm_recipe_circle','_muhammara_wasm_recipe_line','_muhammara_wasm_recipe_move_to','_muhammara_wasm_recipe_line_to','_muhammara_wasm_recipe_curve_to','_muhammara_wasm_recipe_close_path','_muhammara_wasm_recipe_paint_path','_muhammara_wasm_recipe_save','_muhammara_wasm_recipe_restore','_muhammara_wasm_recipe_cmyk_fill','_muhammara_wasm_recipe_gray_stroke','_muhammara_wasm_recipe_line_width','_muhammara_wasm_recipe_rectangle_path','_muhammara_wasm_recipe_fill_path','_muhammara_wasm_recipe_stroke_path','_muhammara_wasm_recipe_transform','_muhammara_wasm_recipe_set_line_style','_muhammara_wasm_recipe_set_opacity','_muhammara_wasm_recipe_text','_muhammara_wasm_recipe_text_dimensions','_muhammara_wasm_recipe_image','_muhammara_wasm_recipe_image_dimensions','_muhammara_wasm_recipe_set_info','_muhammara_wasm_recipe_link','_muhammara_wasm_recipe_annotation','_muhammara_wasm_recipe_append_pdf','_muhammara_wasm_recipe_append_pdf_range','_muhammara_wasm_recipe_end_pdf','_muhammara_wasm_reader_create','_muhammara_wasm_reader_destroy','_muhammara_wasm_reader_get_pages_count','_muhammara_wasm_reader_get_page_object_id','_muhammara_wasm_reader_get_pdf_level','_muhammara_wasm_reader_get_page_info','_muhammara_wasm_reader_get_objects_count','_muhammara_wasm_reader_is_encrypted','_muhammara_wasm_reader_get_page_box','_muhammara_wasm_reader_get_xref_size','_muhammara_wasm_reader_get_xref_position','_muhammara_wasm_reader_get_xref_entry','_muhammara_wasm_reader_get_trailer_entry_type','_muhammara_wasm_modifier_create','_muhammara_wasm_modifier_destroy','_muhammara_wasm_modifier_start_page','_muhammara_wasm_modifier_rectangle','_muhammara_wasm_modifier_circle','_muhammara_wasm_modifier_line','_muhammara_wasm_modifier_text','_muhammara_wasm_modifier_image','_muhammara_wasm_modifier_end_page','_muhammara_wasm_modifier_end_pdf']"
  )
  target_link_options(muhammara-wasm PRIVATE
    "-sEXPORTED_FUNCTIONS+=['_muhammara_wasm_recipe_operator','_muhammara_wasm_recipe_dash','_muhammara_wasm_writer_get_font_for_bytes','_muhammara_wasm_writer_font_text_dimensions','_muhammara_wasm_writer_font_metrics','_muhammara_wasm_writer_set_font','_muhammara_wasm_writer_set_font_name','_muhammara_wasm_writer_show_text','_muhammara_wasm_writer_show_glyphs','_muhammara_wasm_writer_show_text_operator','_muhammara_wasm_writer_show_glyphs_operator','_muhammara_wasm_writer_show_tj','_muhammara_wasm_writer_create_jpg_image','_muhammara_wasm_image_get_object_id','_muhammara_wasm_writer_create_image_form','_muhammara_wasm_writer_create_tiff_form','_muhammara_wasm_writer_create_form','_muhammara_wasm_form_get_object_id','_muhammara_wasm_writer_form_operator','_muhammara_wasm_writer_form_set_font','_muhammara_wasm_writer_form_set_font_name','_muhammara_wasm_writer_form_show_text_operator','_muhammara_wasm_writer_form_show_glyphs_operator','_muhammara_wasm_writer_form_show_tj','_muhammara_wasm_writer_end_form','_muhammara_wasm_writer_do_xobject','_muhammara_wasm_writer_do_form_object_id','_muhammara_wasm_writer_do_xobject_name','_muhammara_wasm_writer_image_dimensions','_muhammara_wasm_writer_get_image_type','_muhammara_wasm_writer_get_image_pages_count','_muhammara_wasm_writer_retrieve_jpg_image_information','_muhammara_wasm_recipe_remove_info','_muhammara_wasm_recipe_clear_info','_muhammara_wasm_recipe_set_info_date','_muhammara_wasm_recipe_set_info_trapped','_muhammara_wasm_pdf_text_string_from_utf8','_muhammara_wasm_pdf_text_string_to_utf8','_muhammara_wasm_pdf_date_normalize','_muhammara_wasm_writer_require_catalog_update']"
  )
  target_link_options(muhammara-wasm PRIVATE
    "-sEXPORTED_FUNCTIONS+=['_muhammara_wasm_recipe_create_with_options','_muhammara_wasm_recipe_annotation_full','_muhammara_wasm_recipe_image_page']"
  )
  target_link_options(muhammara-wasm PRIVATE
    "-sEXPORTED_FUNCTIONS+=['_muhammara_wasm_recipe_clip_rectangle']"
  )
  target_link_options(muhammara-wasm PRIVATE
    "-sEXPORTED_FUNCTIONS+=['_muhammara_wasm_recipe_structured_operator','_muhammara_wasm_writer_form_structured_operator','_muhammara_wasm_modifier_structured_operator']"
  )
  target_link_options(muhammara-wasm PRIVATE
    "-sEXPORTED_FUNCTIONS+=['_muhammara_wasm_writer_form_dash','_muhammara_wasm_writer_form_set_opacity','_muhammara_wasm_writer_form_do_xobject','_muhammara_wasm_writer_form_do_form_object_id','_muhammara_wasm_writer_form_do_xobject_name']"
  )
  target_link_options(muhammara-wasm PRIVATE
    "-sEXPORTED_FUNCTIONS+=['_muhammara_wasm_reader_get_trailer','_muhammara_wasm_reader_query_dictionary_object','_muhammara_wasm_reader_query_array_object','_muhammara_wasm_reader_parse_object','_muhammara_wasm_reader_parse_page_dictionary','_muhammara_wasm_reader_parse_page','_muhammara_wasm_page_input_get_dictionary','_muhammara_wasm_page_input_get_box','_muhammara_wasm_page_input_get_rotate','_muhammara_wasm_reader_start_reading_objects_from_stream','_muhammara_wasm_reader_start_reading_objects_from_streams','_muhammara_wasm_reader_start_reading_from_stream','_muhammara_wasm_reader_get_parser_stream','_muhammara_wasm_byte_reader_read','_muhammara_wasm_byte_reader_not_ended','_muhammara_wasm_byte_reader_set_position','_muhammara_wasm_byte_reader_set_position_from_end','_muhammara_wasm_byte_reader_skip','_muhammara_wasm_byte_reader_get_current_position','_muhammara_wasm_byte_reader_destroy','_muhammara_wasm_object_get_type','_muhammara_wasm_object_get_string','_muhammara_wasm_object_get_string_bytes','_muhammara_wasm_object_get_number','_muhammara_wasm_object_get_boolean','_muhammara_wasm_object_array_length','_muhammara_wasm_reader_object_array_query','_muhammara_wasm_object_array_query','_muhammara_wasm_object_dictionary_query','_muhammara_wasm_reader_object_dictionary_query','_muhammara_wasm_object_dictionary_keys','_muhammara_wasm_object_stream_dictionary','_muhammara_wasm_reader_object_stream_dictionary','_muhammara_wasm_object_parser_parse']"
  )
  target_link_options(muhammara-wasm PRIVATE
    "-sEXPORTED_FUNCTIONS+=['_muhammara_wasm_reader_extract_page_text','_muhammara_wasm_text_extraction_destroy','_muhammara_wasm_text_extraction_get_count','_muhammara_wasm_text_extraction_get_content','_muhammara_wasm_text_extraction_get_font_resource','_muhammara_wasm_text_extraction_get_font_size','_muhammara_wasm_text_extraction_get_text_matrix']"
  )
  target_link_options(muhammara-wasm PRIVATE
    "-sEXPORTED_FUNCTIONS+=['_muhammara_wasm_modifier_create_page','_muhammara_wasm_modifier_start_page_context','_muhammara_wasm_modifier_operator','_muhammara_wasm_modifier_dash','_muhammara_wasm_modifier_get_font_for_bytes','_muhammara_wasm_modifier_set_font','_muhammara_wasm_modifier_set_font_name','_muhammara_wasm_modifier_set_opacity','_muhammara_wasm_modifier_do_xobject_name','_muhammara_wasm_modifier_do_form_object_id','_muhammara_wasm_modifier_show_text','_muhammara_wasm_modifier_show_text_operator','_muhammara_wasm_modifier_show_glyphs_operator','_muhammara_wasm_modifier_show_tj','_muhammara_wasm_modifier_end_context','_muhammara_wasm_modifier_write_page','_muhammara_wasm_modifier_create_form','_muhammara_wasm_modifier_form_get_object_id','_muhammara_wasm_modifier_end_form','_muhammara_wasm_modifier_get_modified_file_parser','_muhammara_wasm_modifier_create_copying_context','_muhammara_wasm_modifier_create_copying_context_for_modified_file','_muhammara_wasm_writer_create_copying_context','_muhammara_wasm_writer_create_forms_from_pdf','_muhammara_wasm_modifier_destroy_copying_context','_muhammara_wasm_copying_context_append_page','_muhammara_wasm_copying_context_merge_page','_muhammara_wasm_copying_context_create_form_from_page','_muhammara_wasm_copying_context_merge_page_to_form','_muhammara_wasm_copying_context_get_source_document_parser','_muhammara_wasm_copying_parser_get_pages_count','_muhammara_wasm_copying_parser_parse_page','_muhammara_wasm_copying_parser_query_dictionary_object','_muhammara_wasm_copying_parser_query_array_object','_muhammara_wasm_copying_context_copy_direct_object_as_is','_muhammara_wasm_copying_context_copy_object','_muhammara_wasm_copying_context_copy_direct_object_with_deep_copy','_muhammara_wasm_copying_context_copy_new_objects_for_direct_object','_muhammara_wasm_copying_context_get_copied_object_id','_muhammara_wasm_copying_context_get_copied_objects','_muhammara_wasm_copying_context_replace_source_objects','_muhammara_wasm_copying_context_end','_muhammara_wasm_modifier_require_catalog_update']"
  )
  target_link_options(muhammara-wasm PRIVATE
    "-sEXPORTED_FUNCTIONS+=['_muhammara_wasm_recipe_get_objects_context','_muhammara_wasm_modifier_get_objects_context','_muhammara_wasm_objects_allocate_new_object_id','_muhammara_wasm_objects_start_indirect_object','_muhammara_wasm_objects_end_indirect_object','_muhammara_wasm_objects_start_modified_indirect_object','_muhammara_wasm_objects_delete_object','_muhammara_wasm_objects_start_dictionary','_muhammara_wasm_objects_end_dictionary','_muhammara_wasm_dictionary_write_key','_muhammara_wasm_dictionary_write_value','_muhammara_wasm_dictionary_write_bytes','_muhammara_wasm_dictionary_write_rectangle','_muhammara_wasm_objects_start_array','_muhammara_wasm_objects_end_array','_muhammara_wasm_objects_write_number','_muhammara_wasm_objects_write_string','_muhammara_wasm_objects_write_bytes','_muhammara_wasm_objects_write_boolean','_muhammara_wasm_objects_write_reference','_muhammara_wasm_objects_end_line','_muhammara_wasm_objects_set_compress_streams','_muhammara_wasm_objects_start_pdf_stream','_muhammara_wasm_pdf_stream_get_write_stream','_muhammara_wasm_byte_writer_write','_muhammara_wasm_objects_end_pdf_stream','_muhammara_wasm_objects_start_free_context','_muhammara_wasm_objects_end_free_context','_muhammara_wasm_objects_get_current_position']"
  )
  target_link_options(muhammara-wasm PRIVATE
    "-sEXPORTED_FUNCTIONS+=['_muhammara_wasm_recipe_get_page_resources','_muhammara_wasm_modifier_get_page_resources','_muhammara_wasm_writer_get_form_resources','_muhammara_wasm_resources_add_procset','_muhammara_wasm_resources_add_mapping','_muhammara_wasm_writer_attach_url_link','_muhammara_wasm_writer_register_annotation','_muhammara_wasm_writer_create_annotation','_muhammara_wasm_modifier_attach_url_link','_muhammara_wasm_modifier_create_annotation']"
  )
  target_link_options(muhammara-wasm PRIVATE
    "-sEXPORTED_FUNCTIONS+=['_muhammara_wasm_copying_parser_get_page_object_id','_muhammara_wasm_copying_context_get_source_document_stream','_muhammara_wasm_recipe_end_page_and_return_id','_muhammara_wasm_writer_append_pages_from_pdf','_muhammara_wasm_writer_merge_pages_to_page_from_pdf']"
  )
  target_link_options(muhammara-wasm PRIVATE
    "-sEXPORTED_FUNCTIONS+=['_muhammara_wasm_writer_draw_image','_muhammara_wasm_writer_form_draw_image','_muhammara_wasm_modifier_draw_image']"
  )
  target_link_options(muhammara-wasm PRIVATE
    "-sEXPORTED_FUNCTIONS+=['_muhammara_wasm_writer_write_free_code','_muhammara_wasm_writer_form_write_free_code','_muhammara_wasm_modifier_write_free_code','_muhammara_wasm_page_content_get_stream','_muhammara_wasm_form_get_content_stream','_muhammara_wasm_content_stream_get_write_stream','_muhammara_wasm_content_byte_writer_write']"
  )
  target_link_options(muhammara-wasm PRIVATE
    "-sEXPORTED_FUNCTIONS+=['_muhammara_wasm_modifier_pause_page','_muhammara_wasm_modifier_write_page_and_return_id','_muhammara_wasm_modifier_attach_url_link_to_current_page','_muhammara_wasm_modifier_register_annotation','_muhammara_wasm_modifier_create_annotation_for_current_page','_muhammara_wasm_modifier_set_info','_muhammara_wasm_modifier_remove_info','_muhammara_wasm_modifier_clear_info','_muhammara_wasm_modifier_set_info_date','_muhammara_wasm_modifier_set_info_trapped','_muhammara_wasm_modifier_image_dimensions','_muhammara_wasm_modifier_get_image_type','_muhammara_wasm_modifier_get_image_pages_count','_muhammara_wasm_modifier_retrieve_jpg_image_information','_muhammara_wasm_modifier_create_jpg_image','_muhammara_wasm_modifier_create_image_form','_muhammara_wasm_modifier_create_forms_from_pdf','_muhammara_wasm_modifier_append_pages_from_pdf','_muhammara_wasm_modifier_merge_pages_to_page_from_pdf','_muhammara_wasm_modifier_replace_object']"
  )
  target_link_options(muhammara-wasm PRIVATE
    "-sEXPORTED_FUNCTIONS+=['_muhammara_wasm_modifier_font_metrics','_muhammara_wasm_modifier_form_dash','_muhammara_wasm_modifier_form_set_opacity','_muhammara_wasm_modifier_form_structured_operator','_muhammara_wasm_modifier_form_draw_image','_muhammara_wasm_modifier_form_show_text_operator','_muhammara_wasm_modifier_form_show_glyphs_operator','_muhammara_wasm_modifier_form_show_tj','_muhammara_wasm_modifier_form_do_xobject_name','_muhammara_wasm_modifier_form_do_form_object_id']"
  )
  target_link_options(muhammara-wasm PRIVATE
    "-sEXPORTED_FUNCTIONS+=['_muhammara_wasm_modifier_write_current_page_stream','_muhammara_wasm_modifier_font_text_dimensions','_muhammara_wasm_modifier_create_tiff_form','_muhammara_wasm_modifier_get_form_resources','_muhammara_wasm_modifier_form_operator','_muhammara_wasm_modifier_form_set_font','_muhammara_wasm_modifier_form_set_font_name','_muhammara_wasm_modifier_form_show_text','_muhammara_wasm_modifier_form_write_free_code','_muhammara_wasm_modifier_form_write_stream','_muhammara_wasm_object_indirect_reference','_muhammara_wasm_object_stream_content_start']"
  )
endif()
