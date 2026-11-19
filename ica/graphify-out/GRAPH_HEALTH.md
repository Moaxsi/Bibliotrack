[graphify] MultiDiGraph edge-collapse diagnostic
input: <in-memory>
input_stage: provided JSON (normal graph.json is post-build)
effective_directed: <direct-call>
nodes: 304
unverified_code_nodes: 0
raw_edges: 690
valid_candidate_edges: 609
missing_endpoint_edges: 0
dangling_endpoint_edges: 81
external_reference_edges: 0
self_loop_edges: 0
exact_duplicate_edges: 0
directed_unique_endpoint_pairs: 567
directed_same_endpoint_collapsed_edges: 42
undirected_unique_endpoint_pairs: 567
undirected_same_endpoint_collapsed_edges: 42
same_endpoint_group_count: 40
relation_variant_groups: 10
source_file_variant_groups: 0
source_location_variant_groups: 9
context_variant_groups: 21
post_build_graph_type: Graph
post_build_edges: 641
producer_suppression_sites: 12
producer_suppression_examples:
  - L1814 seen_ids arity=unknown
  - L2378 seen_ids arity=unknown
  - L2380 seen_doc_refs arity=unknown
  - L3047 seen_ids arity=unknown
  - L3194 seen_ids arity=unknown
  - L4223 seen_keys arity=unknown
  - L4409 seen_keys arity=unknown
  - L7740 seen_ids arity=unknown
examples:
  - src_main_resources_static_frontend_admin_js_libros -> src_main_resources_static_frontend_compartido_js_comun edges=3 relations=['imports_from'] locations=['L1', 'L2', 'L4'] contexts=['import']
  - src_main_resources_static_frontend_admin_js_ventas -> src_main_resources_static_frontend_compartido_js_comun edges=3 relations=['imports_from'] locations=['L1', 'L2', 'L3'] contexts=['import']
  - mvnw -> mvnw_native_path edges=2 relations=['defines'] locations=['L11', 'L7'] contexts=['']
  - mvnw -> mvnw_verbose edges=2 relations=['defines'] locations=['L59', 'L60'] contexts=['']
  - src_main_java_com_bibliotrack_ica_controller_appcontroller -> src_main_java_com_bibliotrack_ica_modelo_categoria_categoria edges=2 relations=['imports'] locations=['L3'] contexts=['', 'import']
note: normal graph.json is post-build; raw producer loss must be measured earlier.