import * as Blockly from "blockly";
import type {
  binary_op,
  bool_op,
  boolop_block,
  call_block,
  compare_block,
  compare_op,
  comprehension_block,
  comprehension_for,
  comprehension_kind,
  dict_block,
  dict_entry,
  expr,
  ir_block,
  ir_case_block,
  ir_context_item,
  ir_elif_stmt,
  ir_func_param,
  ir_match_case,
  ir_program,
  ir_stmt,
  list_block,
  literal,
  node_meta,
  pattern,
  range_block,
  span,
  tuple_block,
  unary_op,
  function_def_block,
  set_block,
  import_name,
  ir_except_handler,
  try_block,
  class_def_block,
  import_block,
  fstring_part,
  with_block,
  zip_block,
} from "./types";
import {
  block_type_assign,
  block_type_attribute,
  block_type_binary,
  block_type_bool,
  block_type_boolop,
  block_type_call,
  block_type_case,
  block_type_compare,
  block_type_comprehension,
  block_type_dict,
  block_type_elif,
  block_type_else,
  block_type_event_start,
  block_type_expr,
  block_type_for,
  block_type_function_def,
  block_type_grouped,
  block_type_identifier,
  block_type_if,
  block_type_ifexpr,
  block_type_lambda,
  block_type_list,
  block_type_match,
  block_type_none,
  block_type_number,
  block_type_pass,
  block_type_print,
  block_type_random,
  block_type_round,
  block_type_set,
  block_type_string,
  block_type_subscript,
  block_type_sync_error,
  block_type_tuple,
  block_type_unary,
  block_type_var_set,
  block_type_wait,
  block_type_while,
  block_type_return,
  block_type_break,
  block_type_continue,
  block_type_aug_assign,
  block_type_import,
  block_type_try,
  block_type_class_def,
  block_type_slice,
  block_type_fstring,
  block_type_with_block,
  block_type_assert_stmt,
  block_type_raise_stmt,
  block_type_del_stmt,
  block_type_global_stmt,
  block_type_nonlocal_stmt,
  block_type_ann_assign,
  block_type_named_expr,
  block_type_yield_expr,
  block_type_yield_from_expr,
  block_type_await_expr,
  block_type_range,
  block_type_len,
  block_type_input,
  block_type_type_convert,
  block_type_enumerate,
  block_type_zip,
  block_type_sorted,
  block_type_reversed,
  block_type_math_func,
  block_type_isinstance,
  block_type_type_check,
} from "./blockly_config";

let workspace: Blockly.WorkspaceSvg | null = null;
let next_node_id = 1;

export const get_workspace = () => workspace;
export const set_workspace = (value: Blockly.WorkspaceSvg | null) => {
  workspace = value;
};

const set_block_span = (block: Blockly.Block, meta: node_meta) => {
  (block as any).__code_span = meta.span;
};

export const get_block_span = (block: Blockly.Block): span | null => {
  return (block as any).__code_span ?? null;
};

