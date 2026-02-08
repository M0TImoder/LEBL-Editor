import { invoke } from "@tauri-apps/api/core";
import * as Blockly from "blockly";
import "./styles.css";

type theme_mode = "light" | "dark";

type position = {
  line: number;
  column: number;
  offset: number;
};

type span = {
  start: position;
  end: position;
};

type token_range = {
  start: number;
  end: number;
};

type trivia = {
  kind: "Comment" | "RawWhitespace" | "Blank";
  data: unknown;
};

type node_meta = {
  id: number;
  span: span;
  token_range: token_range;
  leading_trivia: trivia[];
  trailing_trivia: trivia[];
};

type number_literal = {
  raw: string;
};

type string_literal = {
  raw: string;
  value: string;
  quote: "single" | "double";
  escaped: boolean;
};

type literal =
  | { kind: "Number"; data: number_literal }
  | { kind: "String"; data: string_literal }
  | { kind: "Bool"; data: boolean }
  | { kind: "None" };

type pattern =
  | { kind: "Wildcard"; data: node_meta }
  | { kind: "Identifier"; data: pattern_identifier }
  | { kind: "Literal"; data: pattern_literal };

type pattern_identifier = {
  meta: node_meta;
  name: string;
};

type pattern_literal = {
  meta: node_meta;
  literal: literal;
};

type binary_op =
  | "add"
  | "sub"
  | "mul"
  | "div"
  | "mod";

type unary_op = "neg" | "not";

type bool_op = "and" | "or";

type compare_op =
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

type comprehension_kind = "list" | "dict" | "generator" | "set";

type expr =
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
  | { kind: "Comprehension"; data: comprehension_expr };

type identifier_expr = {
  meta: node_meta;
  name: string;
};

type literal_expr = {
  meta: node_meta;
  literal: literal;
};

type binary_expr = {
  meta: node_meta;
  left: expr;
  op: binary_op;
  right: expr;
};

type unary_expr = {
  meta: node_meta;
  op: unary_op;
  expr: expr;
};

type boolop_expr = {
  meta: node_meta;
  op: bool_op;
  values: expr[];
};

type compare_expr = {
  meta: node_meta;
  left: expr;
  ops: compare_op[];
  comparators: expr[];
};

type lambda_expr = {
  meta: node_meta;
  params: string[];
  body: expr;
};

type ifexpr_expr = {
  meta: node_meta;
  body: expr;
  condition: expr;
  else_body: expr;
};

type call_expr = {
  meta: node_meta;
  callee: expr;
  args: expr[];
};

type tuple_expr = {
  meta: node_meta;
  elements: expr[];
};

type attribute_expr = {
  meta: node_meta;
  value: expr;
  attr: string;
};

type subscript_expr = {
  meta: node_meta;
  value: expr;
  index: expr;
};

type grouped_expr = {
  meta: node_meta;
  expr: expr;
};

type list_expr = {
  meta: node_meta;
  elements: expr[];
};

type dict_expr = {
  meta: node_meta;
  entries: dict_entry[];
};

type dict_entry = {
  meta: node_meta;
  key: expr;
  value: expr;
};

type set_expr = {
  meta: node_meta;
  elements: expr[];
};

type comprehension_expr =
  | { kind: "list"; data: comprehension_list_expr }
  | { kind: "set"; data: comprehension_set_expr }
  | { kind: "generator"; data: comprehension_generator_expr }
  | { kind: "dict"; data: comprehension_dict_expr };

type comprehension_list_expr = {
  meta: node_meta;
  element: expr;
  fors: comprehension_for[];
};

type comprehension_set_expr = {
  meta: node_meta;
  element: expr;
  fors: comprehension_for[];
};

type comprehension_generator_expr = {
  meta: node_meta;
  element: expr;
  fors: comprehension_for[];
};

type comprehension_dict_expr = {
  meta: node_meta;
  key: expr;
  value: expr;
  fors: comprehension_for[];
};

type comprehension_for = {
  meta: node_meta;
  target: expr;
  iter: expr;
  ifs: expr[];
};

type ir_block = {
  meta: node_meta;
  indent_level: number;
  statements: ir_stmt[];
};

type ir_case_block = {
  meta: node_meta;
  indent_level: number;
  cases: ir_match_case[];
};

type ir_match_case = {
  meta: node_meta;
  pattern: pattern;
  body: ir_block;
};

type ir_stmt =
  | { kind: "If"; data: ir_if_stmt }
  | { kind: "While"; data: ir_while_stmt }
  | { kind: "For"; data: ir_for_stmt }
  | { kind: "Match"; data: ir_match_stmt }
  | { kind: "Assign"; data: ir_assign_stmt }
  | { kind: "Expr"; data: ir_expr_stmt }
  | { kind: "Pass"; data: ir_pass_stmt }
  | { kind: "Empty"; data: ir_empty_stmt };

type ir_if_stmt = {
  meta: node_meta;
  condition: expr;
  body: ir_block;
  elifs: ir_elif_stmt[];
  else_body: ir_block | null;
};

type ir_elif_stmt = {
  meta: node_meta;
  condition: expr;
  body: ir_block;
};

type ir_while_stmt = {
  meta: node_meta;
  condition: expr;
  body: ir_block;
};

type ir_for_stmt = {
  meta: node_meta;
  target: expr;
  iterable: expr;
  body: ir_block;
};

type ir_match_stmt = {
  meta: node_meta;
  subject: expr;
  cases: ir_case_block;
};

type ir_assign_stmt = {
  meta: node_meta;
  target: expr;
  value: expr;
};

type ir_expr_stmt = {
  meta: node_meta;
  expr: expr;
};

type ir_pass_stmt = {
  meta: node_meta;
};

type ir_empty_stmt = {
  meta: node_meta;
  source: "Source" | "Generated";
};

type ir_program = {
  meta: node_meta;
  indent_width: number;
  body: ir_stmt[];
  token_store: unknown | null;
  dirty: boolean;
};

type run_result = {
  stdout: string;
  stderr: string;
  status: number;
};

type call_block = Blockly.Block & {
  itemCount_: number;
  updateShape_: () => void;
};

type tuple_block = Blockly.Block & {
  itemCount_: number;
  updateShape_: () => void;
};

type boolop_block = Blockly.Block & {
  itemCount_: number;
  updateShape_: () => void;
};

type compare_block = Blockly.Block & {
  itemCount_: number;
  updateShape_: () => void;
};

type list_block = Blockly.Block & {
  itemCount_: number;
  updateShape_: () => void;
};

type dict_block = Blockly.Block & {
  itemCount_: number;
  updateShape_: () => void;
};

type set_block = Blockly.Block & {
  itemCount_: number;
  updateShape_: () => void;
};

type comprehension_block = Blockly.Block & {
  forCount_: number;
  ifCounts_: number[];
  updateShape_: () => void;
};

const block_type_if = "stmt_if";
const block_type_elif = "stmt_elif";
const block_type_else = "stmt_else";
const block_type_while = "stmt_while";
const block_type_for = "stmt_for";
const block_type_match = "stmt_match";
const block_type_case = "stmt_case";
const block_type_assign = "stmt_assign";
const block_type_expr = "stmt_expr";
const block_type_pass = "stmt_pass";
const block_type_identifier = "expr_identifier";
const block_type_number = "expr_number";
const block_type_string = "expr_string";
const block_type_bool = "expr_bool";
const block_type_none = "expr_none";
const block_type_binary = "expr_binary";
const block_type_unary = "expr_unary";
const block_type_boolop = "expr_boolop";
const block_type_compare = "expr_compare";
const block_type_ifexpr = "expr_ifexpr";
const block_type_lambda = "expr_lambda";
const block_type_call = "expr_call";
const block_type_tuple = "expr_tuple";
const block_type_attribute = "expr_attribute";
const block_type_subscript = "expr_subscript";
const block_type_grouped = "expr_grouped";
const block_type_list = "expr_list";
const block_type_dict = "expr_dict";
const block_type_set = "expr_set";
const block_type_comprehension = "expr_comprehension";
const expr_output = "Expr";

const workspace_container_id = "blockly_workspace";
const local_storage_source_key = "lebl_python_source";
const local_storage_theme_key = "lebl_theme_mode";
const code_sync_delay_ms = 180;

let workspace: Blockly.WorkspaceSvg | null = null;
let code_editor: HTMLTextAreaElement | null = null;
let output_console: HTMLPreElement | null = null;
let theme_toggle_button: HTMLButtonElement | null = null;
let save_button: HTMLButtonElement | null = null;
let load_button: HTMLButtonElement | null = null;
let run_button: HTMLButtonElement | null = null;
let is_syncing = false;
let code_sync_timer: number | undefined;
let current_theme: theme_mode = "light";
let next_node_id = 1;

