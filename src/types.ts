import type * as Blockly from "blockly";

export type theme_mode = "light" | "dark";

export type position = {
  line: number;
  column: number;
  offset: number;
};

export type span = {
  start: position;
  end: position;
};

export type token_range = {
  start: number;
  end: number;
};

export type trivia = {
  kind: "Comment" | "RawWhitespace" | "Blank";
  data: unknown;
  span: span;
};

export type node_meta = {
  id: number;
  span: span;
  token_range: token_range;
  leading_trivia: trivia[];
  trailing_trivia: trivia[];
};

export type number_literal = {
  raw: string;
};

export type string_literal = {
  raw: string;
  value: string;
  quote: "single" | "double";
  escaped: boolean;
};

export type literal =
  | { kind: "Number"; data: number_literal }
  | { kind: "String"; data: string_literal }
  | { kind: "Bool"; data: boolean }
  | { kind: "None" };

export type pattern =
  | { kind: "Wildcard"; data: node_meta }
  | { kind: "Identifier"; data: pattern_identifier }
  | { kind: "Literal"; data: pattern_literal };

export type pattern_identifier = {
  meta: node_meta;
  name: string;
};

export type pattern_literal = {
  meta: node_meta;
  literal: literal;
};

export type binary_op =
  | "add"
  | "sub"
  | "mul"
  | "div"
  | "mod"
  | "floor_div"
  | "power"
  | "bit_and"
  | "bit_or"
  | "bit_xor"
  | "left_shift"
  | "right_shift";

export type unary_op = "neg" | "not" | "bit_not";

export type bool_op = "and" | "or";

export type compare_op =
  | "eq"
  | "not_eq"
  | "lt"
  | "lt_eq"
  | "gt"
  | "gt_eq"
  | "in"
  | "not_in"
  | "is"
  | "is_not";

export type comprehension_kind = "list" | "dict" | "generator" | "set";

export type expr =
  | { kind: "Identifier"; data: identifier_expr }
  | { kind: "Literal"; data: literal_expr }
  | { kind: "Binary"; data: binary_expr }
  | { kind: "Unary"; data: unary_expr }
  | { kind: "BoolOp"; data: boolop_expr }
  | { kind: "Compare"; data: compare_expr }
  | { kind: "Lambda"; data: lambda_expr }
  | { kind: "IfExpr"; data: ifexpr_expr }
  | { kind: "Call"; data: call_expr }
  | { kind: "Tuple"; data: tuple_expr }
  | { kind: "Attribute"; data: attribute_expr }
  | { kind: "Subscript"; data: subscript_expr }
  | { kind: "Grouped"; data: grouped_expr }
  | { kind: "List"; data: list_expr }
  | { kind: "Dict"; data: dict_expr }
  | { kind: "Set"; data: set_expr }
  | { kind: "Comprehension"; data: comprehension_expr }
  | { kind: "Slice"; data: slice_expr }
  | { kind: "FString"; data: fstring_expr }
  | { kind: "NamedExpr"; data: named_expr_data }
  | { kind: "Yield"; data: yield_expr_data }
  | { kind: "YieldFrom"; data: yield_from_expr_data }
  | { kind: "Await"; data: await_expr_data };

export type slice_expr = {
  meta: node_meta;
  lower: expr | null;
  upper: expr | null;
  step: expr | null;
};

export type keyword_arg = {
  name: string;
  value: expr;
};

export type fstring_part =
  | { kind: "Literal"; data: string }
  | { kind: "Expr"; data: expr };

export type fstring_expr = {
  meta: node_meta;
  parts: fstring_part[];
  quote: "single" | "double";
};

export type named_expr_data = {
  meta: node_meta;
  name: string;
  value: expr;
};

export type yield_expr_data = {
  meta: node_meta;
  value: expr | null;
};

export type yield_from_expr_data = {
  meta: node_meta;
  value: expr;
};

export type await_expr_data = {
  meta: node_meta;
  value: expr;
};

export type identifier_expr = {
  meta: node_meta;
  name: string;
};

export type literal_expr = {
  meta: node_meta;
  literal: literal;
};

export type binary_expr = {
  meta: node_meta;
  left: expr;
  op: binary_op;
  right: expr;
};

export type unary_expr = {
  meta: node_meta;
  op: unary_op;
  expr: expr;
};

export type boolop_expr = {
  meta: node_meta;
  op: bool_op;
  values: expr[];
};

