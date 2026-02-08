import * as Blockly from "blockly";
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
  set_block,
  try_block,
  tuple_block,
} from "./types";

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
export const expr_output = "Expr";
export const declared_variables_category_key = "DECLARED_VARIABLES";

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
          const param = normalize_variable_name(def_block.getFieldValue(`PARAM${index}`));
          if (param.length > 0) {
            names.add(param);
          }
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
    return [{ kind: "label", text: "宣言済みの変数なし" }];
  }
  return names.map((name) => ({
    kind: "block",
    type: block_type_identifier,
    fields: { name },
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

export const toolbox = {
  kind: "categoryToolbox",
  contents: [
    {
      kind: "category",
      name: "イベント",
      contents: [{ kind: "block", type: block_type_event_start }],
    },
    {
      kind: "category",
      name: "制御",
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
      contents: [
        { kind: "block", type: block_type_assign },
        { kind: "block", type: block_type_aug_assign },
      ],
    },
    {
      kind: "category",
      name: "変数",
      contents: [{ kind: "block", type: block_type_var_set }],
    },
    {
      kind: "category",
      name: "宣言済み変数",
      custom: declared_variables_category_key,
    },
    {
      kind: "category",
      name: "定義",
      contents: [
        { kind: "block", type: block_type_function_def },
        { kind: "block", type: block_type_class_def },
      ],
    },
    {
      kind: "category",
      name: "インポート",
      contents: [{ kind: "block", type: block_type_import }],
    },
    {
      kind: "category",
      name: "出力",
      contents: [{ kind: "block", type: block_type_print }],
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

export const register_blocks = () => {
  Blockly.Blocks[block_type_event_start] = {
    init() {
      this.appendDummyInput().appendField("start");
      this.appendStatementInput("BODY").appendField("do");
      this.setColour(120);
    },
  };

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

  Blockly.Blocks[block_type_wait] = {
    init() {
      this.appendValueInput("SECONDS").setCheck(expr_output).appendField("wait");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(160);
    },
  };

  Blockly.Blocks[block_type_print] = {
    init() {
      this.appendValueInput("VALUE").setCheck(expr_output).appendField("print");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(20);
    },
  };

  Blockly.Blocks[block_type_var_set] = {
    init() {
      this.appendDummyInput()
        .appendField("var")
        .appendField(new Blockly.FieldTextInput("value"), "name");
      this.appendValueInput("VALUE").setCheck(expr_output).appendField("=");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(20);
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
        .appendField("def")
        .appendField(new Blockly.FieldTextInput("fn"), "name")
        .appendField(new Blockly.FieldNumber(0, 0, 8, 1, validator), "ARG_COUNT");
      this.appendStatementInput("BODY").appendField("do");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(20);
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

  Blockly.Blocks[block_type_sync_error] = {
    init() {
      this.appendDummyInput().appendField("同期エラー");
      this.setColour(0);
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
          ["//", "floor_div"],
          ["**", "power"],
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
            setTimeout(() => (this as comprehension_block).updateShape_(), 0);
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

  Blockly.Blocks[block_type_slice] = {
    init() {
      this.appendValueInput("LOWER").setCheck(expr_output).appendField("[");
      this.appendValueInput("UPPER").setCheck(expr_output).appendField(":");
      this.appendValueInput("STEP").setCheck(expr_output).appendField(":");
      this.appendDummyInput().appendField("]");
      this.setOutput(true, expr_output);
      this.setColour(290);
    },
  };

  Blockly.Blocks[block_type_fstring] = {
    init() {
      this.appendDummyInput()
        .appendField("f\"")
        .appendField(new Blockly.FieldTextInput("text"), "TEMPLATE")
        .appendField("\"");
      this.setOutput(true, expr_output);
      this.setColour(290);
    },
  };

  Blockly.Blocks[block_type_return] = {
    init() {
      this.appendValueInput("VALUE").setCheck(expr_output).appendField("return");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(290);
    },
  };

  Blockly.Blocks[block_type_break] = {
    init() {
      this.appendDummyInput().appendField("break");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(160);
    },
  };

  Blockly.Blocks[block_type_continue] = {
    init() {
      this.appendDummyInput().appendField("continue");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(160);
    },
  };

  Blockly.Blocks[block_type_aug_assign] = {
    init() {
      this.appendValueInput("TARGET").setCheck(expr_output).appendField("set");
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
      this.setColour(20);
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
      this.setColour(65);
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
      this.appendStatementInput("BODY").appendField("try");
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
      if (this.getInput("FINALLY_BODY")) this.removeInput("FINALLY_BODY");
      // Add handler inputs
      for (let handler_index = 0; handler_index < (this as try_block).handlerCount_; handler_index += 1) {
        this.appendValueInput(`EXCEPT_TYPE${handler_index}`)
          .setCheck(expr_output)
          .appendField(`except`);
        this.appendDummyInput(`EXCEPT_NAME${handler_index}`)
          .appendField("as")
          .appendField(new Blockly.FieldTextInput(""), `EXCEPT_NAME${handler_index}`);
        this.appendStatementInput(`EXCEPT_BODY${handler_index}`).appendField("do");
      }
      this.appendStatementInput("FINALLY_BODY").appendField("finally");
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
        .appendField("class")
        .appendField(new Blockly.FieldTextInput("MyClass"), "NAME")
        .appendField(new Blockly.FieldNumber(0, 0, 5, 1, validator), "BASE_COUNT");
      this.appendStatementInput("BODY").appendField("do");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(20);
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
};