const blockly_theme_light = Blockly.Theme.defineTheme("lebl_light", {
  name: "lebl_light",
  base: Blockly.Themes.Classic,
  componentStyles: {
    workspaceBackgroundColour: "#f8f9fb",
    toolboxBackgroundColour: "#ffffff",
    toolboxForegroundColour: "#1b1f28",
    flyoutBackgroundColour: "#ffffff",
    flyoutForegroundColour: "#1b1f28",
    flyoutOpacity: 0.9,
    scrollbarColour: "#c7cdd8",
    insertionMarkerColour: "#4c6fff",
    insertionMarkerOpacity: 0.3,
  },
});

const blockly_theme_dark = Blockly.Theme.defineTheme("lebl_dark", {
  name: "lebl_dark",
  base: Blockly.Themes.Classic,
  componentStyles: {
    workspaceBackgroundColour: "#1b1f27",
    toolboxBackgroundColour: "#1c1f27",
    toolboxForegroundColour: "#e8eaf1",
    flyoutBackgroundColour: "#202431",
    flyoutForegroundColour: "#e8eaf1",
    flyoutOpacity: 0.9,
    scrollbarColour: "#3a4152",
    insertionMarkerColour: "#7aa2ff",
    insertionMarkerOpacity: 0.4,
  },
});

const toolbox = {
  kind: "categoryToolbox",
  contents: [
    {
      kind: "category",
      name: "制御",
      contents: [
        { kind: "block", type: block_type_if },
        { kind: "block", type: block_type_elif },
        { kind: "block", type: block_type_else },
        { kind: "block", type: block_type_match },
        { kind: "block", type: block_type_case },
      ],
    },
    {
      kind: "category",
      name: "ループ",
      contents: [
        { kind: "block", type: block_type_while },
        { kind: "block", type: block_type_for },
      ],
    },
    {
      kind: "category",
      name: "代入",
      contents: [{ kind: "block", type: block_type_assign }],
    },
    {
      kind: "category",
      name: "式",
      contents: [
        { kind: "block", type: block_type_identifier },
        { kind: "block", type: block_type_number },
        { kind: "block", type: block_type_string },
        { kind: "block", type: block_type_bool },
        { kind: "block", type: block_type_none },
        { kind: "block", type: block_type_binary },
        { kind: "block", type: block_type_unary },
        { kind: "block", type: block_type_boolop },
        { kind: "block", type: block_type_compare },
        { kind: "block", type: block_type_ifexpr },
        { kind: "block", type: block_type_lambda },
        { kind: "block", type: block_type_call },
        { kind: "block", type: block_type_tuple },
        { kind: "block", type: block_type_list },
        { kind: "block", type: block_type_dict },
        { kind: "block", type: block_type_set },
        { kind: "block", type: block_type_comprehension },
        { kind: "block", type: block_type_attribute },
        { kind: "block", type: block_type_subscript },
        { kind: "block", type: block_type_grouped },
      ],
    },
    {
      kind: "category",
      name: "文",
      contents: [
        { kind: "block", type: block_type_expr },
        { kind: "block", type: block_type_pass },
      ],
    },
  ],
};

const default_source_code = [
  "value = 3",
  "if value > 1:",
  "    print(value)",
  "elif value == 1:",
  "    print('one')",
  "else:",
  "    print('zero')",
  "for item in range(3):",
  "    print(item)",
  "while value < 6:",
  "    value = value + 1",
  "match value:",
  "    case 6:",
  "        print('six')",
  "    case _:",
  "        print('other')",
].join("\n");

const parse_python_to_ir = async (source: string) =>
  invoke<ir_program>("parse_python_to_ir", { source });

const generate_python_from_ir = async (ir: ir_program) =>
  invoke<string>("generate_python_from_ir", {
    ir,
    render_mode: "Lossless",
  });

const run_python = async (source: string) =>
  invoke<run_result>("run_python", { source });

const set_output = (text: string) => {
  if (output_console) {
    output_console.textContent = text;
  }
};

const apply_theme = (theme: theme_mode) => {
  current_theme = theme;
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(local_storage_theme_key, theme);
  if (workspace) {
    workspace.setTheme(theme === "dark" ? blockly_theme_dark : blockly_theme_light);
    Blockly.svgResize(workspace);
  }
  if (theme_toggle_button) {
    theme_toggle_button.textContent = theme === "dark" ? "ライト" : "ダーク";
  }
};

const make_span = (): span => ({
  start: { line: 1, column: 1, offset: 0 },
  end: { line: 1, column: 1, offset: 0 },
});

const make_meta = (): node_meta => ({
  id: next_node_id++,
  span: make_span(),
  token_range: { start: 0, end: 0 },
  leading_trivia: [],
  trailing_trivia: [],
});

const update_node_counter = (program: ir_program) => {
  const max_id = Math.max(collect_max_id_program(program), next_node_id);
  next_node_id = max_id + 1;
};

const collect_max_id_program = (program: ir_program) => {
  let max_id = program.meta.id;
  program.body.forEach((stmt) => {
    max_id = Math.max(max_id, collect_max_id_stmt(stmt));
  });
  return max_id;
};

const collect_max_id_stmt = (stmt: ir_stmt): number => {
  let max_id = stmt.data.meta.id;
  switch (stmt.kind) {
    case "If":
      max_id = Math.max(max_id, collect_max_id_expr(stmt.data.condition));
      max_id = Math.max(max_id, collect_max_id_block(stmt.data.body));
      stmt.data.elifs.forEach((elif) => {
        max_id = Math.max(max_id, collect_max_id_expr(elif.condition));
        max_id = Math.max(max_id, collect_max_id_block(elif.body));
      });
      if (stmt.data.else_body) {
        max_id = Math.max(max_id, collect_max_id_block(stmt.data.else_body));
      }
      return max_id;
    case "While":
      return Math.max(
        max_id,
        collect_max_id_expr(stmt.data.condition),
        collect_max_id_block(stmt.data.body),
      );
    case "For":
      return Math.max(
        max_id,
        collect_max_id_expr(stmt.data.target),
        collect_max_id_expr(stmt.data.iterable),
        collect_max_id_block(stmt.data.body),
      );
    case "Match":
      max_id = Math.max(max_id, collect_max_id_expr(stmt.data.subject));
      max_id = Math.max(max_id, collect_max_id_case_block(stmt.data.cases));
      return max_id;
    case "Assign":
      return Math.max(
        max_id,
        collect_max_id_expr(stmt.data.target),
        collect_max_id_expr(stmt.data.value),
      );
    case "Expr":
      return Math.max(max_id, collect_max_id_expr(stmt.data.expr));
    case "Pass":
    case "Empty":
      return max_id;
    default:
      return max_id;
  }
};

const collect_max_id_block = (block: ir_block): number => {
  let max_id = block.meta.id;
  block.statements.forEach((stmt) => {
    max_id = Math.max(max_id, collect_max_id_stmt(stmt));
  });
  return max_id;
};

const collect_max_id_case_block = (block: ir_case_block): number => {
  let max_id = block.meta.id;
  block.cases.forEach((case_stmt) => {
    max_id = Math.max(max_id, case_stmt.meta.id);
    max_id = Math.max(max_id, collect_max_id_pattern(case_stmt.pattern));
    max_id = Math.max(max_id, collect_max_id_block(case_stmt.body));
  });
  return max_id;
};

const collect_max_id_pattern = (pattern_value: pattern): number => {
  if (pattern_value.kind === "Wildcard") {
    return pattern_value.data.id;
  }
  return pattern_value.data.meta.id;
};