export type compare_expr = {
  meta: node_meta;
  left: expr;
  ops: compare_op[];
  comparators: expr[];
};

export type lambda_expr = {
  meta: node_meta;
  params: string[];
  body: expr;
};

export type ifexpr_expr = {
  meta: node_meta;
  body: expr;
  condition: expr;
  else_body: expr;
};

export type call_expr = {
  meta: node_meta;
  callee: expr;
  args: expr[];
  kwargs: keyword_arg[];
};

export type tuple_expr = {
  meta: node_meta;
  elements: expr[];
};

export type attribute_expr = {
  meta: node_meta;
  value: expr;
  attr: string;
};

export type subscript_expr = {
  meta: node_meta;
  value: expr;
  index: expr;
};

export type grouped_expr = {
  meta: node_meta;
  expr: expr;
};

export type list_expr = {
  meta: node_meta;
  elements: expr[];
};

export type dict_expr = {
  meta: node_meta;
  entries: dict_entry[];
};

export type dict_entry = {
  meta: node_meta;
  key: expr;
  value: expr;
};

export type set_expr = {
  meta: node_meta;
  elements: expr[];
};

export type comprehension_expr =
  | { kind: "list"; data: comprehension_list_expr }
  | { kind: "set"; data: comprehension_set_expr }
  | { kind: "generator"; data: comprehension_generator_expr }
  | { kind: "dict"; data: comprehension_dict_expr };

export type comprehension_list_expr = {
  meta: node_meta;
  element: expr;
  fors: comprehension_for[];
};

export type comprehension_set_expr = {
  meta: node_meta;
  element: expr;
  fors: comprehension_for[];
};

export type comprehension_generator_expr = {
  meta: node_meta;
  element: expr;
  fors: comprehension_for[];
};

export type comprehension_dict_expr = {
  meta: node_meta;
  key: expr;
  value: expr;
  fors: comprehension_for[];
};

export type comprehension_for = {
  meta: node_meta;
  target: expr;
  iter: expr;
  ifs: expr[];
};

export type ir_block = {
  meta: node_meta;
  indent_level: number;
  statements: ir_stmt[];
};

export type ir_case_block = {
  meta: node_meta;
  indent_level: number;
  cases: ir_match_case[];
};

export type ir_match_case = {
  meta: node_meta;
  pattern: pattern;
  body: ir_block;
};

export type ir_stmt =
  | { kind: "If"; data: ir_if_stmt }
  | { kind: "While"; data: ir_while_stmt }
  | { kind: "For"; data: ir_for_stmt }
  | { kind: "Match"; data: ir_match_stmt }
  | { kind: "FunctionDef"; data: ir_function_def }
  | { kind: "Assign"; data: ir_assign_stmt }
  | { kind: "Expr"; data: ir_expr_stmt }
  | { kind: "Pass"; data: ir_pass_stmt }
  | { kind: "Empty"; data: ir_empty_stmt }
  | { kind: "Return"; data: ir_return_stmt }
  | { kind: "Break"; data: ir_break_stmt }
  | { kind: "Continue"; data: ir_continue_stmt }
  | { kind: "AugAssign"; data: ir_aug_assign_stmt }
  | { kind: "Import"; data: ir_import_stmt }
  | { kind: "Try"; data: ir_try_stmt }
  | { kind: "ClassDef"; data: ir_class_def }
  | { kind: "With"; data: ir_with_stmt }
  | { kind: "Assert"; data: ir_assert_stmt }
  | { kind: "Raise"; data: ir_raise_stmt }
  | { kind: "Del"; data: ir_del_stmt }
  | { kind: "Global"; data: ir_global_stmt }
  | { kind: "Nonlocal"; data: ir_nonlocal_stmt }
  | { kind: "AnnAssign"; data: ir_ann_assign_stmt };

export type ir_if_stmt = {
  meta: node_meta;
  condition: expr;
  body: ir_block;
  elifs: ir_elif_stmt[];
  else_body: ir_block | null;
};

export type ir_elif_stmt = {
  meta: node_meta;
  condition: expr;
  body: ir_block;
};

export type ir_while_stmt = {
  meta: node_meta;
  condition: expr;
  body: ir_block;
  else_body: ir_block | null;
};

export type ir_for_stmt = {
  meta: node_meta;
  target: expr;
  iterable: expr;
  body: ir_block;
  else_body: ir_block | null;
  is_async?: boolean;
};

