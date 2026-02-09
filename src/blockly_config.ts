import * as Blockly from "blockly";
import { t } from "./i18n";
import type {
  boolop_block,
  call_block,
  class_def_block,
  compare_block,
  comprehension_block,
  dict_block,
  function_def_block,
  import_block,
  list_block,
  range_block,
  set_block,
  try_block,
  tuple_block,
  with_block,
  zip_block,
} from "./types";

/** Return easy-mode label if active, otherwise the original keyword. */
const b = (key: string, fallback: string): string => t(key) !== key ? t(key) : fallback;

export const block_type_if = "stmt_if";
export const block_type_elif = "stmt_elif";
export const block_type_else = "stmt_else";
export const block_type_while = "stmt_while";
export const block_type_for = "stmt_for";
export const block_type_match = "stmt_match";
export const block_type_case = "stmt_case";
export const block_type_event_start = "event_start";
export const block_type_wait = "stmt_wait";
export const block_type_print = "stmt_print";
export const block_type_var_set = "stmt_var_set";
export const block_type_function_def = "stmt_function_def";
export const block_type_assign = "stmt_assign";
export const block_type_expr = "stmt_expr";
export const block_type_pass = "stmt_pass";
export const block_type_sync_error = "stmt_sync_error";
export const block_type_identifier = "expr_identifier";
export const block_type_number = "expr_number";
export const block_type_string = "expr_string";
export const block_type_bool = "expr_bool";
export const block_type_none = "expr_none";
export const block_type_binary = "expr_binary";
export const block_type_unary = "expr_unary";
export const block_type_boolop = "expr_boolop";
export const block_type_compare = "expr_compare";
export const block_type_ifexpr = "expr_ifexpr";
export const block_type_lambda = "expr_lambda";
export const block_type_random = "expr_random";
export const block_type_round = "expr_round";
export const block_type_call = "expr_call";
export const block_type_tuple = "expr_tuple";
export const block_type_attribute = "expr_attribute";
export const block_type_subscript = "expr_subscript";
export const block_type_grouped = "expr_grouped";
export const block_type_list = "expr_list";
export const block_type_dict = "expr_dict";
export const block_type_set = "expr_set";
export const block_type_comprehension = "expr_comprehension";
export const block_type_slice = "expr_slice";
export const block_type_fstring = "expr_fstring";
export const block_type_return = "stmt_return";
export const block_type_break = "stmt_break";
export const block_type_continue = "stmt_continue";
export const block_type_aug_assign = "stmt_aug_assign";
export const block_type_import = "stmt_import";
export const block_type_try = "stmt_try";
export const block_type_except = "stmt_except";
export const block_type_class_def = "stmt_class_def";
export const block_type_with_block = "with_block";
export const block_type_assert_stmt = "assert_stmt";
export const block_type_raise_stmt = "raise_stmt";
export const block_type_del_stmt = "del_stmt";
export const block_type_global_stmt = "global_stmt";
export const block_type_nonlocal_stmt = "nonlocal_stmt";
export const block_type_ann_assign = "stmt_ann_assign";
export const block_type_named_expr = "expr_named_expr";
export const block_type_yield_expr = "expr_yield";
export const block_type_yield_from_expr = "expr_yield_from";
export const block_type_await_expr = "expr_await";
export const block_type_range = "expr_range";
export const block_type_len = "expr_len";
export const block_type_input = "expr_input";
export const block_type_type_convert = "expr_type_convert";
export const block_type_enumerate = "expr_enumerate";
export const block_type_zip = "expr_zip";
export const block_type_sorted = "expr_sorted";
export const block_type_reversed = "expr_reversed";
export const block_type_math_func = "expr_math_func";
export const block_type_isinstance = "expr_isinstance";
export const block_type_type_check = "expr_type_check";
export const expr_output = "Expr";
export const declared_variables_category_key = "DECLARED_VARIABLES";
export const declared_functions_category_key = "DECLARED_FUNCTIONS";

const normalize_variable_name = (value: string | null | undefined) =>
  (value ?? "").trim();

const collect_declared_variable_names = (active_workspace: Blockly.WorkspaceSvg) => {
  const names = new Set<string>();
  active_workspace.getAllBlocks(false).forEach((block) => {
    switch (block.type) {
      case block_type_var_set: {
        const name = normalize_variable_name(block.getFieldValue("name"));
        if (name.length > 0) {
          names.add(name);
        }
        break;
      }
      case block_type_assign: {
        const target = block.getInputTargetBlock("TARGET");
        if (target?.type === block_type_identifier) {
          const name = normalize_variable_name(target.getFieldValue("name"));
          if (name.length > 0) {
            names.add(name);
          }
        } else if (target?.type === block_type_tuple) {
          const tuple = target as unknown as tuple_block;
          for (let i = 0; i < (tuple.itemCount_ ?? 0); i++) {
            const item = tuple.getInputTargetBlock(`ITEM${i}`);
            if (item?.type === block_type_identifier) {
              const name = normalize_variable_name(item.getFieldValue("name"));
              if (name.length > 0) {
                names.add(name);
              }
            }
          }
        }
        break;
      }
      case block_type_for: {
        const target = block.getInputTargetBlock("TARGET");
        if (target?.type === block_type_identifier) {
          const name = normalize_variable_name(target.getFieldValue("name"));
          if (name.length > 0) {
            names.add(name);
          }
        }
        break;
      }
      case block_type_function_def: {
        const def_block = block as unknown as function_def_block;
        const count = def_block.itemCount_ ?? 0;
        for (let index = 0; index < count; index += 1) {
          let raw = normalize_variable_name(def_block.getFieldValue(`PARAM${index}`));
          if (raw.startsWith("**")) raw = raw.substring(2).trim();
          else if (raw.startsWith("*")) raw = raw.substring(1).trim();
          const eq_pos = raw.indexOf("=");
          if (eq_pos >= 0) raw = raw.substring(0, eq_pos).trim();
          const colon_pos = raw.indexOf(":");
          if (colon_pos >= 0) raw = raw.substring(0, colon_pos).trim();
          if (raw.length > 0) {
            names.add(raw);
          }
        }
        break;
      }
      case block_type_ann_assign: {
        const name = normalize_variable_name(block.getFieldValue("TARGET"));
        if (name.length > 0) {
          names.add(name);
        }
        break;
      }
      default:
        break;
    }
  });
  return Array.from(names).sort((left, right) => left.localeCompare(right));
};