const collect_max_id_expr = (expression: expr): number => {
  switch (expression.kind) {
    case "Identifier":
      return expression.data.meta.id;
    case "Literal":
      return expression.data.meta.id;
    case "Binary":
      return Math.max(
        expression.data.meta.id,
        collect_max_id_expr(expression.data.left),
        collect_max_id_expr(expression.data.right),
      );
    case "Unary":
      return Math.max(
        expression.data.meta.id,
        collect_max_id_expr(expression.data.expr),
      );
    case "BoolOp": {
      let max_id = expression.data.meta.id;
      expression.data.values.forEach((value) => {
        max_id = Math.max(max_id, collect_max_id_expr(value));
      });
      return max_id;
    }
    case "Compare": {
      let max_id = Math.max(
        expression.data.meta.id,
        collect_max_id_expr(expression.data.left),
      );
      expression.data.comparators.forEach((value) => {
        max_id = Math.max(max_id, collect_max_id_expr(value));
      });
      return max_id;
    }
    case "Lambda":
      return Math.max(
        expression.data.meta.id,
        collect_max_id_expr(expression.data.body),
      );
    case "IfExpr":
      return Math.max(
        expression.data.meta.id,
        collect_max_id_expr(expression.data.body),
        collect_max_id_expr(expression.data.condition),
        collect_max_id_expr(expression.data.else_body),
      );
    case "Call": {
      let max_id = expression.data.meta.id;
      max_id = Math.max(max_id, collect_max_id_expr(expression.data.callee));
      expression.data.args.forEach((arg) => {
        max_id = Math.max(max_id, collect_max_id_expr(arg));
      });
      return max_id;
    }
    case "Tuple": {
      let max_id = expression.data.meta.id;
      expression.data.elements.forEach((item) => {
        max_id = Math.max(max_id, collect_max_id_expr(item));
      });
      return max_id;
    }
    case "Attribute":
      return Math.max(
        expression.data.meta.id,
        collect_max_id_expr(expression.data.value),
      );
    case "Subscript":
      return Math.max(
        expression.data.meta.id,
        collect_max_id_expr(expression.data.value),
        collect_max_id_expr(expression.data.index),
      );
    case "Grouped":
      return Math.max(
        expression.data.meta.id,
        collect_max_id_expr(expression.data.expr),
      );
    case "List": {
      let max_id = expression.data.meta.id;
      expression.data.elements.forEach((item) => {
        max_id = Math.max(max_id, collect_max_id_expr(item));
      });
      return max_id;
    }
    case "Dict": {
      let max_id = expression.data.meta.id;
      expression.data.entries.forEach((entry) => {
        max_id = Math.max(
          max_id,
          collect_max_id_expr(entry.key),
          collect_max_id_expr(entry.value),
        );
      });
      return max_id;
    }
    case "Set": {
      let max_id = expression.data.meta.id;
      expression.data.elements.forEach((item) => {
        max_id = Math.max(max_id, collect_max_id_expr(item));
      });
      return max_id;
    }
    case "Comprehension": {
      const comp = expression.data;
      if (comp.kind === "dict") {
        const dict = comp.data;
        let max_id = dict.meta.id;
        max_id = Math.max(
          max_id,
          collect_max_id_expr(dict.key),
          collect_max_id_expr(dict.value),
        );
        dict.fors.forEach((entry) => {
          max_id = Math.max(
            max_id,
            collect_max_id_expr(entry.target),
            collect_max_id_expr(entry.iter),
          );
          entry.ifs.forEach((cond) => {
            max_id = Math.max(max_id, collect_max_id_expr(cond));
          });
        });
        return max_id;
      }
      const comp_data = comp.data;
      let max_id = Math.max(
        comp_data.meta.id,
        collect_max_id_expr(comp_data.element),
      );
      comp_data.fors.forEach((entry) => {
        max_id = Math.max(
          max_id,
          collect_max_id_expr(entry.target),
          collect_max_id_expr(entry.iter),
        );
        entry.ifs.forEach((cond) => {
          max_id = Math.max(max_id, collect_max_id_expr(cond));
        });
      });
      return max_id;
    }
  }
};