export type ir_match_stmt = {
  meta: node_meta;
  subject: expr;
  cases: ir_case_block;
};

export type ir_function_def = {
  meta: node_meta;
  name: string;
  params: ir_func_param[];
  decorators: expr[];
  body: ir_block;
  return_type: expr | null;
  is_async?: boolean;
};

export type ir_func_param = {
  name: string;
  annotation: expr | null;
  default_value: expr | null;
  kind: "normal" | "star" | "double_star";
};

export type ir_assign_stmt = {
  meta: node_meta;
  targets: expr[];
  value: expr;
};

export type ir_expr_stmt = {
  meta: node_meta;
  expr: expr;
};

export type ir_pass_stmt = {
  meta: node_meta;
};

export type ir_empty_stmt = {
  meta: node_meta;
  source: "Source" | "Generated";
};

export type ir_return_stmt = {
  meta: node_meta;
  value: expr | null;
};

export type ir_break_stmt = {
  meta: node_meta;
};

export type ir_continue_stmt = {
  meta: node_meta;
};

export type ir_aug_assign_stmt = {
  meta: node_meta;
  target: expr;
  op: string;
  value: expr;
};

export type import_name = {
  name: string;
  alias: string | null;
};

export type ir_import_stmt = {
  meta: node_meta;
  module: string;
  names: import_name[];
  is_from: boolean;
};

export type ir_except_handler = {
  meta: node_meta;
  exception_type: expr | null;
  name: string | null;
  body: ir_block;
};

export type ir_try_stmt = {
  meta: node_meta;
  body: ir_block;
  handlers: ir_except_handler[];
  else_body: ir_block | null;
  finally_body: ir_block | null;
};

export type ir_class_def = {
  meta: node_meta;
  name: string;
  bases: expr[];
  decorators: expr[];
  body: ir_block;
};

export type ir_context_item = {
  context: expr;
  name: string | null;
};

export type ir_with_stmt = {
  meta: node_meta;
  items: ir_context_item[];
  body: ir_stmt[];
  is_async?: boolean;
};

export type ir_assert_stmt = {
  meta: node_meta;
  condition: expr;
  message: expr | null;
};

export type ir_raise_stmt = {
  meta: node_meta;
  exception: expr | null;
};

export type ir_del_stmt = {
  meta: node_meta;
  target: expr;
};

export type ir_global_stmt = {
  meta: node_meta;
  names: string[];
};

export type ir_nonlocal_stmt = {
  meta: node_meta;
  names: string[];
};

export type ir_ann_assign_stmt = {
  meta: node_meta;
  target: string;
  annotation: expr;
  value: expr | null;
};

export type ir_program = {
  meta: node_meta;
  indent_width: number;
  body: ir_stmt[];
  token_store: unknown | null;
  dirty: boolean;
};

export type run_result = {
  stdout: string;
  stderr: string;
  status: number;
};

export type call_block = Blockly.Block & {
  itemCount_: number;
  updateShape_: () => void;
};

export type tuple_block = Blockly.Block & {
  itemCount_: number;
  updateShape_: () => void;
};

export type function_def_block = Blockly.Block & {
  itemCount_: number;
  updateShape_: () => void;
};

export type boolop_block = Blockly.Block & {
  itemCount_: number;
  updateShape_: () => void;
};

export type compare_block = Blockly.Block & {
  itemCount_: number;
  updateShape_: () => void;
};

export type list_block = Blockly.Block & {
  itemCount_: number;
  updateShape_: () => void;
};

export type dict_block = Blockly.Block & {
  itemCount_: number;
  updateShape_: () => void;
};

export type set_block = Blockly.Block & {
  itemCount_: number;
  updateShape_: () => void;
};

export type comprehension_block = Blockly.Block & {
  forCount_: number;
  ifCounts_: number[];
  is_updating_: boolean;
  updateShape_: () => void;
};

export type try_block = Blockly.Block & {
  handlerCount_: number;
  updateShape_: () => void;
};

export type class_def_block = Blockly.Block & {
  baseCount_: number;
  updateShape_: () => void;
};

export type import_block = Blockly.Block & {
  nameCount_: number;
  updateShape_: () => void;
};

export type with_block = Blockly.Block & {
  itemCount_: number;
  updateShape_: () => void;
};

export type range_block = Blockly.Block & {
  itemCount_: number;
  updateShape_: () => void;
};

export type zip_block = Blockly.Block & {
  itemCount_: number;
  updateShape_: () => void;
};