export const build_declared_variable_category = (active_workspace: Blockly.WorkspaceSvg) => {
  const names = collect_declared_variable_names(active_workspace);
  if (names.length === 0) {
    return [{ kind: "label", text: t("msg_no_declared_vars") }];
  }
  return names.map((name) => ({
    kind: "block",
    type: block_type_identifier,
    fields: { name },
  }));
};

const collect_declared_function_info = (active_workspace: Blockly.WorkspaceSvg) => {
  const funcs: { name: string; param_count: number }[] = [];
  const seen = new Set<string>();
  active_workspace.getAllBlocks(false).forEach((block) => {
    if (block.type === block_type_function_def) {
      const name = normalize_variable_name(block.getFieldValue("name"));
      if (name.length > 0 && !seen.has(name)) {
        seen.add(name);
        const param_count = (block as unknown as function_def_block).itemCount_ ?? 0;
        funcs.push({ name, param_count });
      }
    }
  });
  return funcs.sort((a, b_item) => a.name.localeCompare(b_item.name));
};

export const build_declared_function_category = (active_workspace: Blockly.WorkspaceSvg) => {
  const funcs = collect_declared_function_info(active_workspace);
  if (funcs.length === 0) {
    return [{ kind: "label", text: t("msg_no_declared_funcs") }];
  }
  return funcs.map((fn) => ({
    kind: "block",
    type: block_type_call,
    fields: { NAME: fn.name, ARG_COUNT: fn.param_count },
  }));
};