const register_blocks = () => {
  Blockly.Blocks[block_type_if] = {
    init() {
      this.appendValueInput("COND").setCheck(expr_output).appendField("if");
      this.appendStatementInput("BODY").appendField("do");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(210);
    },
  };

  Blockly.Blocks[block_type_elif] = {
    init() {
      this.appendValueInput("COND").setCheck(expr_output).appendField("elif");
      this.appendStatementInput("BODY").appendField("do");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(210);
    },
  };

  Blockly.Blocks[block_type_else] = {
    init() {
      this.appendDummyInput().appendField("else");
      this.appendStatementInput("BODY").appendField("do");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(210);
    },
  };

  Blockly.Blocks[block_type_while] = {
    init() {
      this.appendValueInput("COND").setCheck(expr_output).appendField("while");
      this.appendStatementInput("BODY").appendField("do");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(160);
    },
  };

  Blockly.Blocks[block_type_for] = {
    init() {
      this.appendValueInput("TARGET").setCheck(expr_output).appendField("for");
      this.appendValueInput("ITER").setCheck(expr_output).appendField("in");
      this.appendStatementInput("BODY").appendField("do");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(160);
    },
  };

  Blockly.Blocks[block_type_match] = {
    init() {
      this.appendValueInput("SUBJECT").setCheck(expr_output).appendField("match");
      this.appendStatementInput("CASES").appendField("case");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(60);
    },
  };

  Blockly.Blocks[block_type_case] = {
    init() {
      this.appendValueInput("PATTERN").setCheck(expr_output).appendField("case");
      this.appendStatementInput("BODY").appendField("do");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(60);
    },
  };

  Blockly.Blocks[block_type_assign] = {
    init() {
      this.appendValueInput("TARGET").setCheck(expr_output).appendField("set");
      this.appendValueInput("VALUE").setCheck(expr_output).appendField("=");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(20);
    },
  };

  Blockly.Blocks[block_type_expr] = {
    init() {
      this.appendValueInput("EXPR").setCheck(expr_output).appendField("expr");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(20);
    },
  };

  Blockly.Blocks[block_type_pass] = {
    init() {
      this.appendDummyInput().appendField("pass");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(20);
    },
  };

  Blockly.Blocks[block_type_identifier] = {
    init() {
      this.appendDummyInput()
        .appendField("id")
        .appendField(new Blockly.FieldTextInput("value"), "name");
      this.setOutput(true, expr_output);
      this.setColour(290);
    },
  };

  Blockly.Blocks[block_type_number] = {
    init() {
      this.appendDummyInput()
        .appendField("num")
        .appendField(new Blockly.FieldTextInput("0"), "value");
      this.setOutput(true, expr_output);
      this.setColour(290);
    },
  };

  Blockly.Blocks[block_type_string] = {
    init() {
      this.appendDummyInput()
        .appendField("str")
        .appendField(new Blockly.FieldTextInput("text"), "value");
      this.setOutput(true, expr_output);
      this.setColour(290);
    },
  };

  Blockly.Blocks[block_type_bool] = {
    init() {
      this.appendDummyInput()
        .appendField("bool")
        .appendField(
          new Blockly.FieldDropdown([
            ["True", "true"],
            ["False", "false"],
          ]),
          "value",
        );
      this.setOutput(true, expr_output);
      this.setColour(290);
    },
  };

  Blockly.Blocks[block_type_none] = {
    init() {
      this.appendDummyInput().appendField("None");
      this.setOutput(true, expr_output);
      this.setColour(290);
    },
  };

  Blockly.Blocks[block_type_binary] = {
    init() {
      this.appendValueInput("LEFT").setCheck(expr_output);
      this.appendDummyInput().appendField(
        new Blockly.FieldDropdown([
          ["+", "add"],
          ["-", "sub"],
          ["*", "mul"],
          ["/", "div"],
          ["%", "mod"],
        ]),
        "op",
      );
      this.appendValueInput("RIGHT").setCheck(expr_output);
      this.setOutput(true, expr_output);
      this.setColour(330);
    },
  };

  Blockly.Blocks[block_type_unary] = {
    init() {
      this.appendDummyInput().appendField(
        new Blockly.FieldDropdown([
          ["-", "neg"],
          ["not", "not"],
        ]),
        "op",
      );
      this.appendValueInput("VALUE").setCheck(expr_output);
      this.setOutput(true, expr_output);
      this.setColour(330);
    },
  };

  Blockly.Blocks[block_type_boolop] = {
    init() {
      const validator = (value: number | string) => {
        const count = Math.max(2, Math.floor(Number(value)));
        const bool_block = this as boolop_block;
        bool_block.itemCount_ = count;
        bool_block.updateShape_();
        return count;
      };
      this.appendDummyInput()
        .appendField("boolop")
        .appendField(
          new Blockly.FieldDropdown([
            ["and", "and"],
            ["or", "or"],
          ]),
          "op",
        )
        .appendField(new Blockly.FieldNumber(2, 2, 6, 1, validator), "COUNT");
      this.setOutput(true, expr_output);
      this.setColour(330);
      (this as boolop_block).itemCount_ = 2;
      (this as boolop_block).updateShape_();
    },
    updateShape_() {
      let index = 0;
      while (this.getInput(`VALUE${index}`)) {
        this.removeInput(`VALUE${index}`);
        index += 1;
      }
      for (let value_index = 0; value_index < (this as boolop_block).itemCount_; value_index += 1) {
        const input = this.appendValueInput(`VALUE${value_index}`).setCheck(expr_output);
        if (value_index === 0) {
          input.appendField("values");
        }
      }
    },
  };

  Blockly.Blocks[block_type_compare] = {
    init() {
      const validator = (value: number | string) => {
        const count = Math.max(1, Math.floor(Number(value)));
        const compare_block = this as compare_block;
        compare_block.itemCount_ = count;
        compare_block.updateShape_();
        return count;
      };
      this.appendValueInput("LEFT").setCheck(expr_output).appendField("compare");
      this.appendDummyInput().appendField(new Blockly.FieldNumber(1, 1, 6, 1, validator), "COUNT");
      this.setOutput(true, expr_output);
      this.setColour(330);
      (this as compare_block).itemCount_ = 1;
      (this as compare_block).updateShape_();
    },
    updateShape_() {
      let index = 0;
      while (this.getInput(`CMP${index}`)) {
        this.removeInput(`CMP${index}`);
        if (this.getInput(`OP${index}`)) {
          this.removeInput(`OP${index}`);
        }
        index += 1;
      }
      for (let op_index = 0; op_index < (this as compare_block).itemCount_; op_index += 1) {
        this.appendDummyInput(`OP${op_index}`).appendField(
          new Blockly.FieldDropdown([
            ["==", "eq"],
            ["!=", "not_eq"],
            ["<", "lt"],
            ["<=", "lt_eq"],
            [">", "gt"],
            [">=", "gt_eq"],
            ["in", "in"],
            ["not in", "not_in"],
            ["is", "is"],
            ["is not", "is_not"],
          ]),
          `OP${op_index}`,
        );
        this.appendValueInput(`CMP${op_index}`).setCheck(expr_output);
      }
    },
  };

  Blockly.Blocks[block_type_ifexpr] = {
    init() {
      this.appendValueInput("BODY").setCheck(expr_output).appendField("ifexpr");
      this.appendValueInput("COND").setCheck(expr_output).appendField("if");
      this.appendValueInput("ELSE").setCheck(expr_output).appendField("else");
      this.setOutput(true, expr_output);
      this.setColour(330);
    },
  };

  Blockly.Blocks[block_type_lambda] = {
    init() {
      this.appendDummyInput()
        .appendField("lambda")
        .appendField(new Blockly.FieldTextInput("x"), "params");
      this.appendValueInput("BODY").setCheck(expr_output).appendField(":");
      this.setOutput(true, expr_output);
      this.setColour(330);
    },
  };

  Blockly.Blocks[block_type_list] = {
    init() {
      const validator = (value: number | string) => {
        const count = Math.max(0, Math.floor(Number(value)));
        const list_block = this as list_block;
        list_block.itemCount_ = count;
        list_block.updateShape_();
        return count;
      };
      this.appendDummyInput()
        .appendField("list")
        .appendField(new Blockly.FieldNumber(0, 0, 8, 1, validator), "COUNT");
      this.setOutput(true, expr_output);
      this.setColour(290);
      (this as list_block).itemCount_ = 0;
      (this as list_block).updateShape_();
    },
    updateShape_() {
      let index = 0;
      while (this.getInput(`ITEM${index}`)) {
        this.removeInput(`ITEM${index}`);
        index += 1;
      }
      for (let item_index = 0; item_index < (this as list_block).itemCount_; item_index += 1) {
        const input = this.appendValueInput(`ITEM${item_index}`).setCheck(expr_output);
        if (item_index === 0) {
          input.appendField("items");
        }
      }
    },
  };

  Blockly.Blocks[block_type_dict] = {
    init() {
      const validator = (value: number | string) => {
        const count = Math.max(0, Math.floor(Number(value)));
        const dict_block = this as dict_block;
        dict_block.itemCount_ = count;
        dict_block.updateShape_();
        return count;
      };
      this.appendDummyInput()
        .appendField("dict")
        .appendField(new Blockly.FieldNumber(0, 0, 6, 1, validator), "COUNT");
      this.setOutput(true, expr_output);
      this.setColour(290);
      (this as dict_block).itemCount_ = 0;
      (this as dict_block).updateShape_();
    },
    updateShape_() {
      let index = 0;
      while (this.getInput(`KEY${index}`)) {
        this.removeInput(`KEY${index}`);
        this.removeInput(`VALUE${index}`);
        index += 1;
      }
      for (let entry_index = 0; entry_index < (this as dict_block).itemCount_; entry_index += 1) {
        const key_input = this.appendValueInput(`KEY${entry_index}`).setCheck(expr_output);
        key_input.appendField(entry_index === 0 ? "key" : "");
        const value_input = this.appendValueInput(`VALUE${entry_index}`).setCheck(expr_output);
        value_input.appendField("value");
      }
    },
  };

  Blockly.Blocks[block_type_set] = {
    init() {
      const validator = (value: number | string) => {
        const count = Math.max(0, Math.floor(Number(value)));
        const set_block = this as set_block;
        set_block.itemCount_ = count;
        set_block.updateShape_();
        return count;
      };
      this.appendDummyInput()
        .appendField("set")
        .appendField(new Blockly.FieldNumber(0, 0, 8, 1, validator), "COUNT");
      this.setOutput(true, expr_output);
      this.setColour(290);
      (this as set_block).itemCount_ = 0;
      (this as set_block).updateShape_();
    },
    updateShape_() {
      let index = 0;
      while (this.getInput(`ITEM${index}`)) {
        this.removeInput(`ITEM${index}`);
        index += 1;
      }
      for (let item_index = 0; item_index < (this as set_block).itemCount_; item_index += 1) {
        const input = this.appendValueInput(`ITEM${item_index}`).setCheck(expr_output);
        if (item_index === 0) {
          input.appendField("items");
        }
      }
    },
  };

  Blockly.Blocks[block_type_comprehension] = {
    init() {
      const validator = (value: number | string) => {
        const count = Math.max(1, Math.floor(Number(value)));
        const comp_block = this as comprehension_block;
        comp_block.forCount_ = count;
        comp_block.ifCounts_ = comp_block.ifCounts_.slice(0, count);
        while (comp_block.ifCounts_.length < count) {
          comp_block.ifCounts_.push(0);
        }
        comp_block.updateShape_();
        return count;
      };
      this.appendDummyInput()
        .appendField("comp")
        .appendField(
          new Blockly.FieldDropdown([
            ["list", "list"],
            ["dict", "dict"],
            ["generator", "generator"],
            ["set", "set"],
          ], (value) => {
            (this as comprehension_block).updateShape_();
            return value;
          }),
          "KIND",
        );
      this.appendValueInput("ELEMENT").setCheck(expr_output).appendField("element");
      this.appendDummyInput()
        .appendField("for")
        .appendField(new Blockly.FieldNumber(1, 1, 4, 1, validator), "FOR_COUNT");
      this.setOutput(true, expr_output);
      this.setColour(290);
      (this as comprehension_block).forCount_ = 1;
      (this as comprehension_block).ifCounts_ = [0];
      (this as comprehension_block).updateShape_();
    },
    updateShape_() {
      const comp_block = this as comprehension_block;
      let index = 0;
      while (this.getInput(`TARGET${index}`)) {
        this.removeInput(`TARGET${index}`);
        this.removeInput(`ITER${index}`);
        this.removeInput(`IFCOUNT${index}`);
        let if_index = 0;
        while (this.getInput(`IF${index}_${if_index}`)) {
          this.removeInput(`IF${index}_${if_index}`);
          if_index += 1;
        }
        index += 1;
      }
      if (this.getFieldValue("KIND") === "dict") {
        if (!this.getInput("KEY")) {
          this.appendValueInput("KEY").setCheck(expr_output).appendField("key");
        }
      } else if (this.getInput("KEY")) {
        this.removeInput("KEY");
      }
      for (let for_index = 0; for_index < comp_block.forCount_; for_index += 1) {
        const target_input = this.appendValueInput(`TARGET${for_index}`).setCheck(expr_output);
        target_input.appendField("for");
        this.appendValueInput(`ITER${for_index}`).setCheck(expr_output).appendField("in");
        const if_validator = (value: number | string) => {
          const count = Math.max(0, Math.floor(Number(value)));
          comp_block.ifCounts_[for_index] = count;
          comp_block.updateShape_();
          return count;
        };
        this.appendDummyInput(`IFCOUNT${for_index}`)
          .appendField("if")
          .appendField(
            new Blockly.FieldNumber(
              comp_block.ifCounts_[for_index] ?? 0,
              0,
              4,
              1,
              if_validator,
            ),
            `IF_COUNT${for_index}`,
          );
        for (let if_index = 0; if_index < comp_block.ifCounts_[for_index]; if_index += 1) {
          const input = this.appendValueInput(`IF${for_index}_${if_index}`).setCheck(expr_output);
          if (if_index === 0) {
            input.appendField("cond");
          }
        }
      }
    },
  };

  Blockly.Blocks[block_type_call] = {
    init() {
      this.appendValueInput("CALLEE").setCheck(expr_output).appendField("call");
      const validator = (value: number | string) => {
        const count = Math.max(0, Math.floor(Number(value)));
        const call_block = this as call_block;
        call_block.itemCount_ = count;
        call_block.updateShape_();
        return count;
      };
      this.appendDummyInput()
        .appendField("args")
        .appendField(new Blockly.FieldNumber(1, 0, 8, 1, validator), "ARG_COUNT");
      this.setOutput(true, expr_output);
      this.setColour(290);
      (this as call_block).itemCount_ = 1;
      (this as call_block).updateShape_();
    },
    updateShape_() {
      let index = 0;
      while (this.getInput(`ARG${index}`)) {
        this.removeInput(`ARG${index}`);
        index += 1;
      }
      for (
        let arg_index = 0;
        arg_index < (this as call_block).itemCount_;
        arg_index += 1
      ) {
        const input = this.appendValueInput(`ARG${arg_index}`).setCheck(
          expr_output,
        );
        if (arg_index === 0) {
          input.appendField("args");
        }
      }
    },
  };

  Blockly.Blocks[block_type_tuple] = {
    init() {
      const validator = (value: number | string) => {
        const count = Math.max(0, Math.floor(Number(value)));
        const tuple_block = this as tuple_block;
        tuple_block.itemCount_ = count;
        tuple_block.updateShape_();
        return count;
      };
      this.appendDummyInput()
        .appendField("tuple")
        .appendField(new Blockly.FieldNumber(2, 0, 8, 1, validator), "COUNT");
      this.setOutput(true, expr_output);
      this.setColour(290);
      (this as tuple_block).itemCount_ = 2;
      (this as tuple_block).updateShape_();
    },
    updateShape_() {
      let index = 0;
      while (this.getInput(`ITEM${index}`)) {
        this.removeInput(`ITEM${index}`);
        index += 1;
      }
      for (
        let item_index = 0;
        item_index < (this as tuple_block).itemCount_;
        item_index += 1
      ) {
        const input = this.appendValueInput(`ITEM${item_index}`).setCheck(
          expr_output,
        );
        if (item_index === 0) {
          input.appendField("items");
        }
      }
    },
  };

  Blockly.Blocks[block_type_attribute] = {
    init() {
      this.appendValueInput("VALUE").setCheck(expr_output).appendField("attr");
      this.appendDummyInput().appendField(
        new Blockly.FieldTextInput("name"),
        "attr",
      );
      this.setOutput(true, expr_output);
      this.setColour(290);
    },
  };

  Blockly.Blocks[block_type_subscript] = {
    init() {
      this.appendValueInput("VALUE").setCheck(expr_output).appendField("index");
      this.appendValueInput("INDEX").setCheck(expr_output);
      this.setOutput(true, expr_output);
      this.setColour(290);
    },
  };

  Blockly.Blocks[block_type_grouped] = {
    init() {
      this.appendValueInput("VALUE").setCheck(expr_output).appendField("group");
      this.setOutput(true, expr_output);
      this.setColour(290);
    },
  };
};