export const refresh_declared_variable_category = () => {
  if (workspace) {
    workspace.refreshToolboxSelection();
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

const render_expr_text = (e: expr): string => {
  if (e.kind === "Identifier") return e.data.name;
  if (e.kind === "Attribute") return `${render_expr_text(e.data.value)}.${e.data.attr}`;
  if (e.kind === "Call") {
    const callee = render_expr_text(e.data.callee);
    const args = e.data.args.map((a) => render_expr_text(a)).join(", ");
    return args ? `${callee}(${args})` : `${callee}()`;
  }
  if (e.kind === "Literal") {
    const lit = e.data.literal;
    if (lit.kind === "String") return lit.data.value;
    if (lit.kind === "Number") return lit.data.raw;
    if (lit.kind === "Bool") return lit.data ? "True" : "False";
    return "None";
  }
  return "?";
};

const parse_decorators_field = (text: string): expr[] => {
  if (!text || text.trim() === "") return [];
  return text.split(",").map((s) => s.trim()).filter((s) => s.length > 0).map((s): expr => ({
    kind: "Identifier",
    data: { meta: make_meta(), name: s },
  }));
};

export const update_node_counter = (program: ir_program) => {
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
      max_id = Math.max(
        max_id,
        collect_max_id_expr(stmt.data.condition),
        collect_max_id_block(stmt.data.body),
      );
      if (stmt.data.else_body) {
        max_id = Math.max(max_id, collect_max_id_block(stmt.data.else_body));
      }
      return max_id;
    case "For":
      max_id = Math.max(
        max_id,
        collect_max_id_expr(stmt.data.target),
        collect_max_id_expr(stmt.data.iterable),
        collect_max_id_block(stmt.data.body),
      );
      if (stmt.data.else_body) {
        max_id = Math.max(max_id, collect_max_id_block(stmt.data.else_body));
      }
      return max_id;
    case "Match":
      max_id = Math.max(max_id, collect_max_id_expr(stmt.data.subject));
      max_id = Math.max(max_id, collect_max_id_case_block(stmt.data.cases));
      return max_id;
    case "FunctionDef":
      max_id = Math.max(
        max_id,
        collect_max_id_block(stmt.data.body),
      );
      (stmt.data.decorators ?? []).forEach((d) => {
        max_id = Math.max(max_id, collect_max_id_expr(d));
      });
      stmt.data.params.forEach((p) => {
        if (p.annotation) {
          max_id = Math.max(max_id, collect_max_id_expr(p.annotation));
        }
        if (p.default_value) {
          max_id = Math.max(max_id, collect_max_id_expr(p.default_value));
        }
      });
      if (stmt.data.return_type) {
        max_id = Math.max(max_id, collect_max_id_expr(stmt.data.return_type));
      }
      return max_id;
    case "Assign":
      max_id = Math.max(max_id, collect_max_id_expr(stmt.data.value));
      stmt.data.targets.forEach((t) => {
        max_id = Math.max(max_id, collect_max_id_expr(t));
      });
      return max_id;
    case "Expr":
      return Math.max(max_id, collect_max_id_expr(stmt.data.expr));
    case "Pass":
    case "Empty":
      return max_id;
    case "Return":
      if (stmt.data.value) {
        return Math.max(max_id, collect_max_id_expr(stmt.data.value));
      }
      return max_id;
    case "Break":
    case "Continue":
      return max_id;
    case "AugAssign":
      return Math.max(
        max_id,
        collect_max_id_expr(stmt.data.target),
        collect_max_id_expr(stmt.data.value),
      );
    case "Import":
      return max_id;
    case "Try":
      max_id = Math.max(max_id, collect_max_id_block(stmt.data.body));
      stmt.data.handlers.forEach((handler) => {
        max_id = Math.max(max_id, handler.meta.id);
        if (handler.exception_type) {
          max_id = Math.max(max_id, collect_max_id_expr(handler.exception_type));
        }
        max_id = Math.max(max_id, collect_max_id_block(handler.body));
      });
      if (stmt.data.else_body) {
        max_id = Math.max(max_id, collect_max_id_block(stmt.data.else_body));
      }
      if (stmt.data.finally_body) {
        max_id = Math.max(max_id, collect_max_id_block(stmt.data.finally_body));
      }
      return max_id;
    case "ClassDef":
      max_id = Math.max(max_id, collect_max_id_block(stmt.data.body));
      stmt.data.bases.forEach((base) => {
        max_id = Math.max(max_id, collect_max_id_expr(base));
      });
      (stmt.data.decorators ?? []).forEach((d) => {
        max_id = Math.max(max_id, collect_max_id_expr(d));
      });
      return max_id;
    case "With":
      stmt.data.items.forEach((item) => {
        max_id = Math.max(max_id, collect_max_id_expr(item.context));
      });
      stmt.data.body.forEach((s) => {
        max_id = Math.max(max_id, collect_max_id_stmt(s));
      });
      return max_id;
    case "Assert":
      max_id = Math.max(max_id, collect_max_id_expr(stmt.data.condition));
      if (stmt.data.message) {
        max_id = Math.max(max_id, collect_max_id_expr(stmt.data.message));
      }
      return max_id;
    case "Raise":
      if (stmt.data.exception) {
        max_id = Math.max(max_id, collect_max_id_expr(stmt.data.exception));
      }
      return max_id;
    case "Del":
      return Math.max(max_id, collect_max_id_expr(stmt.data.target));
    case "Global":
    case "Nonlocal":
      return max_id;
    case "AnnAssign":
      max_id = Math.max(max_id, collect_max_id_expr(stmt.data.annotation));
      if (stmt.data.value) {
        max_id = Math.max(max_id, collect_max_id_expr(stmt.data.value));
      }
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
    case "Slice": {
      let max_id = expression.data.meta.id;
      if (expression.data.lower) {
        max_id = Math.max(max_id, collect_max_id_expr(expression.data.lower));
      }
      if (expression.data.upper) {
        max_id = Math.max(max_id, collect_max_id_expr(expression.data.upper));
      }
      if (expression.data.step) {
        max_id = Math.max(max_id, collect_max_id_expr(expression.data.step));
      }
      return max_id;
    }
    case "FString": {
      let max_id = expression.data.meta.id;
      expression.data.parts.forEach((part) => {
        if (part.kind === "Expr") {
          max_id = Math.max(max_id, collect_max_id_expr(part.data));
        }
      });
      return max_id;
    }
    case "Comprehension": {
      const comp = expression.data;
      if (comp.kind === "dict") {
        const dict = comp.data;
        let max_id = Math.max(
          dict.meta.id,
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
    case "NamedExpr":
      return Math.max(
        expression.data.meta.id,
        collect_max_id_expr(expression.data.value),
      );
    case "Yield":
      return Math.max(
        expression.data.meta.id,
        expression.data.value ? collect_max_id_expr(expression.data.value) : 0,
      );
    case "YieldFrom":
      return Math.max(
        expression.data.meta.id,
        collect_max_id_expr(expression.data.value),
      );
    case "Await":
      return Math.max(
        expression.data.meta.id,
        collect_max_id_expr(expression.data.value),
      );
  }
};

const init_block = (block: Blockly.Block) => {
  if (block instanceof Blockly.BlockSvg) {
    block.initSvg();
    block.render();
  }
};

export const show_sync_error_block = () => {
  if (!workspace) {
    return;
  }
  Blockly.Events.disable();
  workspace.clear();
  const error_block = workspace.newBlock(block_type_sync_error);
  init_block(error_block);
  (error_block as Blockly.BlockSvg).moveBy(24, 24);
  workspace.cleanUp();
  Blockly.Events.enable();
  workspace.render();
  refresh_declared_variable_category();
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
  const result = create_statement_blocks_inner(statement);
  if (result) {
    set_block_span(result.first, statement.data.meta);
  }
  return result;
};

const create_statement_blocks_inner = (statement: ir_stmt) => {
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
    if (statement.data.else_body) {
      attach_statement_body(block, "ELSE_BODY", statement.data.else_body.statements);
    }
    init_block(block);
    return { first: block, last: block };
  }
  if (statement.kind === "For") {
    const block = workspace.newBlock(block_type_for);
    attach_expr_input(block, "TARGET", statement.data.target);
    attach_expr_input(block, "ITER", statement.data.iterable);
    if (statement.data.is_async) {
      block.setFieldValue("TRUE", "IS_ASYNC");
    }
    attach_statement_body(block, "BODY", statement.data.body.statements);
    if (statement.data.else_body) {
      attach_statement_body(block, "ELSE_BODY", statement.data.else_body.statements);
    }
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
  if (statement.kind === "FunctionDef") {
    const block = workspace.newBlock(block_type_function_def) as unknown as function_def_block;
    block.setFieldValue(statement.data.name, "name");
    const dec_names = (statement.data.decorators ?? []).map((d) => {
      if (d.kind === "Identifier") return d.data.name;
      if (d.kind === "Attribute") return render_expr_text(d);
      if (d.kind === "Call") return render_expr_text(d);
      return render_expr_text(d);
    });
    block.setFieldValue(dec_names.join(", "), "DECORATORS");
    block.itemCount_ = statement.data.params.length;
    block.updateShape_();
    block.setFieldValue(String(statement.data.params.length), "ARG_COUNT");
    statement.data.params.forEach((param, index) => {
      const prefix = param.kind === "star" ? "*" : param.kind === "double_star" ? "**" : "";
      let param_text = `${prefix}${param.name}`;
      if (param.annotation) {
        param_text += `: ${render_expr_text(param.annotation)}`;
      }
      if (param.default_value) {
        param_text += ` = ${render_expr_text(param.default_value)}`;
      }
      block.setFieldValue(param_text, `PARAM${index}`);
    });
    if (statement.data.return_type) {
      block.setFieldValue(render_expr_text(statement.data.return_type), "RETURN_TYPE");
    }
    if (statement.data.is_async) {
      block.setFieldValue("TRUE", "IS_ASYNC");
    }
    attach_statement_body(block, "BODY", statement.data.body.statements);
    init_block(block);
    return { first: block, last: block };
  }
  if (statement.kind === "Assign") {
    if (statement.data.targets.length === 1 && statement.data.targets[0].kind === "Identifier") {
      const block = workspace.newBlock(block_type_var_set);
      block.setFieldValue(statement.data.targets[0].data.name, "name");
      attach_expr_input(block, "VALUE", statement.data.value);
      init_block(block);
      return { first: block, last: block };
    }
    const block = workspace.newBlock(block_type_assign);
    if (statement.data.targets.length === 1) {
      attach_expr_input(block, "TARGET", statement.data.targets[0]);
    } else {
      // Multiple targets: wrap as a Tuple expression for the block
      const tuple_expr: expr = {
        kind: "Tuple",
        data: {
          meta: statement.data.meta,
          elements: statement.data.targets,
        },
      };
      attach_expr_input(block, "TARGET", tuple_expr);
    }
    attach_expr_input(block, "VALUE", statement.data.value);
    init_block(block);
    return { first: block, last: block };
  }
  if (statement.kind === "AnnAssign") {
    const block = workspace.newBlock(block_type_ann_assign);
    block.setFieldValue(statement.data.target, "TARGET");
    block.setFieldValue(render_expr_text(statement.data.annotation), "ANNOTATION");
    if (statement.data.value) {
      attach_expr_input(block, "VALUE", statement.data.value);
    }
    init_block(block);
    return { first: block, last: block };
  }
  if (statement.kind === "Expr") {
    const wait_expr = statement.data.expr;
    if (
      wait_expr.kind === "Call" &&
      wait_expr.data.callee.kind === "Identifier" &&
      wait_expr.data.callee.data.name === "sleep" &&
      wait_expr.data.args.length === 1
    ) {
      const block = workspace.newBlock(block_type_wait);
      attach_expr_input(block, "SECONDS", wait_expr.data.args[0]);
      init_block(block);
      return { first: block, last: block };
    }
    if (
      wait_expr.kind === "Call" &&
      wait_expr.data.callee.kind === "Identifier" &&
      wait_expr.data.callee.data.name === "print" &&
      wait_expr.data.args.length === 1
    ) {
      const block = workspace.newBlock(block_type_print);
      attach_expr_input(block, "VALUE", wait_expr.data.args[0]);
      init_block(block);
      return { first: block, last: block };
    }
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
  if (statement.kind === "Return") {
    const block = workspace.newBlock(block_type_return);
    if (statement.data.value) {
      attach_expr_input(block, "VALUE", statement.data.value);
    }
    init_block(block);
    return { first: block, last: block };
  }
  if (statement.kind === "Break") {
    const block = workspace.newBlock(block_type_break);
    init_block(block);
    return { first: block, last: block };
  }
  if (statement.kind === "Continue") {
    const block = workspace.newBlock(block_type_continue);
    init_block(block);
    return { first: block, last: block };
  }
  if (statement.kind === "AugAssign") {
    const block = workspace.newBlock(block_type_aug_assign);
    attach_expr_input(block, "TARGET", statement.data.target);
    block.setFieldValue(statement.data.op, "OP");
    attach_expr_input(block, "VALUE", statement.data.value);
    init_block(block);
    return { first: block, last: block };
  }
  if (statement.kind === "Import") {
    const block = workspace.newBlock(block_type_import) as unknown as import_block;
    block.setFieldValue(statement.data.is_from ? "from" : "import", "KIND");
    block.setFieldValue(statement.data.module, "MODULE");
    block.nameCount_ = statement.data.names.length;
    block.updateShape_();
    block.setFieldValue(String(statement.data.names.length), "NAME_COUNT");
    statement.data.names.forEach((name, index) => {
      const display = name.alias ? `${name.name} as ${name.alias}` : name.name;
      block.setFieldValue(display, `NAME${index}`);
    });
    init_block(block);
    return { first: block, last: block };
  }
  if (statement.kind === "Try") {
    const block = workspace.newBlock(block_type_try) as unknown as try_block;
    attach_statement_body(block, "BODY", statement.data.body.statements);
    block.handlerCount_ = statement.data.handlers.length;
    block.updateShape_();
    block.setFieldValue(String(statement.data.handlers.length), "HANDLER_COUNT");
    statement.data.handlers.forEach((handler, index) => {
      if (handler.exception_type) {
        attach_expr_input(block, `EXCEPT_TYPE${index}`, handler.exception_type);
      }
      if (handler.name) {
        block.setFieldValue(handler.name, `EXCEPT_NAME${index}`);
      }
      attach_statement_body(block, `EXCEPT_BODY${index}`, handler.body.statements);
    });
    if (statement.data.else_body) {
      attach_statement_body(block, "ELSE_BODY", statement.data.else_body.statements);
    }
    if (statement.data.finally_body) {
      attach_statement_body(block, "FINALLY_BODY", statement.data.finally_body.statements);
    }
    init_block(block);
    return { first: block, last: block };
  }
  if (statement.kind === "ClassDef") {
    const block = workspace.newBlock(block_type_class_def) as unknown as class_def_block;
    block.setFieldValue(statement.data.name, "NAME");
    const dec_names = (statement.data.decorators ?? []).map((d) => {
      if (d.kind === "Identifier") return d.data.name;
      if (d.kind === "Attribute") return render_expr_text(d);
      if (d.kind === "Call") return render_expr_text(d);
      return render_expr_text(d);
    });
    block.setFieldValue(dec_names.join(", "), "DECORATORS");
    block.baseCount_ = statement.data.bases.length;
    block.updateShape_();
    block.setFieldValue(String(statement.data.bases.length), "BASE_COUNT");
    statement.data.bases.forEach((base, index) => {
      attach_expr_input(block, `BASE${index}`, base);
    });
    attach_statement_body(block, "BODY", statement.data.body.statements);
    init_block(block);
    return { first: block, last: block };
  }
  if (statement.kind === "With") {
    const block = workspace.newBlock(block_type_with_block) as unknown as with_block;
    const count = statement.data.items.length;
    block.itemCount_ = count;
    block.updateShape_();
    block.setFieldValue(String(count), "COUNT");
    if (statement.data.is_async) {
      block.setFieldValue("TRUE", "IS_ASYNC");
    }
    statement.data.items.forEach((item, index) => {
      block.setFieldValue(item.name ?? "", `NAME${index}`);
      attach_expr_input(block as unknown as Blockly.Block, `CONTEXT${index}`, item.context);
    });
    attach_statement_body(block as unknown as Blockly.Block, "BODY", statement.data.body);
    init_block(block as unknown as Blockly.Block);
    return { first: block as unknown as Blockly.Block, last: block as unknown as Blockly.Block };
  }
  if (statement.kind === "Assert") {
    const block = workspace.newBlock(block_type_assert_stmt);
    attach_expr_input(block, "CONDITION", statement.data.condition);
    if (statement.data.message) {
      attach_expr_input(block, "MESSAGE", statement.data.message);
    }
    init_block(block);
    return { first: block, last: block };
  }
  if (statement.kind === "Raise") {
    const block = workspace.newBlock(block_type_raise_stmt);
    if (statement.data.exception) {
      attach_expr_input(block, "EXCEPTION", statement.data.exception);
    }
    init_block(block);
    return { first: block, last: block };
  }
  if (statement.kind === "Del") {
    const block = workspace.newBlock(block_type_del_stmt);
    attach_expr_input(block, "TARGET", statement.data.target);
    init_block(block);
    return { first: block, last: block };
  }
  if (statement.kind === "Global") {
    const block = workspace.newBlock(block_type_global_stmt);
    block.setFieldValue(statement.data.names.join(", "), "NAMES");
    init_block(block);
    return { first: block, last: block };
  }
  if (statement.kind === "Nonlocal") {
    const block = workspace.newBlock(block_type_nonlocal_stmt);
    block.setFieldValue(statement.data.names.join(", "), "NAMES");
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
      if (
        expression.data.callee.kind === "Identifier" &&
        expression.data.callee.data.name === "random" &&
        expression.data.args.length === 0
      ) {
        const block = workspace.newBlock(block_type_random);
        init_block(block);
        return block;
      }
      if (
        expression.data.callee.kind === "Identifier" &&
        expression.data.callee.data.name === "round" &&
        expression.data.args.length === 1
      ) {
        const block = workspace.newBlock(block_type_round);
        attach_expr_input(block, "VALUE", expression.data.args[0]);
        init_block(block);
        return block;
      }
      if (expression.data.callee.kind === "Identifier") {
        const fname = expression.data.callee.data.name;
        const args = expression.data.args;
        // range(stop) / range(start, stop) / range(start, stop, step)
        if (fname === "range" && args.length >= 1 && args.length <= 3) {
          const block = workspace.newBlock(block_type_range) as unknown as range_block;
          block.itemCount_ = args.length;
          block.updateShape_();
          block.setFieldValue(String(args.length), "COUNT");
          if (args.length === 1) {
            attach_expr_input(block, "STOP", args[0]);
          } else if (args.length === 2) {
            attach_expr_input(block, "START", args[0]);
            attach_expr_input(block, "STOP", args[1]);
          } else {
            attach_expr_input(block, "START", args[0]);
            attach_expr_input(block, "STOP", args[1]);
            attach_expr_input(block, "STEP", args[2]);
          }
          init_block(block);
          return block;
        }
        // len(obj)
        if (fname === "len" && args.length === 1) {
          const block = workspace.newBlock(block_type_len);
          attach_expr_input(block, "OBJ", args[0]);
          init_block(block);
          return block;
        }
        // input() / input(prompt)
        if (fname === "input" && args.length <= 1) {
          const block = workspace.newBlock(block_type_input);
          if (args.length === 1) {
            attach_expr_input(block, "PROMPT", args[0]);
          }
          init_block(block);
          return block;
        }
        // type conversion: int, float, str, bool, list, tuple, dict, set
        const type_convert_names = ["int", "float", "str", "bool", "list", "tuple", "dict", "set"];
        if (type_convert_names.includes(fname) && args.length === 1) {
          const block = workspace.newBlock(block_type_type_convert);
          block.setFieldValue(fname, "TYPE");
          attach_expr_input(block, "VALUE", args[0]);
          init_block(block);
          return block;
        }
        // enumerate(iterable) / enumerate(iterable, start)
        if (fname === "enumerate" && args.length >= 1 && args.length <= 2) {
          const block = workspace.newBlock(block_type_enumerate);
          attach_expr_input(block, "ITERABLE", args[0]);
          if (args.length === 2) {
            attach_expr_input(block, "START", args[1]);
          }
          init_block(block);
          return block;
        }
        // zip(iter1, iter2, ...)
        if (fname === "zip" && args.length >= 2) {
          const block = workspace.newBlock(block_type_zip) as unknown as zip_block;
          block.itemCount_ = args.length;
          block.updateShape_();
          block.setFieldValue(String(args.length), "COUNT");
          args.forEach((arg, index) => {
            attach_expr_input(block, `ITER${index}`, arg);
          });
          init_block(block);
          return block;
        }
        // sorted(iterable)
        if (fname === "sorted" && args.length === 1) {
          const block = workspace.newBlock(block_type_sorted);
          attach_expr_input(block, "ITERABLE", args[0]);
          init_block(block);
          return block;
        }
        // reversed(iterable)
        if (fname === "reversed" && args.length === 1) {
          const block = workspace.newBlock(block_type_reversed);
          attach_expr_input(block, "ITERABLE", args[0]);
          init_block(block);
          return block;
        }
        // math functions: abs, min, max, sum
        const math_func_names = ["abs", "min", "max", "sum"];
        if (math_func_names.includes(fname) && args.length === 1) {
          const block = workspace.newBlock(block_type_math_func);
          block.setFieldValue(fname, "FUNC");
          attach_expr_input(block, "VALUE", args[0]);
          init_block(block);
          return block;
        }
        // isinstance(obj, type)
        if (fname === "isinstance" && args.length === 2) {
          const block = workspace.newBlock(block_type_isinstance);
          attach_expr_input(block, "OBJ", args[0]);
          attach_expr_input(block, "TYPE", args[1]);
          init_block(block);
          return block;
        }
        // type(obj)
        if (fname === "type" && args.length === 1) {
          const block = workspace.newBlock(block_type_type_check);
          attach_expr_input(block, "OBJ", args[0]);
          init_block(block);
          return block;
        }
      }
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
    case "Slice": {
      const block = workspace.newBlock(block_type_slice);
      if (expression.data.lower) {
        attach_expr_input(block, "LOWER", expression.data.lower);
      }
      if (expression.data.upper) {
        attach_expr_input(block, "UPPER", expression.data.upper);
      }
      if (expression.data.step) {
        attach_expr_input(block, "STEP", expression.data.step);
      }
      init_block(block);
      return block;
    }
    case "FString": {
      const block = workspace.newBlock(block_type_fstring);
      const template = expression.data.parts.map(part => {
        if (part.kind === "Literal") {
          return part.data;
        }
        return "{...}";
      }).join("");
      block.setFieldValue(template, "TEMPLATE");
      init_block(block);
      return block;
    }
    case "NamedExpr": {
      const block = workspace.newBlock(block_type_named_expr);
      block.setFieldValue(expression.data.name, "NAME");
      attach_expr_input(block, "VALUE", expression.data.value);
      init_block(block);
      return block;
    }
    case "Yield": {
      const block = workspace.newBlock(block_type_yield_expr);
      if (expression.data.value) {
        attach_expr_input(block, "VALUE", expression.data.value);
      }
      init_block(block);
      return block;
    }
    case "YieldFrom": {
      const block = workspace.newBlock(block_type_yield_from_expr);
      attach_expr_input(block, "VALUE", expression.data.value);
      init_block(block);
      return block;
    }
    case "Await": {
      const block = workspace.newBlock(block_type_await_expr);
      attach_expr_input(block, "VALUE", expression.data.value);
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

export const ir_from_blocks = (): ir_program => {
  last_ir_json = null;
  if (!workspace) {
    return {
      meta: make_meta(),
      indent_width: 2,
      body: [],
      token_store: null,
      dirty: true,
    };
  }
  const top_blocks = workspace.getTopBlocks(true);
  const event_blocks = top_blocks.filter(
    (block) => block.type === block_type_event_start,
  );
  if (event_blocks.length > 1) {
    throw new Error("startブロックは1つだけ配置");
  }
  if (event_blocks.length === 1) {
    const statement_top_blocks = top_blocks.filter(
      (block) => block.type !== block_type_event_start && block.previousConnection !== null,
    );
    if (statement_top_blocks.length > 0) {
      throw new Error("startブロック以外のトップレベルは配置不可");
    }
    const event_block = event_blocks[0];
    const statements = statements_from_chain(
      event_block.getInputTargetBlock("BODY"),
    );
    return {
      meta: make_meta(),
      indent_width: 2,
      body: statements,
      token_store: null,
      dirty: true,
    };
  }
  const sorted = [...top_blocks].sort(
    (left, right) =>
      left.getRelativeToSurfaceXY().y - right.getRelativeToSurfaceXY().y,
  );
  const statements: ir_stmt[] = [];
  sorted.forEach((block) => {
    statements.push(...statements_from_chain(block));
  });
  return {
    meta: make_meta(),
    indent_width: 2,
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
    case block_type_while: {
      const else_target = block.getInputTargetBlock("ELSE_BODY");
      return {
        kind: "While",
        data: {
          meta: make_meta(),
          condition: expr_from_input(block, "COND"),
          body: block_from_statements(block.getInputTargetBlock("BODY")),
          else_body: else_target ? block_from_statements(else_target) : null,
        },
      };
    }
    case block_type_for: {
      const else_target = block.getInputTargetBlock("ELSE_BODY");
      return {
        kind: "For",
        data: {
          meta: make_meta(),
          target: expr_from_input(block, "TARGET"),
          iterable: expr_from_input(block, "ITER"),
          body: block_from_statements(block.getInputTargetBlock("BODY")),
          else_body: else_target ? block_from_statements(else_target) : null,
          is_async: block.getFieldValue("IS_ASYNC") === "TRUE",
        },
      };
    }
    case block_type_match:
      return {
        kind: "Match",
        data: {
          meta: make_meta(),
          subject: expr_from_input(block, "SUBJECT"),
          cases: cases_from_chain(block.getInputTargetBlock("CASES")),
        },
      };
    case block_type_function_def: {
      const def_block = block as unknown as function_def_block;
      const count = def_block.itemCount_;
      const params: ir_func_param[] = [];
      for (let index = 0; index < count; index += 1) {
        let raw = (def_block.getFieldValue(`PARAM${index}`) ?? "").trim();
        if (raw.length > 0) {
          let kind: "normal" | "star" | "double_star" = "normal";
          if (raw.startsWith("**")) {
            kind = "double_star";
            raw = raw.substring(2).trim();
          } else if (raw.startsWith("*")) {
            kind = "star";
            raw = raw.substring(1).trim();
          }
          let default_value: expr | null = null;
          const eq_index = raw.indexOf("=");
          if (eq_index >= 0) {
            const def_text = raw.substring(eq_index + 1).trim();
            raw = raw.substring(0, eq_index).trim();
            if (def_text.length > 0) {
              default_value = { kind: "Identifier", data: { meta: make_meta(), name: def_text } };
            }
          }
          const colon_index = raw.indexOf(":");
          if (colon_index >= 0) {
            const param_name = raw.substring(0, colon_index).trim();
            const ann_text = raw.substring(colon_index + 1).trim();
            params.push({
              name: param_name,
              annotation: ann_text.length > 0
                ? { kind: "Identifier", data: { meta: make_meta(), name: ann_text } }
                : null,
              default_value,
              kind,
            });
          } else {
            params.push({ name: raw, annotation: null, default_value, kind });
          }
        }
      }
      const return_type_text = (def_block.getFieldValue("RETURN_TYPE") ?? "").trim();
      const return_type: expr | null = return_type_text.length > 0
        ? { kind: "Identifier", data: { meta: make_meta(), name: return_type_text } }
        : null;
      return {
        kind: "FunctionDef",
        data: {
          meta: make_meta(),
          name: def_block.getFieldValue("name") ?? "fn",
          params,
          decorators: parse_decorators_field(def_block.getFieldValue("DECORATORS") ?? ""),
          body: block_from_statements(block.getInputTargetBlock("BODY")),
          return_type,
          is_async: def_block.getFieldValue("IS_ASYNC") === "TRUE",
        },
      };
    }
    case block_type_wait:
      return {
        kind: "Expr",
        data: {
          meta: make_meta(),
          expr: {
            kind: "Call",
            data: {
              meta: make_meta(),
              callee: {
                kind: "Identifier",
                data: { meta: make_meta(), name: "sleep" },
              },
              args: [expr_from_input(block, "SECONDS")],
              kwargs: [],
            },
          },
        },
      };
    case block_type_print:
      return {
        kind: "Expr",
        data: {
          meta: make_meta(),
          expr: {
            kind: "Call",
            data: {
              meta: make_meta(),
              callee: {
                kind: "Identifier",
                data: { meta: make_meta(), name: "print" },
              },
              args: [expr_from_input(block, "VALUE")],
              kwargs: [],
            },
          },
        },
      };
    case block_type_var_set:
      return {
        kind: "Assign",
        data: {
          meta: make_meta(),
          targets: [{
            kind: "Identifier",
            data: { meta: make_meta(), name: block.getFieldValue("name") ?? "" },
          }],
          value: expr_from_input(block, "VALUE"),
        },
      };
    case block_type_assign: {
      const target_expr = expr_from_input(block, "TARGET");
      const targets: expr[] = target_expr.kind === "Tuple"
        ? target_expr.data.elements
        : [target_expr];
      return {
        kind: "Assign",
        data: {
          meta: make_meta(),
          targets,
          value: expr_from_input(block, "VALUE"),
        },
      };
    }
    case block_type_ann_assign: {
      const value_block = block.getInputTargetBlock("VALUE");
      const ann_text = (block.getFieldValue("ANNOTATION") ?? "int").trim();
      return {
        kind: "AnnAssign",
        data: {
          meta: make_meta(),
          target: block.getFieldValue("TARGET") ?? "x",
          annotation: { kind: "Identifier", data: { meta: make_meta(), name: ann_text } } as expr,
          value: value_block ? expr_from_input(block, "VALUE") : null,
        },
      };
    }
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
    case block_type_return: {
      const value_block = block.getInputTargetBlock("VALUE");
      return {
        kind: "Return",
        data: {
          meta: make_meta(),
          value: value_block ? expr_from_block(value_block) : null,
        },
      };
    }
    case block_type_break:
      return {
        kind: "Break",
        data: { meta: make_meta() },
      };
    case block_type_continue:
      return {
        kind: "Continue",
        data: { meta: make_meta() },
      };
    case block_type_aug_assign:
      return {
        kind: "AugAssign",
        data: {
          meta: make_meta(),
          target: expr_from_input(block, "TARGET"),
          op: block.getFieldValue("OP") ?? "plus_assign",
          value: expr_from_input(block, "VALUE"),
        },
      };
    case block_type_import: {
      const imp_block = block as unknown as import_block;
      const kind_value = block.getFieldValue("KIND") ?? "import";
      const is_from = kind_value === "from";
      const module_name = block.getFieldValue("MODULE") ?? "module";
      const name_count = imp_block.nameCount_;
      const names: import_name[] = [];
      for (let i = 0; i < name_count; i++) {
        const raw = (block.getFieldValue(`NAME${i}`) ?? "").trim();
        if (raw.length > 0) {
          const parts = raw.split(/\s+as\s+/);
          names.push({
            name: parts[0],
            alias: parts.length > 1 ? parts[1] : null,
          });
        }
      }
      return {
        kind: "Import",
        data: {
          meta: make_meta(),
          module: module_name,
          names,
          is_from,
        },
      };
    }
    case block_type_try: {
      const t_block = block as unknown as try_block;
      const handler_count = t_block.handlerCount_;
      const handlers: ir_except_handler[] = [];
      for (let i = 0; i < handler_count; i++) {
        const type_block = block.getInputTargetBlock(`EXCEPT_TYPE${i}`);
        const name_val = block.getFieldValue(`EXCEPT_NAME${i}`) ?? "";
        handlers.push({
          meta: make_meta(),
          exception_type: type_block ? expr_from_block(type_block) : null,
          name: name_val.trim().length > 0 ? name_val.trim() : null,
          body: block_from_statements(block.getInputTargetBlock(`EXCEPT_BODY${i}`)),
        });
      }
      const else_target = block.getInputTargetBlock("ELSE_BODY");
      const finally_target = block.getInputTargetBlock("FINALLY_BODY");
      return {
        kind: "Try",
        data: {
          meta: make_meta(),
          body: block_from_statements(block.getInputTargetBlock("BODY")),
          handlers,
          else_body: else_target ? block_from_statements(else_target) : null,
          finally_body: finally_target ? block_from_statements(finally_target) : null,
        },
      };
    }
    case block_type_class_def: {
      const cls_block = block as unknown as class_def_block;
      const base_count = cls_block.baseCount_;
      const bases: expr[] = [];
      for (let i = 0; i < base_count; i++) {
        bases.push(expr_from_input(block, `BASE${i}`));
      }
      return {
        kind: "ClassDef",
        data: {
          meta: make_meta(),
          name: block.getFieldValue("NAME") ?? "MyClass",
          bases,
          decorators: parse_decorators_field(cls_block.getFieldValue("DECORATORS") ?? ""),
          body: block_from_statements(block.getInputTargetBlock("BODY")),
        },
      };
    }
    case block_type_with_block: {
      const wb = block as unknown as with_block;
      const items: ir_context_item[] = [];
      for (let i = 0; i < wb.itemCount_; i += 1) {
        const name_val = wb.getFieldValue(`NAME${i}`) as string;
        items.push({
          context: expr_from_input(block, `CONTEXT${i}`),
          name: name_val && name_val.trim() !== "" ? name_val.trim() : null,
        });
      }
      return {
        kind: "With",
        data: {
          meta: make_meta(),
          items,
          body: statements_from_chain(block.getInputTargetBlock("BODY")),
          is_async: wb.getFieldValue("IS_ASYNC") === "TRUE",
        },
      };
    }
    case block_type_assert_stmt: {
      const msg_block = block.getInputTargetBlock("MESSAGE");
      return {
        kind: "Assert",
        data: {
          meta: make_meta(),
          condition: expr_from_input(block, "CONDITION"),
          message: msg_block ? expr_from_block(msg_block) : null,
        },
      };
    }
    case block_type_raise_stmt: {
      const exc_block = block.getInputTargetBlock("EXCEPTION");
      return {
        kind: "Raise",
        data: {
          meta: make_meta(),
          exception: exc_block ? expr_from_block(exc_block) : null,
        },
      };
    }
    case block_type_del_stmt:
      return {
        kind: "Del",
        data: {
          meta: make_meta(),
          target: expr_from_input(block, "TARGET"),
        },
      };
    case block_type_global_stmt: {
      const names_str = (block.getFieldValue("NAMES") as string) || "";
      return {
        kind: "Global",
        data: {
          meta: make_meta(),
          names: names_str.split(",").map((s: string) => s.trim()).filter((s: string) => s !== ""),
        },
      };
    }
    case block_type_nonlocal_stmt: {
      const names_str = (block.getFieldValue("NAMES") as string) || "";
      return {
        kind: "Nonlocal",
        data: {
          meta: make_meta(),
          names: names_str.split(",").map((s: string) => s.trim()).filter((s: string) => s !== ""),
        },
      };
    }
    case block_type_sync_error:
      throw new Error("同期エラーのため変換不可");
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

const default_identifier_expr = (): expr => ({
  kind: "Identifier",
  data: { meta: make_meta(), name: "_" },
});

const expr_from_input = (block: Blockly.Block, input_name: string): expr => {
  const target = block.getInputTargetBlock(input_name);
  if (!target) {
    return default_identifier_expr();
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
    case block_type_string: {
      const str_value = block.getFieldValue("value") ?? "";
      const needs_escape = str_value.includes("'") || str_value.includes("\\");
      const escaped_value = str_value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
      return {
        kind: "Literal",
        data: {
          meta: make_meta(),
          literal: {
            kind: "String",
            data: {
              raw: `'${escaped_value}'`,
              value: str_value,
              quote: "single",
              escaped: needs_escape,
            },
          },
        },
      };
    }
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
          values.push(default_identifier_expr());
        } else {
          values.push(expr_from_block(input.connection.targetBlock() as Blockly.Block));
        }
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
          comparators.push(default_identifier_expr());
        } else {
          comparators.push(expr_from_block(input.connection.targetBlock() as Blockly.Block));
        }
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
    case block_type_random:
      return {
        kind: "Call",
        data: {
          meta: make_meta(),
          callee: {
            kind: "Identifier",
            data: { meta: make_meta(), name: "random" },
          },
          args: [],
          kwargs: [],
        },
      };
    case block_type_round:
      return {
        kind: "Call",
        data: {
          meta: make_meta(),
          callee: {
            kind: "Identifier",
            data: { meta: make_meta(), name: "round" },
          },
          args: [expr_from_input(block, "VALUE")],
          kwargs: [],
        },
      };
    case block_type_range: {
      const rb = block as unknown as range_block;
      const range_args: expr[] = [];
      if (rb.itemCount_ === 1) {
        range_args.push(expr_from_input(block, "STOP"));
      } else if (rb.itemCount_ === 2) {
        range_args.push(expr_from_input(block, "START"));
        range_args.push(expr_from_input(block, "STOP"));
      } else {
        range_args.push(expr_from_input(block, "START"));
        range_args.push(expr_from_input(block, "STOP"));
        range_args.push(expr_from_input(block, "STEP"));
      }
      return {
        kind: "Call",
        data: {
          meta: make_meta(),
          callee: { kind: "Identifier", data: { meta: make_meta(), name: "range" } },
          args: range_args,
          kwargs: [],
        },
      };
    }
    case block_type_len:
      return {
        kind: "Call",
        data: {
          meta: make_meta(),
          callee: { kind: "Identifier", data: { meta: make_meta(), name: "len" } },
          args: [expr_from_input(block, "OBJ")],
          kwargs: [],
        },
      };
    case block_type_input: {
      const input_args: expr[] = [];
      const prompt_target = block.getInputTargetBlock("PROMPT");
      if (prompt_target) {
        input_args.push(expr_from_block(prompt_target));
      }
      return {
        kind: "Call",
        data: {
          meta: make_meta(),
          callee: { kind: "Identifier", data: { meta: make_meta(), name: "input" } },
          args: input_args,
          kwargs: [],
        },
      };
    }
    case block_type_type_convert:
      return {
        kind: "Call",
        data: {
          meta: make_meta(),
          callee: {
            kind: "Identifier",
            data: { meta: make_meta(), name: block.getFieldValue("TYPE") ?? "int" },
          },
          args: [expr_from_input(block, "VALUE")],
          kwargs: [],
        },
      };
    case block_type_enumerate: {
      const enum_args: expr[] = [expr_from_input(block, "ITERABLE")];
      const start_target = block.getInputTargetBlock("START");
      if (start_target) {
        enum_args.push(expr_from_block(start_target));
      }
      return {
        kind: "Call",
        data: {
          meta: make_meta(),
          callee: { kind: "Identifier", data: { meta: make_meta(), name: "enumerate" } },
          args: enum_args,
          kwargs: [],
        },
      };
    }
    case block_type_zip: {
      const zb = block as unknown as zip_block;
      const zip_args: expr[] = [];
      for (let i = 0; i < zb.itemCount_; i += 1) {
        const input = zb.getInput(`ITER${i}`);
        if (!input?.connection?.targetBlock()) {
          zip_args.push(default_identifier_expr());
        } else {
          zip_args.push(expr_from_block(input.connection.targetBlock() as Blockly.Block));
        }
      }
      return {
        kind: "Call",
        data: {
          meta: make_meta(),
          callee: { kind: "Identifier", data: { meta: make_meta(), name: "zip" } },
          args: zip_args,
          kwargs: [],
        },
      };
    }
    case block_type_sorted:
      return {
        kind: "Call",
        data: {
          meta: make_meta(),
          callee: { kind: "Identifier", data: { meta: make_meta(), name: "sorted" } },
          args: [expr_from_input(block, "ITERABLE")],
          kwargs: [],
        },
      };
    case block_type_reversed:
      return {
        kind: "Call",
        data: {
          meta: make_meta(),
          callee: { kind: "Identifier", data: { meta: make_meta(), name: "reversed" } },
          args: [expr_from_input(block, "ITERABLE")],
          kwargs: [],
        },
      };
    case block_type_math_func:
      return {
        kind: "Call",
        data: {
          meta: make_meta(),
          callee: {
            kind: "Identifier",
            data: { meta: make_meta(), name: block.getFieldValue("FUNC") ?? "abs" },
          },
          args: [expr_from_input(block, "VALUE")],
          kwargs: [],
        },
      };
    case block_type_isinstance:
      return {
        kind: "Call",
        data: {
          meta: make_meta(),
          callee: { kind: "Identifier", data: { meta: make_meta(), name: "isinstance" } },
          args: [expr_from_input(block, "OBJ"), expr_from_input(block, "TYPE")],
          kwargs: [],
        },
      };
    case block_type_type_check:
      return {
        kind: "Call",
        data: {
          meta: make_meta(),
          callee: { kind: "Identifier", data: { meta: make_meta(), name: "type" } },
          args: [expr_from_input(block, "OBJ")],
          kwargs: [],
        },
      };
    case block_type_call: {
      const call_block = block as unknown as call_block;
      const args: expr[] = [];
      for (let index = 0; index < call_block.itemCount_; index += 1) {
        const input = call_block.getInput(`ARG${index}`);
        if (!input?.connection?.targetBlock()) {
          args.push(default_identifier_expr());
        } else {
          args.push(expr_from_block(input.connection.targetBlock() as Blockly.Block));
        }
      }
      return {
        kind: "Call",
        data: {
          meta: make_meta(),
          callee: expr_from_input(block, "CALLEE"),
          args,
          kwargs: [],
        },
      };
    }
    case block_type_tuple: {
      const tuple = block as unknown as tuple_block;
      const elements: expr[] = [];
      for (let index = 0; index < tuple.itemCount_; index += 1) {
        const input = tuple.getInput(`ITEM${index}`);
        if (!input?.connection?.targetBlock()) {
          elements.push(default_identifier_expr());
        } else {
          elements.push(expr_from_block(input.connection.targetBlock() as Blockly.Block));
        }
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
          elements.push(default_identifier_expr());
        } else {
          elements.push(expr_from_block(input.connection.targetBlock() as Blockly.Block));
        }
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
        entries.push({
          meta: make_meta(),
          key: key_input?.connection?.targetBlock()
            ? expr_from_block(key_input.connection.targetBlock() as Blockly.Block)
            : default_identifier_expr(),
          value: value_input?.connection?.targetBlock()
            ? expr_from_block(value_input.connection.targetBlock() as Blockly.Block)
            : default_identifier_expr(),
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
          elements.push(default_identifier_expr());
        } else {
          elements.push(expr_from_block(input.connection.targetBlock() as Blockly.Block));
        }
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
        return {
          kind: "Comprehension",
          data: {
            kind: "dict",
            data: {
              meta: make_meta(),
              key: default_identifier_expr(),
              value: element,
              fors: [],
            },
          },
        };
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
            ifs.push(default_identifier_expr());
          } else {
            ifs.push(expr_from_block(input.connection.targetBlock() as Blockly.Block));
          }
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
    case block_type_slice: {
      const lower_block = block.getInputTargetBlock("LOWER");
      const upper_block = block.getInputTargetBlock("UPPER");
      const step_block = block.getInputTargetBlock("STEP");
      return {
        kind: "Slice",
        data: {
          meta: make_meta(),
          lower: lower_block ? expr_from_block(lower_block) : null,
          upper: upper_block ? expr_from_block(upper_block) : null,
          step: step_block ? expr_from_block(step_block) : null,
        },
      };
    }
    case block_type_fstring: {
      const template = block.getFieldValue("TEMPLATE") ?? "";
      const parts: fstring_part[] = [{ kind: "Literal" as const, data: template }];
      return {
        kind: "FString",
        data: {
          meta: make_meta(),
          parts,
          quote: "double" as const,
        },
      };
    }
    case block_type_named_expr:
      return {
        kind: "NamedExpr",
        data: {
          meta: make_meta(),
          name: block.getFieldValue("NAME") ?? "",
          value: expr_from_input(block, "VALUE"),
        },
      };
    case block_type_yield_expr: {
      const value_block = block.getInputTargetBlock("VALUE");
      return {
        kind: "Yield",
        data: {
          meta: make_meta(),
          value: value_block ? expr_from_block(value_block) : null,
        },
      };
    }
    case block_type_yield_from_expr:
      return {
        kind: "YieldFrom",
        data: {
          meta: make_meta(),
          value: expr_from_input(block, "VALUE"),
        },
      };
    case block_type_await_expr:
      return {
        kind: "Await",
        data: {
          meta: make_meta(),
          value: expr_from_input(block, "VALUE"),
        },
      };
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

let last_ir_json: string | null = null;

export const blocks_from_ir = (ir: ir_program) => {
  if (!workspace) {
    return;
  }
  const ir_json = JSON.stringify(ir.body);
  if (ir_json === last_ir_json) {
    return;
  }
  last_ir_json = ir_json;
  Blockly.Events.disable();
  const metrics = workspace.getMetrics();
  const scroll_x = metrics?.viewLeft ?? 0;
  const scroll_y = metrics?.viewTop ?? 0;
  const scale = workspace.scale;
  workspace.clear();
  const entry_block = workspace.newBlock(block_type_event_start);
  attach_statement_body(entry_block, "BODY", ir.body);
  init_block(entry_block);
  (entry_block as Blockly.BlockSvg).moveBy(24, 24);
  workspace.cleanUp();
  Blockly.Events.enable();
  workspace.scale = scale;
  workspace.scroll(scroll_x, scroll_y);
  workspace.render();
  refresh_declared_variable_category();
};