export const blockly_theme_light = Blockly.Theme.defineTheme("lebl_light", {
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

export const blockly_theme_dark = Blockly.Theme.defineTheme("lebl_dark", {
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

export const get_toolbox = () => ({
  kind: "categoryToolbox",
  contents: [
    {
      kind: "category",
      name: t("toolbox_events"),
      colour: "230",
      contents: [{ kind: "block", type: block_type_event_start }],
    },
    {
      kind: "category",
      name: t("toolbox_control"),
      colour: "210",
      contents: [
        { kind: "block", type: block_type_if },
        { kind: "block", type: block_type_elif },
        { kind: "block", type: block_type_else },
        { kind: "block", type: block_type_match },
        { kind: "block", type: block_type_case },
        { kind: "block", type: block_type_wait },
        { kind: "block", type: block_type_return },
        { kind: "block", type: block_type_break },
        { kind: "block", type: block_type_continue },
        { kind: "block", type: block_type_try },
        { kind: "block", type: block_type_with_block },
        { kind: "block", type: block_type_del_stmt },
        { kind: "block", type: block_type_assert_stmt },
        { kind: "block", type: block_type_raise_stmt },
      ],
    },
    {
      kind: "category",
      name: t("toolbox_loops"),
      colour: "120",
      contents: [
        { kind: "block", type: block_type_while },
        { kind: "block", type: block_type_for },
      ],
    },
    {
      kind: "category",
      name: t("toolbox_assignment"),
      colour: "330",
      contents: [
        { kind: "block", type: block_type_assign },
        { kind: "block", type: block_type_aug_assign },
        { kind: "block", type: block_type_ann_assign },
      ],
    },
    {
      kind: "category",
      name: t("toolbox_variables"),
      colour: "330",
      contents: [
        { kind: "block", type: block_type_var_set },
        { kind: "block", type: block_type_global_stmt },
        { kind: "block", type: block_type_nonlocal_stmt },
      ],
    },
    {
      kind: "category",
      name: t("toolbox_declared_vars"),
      colour: "330",
      custom: declared_variables_category_key,
    },
    {
      kind: "category",
      name: t("toolbox_definitions"),
      colour: "290",
      contents: [
        { kind: "block", type: block_type_function_def },
        { kind: "block", type: block_type_class_def },
      ],
    },
    {
      kind: "category",
      name: t("toolbox_declared_funcs"),
      colour: "290",
      custom: declared_functions_category_key,
    },
    {
      kind: "category",
      name: t("toolbox_imports"),
      colour: "160",
      contents: [{ kind: "block", type: block_type_import }],
    },
    {
      kind: "category",
      name: t("toolbox_output"),
      colour: "180",
      contents: [{ kind: "block", type: block_type_print }],
    },
    {
      kind: "category",
      name: t("toolbox_builtins"),
      colour: "290",
      contents: [
        { kind: "block", type: block_type_range },
        { kind: "block", type: block_type_len },
        { kind: "block", type: block_type_input },
        { kind: "block", type: block_type_type_convert },
        { kind: "block", type: block_type_enumerate },
        { kind: "block", type: block_type_zip },
        { kind: "block", type: block_type_sorted },
        { kind: "block", type: block_type_reversed },
        { kind: "block", type: block_type_math_func },
        { kind: "block", type: block_type_isinstance },
        { kind: "block", type: block_type_type_check },
      ],
    },
    {
      kind: "category",
      name: t("toolbox_expressions"),
      colour: "230",
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
        { kind: "block", type: block_type_random },
        { kind: "block", type: block_type_round },
        { kind: "block", type: block_type_call },
        { kind: "block", type: block_type_tuple },
        { kind: "block", type: block_type_list },
        { kind: "block", type: block_type_dict },
        { kind: "block", type: block_type_set },
        { kind: "block", type: block_type_comprehension },
        { kind: "block", type: block_type_attribute },
        { kind: "block", type: block_type_subscript },
        { kind: "block", type: block_type_grouped },
        { kind: "block", type: block_type_slice },
        { kind: "block", type: block_type_fstring },
        { kind: "block", type: block_type_named_expr },
        { kind: "block", type: block_type_yield_expr },
        { kind: "block", type: block_type_yield_from_expr },
        { kind: "block", type: block_type_await_expr },
      ],
    },
    {
      kind: "category",
      name: t("toolbox_statements"),
      colour: "180",
      contents: [
        { kind: "block", type: block_type_expr },
        { kind: "block", type: block_type_pass },
      ],
    },
  ],
});

export const register_blocks = () => {
  Blockly.Blocks[block_type_event_start] = {
    init() {
      this.appendDummyInput().appendField(b("block_start", "start"));
      this.appendStatementInput("BODY").appendField(b("block_do", "do"));
      this.setColour(230);
    },
  };

  Blockly.Blocks[block_type_if] = {
    init() {
      this.appendValueInput("COND").setCheck(expr_output).appendField(b("block_if", "if"));
      this.appendStatementInput("BODY").appendField(b("block_do", "do"));
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(210);
    },
  };

  Blockly.Blocks[block_type_elif] = {
    init() {
      this.appendValueInput("COND").setCheck(expr_output).appendField(b("block_elif", "elif"));
      this.appendStatementInput("BODY").appendField(b("block_do", "do"));
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(210);
    },
  };

  Blockly.Blocks[block_type_else] = {
    init() {
      this.appendDummyInput().appendField(b("block_else", "else"));
      this.appendStatementInput("BODY").appendField(b("block_do", "do"));
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(210);
    },
  };

  Blockly.Blocks[block_type_while] = {
    init() {
      this.appendValueInput("COND").setCheck(expr_output).appendField(b("block_while", "while"));
      this.appendStatementInput("BODY").appendField(b("block_do", "do"));
      this.appendStatementInput("ELSE_BODY").appendField(b("block_while_else", "else"));
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(120);
    },
  };

  Blockly.Blocks[block_type_for] = {
    init() {
      this.appendValueInput("TARGET").setCheck(expr_output).appendField(b("block_for", "for"));
      this.appendValueInput("ITER").setCheck(expr_output).appendField(b("block_for_in", "in"));
      this.appendDummyInput().appendField(b("block_async", "async")).appendField(new Blockly.FieldCheckbox("FALSE"), "IS_ASYNC");
      this.appendStatementInput("BODY").appendField(b("block_do", "do"));
      this.appendStatementInput("ELSE_BODY").appendField(b("block_for_else", "else"));
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(120);
    },
  };

  Blockly.Blocks[block_type_match] = {
    init() {
      this.appendValueInput("SUBJECT").setCheck(expr_output).appendField(b("block_match", "match"));
      this.appendStatementInput("CASES").appendField(b("block_case", "case"));
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(210);
    },
  };

  Blockly.Blocks[block_type_case] = {
    init() {
      this.appendValueInput("PATTERN").setCheck(expr_output).appendField(b("block_case", "case"));
      this.appendStatementInput("BODY").appendField(b("block_do", "do"));
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(210);
    },
  };

  Blockly.Blocks[block_type_wait] = {
    init() {
      this.appendValueInput("SECONDS").setCheck(expr_output).appendField(b("block_wait", "wait"));
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(210);
    },
  };

  Blockly.Blocks[block_type_print] = {
    init() {
      this.appendValueInput("VALUE").setCheck(expr_output).appendField(b("block_print", "print"));
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(180);
    },
  };

  Blockly.Blocks[block_type_var_set] = {
    init() {
      this.appendDummyInput()
        .appendField(b("block_var_set", "var"))
        .appendField(new Blockly.FieldTextInput("value"), "name");
      this.appendValueInput("VALUE").setCheck(expr_output).appendField("=");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(330);
    },
  };

  Blockly.Blocks[block_type_function_def] = {
    init() {
      const validator = (value: number | string) => {
        const count = Math.max(0, Math.floor(Number(value)));
        const def_block = this as function_def_block;
        def_block.itemCount_ = count;
        def_block.updateShape_();
        return count;
      };
      this.appendDummyInput()
        .appendField("@")
        .appendField(new Blockly.FieldTextInput(""), "DECORATORS");
      this.appendDummyInput()
        .appendField(b("block_def", "def"))
        .appendField(new Blockly.FieldTextInput("fn"), "name")
        .appendField(new Blockly.FieldNumber(0, 0, 8, 1, validator), "ARG_COUNT")
        .appendField("->")
        .appendField(new Blockly.FieldTextInput(""), "RETURN_TYPE");
      this.appendDummyInput().appendField(b("block_async", "async")).appendField(new Blockly.FieldCheckbox("FALSE"), "IS_ASYNC");
      this.appendStatementInput("BODY").appendField(b("block_do", "do"));
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(290);
      (this as function_def_block).itemCount_ = 0;
      (this as function_def_block).updateShape_();
    },
    updateShape_() {
      let index = 0;
      while (this.getInput(`PARAM${index}`)) {
        this.removeInput(`PARAM${index}`);
        index += 1;
      }
      for (let param_index = 0; param_index < (this as function_def_block).itemCount_; param_index += 1) {
        this.appendDummyInput(`PARAM${param_index}`).appendField(
          new Blockly.FieldTextInput(`arg${param_index + 1}`),
          `PARAM${param_index}`,
        );
        if (this.getInput("BODY")) {
          this.moveInputBefore(`PARAM${param_index}`, "BODY");
        }
      }
    },
  };

  Blockly.Blocks[block_type_assign] = {
    init() {
      this.appendValueInput("TARGET").setCheck(expr_output).appendField(b("block_assign_set", "set"));
      this.appendValueInput("VALUE").setCheck(expr_output).appendField("=");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(330);
    },
  };

  Blockly.Blocks[block_type_ann_assign] = {
    init() {
      this.appendDummyInput()
        .appendField(new Blockly.FieldTextInput("x"), "TARGET")
        .appendField(":")
        .appendField(new Blockly.FieldTextInput("int"), "ANNOTATION");
      this.appendValueInput("VALUE").setCheck(expr_output).appendField("=");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(330);
    },
  };

  Blockly.Blocks[block_type_expr] = {
    init() {
      this.appendValueInput("EXPR").setCheck(expr_output).appendField(b("block_element", "expr"));
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(180);
    },
  };

  Blockly.Blocks[block_type_pass] = {
    init() {
      this.appendDummyInput().appendField(b("block_pass", "pass"));
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(230);
    },
  };

  Blockly.Blocks[block_type_sync_error] = {
    init() {
      this.appendDummyInput().appendField(t("msg_sync_error"));
      this.setColour(0);
    },
  };

  Blockly.Blocks[block_type_identifier] = {
    init() {
      this.appendDummyInput()
        .appendField(b("block_id", "id"))
        .appendField(new Blockly.FieldTextInput("value"), "name");
      this.setOutput(true, expr_output);
      this.setColour(330);
    },
  };

  Blockly.Blocks[block_type_number] = {
    init() {
      this.appendDummyInput()
        .appendField(b("block_num", "num"))
        .appendField(new Blockly.FieldTextInput("0"), "value");
      this.setOutput(true, expr_output);
      this.setColour(60);
    },
  };

  Blockly.Blocks[block_type_string] = {
    init() {
      this.appendDummyInput()
        .appendField(b("block_str", "str"))
        .appendField(new Blockly.FieldTextInput("text"), "value");
      this.setOutput(true, expr_output);
      this.setColour(60);
    },
  };

  Blockly.Blocks[block_type_bool] = {
    init() {
      this.appendDummyInput()
        .appendField(b("block_bool", "bool"))
        .appendField(
          new Blockly.FieldDropdown([
            ["True", "true"],
            ["False", "false"],
          ]),
          "value",
        );
      this.setOutput(true, expr_output);
      this.setColour(60);
    },
  };

  Blockly.Blocks[block_type_none] = {
    init() {
      this.appendDummyInput().appendField(b("block_none", "None"));
      this.setOutput(true, expr_output);
      this.setColour(60);
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
          ["//", "floor_div"],
          ["**", "power"],
          ["&", "bit_and"],
          ["|", "bit_or"],
          ["^", "bit_xor"],
          ["<<", "left_shift"],
          [">>", "right_shift"],
        ]),
        "op",
      );
      this.appendValueInput("RIGHT").setCheck(expr_output);
      this.setOutput(true, expr_output);
      this.setColour(230);
    },
  };

  Blockly.Blocks[block_type_unary] = {
    init() {
      this.appendDummyInput().appendField(
        new Blockly.FieldDropdown([
          ["-", "neg"],
          ["not", "not"],
          ["~", "bit_not"],
        ]),
        "op",
      );
      this.appendValueInput("VALUE").setCheck(expr_output);
      this.setOutput(true, expr_output);
      this.setColour(230);
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
        .appendField(b("block_boolop", "boolop"))
        .appendField(
          new Blockly.FieldDropdown([
            ["and", "and"],
            ["or", "or"],
          ]),
          "op",
        )
        .appendField(new Blockly.FieldNumber(2, 2, 6, 1, validator), "COUNT");
      this.setOutput(true, expr_output);
      this.setColour(230);
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
      this.appendValueInput("LEFT").setCheck(expr_output).appendField(b("block_compare", "compare"));
      this.appendDummyInput().appendField(new Blockly.FieldNumber(1, 1, 6, 1, validator), "COUNT");
      this.setOutput(true, expr_output);
      this.setColour(230);
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
      this.appendValueInput("BODY").setCheck(expr_output).appendField(b("block_ifexpr", "ifexpr"));
      this.appendValueInput("COND").setCheck(expr_output).appendField(b("block_if", "if"));
      this.appendValueInput("ELSE").setCheck(expr_output).appendField(b("block_else", "else"));
      this.setOutput(true, expr_output);
      this.setColour(210);
    },
  };

  Blockly.Blocks[block_type_lambda] = {
    init() {
      this.appendDummyInput()
        .appendField(b("block_lambda", "lambda"))
        .appendField(new Blockly.FieldTextInput("x"), "params");
      this.appendValueInput("BODY").setCheck(expr_output).appendField(":");
      this.setOutput(true, expr_output);
      this.setColour(290);
    },
  };

  Blockly.Blocks[block_type_random] = {
    init() {
      this.appendDummyInput().appendField("random");
      this.setOutput(true, expr_output);
      this.setColour(290);
    },
  };

  Blockly.Blocks[block_type_round] = {
    init() {
      this.appendValueInput("VALUE").setCheck(expr_output).appendField("round");
      this.setOutput(true, expr_output);
      this.setColour(290);
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
        .appendField(b("block_list", "list"))
        .appendField(new Blockly.FieldNumber(0, 0, 8, 1, validator), "COUNT");
      this.setOutput(true, expr_output);
      this.setColour(40);
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
        .appendField(b("block_dict", "dict"))
        .appendField(new Blockly.FieldNumber(0, 0, 6, 1, validator), "COUNT");
      this.setOutput(true, expr_output);
      this.setColour(40);
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
        key_input.appendField(entry_index === 0 ? b("block_key", "key") : "");
        const value_input = this.appendValueInput(`VALUE${entry_index}`).setCheck(expr_output);
        value_input.appendField(b("block_value", "value"));
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
        .appendField(b("block_set", "set"))
        .appendField(new Blockly.FieldNumber(0, 0, 8, 1, validator), "COUNT");
      this.setOutput(true, expr_output);
      this.setColour(40);
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
            setTimeout(() => (this as comprehension_block).updateShape_(), 0);
            return value;
          }),
          "KIND",
        );
      this.appendValueInput("ELEMENT").setCheck(expr_output).appendField(b("block_element", "element"));
      this.appendDummyInput()
        .appendField(b("block_for", "for"))
        .appendField(new Blockly.FieldNumber(1, 1, 4, 1, validator), "FOR_COUNT");
      this.setOutput(true, expr_output);
      this.setColour(50);
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
          this.appendValueInput("KEY").setCheck(expr_output).appendField(b("block_key", "key"));
        }
      } else if (this.getInput("KEY")) {
        this.removeInput("KEY");
      }
      for (let for_index = 0; for_index < comp_block.forCount_; for_index += 1) {
        const target_input = this.appendValueInput(`TARGET${for_index}`).setCheck(expr_output);
        target_input.appendField(b("block_for", "for"));
        this.appendValueInput(`ITER${for_index}`).setCheck(expr_output).appendField(b("block_for_in", "in"));
        const if_validator = (value: number | string) => {
          const count = Math.max(0, Math.floor(Number(value)));
          comp_block.ifCounts_[for_index] = count;
          comp_block.updateShape_();
          return count;
        };
        this.appendDummyInput(`IFCOUNT${for_index}`)
          .appendField(b("block_if", "if"))
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
            input.appendField(b("block_cond", "cond"));
          }
        }
      }
    },
  };

  Blockly.Blocks[block_type_call] = {
    init() {
      this.appendDummyInput("NAME_ROW")
        .appendField(b("block_call", "call"))
        .appendField(new Blockly.FieldTextInput("func"), "NAME");
      this.appendValueInput("CALLEE").setCheck(expr_output).appendField(b("block_attr", "▸"));
      const validator = (value: number | string) => {
        const count = Math.max(0, Math.floor(Number(value)));
        const call_block = this as call_block;
        call_block.itemCount_ = count;
        call_block.updateShape_();
        return count;
      };
      this.appendDummyInput()
        .appendField("args")
        .appendField(new Blockly.FieldNumber(0, 0, 8, 1, validator), "ARG_COUNT");
      this.setOutput(true, expr_output);
      this.setColour(290);
      (this as call_block).itemCount_ = 0;
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
        .appendField(b("block_tuple", "tuple"))
        .appendField(new Blockly.FieldNumber(2, 0, 8, 1, validator), "COUNT");
      this.setOutput(true, expr_output);
      this.setColour(40);
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
      this.appendValueInput("VALUE").setCheck(expr_output).appendField(b("block_attr", "attr"));
      this.appendDummyInput().appendField(
        new Blockly.FieldTextInput("name"),
        "attr",
      );
      this.setOutput(true, expr_output);
      this.setColour(350);
    },
  };

  Blockly.Blocks[block_type_subscript] = {
    init() {
      this.appendValueInput("VALUE").setCheck(expr_output).appendField(b("block_index", "index"));
      this.appendValueInput("INDEX").setCheck(expr_output);
      this.setOutput(true, expr_output);
      this.setColour(350);
    },
  };

  Blockly.Blocks[block_type_grouped] = {
    init() {
      this.appendValueInput("VALUE").setCheck(expr_output).appendField(b("block_group", "group"));
      this.setOutput(true, expr_output);
      this.setColour(200);
    },
  };

  Blockly.Blocks[block_type_slice] = {
    init() {
      this.appendValueInput("LOWER").setCheck(expr_output).appendField("[");
      this.appendValueInput("UPPER").setCheck(expr_output).appendField(":");
      this.appendValueInput("STEP").setCheck(expr_output).appendField(":");
      this.appendDummyInput().appendField("]");
      this.setOutput(true, expr_output);
      this.setColour(350);
    },
  };

  Blockly.Blocks[block_type_fstring] = {
    init() {
      this.appendDummyInput()
        .appendField("f\"")
        .appendField(new Blockly.FieldTextInput("text"), "TEMPLATE")
        .appendField("\"");
      this.setOutput(true, expr_output);
      this.setColour(160);
    },
  };

  Blockly.Blocks[block_type_named_expr] = {
    init() {
      this.appendValueInput("VALUE")
        .setCheck(expr_output)
        .appendField(new Blockly.FieldTextInput("name"), "NAME")
        .appendField(b("block_named_expr", ":="));
      this.setOutput(true, expr_output);
      this.setColour(210);
    },
  };

  Blockly.Blocks[block_type_yield_expr] = {
    init() {
      this.appendValueInput("VALUE")
        .setCheck(expr_output)
        .appendField(b("block_yield", "yield"));
      this.setOutput(true, expr_output);
      this.setColour(290);
    },
  };

  Blockly.Blocks[block_type_yield_from_expr] = {
    init() {
      this.appendValueInput("VALUE")
        .setCheck(expr_output)
        .appendField(b("block_yield_from", "yield from"));
      this.setOutput(true, expr_output);
      this.setColour(290);
    },
  };

  Blockly.Blocks[block_type_await_expr] = {
    init() {
      this.appendValueInput("VALUE")
        .setCheck(expr_output)
        .appendField(b("block_await", "await"));
      this.setOutput(true, expr_output);
      this.setColour(290);
    },
  };

  Blockly.Blocks[block_type_return] = {
    init() {
      this.appendValueInput("VALUE").setCheck(expr_output).appendField(b("block_return", "return"));
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(290);
    },
  };

  Blockly.Blocks[block_type_break] = {
    init() {
      this.appendDummyInput().appendField(b("block_break", "break"));
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(120);
    },
  };

  Blockly.Blocks[block_type_continue] = {
    init() {
      this.appendDummyInput().appendField(b("block_continue", "continue"));
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(120);
    },
  };

  Blockly.Blocks[block_type_aug_assign] = {
    init() {
      this.appendValueInput("TARGET").setCheck(expr_output).appendField(b("block_assign_set", "set"));
      this.appendDummyInput().appendField(
        new Blockly.FieldDropdown([
          ["+=", "plus_assign"],
          ["-=", "minus_assign"],
          ["*=", "star_assign"],
          ["/=", "slash_assign"],
          ["%=", "percent_assign"],
        ]),
        "OP",
      );
      this.appendValueInput("VALUE").setCheck(expr_output);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(330);
    },
  };

  Blockly.Blocks[block_type_import] = {
    init() {
      const validator = (value: number | string) => {
        const count = Math.max(0, Math.floor(Number(value)));
        const imp_block = this as import_block;
        imp_block.nameCount_ = count;
        imp_block.updateShape_();
        return count;
      };
      this.appendDummyInput()
        .appendField(
          new Blockly.FieldDropdown([
            ["import", "import"],
            ["from", "from"],
          ]),
          "KIND",
        )
        .appendField(new Blockly.FieldTextInput("module"), "MODULE")
        .appendField(new Blockly.FieldNumber(0, 0, 10, 1, validator), "NAME_COUNT");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(160);
      (this as import_block).nameCount_ = 0;
      (this as import_block).updateShape_();
    },
    updateShape_() {
      let index = 0;
      while (this.getInput(`NAME${index}`)) {
        this.removeInput(`NAME${index}`);
        index += 1;
      }
      for (let name_index = 0; name_index < (this as import_block).nameCount_; name_index += 1) {
        this.appendDummyInput(`NAME${name_index}`).appendField(
          new Blockly.FieldTextInput(`name${name_index}`),
          `NAME${name_index}`,
        );
      }
    },
  };

  Blockly.Blocks[block_type_try] = {
    init() {
      const validator = (value: number | string) => {
        const count = Math.max(0, Math.floor(Number(value)));
        const t_block = this as try_block;
        t_block.handlerCount_ = count;
        t_block.updateShape_();
        return count;
      };
      this.appendStatementInput("BODY").appendField(b("block_try", "try"));
      this.appendDummyInput()
        .appendField("handlers")
        .appendField(new Blockly.FieldNumber(1, 0, 5, 1, validator), "HANDLER_COUNT");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(20);
      (this as try_block).handlerCount_ = 1;
      (this as try_block).updateShape_();
    },
    updateShape_() {
      // Remove old handler inputs
      let index = 0;
      while (this.getInput(`EXCEPT_TYPE${index}`) || this.getInput(`EXCEPT_BODY${index}`)) {
        if (this.getInput(`EXCEPT_TYPE${index}`)) this.removeInput(`EXCEPT_TYPE${index}`);
        if (this.getInput(`EXCEPT_NAME${index}`)) this.removeInput(`EXCEPT_NAME${index}`);
        if (this.getInput(`EXCEPT_BODY${index}`)) this.removeInput(`EXCEPT_BODY${index}`);
        index += 1;
      }
      if (this.getInput("ELSE_BODY")) this.removeInput("ELSE_BODY");
      if (this.getInput("FINALLY_BODY")) this.removeInput("FINALLY_BODY");
      // Add handler inputs
      for (let handler_index = 0; handler_index < (this as try_block).handlerCount_; handler_index += 1) {
        this.appendValueInput(`EXCEPT_TYPE${handler_index}`)
          .setCheck(expr_output)
          .appendField(b("block_except", "except"));
        this.appendDummyInput(`EXCEPT_NAME${handler_index}`)
          .appendField("as")
          .appendField(new Blockly.FieldTextInput(""), `EXCEPT_NAME${handler_index}`);
        this.appendStatementInput(`EXCEPT_BODY${handler_index}`).appendField(b("block_do", "do"));
      }
      this.appendStatementInput("ELSE_BODY").appendField(b("block_else", "else"));
      this.appendStatementInput("FINALLY_BODY").appendField(b("block_finally", "finally"));
    },
  };

  Blockly.Blocks[block_type_class_def] = {
    init() {
      const validator = (value: number | string) => {
        const count = Math.max(0, Math.floor(Number(value)));
        const cls_block = this as class_def_block;
        cls_block.baseCount_ = count;
        cls_block.updateShape_();
        return count;
      };
      this.appendDummyInput()
        .appendField("@")
        .appendField(new Blockly.FieldTextInput(""), "DECORATORS");
      this.appendDummyInput()
        .appendField(b("block_class", "class"))
        .appendField(new Blockly.FieldTextInput("MyClass"), "NAME")
        .appendField(new Blockly.FieldNumber(0, 0, 5, 1, validator), "BASE_COUNT");
      this.appendStatementInput("BODY").appendField(b("block_do", "do"));
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(280);
      (this as class_def_block).baseCount_ = 0;
      (this as class_def_block).updateShape_();
    },
    updateShape_() {
      let index = 0;
      while (this.getInput(`BASE${index}`)) {
        this.removeInput(`BASE${index}`);
        index += 1;
      }
      for (let base_index = 0; base_index < (this as class_def_block).baseCount_; base_index += 1) {
        const input = this.appendValueInput(`BASE${base_index}`).setCheck(expr_output);
        if (base_index === 0) {
          input.appendField("bases");
        }
        if (this.getInput("BODY")) {
          this.moveInputBefore(`BASE${base_index}`, "BODY");
        }
      }
    },
  };

  Blockly.Blocks[block_type_with_block] = {
    init() {
      const validator = (value: number | string) => {
        const count = Math.max(1, Math.floor(Number(value)));
        const wb = this as with_block;
        wb.itemCount_ = count;
        wb.updateShape_();
        return count;
      };
      this.appendDummyInput()
        .appendField(b("block_with", "with"))
        .appendField(new Blockly.FieldNumber(1, 1, 8, 1, validator), "COUNT");
      this.appendDummyInput().appendField(b("block_async", "async")).appendField(new Blockly.FieldCheckbox("FALSE"), "IS_ASYNC");
      this.appendStatementInput("BODY").appendField(b("block_do", "do"));
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(190);
      (this as with_block).itemCount_ = 1;
      (this as with_block).updateShape_();
    },
    updateShape_() {
      let index = 0;
      while (this.getInput(`CONTEXT${index}`)) {
        this.removeInput(`CONTEXT${index}`);
        this.removeInput(`NAME${index}`);
        index += 1;
      }
      const body_input = this.getInput("BODY");
      for (let i = 0; i < (this as with_block).itemCount_; i += 1) {
        const ctx_input = this.appendValueInput(`CONTEXT${i}`).setCheck(expr_output);
        ctx_input.appendField(i === 0 ? "context" : ",");
        this.appendDummyInput(`NAME${i}`)
          .appendField("as")
          .appendField(new Blockly.FieldTextInput(""), `NAME${i}`);
        if (body_input) {
          this.moveInputBefore(`CONTEXT${i}`, "BODY");
          this.moveInputBefore(`NAME${i}`, "BODY");
        }
      }
    },
  };

  Blockly.Blocks[block_type_assert_stmt] = {
    init() {
      this.appendValueInput("CONDITION").setCheck(expr_output).appendField(b("block_assert", "assert"));
      this.appendValueInput("MESSAGE").setCheck(expr_output).appendField(",");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(20);
    },
  };

  Blockly.Blocks[block_type_raise_stmt] = {
    init() {
      this.appendValueInput("EXCEPTION").setCheck(expr_output).appendField(b("block_raise", "raise"));
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(20);
    },
  };

  Blockly.Blocks[block_type_del_stmt] = {
    init() {
      this.appendValueInput("TARGET").setCheck(expr_output).appendField(b("block_del", "del"));
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(330);
    },
  };

  Blockly.Blocks[block_type_global_stmt] = {
    init() {
      this.appendDummyInput()
        .appendField(b("block_global", "global"))
        .appendField(new Blockly.FieldTextInput(""), "NAMES");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(330);
    },
  };

  Blockly.Blocks[block_type_nonlocal_stmt] = {
    init() {
      this.appendDummyInput()
        .appendField(b("block_nonlocal", "nonlocal"))
        .appendField(new Blockly.FieldTextInput(""), "NAMES");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(330);
    },
  };

  // --- Built-in function blocks ---

  Blockly.Blocks[block_type_range] = {
    init() {
      const validator = (value: number | string) => {
        const count = Math.max(1, Math.min(3, Math.floor(Number(value))));
        const rb = this as range_block;
        rb.itemCount_ = count;
        rb.updateShape_();
        return count;
      };
      this.appendDummyInput()
        .appendField(b("block_range", "range"))
        .appendField(new Blockly.FieldNumber(1, 1, 3, 1, validator), "COUNT");
      this.setOutput(true, expr_output);
      this.setColour(290);
      (this as range_block).itemCount_ = 1;
      (this as range_block).updateShape_();
    },
    updateShape_() {
      for (const name of ["START", "STOP", "STEP"]) {
        if (this.getInput(name)) {
          this.removeInput(name);
        }
      }
      const count = (this as range_block).itemCount_;
      if (count === 1) {
        this.appendValueInput("STOP").setCheck(expr_output).appendField(b("block_range_stop", "stop"));
      } else if (count === 2) {
        this.appendValueInput("START").setCheck(expr_output).appendField(b("block_range_start", "start"));
        this.appendValueInput("STOP").setCheck(expr_output).appendField(b("block_range_stop", "stop"));
      } else {
        this.appendValueInput("START").setCheck(expr_output).appendField(b("block_range_start", "start"));
        this.appendValueInput("STOP").setCheck(expr_output).appendField(b("block_range_stop", "stop"));
        this.appendValueInput("STEP").setCheck(expr_output).appendField(b("block_range_step", "step"));
      }
    },
  };

  Blockly.Blocks[block_type_len] = {
    init() {
      this.appendValueInput("OBJ").setCheck(expr_output).appendField(b("block_len", "len"));
      this.setOutput(true, expr_output);
      this.setColour(290);
    },
  };

  Blockly.Blocks[block_type_input] = {
    init() {
      this.appendValueInput("PROMPT").setCheck(expr_output).appendField(b("block_input", "input"));
      this.setOutput(true, expr_output);
      this.setColour(290);
    },
  };

  Blockly.Blocks[block_type_type_convert] = {
    init() {
      this.appendValueInput("VALUE")
        .setCheck(expr_output)
        .appendField(
          new Blockly.FieldDropdown([
            ["int", "int"],
            ["float", "float"],
            ["str", "str"],
            ["bool", "bool"],
            ["list", "list"],
            ["tuple", "tuple"],
            ["dict", "dict"],
            ["set", "set"],
          ]),
          "TYPE",
        );
      this.setOutput(true, expr_output);
      this.setColour(290);
    },
  };

  Blockly.Blocks[block_type_enumerate] = {
    init() {
      this.appendValueInput("ITERABLE").setCheck(expr_output).appendField(b("block_enumerate", "enumerate"));
      this.appendValueInput("START").setCheck(expr_output).appendField("start=");
      this.setOutput(true, expr_output);
      this.setColour(290);
    },
  };

  Blockly.Blocks[block_type_zip] = {
    init() {
      const validator = (value: number | string) => {
        const count = Math.max(2, Math.floor(Number(value)));
        const zb = this as zip_block;
        zb.itemCount_ = count;
        zb.updateShape_();
        return count;
      };
      this.appendDummyInput()
        .appendField(b("block_zip", "zip"))
        .appendField(new Blockly.FieldNumber(2, 2, 8, 1, validator), "COUNT");
      this.setOutput(true, expr_output);
      this.setColour(290);
      (this as zip_block).itemCount_ = 2;
      (this as zip_block).updateShape_();
    },
    updateShape_() {
      let index = 0;
      while (this.getInput(`ITER${index}`)) {
        this.removeInput(`ITER${index}`);
        index += 1;
      }
      for (let i = 0; i < (this as zip_block).itemCount_; i += 1) {
        const input = this.appendValueInput(`ITER${i}`).setCheck(expr_output);
        if (i === 0) {
          input.appendField("iterables");
        }
      }
    },
  };

  Blockly.Blocks[block_type_sorted] = {
    init() {
      this.appendValueInput("ITERABLE").setCheck(expr_output).appendField(b("block_sorted", "sorted"));
      this.setOutput(true, expr_output);
      this.setColour(290);
    },
  };

  Blockly.Blocks[block_type_reversed] = {
    init() {
      this.appendValueInput("ITERABLE").setCheck(expr_output).appendField(b("block_reversed", "reversed"));
      this.setOutput(true, expr_output);
      this.setColour(290);
    },
  };

  Blockly.Blocks[block_type_math_func] = {
    init() {
      this.appendValueInput("VALUE")
        .setCheck(expr_output)
        .appendField(
          new Blockly.FieldDropdown([
            ["abs", "abs"],
            ["min", "min"],
            ["max", "max"],
            ["sum", "sum"],
          ]),
          "FUNC",
        );
      this.setOutput(true, expr_output);
      this.setColour(290);
    },
  };

  Blockly.Blocks[block_type_isinstance] = {
    init() {
      this.appendValueInput("OBJ").setCheck(expr_output).appendField(b("block_isinstance", "isinstance"));
      this.appendValueInput("TYPE").setCheck(expr_output).appendField(",");
      this.setOutput(true, expr_output);
      this.setColour(290);
    },
  };

  Blockly.Blocks[block_type_type_check] = {
    init() {
      this.appendValueInput("OBJ").setCheck(expr_output).appendField(b("block_type_check", "type"));
      this.setOutput(true, expr_output);
      this.setColour(290);
    },
  };
};