const ensure_workspace = () => {
  if (workspace) {
    return;
  }
  workspace = Blockly.inject(workspace_container_id, {
    toolbox,
    grid: {
      spacing: 20,
      length: 3,
      colour: "#c7cdd8",
      snap: true,
    },
    zoom: {
      controls: true,
      wheel: true,
      startScale: 1,
      maxScale: 3,
      minScale: 0.3,
      scaleSpeed: 1.2,
    },
    theme: current_theme === "dark" ? blockly_theme_dark : blockly_theme_light,
  });
};

const init_block = (block: Blockly.Block) => {
  if (block instanceof Blockly.BlockSvg) {
    block.initSvg();
    block.render();
  }
};

const attach_statement_body = (
  parent_block: Blockly.Block,
  input_name: string,
  body: ir_stmt[],
) => {
  if (!workspace) {
    return;
  }
  const first_block = build_statement_chain(body);
  if (first_block && parent_block.getInput(input_name)?.connection) {
    const first_svg = first_block as Blockly.BlockSvg;
    if (first_svg.previousConnection) {
      parent_block
        .getInput(input_name)
        ?.connection?.connect(first_svg.previousConnection);
    }
  }
};

const build_statement_chain = (body: ir_stmt[]) => {
  if (!workspace || body.length === 0) {
    return null;
  }
  let first_block: Blockly.Block | null = null;
  let previous_block: Blockly.Block | null = null;
  body.forEach((statement) => {
    const chain = create_statement_blocks(statement);
    if (!chain) {
      return;
    }
    if (!first_block) {
      first_block = chain.first;
    }
    if (previous_block?.nextConnection && chain.first.previousConnection) {
      previous_block.nextConnection.connect(chain.first.previousConnection);
    }
    previous_block = chain.last;
  });
  return first_block;
};

const create_statement_blocks = (statement: ir_stmt) => {
  if (!workspace) {
    return null;
  }
  if (statement.kind === "Empty") {
    return null;
  }
  if (statement.kind === "If") {
    const block = workspace.newBlock(block_type_if);
    attach_expr_input(block, "COND", statement.data.condition);
    attach_statement_body(block, "BODY", statement.data.body.statements);
    let last_block = block;
    statement.data.elifs.forEach((elif_stmt) => {
      const elif_block = workspace?.newBlock(block_type_elif);
      if (!elif_block) {
        return;
      }
      attach_expr_input(elif_block, "COND", elif_stmt.condition);
      attach_statement_body(elif_block, "BODY", elif_stmt.body.statements);
      init_block(elif_block);
      if (last_block.nextConnection && elif_block.previousConnection) {
        last_block.nextConnection.connect(elif_block.previousConnection);
      }
      last_block = elif_block;
    });
    if (statement.data.else_body) {
      const else_block = workspace.newBlock(block_type_else);
      attach_statement_body(else_block, "BODY", statement.data.else_body.statements);
      init_block(else_block);
      if (last_block.nextConnection && else_block.previousConnection) {
        last_block.nextConnection.connect(else_block.previousConnection);
      }
      last_block = else_block;
    }
    init_block(block);
    return { first: block, last: last_block };
  }
  if (statement.kind === "While") {
    const block = workspace.newBlock(block_type_while);
    attach_expr_input(block, "COND", statement.data.condition);
    attach_statement_body(block, "BODY", statement.data.body.statements);
    init_block(block);
    return { first: block, last: block };
  }
  if (statement.kind === "For") {
    const block = workspace.newBlock(block_type_for);
    attach_expr_input(block, "TARGET", statement.data.target);
    attach_expr_input(block, "ITER", statement.data.iterable);
    attach_statement_body(block, "BODY", statement.data.body.statements);
    init_block(block);
    return { first: block, last: block };
  }
  if (statement.kind === "Match") {
    const block = workspace.newBlock(block_type_match);
    attach_expr_input(block, "SUBJECT", statement.data.subject);
    attach_case_body(block, "CASES", statement.data.cases.cases);
    init_block(block);
    return { first: block, last: block };
  }
  if (statement.kind === "Assign") {
    const block = workspace.newBlock(block_type_assign);
    attach_expr_input(block, "TARGET", statement.data.target);
    attach_expr_input(block, "VALUE", statement.data.value);
    init_block(block);
    return { first: block, last: block };
  }
  if (statement.kind === "Expr") {
    const block = workspace.newBlock(block_type_expr);
    attach_expr_input(block, "EXPR", statement.data.expr);
    init_block(block);
    return { first: block, last: block };
  }
  if (statement.kind === "Pass") {
    const block = workspace.newBlock(block_type_pass);
    init_block(block);
    return { first: block, last: block };
  }
  return null;
};

const attach_case_body = (
  parent_block: Blockly.Block,
  input_name: string,
  cases: ir_match_case[],
) => {
  if (!workspace) {
    return;
  }
  let first_block: Blockly.Block | null = null;
  let previous_block: Blockly.Block | null = null;
  cases.forEach((case_entry) => {
    const case_block = workspace?.newBlock(block_type_case);
    if (!case_block) {
      return;
    }
    attach_pattern_input(case_block, "PATTERN", case_entry.pattern);
    attach_statement_body(case_block, "BODY", case_entry.body.statements);
    init_block(case_block);
    if (!first_block) {
      first_block = case_block;
    }
    if (previous_block?.nextConnection && case_block.previousConnection) {
      previous_block.nextConnection.connect(case_block.previousConnection);
    }
    previous_block = case_block;
  });
  if (first_block) {
    const connection = parent_block.getInput(input_name)?.connection;
    const first_svg = first_block as Blockly.BlockSvg;
    if (connection && first_svg.previousConnection) {
      connection.connect(first_svg.previousConnection);
    }
  }
};

const attach_expr_input = (
  parent_block: Blockly.Block,
  input_name: string,
  expression: expr,
) => {
  if (!workspace) {
    return;
  }
  const expr_block = create_expr_block(expression);
  if (!expr_block) {
    return;
  }
  const connection = parent_block.getInput(input_name)?.connection;
  if (connection && expr_block.outputConnection) {
    connection.connect(expr_block.outputConnection);
  }
};

const attach_pattern_input = (
  parent_block: Blockly.Block,
  input_name: string,
  pattern_value: pattern,
) => {
  if (!workspace) {
    return;
  }
  const expr_value = pattern_to_expr(pattern_value);
  attach_expr_input(parent_block, input_name, expr_value);
};

const create_expr_block = (expression: expr): Blockly.Block | null => {
  if (!workspace) {
    return null;
  }
  switch (expression.kind) {
    case "Identifier": {
      const block = workspace.newBlock(block_type_identifier);
      block.setFieldValue(expression.data.name, "name");
      init_block(block);
      return block;
    }
    case "Literal": {
      return create_literal_block(expression.data.literal);
    }
    case "Binary": {
      const block = workspace.newBlock(block_type_binary);
      block.setFieldValue(expression.data.op, "op");
      attach_expr_input(block, "LEFT", expression.data.left);
      attach_expr_input(block, "RIGHT", expression.data.right);
      init_block(block);
      return block;
    }
    case "Unary": {
      const block = workspace.newBlock(block_type_unary);
      block.setFieldValue(expression.data.op, "op");
      attach_expr_input(block, "VALUE", expression.data.expr);
      init_block(block);
      return block;
    }
    case "BoolOp": {
      const block = workspace.newBlock(block_type_boolop) as unknown as boolop_block;
      const count = Math.max(2, expression.data.values.length);
      block.itemCount_ = count;
      block.updateShape_();
      block.setFieldValue(expression.data.op, "op");
      block.setFieldValue(String(count), "COUNT");
      expression.data.values.forEach((value, index) => {
        attach_expr_input(block, `VALUE${index}`, value);
      });
      init_block(block);
      return block;
    }
    case "Compare": {
      const block = workspace.newBlock(block_type_compare) as unknown as compare_block;
      const count = Math.max(1, expression.data.comparators.length);
      block.itemCount_ = count;
      block.updateShape_();
      block.setFieldValue(String(count), "COUNT");
      attach_expr_input(block, "LEFT", expression.data.left);
      expression.data.ops.forEach((op, index) => {
        block.setFieldValue(op, `OP${index}`);
      });
      expression.data.comparators.forEach((item, index) => {
        attach_expr_input(block, `CMP${index}`, item);
      });
      init_block(block);
      return block;
    }
    case "IfExpr": {
      const block = workspace.newBlock(block_type_ifexpr);
      attach_expr_input(block, "BODY", expression.data.body);
      attach_expr_input(block, "COND", expression.data.condition);
      attach_expr_input(block, "ELSE", expression.data.else_body);
      init_block(block);
      return block;
    }
    case "Lambda": {
      const block = workspace.newBlock(block_type_lambda);
      block.setFieldValue(expression.data.params.join(", "), "params");
      attach_expr_input(block, "BODY", expression.data.body);
      init_block(block);
      return block;
    }
    case "Call": {
      const block = workspace.newBlock(block_type_call) as unknown as call_block;
      const args_count = expression.data.args.length;
      block.itemCount_ = args_count;
      block.updateShape_();
      block.setFieldValue(String(args_count), "ARG_COUNT");
      attach_expr_input(block, "CALLEE", expression.data.callee);
      expression.data.args.forEach((arg, index) => {
        attach_expr_input(block, `ARG${index}`, arg);
      });
      init_block(block);
      return block;
    }
    case "Tuple": {
      const block = workspace.newBlock(block_type_tuple) as unknown as tuple_block;
      const count = expression.data.elements.length;
      block.itemCount_ = count;
      block.updateShape_();
      block.setFieldValue(String(count), "COUNT");
      expression.data.elements.forEach((item, index) => {
        attach_expr_input(block, `ITEM${index}`, item);
      });
      init_block(block);
      return block;
    }
    case "Attribute": {
      const block = workspace.newBlock(block_type_attribute);
      attach_expr_input(block, "VALUE", expression.data.value);
      block.setFieldValue(expression.data.attr, "attr");
      init_block(block);
      return block;
    }
    case "Subscript": {
      const block = workspace.newBlock(block_type_subscript);
      attach_expr_input(block, "VALUE", expression.data.value);
      attach_expr_input(block, "INDEX", expression.data.index);
      init_block(block);
      return block;
    }
    case "Grouped": {
      const block = workspace.newBlock(block_type_grouped);
      attach_expr_input(block, "VALUE", expression.data.expr);
      init_block(block);
      return block;
    }
    case "List": {
      const block = workspace.newBlock(block_type_list) as unknown as list_block;
      const count = expression.data.elements.length;
      block.itemCount_ = count;
      block.updateShape_();
      block.setFieldValue(String(count), "COUNT");
      expression.data.elements.forEach((item, index) => {
        attach_expr_input(block, `ITEM${index}`, item);
      });
      init_block(block);
      return block;
    }
    case "Dict": {
      const block = workspace.newBlock(block_type_dict) as unknown as dict_block;
      const count = expression.data.entries.length;
      block.itemCount_ = count;
      block.updateShape_();
      block.setFieldValue(String(count), "COUNT");
      expression.data.entries.forEach((entry, index) => {
        attach_expr_input(block, `KEY${index}`, entry.key);
        attach_expr_input(block, `VALUE${index}`, entry.value);
      });
      init_block(block);
      return block;
    }
    case "Set": {
      const block = workspace.newBlock(block_type_set) as unknown as set_block;
      const count = expression.data.elements.length;
      block.itemCount_ = count;
      block.updateShape_();
      block.setFieldValue(String(count), "COUNT");
      expression.data.elements.forEach((item, index) => {
        attach_expr_input(block, `ITEM${index}`, item);
      });
      init_block(block);
      return block;
    }
    case "Comprehension": {
      const block = workspace.newBlock(block_type_comprehension) as unknown as comprehension_block;
      const comp = expression.data;
      block.setFieldValue(comp.kind, "KIND");
      block.forCount_ = Math.max(1, comp.data.fors.length);
      block.ifCounts_ = comp.data.fors.map((entry) => entry.ifs.length);
      while (block.ifCounts_.length < block.forCount_) {
        block.ifCounts_.push(0);
      }
      block.updateShape_();
      block.setFieldValue(String(block.forCount_), "FOR_COUNT");
      if (comp.kind === "dict") {
        const dict = comp.data;
        attach_expr_input(block, "ELEMENT", dict.value);
        attach_expr_input(block, "KEY", dict.key);
      } else {
        const list = comp.data;
        attach_expr_input(block, "ELEMENT", list.element);
      }
      comp.data.fors.forEach((entry, index) => {
        attach_expr_input(block, `TARGET${index}`, entry.target);
        attach_expr_input(block, `ITER${index}`, entry.iter);
        block.setFieldValue(String(entry.ifs.length), `IF_COUNT${index}`);
        entry.ifs.forEach((condition, if_index) => {
          attach_expr_input(block, `IF${index}_${if_index}`, condition);
        });
      });
      init_block(block);
      return block;
    }
    default:
      return null;
  }
};

const create_literal_block = (literal_value: literal): Blockly.Block | null => {
  if (!workspace) {
    return null;
  }
  if (literal_value.kind === "Number") {
    const block = workspace.newBlock(block_type_number);
    block.setFieldValue(literal_value.data.raw, "value");
    init_block(block);
    return block;
  }
  if (literal_value.kind === "String") {
    const block = workspace.newBlock(block_type_string);
    block.setFieldValue(literal_value.data.value, "value");
    init_block(block);
    return block;
  }
  if (literal_value.kind === "Bool") {
    const block = workspace.newBlock(block_type_bool);
    block.setFieldValue(literal_value.data ? "true" : "false", "value");
    init_block(block);
    return block;
  }
  if (literal_value.kind === "None") {
    const block = workspace.newBlock(block_type_none);
    init_block(block);
    return block;
  }
  return null;
};

const pattern_to_expr = (pattern_value: pattern): expr => {
  if (pattern_value.kind === "Wildcard") {
    return {
      kind: "Identifier",
      data: { meta: make_meta(), name: "_" },
    };
  }
  if (pattern_value.kind === "Identifier") {
    return {
      kind: "Identifier",
      data: { meta: make_meta(), name: pattern_value.data.name },
    };
  }
  return {
    kind: "Literal",
    data: { meta: make_meta(), literal: pattern_value.data.literal },
  };
};

const ir_from_blocks = (): ir_program => {
  if (!workspace) {
    return {
      meta: make_meta(),
      indent_width: 4,
      body: [],
      token_store: null,
      dirty: true,
    };
  }
  const top_blocks = workspace.getTopBlocks(true);
  const sorted = top_blocks.sort(
    (left, right) =>
      left.getRelativeToSurfaceXY().y - right.getRelativeToSurfaceXY().y,
  );
  const statements: ir_stmt[] = [];
  sorted.forEach((block) => {
    statements.push(...statements_from_chain(block));
  });
  return {
    meta: make_meta(),
    indent_width: 4,
    body: statements,
    token_store: null,
    dirty: true,
  };
};

const statements_from_chain = (start_block: Blockly.Block | null): ir_stmt[] => {
  const statements: ir_stmt[] = [];
  let current_block = start_block;
  while (current_block) {
    if (current_block.type === block_type_if) {
      const result = consume_if_chain(current_block);
      statements.push(result.statement);
      current_block = result.next;
      continue;
    }
    if (
      current_block.type === block_type_elif ||
      current_block.type === block_type_else
    ) {
      throw new Error("elif/elseはifの直後に配置");
    }
    if (current_block.type === block_type_case) {
      throw new Error("caseはmatchの中に配置");
    }
    statements.push(statement_from_block(current_block));
    current_block = current_block.getNextBlock();
  }
  return statements;
};

const consume_if_chain = (block: Blockly.Block) => {
  const condition = expr_from_input(block, "COND");
  const body = block_from_statements(block.getInputTargetBlock("BODY"));
  const elifs: ir_elif_stmt[] = [];
  let else_body: ir_block | null = null;
  let next_block = block.getNextBlock();
  while (next_block) {
    if (next_block.type === block_type_elif) {
      const elif_condition = expr_from_input(next_block, "COND");
      const elif_body = block_from_statements(next_block.getInputTargetBlock("BODY"));
      elifs.push({
        meta: make_meta(),
        condition: elif_condition,
        body: elif_body,
      });
      next_block = next_block.getNextBlock();
      continue;
    }
    if (next_block.type === block_type_else) {
      else_body = block_from_statements(next_block.getInputTargetBlock("BODY"));
      next_block = next_block.getNextBlock();
      break;
    }
    break;
  }
  const statement: ir_stmt = {
    kind: "If",
    data: {
      meta: make_meta(),
      condition,
      body,
      elifs,
      else_body,
    },
  };
  return { statement, next: next_block };
};

const block_from_statements = (start_block: Blockly.Block | null): ir_block => ({
  meta: make_meta(),
  indent_level: 1,
  statements: statements_from_chain(start_block),
});

const statement_from_block = (block: Blockly.Block): ir_stmt => {
  switch (block.type) {
    case block_type_while:
      return {
        kind: "While",
        data: {
          meta: make_meta(),
          condition: expr_from_input(block, "COND"),
          body: block_from_statements(block.getInputTargetBlock("BODY")),
        },
      };
    case block_type_for:
      return {
        kind: "For",
        data: {
          meta: make_meta(),
          target: expr_from_input(block, "TARGET"),
          iterable: expr_from_input(block, "ITER"),
          body: block_from_statements(block.getInputTargetBlock("BODY")),
        },
      };
    case block_type_match:
      return {
        kind: "Match",
        data: {
          meta: make_meta(),
          subject: expr_from_input(block, "SUBJECT"),
          cases: cases_from_chain(block.getInputTargetBlock("CASES")),
        },
      };
    case block_type_assign:
      return {
        kind: "Assign",
        data: {
          meta: make_meta(),
          target: expr_from_input(block, "TARGET"),
          value: expr_from_input(block, "VALUE"),
        },
      };
    case block_type_expr:
      return {
        kind: "Expr",
        data: {
          meta: make_meta(),
          expr: expr_from_input(block, "EXPR"),
        },
      };
    case block_type_pass:
      return {
        kind: "Pass",
        data: { meta: make_meta() },
      };
    default:
      throw new Error("未対応のステートメント");
  }
};

const cases_from_chain = (start_block: Blockly.Block | null): ir_case_block => {
  const cases: ir_match_case[] = [];
  let current = start_block;
  while (current) {
    if (current.type !== block_type_case) {
      throw new Error("matchにはcaseブロックのみ配置");
    }
    const pattern_expr = expr_from_input(current, "PATTERN");
    cases.push({
      meta: make_meta(),
      pattern: pattern_from_expr(pattern_expr),
      body: block_from_statements(current.getInputTargetBlock("BODY")),
    });
    current = current.getNextBlock();
  }
  if (cases.length === 0) {
    throw new Error("matchにcaseが必要");
  }
  return {
    meta: make_meta(),
    indent_level: 1,
    cases,
  };
};

const expr_from_input = (block: Blockly.Block, input_name: string): expr => {
  const target = block.getInputTargetBlock(input_name);
  if (!target) {
    throw new Error("式が不足");
  }
  return expr_from_block(target);
};

const expr_from_block = (block: Blockly.Block): expr => {
  switch (block.type) {
    case block_type_identifier:
      return {
        kind: "Identifier",
        data: { meta: make_meta(), name: block.getFieldValue("name") ?? "" },
      };
    case block_type_number:
      return {
        kind: "Literal",
        data: {
          meta: make_meta(),
          literal: { kind: "Number", data: { raw: block.getFieldValue("value") ?? "0" } },
        },
      };
    case block_type_string:
      return {
        kind: "Literal",
        data: {
          meta: make_meta(),
          literal: {
            kind: "String",
            data: {
              raw: `'${block.getFieldValue("value") ?? ""}'`,
              value: block.getFieldValue("value") ?? "",
              quote: "single",
              escaped: false,
            },
          },
        },
      };
    case block_type_bool:
      return {
        kind: "Literal",
        data: {
          meta: make_meta(),
          literal: { kind: "Bool", data: block.getFieldValue("value") === "true" },
        },
      };
    case block_type_none:
      return {
        kind: "Literal",
        data: { meta: make_meta(), literal: { kind: "None" } },
      };
    case block_type_binary:
      return {
        kind: "Binary",
        data: {
          meta: make_meta(),
          left: expr_from_input(block, "LEFT"),
          op: block.getFieldValue("op") as binary_op,
          right: expr_from_input(block, "RIGHT"),
        },
      };
    case block_type_unary:
      return {
        kind: "Unary",
        data: {
          meta: make_meta(),
          op: block.getFieldValue("op") as unary_op,
          expr: expr_from_input(block, "VALUE"),
        },
      };
    case block_type_boolop: {
      const bool_block = block as unknown as boolop_block;
      const values: expr[] = [];
      for (let index = 0; index < bool_block.itemCount_; index += 1) {
        const input = bool_block.getInput(`VALUE${index}`);
        if (!input?.connection?.targetBlock()) {
          throw new Error("boolop値が不足");
        }
        values.push(expr_from_block(input.connection.targetBlock() as Blockly.Block));
      }
      return {
        kind: "BoolOp",
        data: {
          meta: make_meta(),
          op: block.getFieldValue("op") as bool_op,
          values,
        },
      };
    }
    case block_type_compare: {
      const compare = block as unknown as compare_block;
      const ops: compare_op[] = [];
      const comparators: expr[] = [];
      for (let index = 0; index < compare.itemCount_; index += 1) {
        const op_value = block.getFieldValue(`OP${index}`) as compare_op;
        ops.push(op_value);
        const input = compare.getInput(`CMP${index}`);
        if (!input?.connection?.targetBlock()) {
          throw new Error("compare値が不足");
        }
        comparators.push(expr_from_block(input.connection.targetBlock() as Blockly.Block));
      }
      return {
        kind: "Compare",
        data: {
          meta: make_meta(),
          left: expr_from_input(block, "LEFT"),
          ops,
          comparators,
        },
      };
    }
    case block_type_ifexpr:
      return {
        kind: "IfExpr",
        data: {
          meta: make_meta(),
          body: expr_from_input(block, "BODY"),
          condition: expr_from_input(block, "COND"),
          else_body: expr_from_input(block, "ELSE"),
        },
      };
    case block_type_lambda: {
      const raw = block.getFieldValue("params") ?? "";
      const params = raw
        .split(",")
        .map((value: string) => value.trim())
        .filter((value: string) => value.length > 0);
      return {
        kind: "Lambda",
        data: {
          meta: make_meta(),
          params,
          body: expr_from_input(block, "BODY"),
        },
      };
    }
    case block_type_call: {
      const call_block = block as unknown as call_block;
      const args: expr[] = [];
      for (let index = 0; index < call_block.itemCount_; index += 1) {
        const input = call_block.getInput(`ARG${index}`);
        if (!input?.connection?.targetBlock()) {
          throw new Error("call引数が不足");
        }
        args.push(expr_from_block(input.connection.targetBlock() as Blockly.Block));
      }
      return {
        kind: "Call",
        data: {
          meta: make_meta(),
          callee: expr_from_input(block, "CALLEE"),
          args,
        },
      };
    }
    case block_type_tuple: {
      const tuple = block as unknown as tuple_block;
      const elements: expr[] = [];
      for (let index = 0; index < tuple.itemCount_; index += 1) {
        const input = tuple.getInput(`ITEM${index}`);
        if (!input?.connection?.targetBlock()) {
          throw new Error("tuple要素が不足");
        }
        elements.push(expr_from_block(input.connection.targetBlock() as Blockly.Block));
      }
      return {
        kind: "Tuple",
        data: {
          meta: make_meta(),
          elements,
        },
      };
    }
    case block_type_attribute:
      return {
        kind: "Attribute",
        data: {
          meta: make_meta(),
          value: expr_from_input(block, "VALUE"),
          attr: block.getFieldValue("attr") ?? "",
        },
      };
    case block_type_subscript:
      return {
        kind: "Subscript",
        data: {
          meta: make_meta(),
          value: expr_from_input(block, "VALUE"),
          index: expr_from_input(block, "INDEX"),
        },
      };
    case block_type_grouped:
      return {
        kind: "Grouped",
        data: {
          meta: make_meta(),
          expr: expr_from_input(block, "VALUE"),
        },
      };
    case block_type_list: {
      const list = block as unknown as list_block;
      const elements: expr[] = [];
      for (let index = 0; index < list.itemCount_; index += 1) {
        const input = list.getInput(`ITEM${index}`);
        if (!input?.connection?.targetBlock()) {
          throw new Error("list要素が不足");
        }
        elements.push(expr_from_block(input.connection.targetBlock() as Blockly.Block));
      }
      return {
        kind: "List",
        data: {
          meta: make_meta(),
          elements,
        },
      };
    }
    case block_type_dict: {
      const dict = block as unknown as dict_block;
      const entries: dict_entry[] = [];
      for (let index = 0; index < dict.itemCount_; index += 1) {
        const key_input = dict.getInput(`KEY${index}`);
        const value_input = dict.getInput(`VALUE${index}`);
        if (!key_input?.connection?.targetBlock() || !value_input?.connection?.targetBlock()) {
          throw new Error("dict要素が不足");
        }
        entries.push({
          meta: make_meta(),
          key: expr_from_block(key_input.connection.targetBlock() as Blockly.Block),
          value: expr_from_block(value_input.connection.targetBlock() as Blockly.Block),
        });
      }
      return {
        kind: "Dict",
        data: {
          meta: make_meta(),
          entries,
        },
      };
    }
    case block_type_set: {
      const set_block_value = block as unknown as set_block;
      const elements: expr[] = [];
      for (let index = 0; index < set_block_value.itemCount_; index += 1) {
        const input = set_block_value.getInput(`ITEM${index}`);
        if (!input?.connection?.targetBlock()) {
          throw new Error("set要素が不足");
        }
        elements.push(expr_from_block(input.connection.targetBlock() as Blockly.Block));
      }
      return {
        kind: "Set",
        data: {
          meta: make_meta(),
          elements,
        },
      };
    }
    case block_type_comprehension: {
      const comp = block as unknown as comprehension_block;
      const kind = block.getFieldValue("KIND") as comprehension_kind;
      const for_count = comp.forCount_;
      const element = expr_from_input(block, "ELEMENT");
      const key_input = block.getInput("KEY")?.connection?.targetBlock();
      const key =
        key_input != null ? expr_from_block(key_input as Blockly.Block) : null;
      if (kind === "dict" && !key) {
        throw new Error("dict comprehensionのkeyが不足");
      }
      const fors: comprehension_for[] = [];
      for (let index = 0; index < for_count; index += 1) {
        const target = expr_from_input(block, `TARGET${index}`);
        const iter = expr_from_input(block, `ITER${index}`);
        const if_count = comp.ifCounts_[index] ?? 0;
        const ifs: expr[] = [];
        for (let if_index = 0; if_index < if_count; if_index += 1) {
          const input = comp.getInput(`IF${index}_${if_index}`);
          if (!input?.connection?.targetBlock()) {
            throw new Error("comprehension ifが不足");
          }
          ifs.push(expr_from_block(input.connection.targetBlock() as Blockly.Block));
        }
        fors.push({
          meta: make_meta(),
          target,
          iter,
          ifs,
        });
      }
      if (kind === "dict") {
        return {
          kind: "Comprehension",
          data: {
            kind: "dict",
            data: {
              meta: make_meta(),
              key: key as expr,
              value: element,
              fors,
            },
          },
        };
      }
      return {
        kind: "Comprehension",
        data: {
          kind,
          data: {
            meta: make_meta(),
            element,
            fors,
          },
        },
      };
    }
    default:
      throw new Error("未対応の式");
  }
};

const pattern_from_expr = (expression: expr): pattern => {
  if (expression.kind === "Identifier") {
    if (expression.data.name === "_") {
      return { kind: "Wildcard", data: make_meta() };
    }
    return {
      kind: "Identifier",
      data: { meta: make_meta(), name: expression.data.name },
    };
  }
  if (expression.kind === "Literal") {
    return {
      kind: "Literal",
      data: { meta: make_meta(), literal: expression.data.literal },
    };
  }
  throw new Error("patternは識別子かリテラルのみ");
};

const blocks_from_ir = (ir: ir_program) => {
  if (!workspace) {
    return;
  }
  Blockly.Events.disable();
  workspace.clear();
  const chain = build_statement_chain(ir.body);
  if (chain) {
    (chain as Blockly.BlockSvg).moveBy(24, 24);
  }
  workspace.cleanUp();
  Blockly.Events.enable();
  workspace.render();
};

const sync_code_to_blocks = async (source: string) => {
  if (is_syncing) {
    return;
  }
  is_syncing = true;
  try {
    const ir = await parse_python_to_ir(source);
    update_node_counter(ir);
    blocks_from_ir(ir);
  } catch (error) {
    set_output(`同期エラー: ${String(error)}`);
  } finally {
    is_syncing = false;
  }
};

const sync_blocks_to_code = async () => {
  if (is_syncing || !code_editor) {
    return;
  }
  is_syncing = true;
  try {
    const ir = ir_from_blocks();
    const source = await generate_python_from_ir(ir);
    if (code_editor.value !== source) {
      code_editor.value = source;
      localStorage.setItem(local_storage_source_key, source);
    }
  } catch (error) {
    set_output(`同期エラー: ${String(error)}`);
  } finally {
    is_syncing = false;
  }
};

const schedule_code_sync = (source: string) => {
  if (code_sync_timer) {
    window.clearTimeout(code_sync_timer);
  }
  code_sync_timer = window.setTimeout(() => {
    sync_code_to_blocks(source);
  }, code_sync_delay_ms);
};

const load_source_from_storage = () =>
  localStorage.getItem(local_storage_source_key) ?? default_source_code;

const run_python_code = async () => {
  if (!code_editor) {
    return;
  }
  set_output("実行中...");
  try {
    const result = await run_python(code_editor.value);
    const combined = [result.stdout, result.stderr].filter(Boolean).join("\n");
    const text = combined.length > 0 ? combined : "出力なし";
    set_output(text);
  } catch (error) {
    set_output(`実行エラー: ${String(error)}`);
  }
};

window.addEventListener("DOMContentLoaded", () => {
  code_editor = document.querySelector<HTMLTextAreaElement>("#code_editor");
  output_console =
    document.querySelector<HTMLPreElement>("#output_console");
  theme_toggle_button =
    document.querySelector<HTMLButtonElement>("#theme_toggle");
  save_button = document.querySelector<HTMLButtonElement>("#save_button");
  load_button = document.querySelector<HTMLButtonElement>("#load_button");
  run_button = document.querySelector<HTMLButtonElement>("#run_button");

  const stored_theme =
    (localStorage.getItem(local_storage_theme_key) as theme_mode | null) ?? null;
  const prefers_dark =
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;

  apply_theme(stored_theme ?? (prefers_dark ? "dark" : "light"));

  register_blocks();
  ensure_workspace();

  const initial_source = load_source_from_storage();
  if (code_editor) {
    code_editor.value = initial_source;
    code_editor.addEventListener("input", () => {
      const source_value = code_editor?.value ?? "";
      localStorage.setItem(local_storage_source_key, source_value);
      schedule_code_sync(source_value);
    });
  }

  if (workspace) {
    workspace.addChangeListener((event) => {
      if (is_syncing || event.type === Blockly.Events.UI) {
        return;
      }
      sync_blocks_to_code();
    });
  }

  save_button?.addEventListener("click", () => {
    if (!code_editor) {
      return;
    }
    localStorage.setItem(local_storage_source_key, code_editor.value);
    set_output("保存しました");
  });

  load_button?.addEventListener("click", () => {
    if (!code_editor) {
      return;
    }
    const stored_source = load_source_from_storage();
    code_editor.value = stored_source;
    schedule_code_sync(stored_source);
  });

  run_button?.addEventListener("click", () => {
    run_python_code();
  });

  theme_toggle_button?.addEventListener("click", () => {
    apply_theme(current_theme === "dark" ? "light" : "dark");
  });

  sync_code_to_blocks(initial_source);

  window.addEventListener("resize", () => {
    if (workspace) {
      Blockly.svgResize(workspace);
    }
  });
});
