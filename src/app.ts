import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import * as Blockly from "blockly";
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, Decoration, type DecorationSet } from "@codemirror/view";
import { EditorState, Compartment, StateEffect, StateField } from "@codemirror/state";
import { python } from "@codemirror/lang-python";
import { defaultKeymap, indentWithTab, history, historyKeymap } from "@codemirror/commands";
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, HighlightStyle, syntaxTree } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { oneDark } from "@codemirror/theme-one-dark";
import { autocompletion, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import type { ir_program, run_result, run_output, theme_mode } from "./types";
import { t, set_language, get_language, get_easy_mode, set_easy_mode, type Language } from "./i18n";
import {
  blockly_theme_dark,
  blockly_theme_light,
  build_declared_variable_category,
  build_declared_function_category,
  declared_variables_category_key,
  declared_functions_category_key,
  register_blocks,
  get_toolbox,
} from "./blockly_config";
import {
  blocks_from_ir,
  clear_ir_cache,
  get_block_span,
  get_workspace,
  ir_from_blocks,
  refresh_declared_variable_category,
  set_workspace,
  update_node_counter,
} from "./blockly_convert";

const workspace_container_id = "blockly_workspace";
const local_storage_source_key = "lebl_python_source";
const local_storage_theme_key = "lebl_theme_mode";

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

let cm_editor: EditorView | null = null;
const theme_compartment = new Compartment();
let output_console: HTMLPreElement | null = null;
let theme_toggle_button: HTMLButtonElement | null = null;
let save_button: HTMLButtonElement | null = null;
let load_button: HTMLButtonElement | null = null;
let run_button: HTMLButtonElement | null = null;
let stop_button: HTMLButtonElement | null = null;
let help_button: HTMLButtonElement | null = null;
let help_modal_overlay: HTMLElement | null = null;
let language_toggle_button: HTMLButtonElement | null = null;
let easy_mode_toggle_button: HTMLButtonElement | null = null;
let is_syncing = false;
let is_running = false;
let stream_unlisten: UnlistenFn | null = null;
let current_theme: theme_mode = "light";
let code_sync_timer: ReturnType<typeof setTimeout> | null = null;
let blocks_sync_timer: ReturnType<typeof setTimeout> | null = null;
let source_save_timer: ReturnType<typeof setTimeout> | null = null;
let resize_frame: number | null = null;
let pending_code_sync: string | null = null;
let pending_source_save: string | null = null;
let pending_blocks_sync = false;
let current_file_path: string | null = null;
const code_sync_delay_ms = 400;
const blocks_sync_delay_ms = 200;
const source_save_delay_ms = 500;
const max_output_lines = 1000;
const min_pane_width = 240;
const min_output_height = 120;
const min_editor_height = 220;

interface FileTab {
  id: string;
  name: string;
  path: string | null;
  code: string;
  dirty: boolean;
}

let tabs: FileTab[] = [];
let active_tab_id: string | null = null;
let tab_counter = 0;

const generate_tab_id = (): string => `tab_${Date.now()}_${tab_counter++}`;

const get_active_tab = (): FileTab | null =>
  tabs.find((t) => t.id === active_tab_id) ?? null;

const update_active_tab_code = () => {
  const tab = get_active_tab();
  if (tab) {
    const code = get_editor_value();
    if (tab.code !== code) {
      tab.dirty = true;
      tab.code = code;
    }
  }
};

const render_tabs = () => {
  const tab_list = document.getElementById("tab_list");
  if (!tab_list) return;
  tab_list.innerHTML = "";
  for (const tab of tabs) {
    const el = document.createElement("div");
    el.className = "tab_item" + (tab.id === active_tab_id ? " active" : "") + (tab.dirty ? " dirty" : "");
    el.dataset.tabId = tab.id;

    const name_span = document.createElement("span");
    name_span.className = "tab_name";
    name_span.textContent = tab.name;
    el.appendChild(name_span);

    const close_btn = document.createElement("button");
    close_btn.className = "tab_close";
    close_btn.textContent = "×";
    close_btn.title = t("btn_close");
    close_btn.addEventListener("click", (e) => {
      e.stopPropagation();
      close_tab(tab.id);
    });
    el.appendChild(close_btn);

    el.addEventListener("click", () => switch_tab(tab.id));
    tab_list.appendChild(el);
  }
};

const create_tab = (name?: string, code?: string, path?: string | null): FileTab => {
  const tab_name = name ?? `untitled_${tab_counter}.py`;
  const tab: FileTab = {
    id: generate_tab_id(),
    name: tab_name,
    path: path ?? null,
    code: code ?? "",
    dirty: false,
  };
  tabs.push(tab);
  switch_tab(tab.id);
  return tab;
};

const switch_tab = (tab_id: string) => {
  if (active_tab_id === tab_id) return;
  update_active_tab_code();
  active_tab_id = tab_id;
  const tab = get_active_tab();
  if (tab) {
    current_file_path = tab.path;
    set_editor_value(tab.code);
    schedule_code_sync(tab.code);
  }
  render_tabs();
};

const close_tab = (tab_id: string) => {
  const tab = tabs.find((t) => t.id === tab_id);
  if (!tab) return;
  if (tab.dirty) {
    if (!confirm(`「${tab.name}」${t("confirm_close_unsaved")}`)) return;
  }
  const idx = tabs.indexOf(tab);
  tabs.splice(idx, 1);
  if (tabs.length === 0) {
    create_tab("main.py", default_source_code);
    return;
  }
  if (active_tab_id === tab_id) {
    const new_idx = Math.min(idx, tabs.length - 1);
    active_tab_id = null; // reset so switch_tab will proceed
    switch_tab(tabs[new_idx].id);
  } else {
    render_tabs();
  }
};

const get_editor_value = (): string => cm_editor?.state.doc.toString() ?? "";

const set_editor_value = (value: string) => {
  if (!cm_editor) return;
  const current = cm_editor.state.doc.toString();
  if (current === value) return;
  cm_editor.dispatch({
    changes: { from: 0, to: current.length, insert: value },
  });
};

const set_error_effect = StateEffect.define<{ line: number } | null>();
const error_line_decoration = Decoration.line({ class: "cm-error-line" });
const error_line_field = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(decorations, tr) {
    for (const effect of tr.effects) {
      if (effect.is(set_error_effect)) {
        if (effect.value === null) {
          return Decoration.none;
        }
        const line_num = effect.value.line;
        if (line_num >= 1 && line_num <= tr.state.doc.lines) {
          const line = tr.state.doc.line(line_num);
          return Decoration.set([error_line_decoration.range(line.from)]);
        }
        return Decoration.none;
      }
    }
    return decorations;
  },
  provide: (field) => EditorView.decorations.from(field),
});

const set_error_line = (line: number | null) => {
  if (!cm_editor) return;
  cm_editor.dispatch({
    effects: set_error_effect.of(line !== null ? { line } : null),
  });
};

const set_highlight_effect = StateEffect.define<{ from: number; to: number } | null>();
const highlight_line_decoration = Decoration.line({ class: "cm-highlight-line" });
const highlight_line_field = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(decorations, tr) {
    for (const effect of tr.effects) {
      if (effect.is(set_highlight_effect)) {
        if (effect.value === null) {
          return Decoration.none;
        }
        const { from, to } = effect.value;
        const lines: ReturnType<typeof highlight_line_decoration.range>[] = [];
        for (let l = from; l <= to && l <= tr.state.doc.lines; l++) {
          if (l >= 1) {
            const line = tr.state.doc.line(l);
            lines.push(highlight_line_decoration.range(line.from));
          }
        }
        return Decoration.set(lines);
      }
    }
    return decorations;
  },
  provide: (field) => EditorView.decorations.from(field),
});

const parse_error_parts = (error_string: string): { line: number; col: number; message: string } | null => {
  const match = error_string.match(/line (\d+):(\d+)\s+(.*)/);
  if (!match) return null;
  return { line: parseInt(match[1], 10), col: parseInt(match[2], 10), message: match[3] };
};

const parse_python_to_ir = async (source: string) =>
  invoke<ir_program>("parse_python_to_ir", { source });

const generate_python_from_ir = async (ir: ir_program) =>
  invoke<string>("generate_python_from_ir", {
    ir,
    renderMode: "Lossless",
  });

const show_sync_error = (error_str: string) => {
  const overlay = document.getElementById("sync_error_overlay");
  const blocker = document.getElementById("blockly_blocker");
  if (!overlay) return;
  overlay.textContent = "";
  const title_div = document.createElement("div");
  title_div.className = "sync_error_title";
  title_div.textContent = t("error_sync");
  const detail_div = document.createElement("div");
  detail_div.className = "sync_error_detail";
  const parts = parse_error_parts(error_str);
  if (parts) {
    detail_div.textContent = t("error_sync_detail")
      .replace("{line}", String(parts.line))
      .replace("{col}", String(parts.col))
      .replace("{message}", parts.message);
  } else {
    detail_div.textContent = error_str;
  }
  overlay.appendChild(title_div);
  overlay.appendChild(detail_div);
  overlay.hidden = false;
  if (blocker) blocker.hidden = false;
};

const hide_sync_error = () => {
  const overlay = document.getElementById("sync_error_overlay");
  const blocker = document.getElementById("blockly_blocker");
  if (overlay) overlay.hidden = true;
  if (blocker) blocker.hidden = true;
};

const run_python = async (source: string) =>
  invoke<run_result>("run_python", { source });

const stop_python = async () =>
  invoke<string>("stop_python");

const set_output = (text: string) => {
  if (output_console) {
    output_console.textContent = "";
    output_console.appendChild(document.createTextNode(text));
  }
};

const trim_output = () => {
  if (!output_console) return;
  while (output_console.childNodes.length > max_output_lines) {
    const first_child = output_console.firstChild;
    if (!first_child) break;
    output_console.removeChild(first_child);
  }
};

const append_output = (text: string, css_class?: string) => {
  if (!output_console) return;
  const span = document.createElement("span");
  if (css_class) span.className = css_class;
  span.textContent = text + "\n";
  output_console.appendChild(span);
  trim_output();
  output_console.scrollTop = output_console.scrollHeight;
};

const set_running_state = (running: boolean) => {
  is_running = running;
  if (run_button) {
    run_button.disabled = running;
    run_button.style.opacity = running ? "0.5" : "";
  }
  if (stop_button) {
    stop_button.disabled = !running;
    stop_button.style.opacity = running ? "" : "0.5";
  }
};

const apply_theme = (theme: theme_mode) => {
  current_theme = theme;
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(local_storage_theme_key, theme);
  const workspace = get_workspace();
  if (workspace) {
    workspace.setTheme(theme === "dark" ? blockly_theme_dark : blockly_theme_light);
    Blockly.svgResize(workspace);
  }
  if (cm_editor) {
    cm_editor.dispatch({
      effects: theme_compartment.reconfigure(
        theme === "dark" ? oneDark : [],
      ),
    });
  }
  if (theme_toggle_button) {
    theme_toggle_button.textContent = theme === "dark" ? t("theme_light") : t("theme_dark");
  }
};

const ensure_workspace = () => {
  if (get_workspace()) {
    return;
  }
  const workspace = Blockly.inject(workspace_container_id, {
    toolbox: get_toolbox(),
    media: "./media/",
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
  workspace.registerToolboxCategoryCallback(
    declared_variables_category_key,
    build_declared_variable_category,
  );
  workspace.registerToolboxCategoryCallback(
    declared_functions_category_key,
    build_declared_function_category,
  );

  // Fix flyout scale to 1 so toolbox menu doesn't resize with zoom
  const flyout = workspace.getFlyout();
  if (flyout) {
    (flyout as any).getFlyoutScale = () => 1;
    flyout.autoClose = false;
  }

  // Only close flyout when clicking the already-selected toolbox category
  const toolbox = workspace.getToolbox();
  if (toolbox) {
    const orig_setSelectedItem = (toolbox as any).setSelectedItem.bind(toolbox);
    (toolbox as any).setSelectedItem = (newItem: any) => {
      const oldItem = (toolbox as any).selectedItem_;
      if (oldItem && oldItem === newItem) {
        // Same category clicked — toggle closed
        (toolbox as any).deselectItem_(oldItem);
        flyout?.setVisible(false);
        return;
      }
      if (!newItem) {
        // Null selection (e.g. workspace click) — keep flyout open
        return;
      }
      orig_setSelectedItem(newItem);
    };
  }

  set_workspace(workspace);
};

const sync_code_to_blocks = async (source: string) => {
  if (is_syncing) {
    pending_code_sync = source;
    return;
  }
  is_syncing = true;
  try {
    const ir = await parse_python_to_ir(source);
    update_node_counter(ir);
    blocks_from_ir(ir);
    set_error_line(null);
    hide_sync_error();
  } catch (error) {
    const error_str = String(error);
    set_output(`${t("error_sync")}: ${error_str}`);
    const parts = parse_error_parts(error_str);
    set_error_line(parts?.line ?? null);
    show_sync_error(error_str);
  } finally {
    is_syncing = false;
    if (pending_code_sync !== null) {
      const next_source = pending_code_sync;
      pending_code_sync = null;
      sync_code_to_blocks(next_source);
    }
  }
};

const sync_blocks_to_code = async () => {
  if (is_syncing || !cm_editor) {
    pending_blocks_sync = true;
    return;
  }
  is_syncing = true;
  try {
    const ir = ir_from_blocks();
    const source = await generate_python_from_ir(ir);
    const current = get_editor_value();
    if (current !== source) {
      set_editor_value(source);
      schedule_source_save(source);
    }
  } catch (error) {
    set_output(`${t("error_sync")}: ${String(error)}`);
  } finally {
    is_syncing = false;
    if (pending_blocks_sync) {
      pending_blocks_sync = false;
      sync_blocks_to_code();
    }
  }
};

/** Force a code→blocks rebuild (used when block labels change). */
const trigger_code_to_blocks_sync = () => {
  clear_ir_cache();
  const source = get_editor_value();
  sync_code_to_blocks(source);
};

const flush_source_save = () => {
  if (source_save_timer !== null) {
    clearTimeout(source_save_timer);
    source_save_timer = null;
  }
  if (pending_source_save !== null) {
    localStorage.setItem(local_storage_source_key, pending_source_save);
    pending_source_save = null;
  }
};

const schedule_source_save = (source: string) => {
  pending_source_save = source;
  if (source_save_timer !== null) {
    clearTimeout(source_save_timer);
  }
  source_save_timer = setTimeout(() => {
    source_save_timer = null;
    if (pending_source_save !== null) {
      localStorage.setItem(local_storage_source_key, pending_source_save);
      pending_source_save = null;
    }
  }, source_save_delay_ms);
};

const schedule_code_sync = (source: string) => {
  if (code_sync_timer !== null) {
    clearTimeout(code_sync_timer);
  }
  code_sync_timer = setTimeout(() => {
    code_sync_timer = null;
    sync_code_to_blocks(source);
  }, code_sync_delay_ms);
};

const schedule_blocks_sync = () => {
  if (blocks_sync_timer !== null) {
    clearTimeout(blocks_sync_timer);
  }
  blocks_sync_timer = setTimeout(() => {
    blocks_sync_timer = null;
    sync_blocks_to_code().catch(() => {});
    refresh_declared_variable_category();
  }, blocks_sync_delay_ms);
};

const schedule_editor_resize = () => {
  if (resize_frame !== null) {
    return;
  }
  resize_frame = window.requestAnimationFrame(() => {
    resize_frame = null;
    cm_editor?.requestMeasure();
    const workspace_value = get_workspace();
    if (workspace_value) {
      Blockly.svgResize(workspace_value);
    }
  });
};

const init_pane_splitters = () => {
  const pane_group = document.querySelector<HTMLElement>(".pane_group");
  const app_main = document.querySelector<HTMLElement>(".app_main");
  const code_pane = document.querySelector<HTMLElement>(".code_pane");
  const output_pane = document.querySelector<HTMLElement>(".output_pane");
  const vertical_splitter = document.getElementById("pane_splitter_vertical");
  const horizontal_splitter = document.getElementById("pane_splitter_horizontal");
  if (!pane_group || !app_main || !code_pane || !output_pane || !vertical_splitter || !horizontal_splitter) {
    return;
  }

  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

  vertical_splitter.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    const group_rect = pane_group.getBoundingClientRect();
    const code_rect = code_pane.getBoundingClientRect();
    const splitter_rect = vertical_splitter.getBoundingClientRect();
    const start_x = event.clientX;
    const start_width = code_rect.width;
    const max_width = Math.max(min_pane_width, group_rect.width - min_pane_width - splitter_rect.width);
    const on_move = (move_event: PointerEvent) => {
      const next_width = clamp(
        start_width + (move_event.clientX - start_x),
        min_pane_width,
        max_width,
      );
      pane_group.style.setProperty("--pane-left-width", `${next_width}px`);
      schedule_editor_resize();
    };
    const stop = (end_event: PointerEvent) => {
      vertical_splitter.releasePointerCapture(end_event.pointerId);
      vertical_splitter.removeEventListener("pointermove", on_move);
      vertical_splitter.removeEventListener("pointerup", stop);
      vertical_splitter.removeEventListener("pointercancel", stop);
      schedule_editor_resize();
    };
    vertical_splitter.setPointerCapture(event.pointerId);
    vertical_splitter.addEventListener("pointermove", on_move);
    vertical_splitter.addEventListener("pointerup", stop);
    vertical_splitter.addEventListener("pointercancel", stop);
  });

  horizontal_splitter.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    const main_rect = app_main.getBoundingClientRect();
    const output_rect = output_pane.getBoundingClientRect();
    const splitter_rect = horizontal_splitter.getBoundingClientRect();
    const start_y = event.clientY;
    const start_height = output_rect.height;
    const max_height = Math.max(min_output_height, main_rect.height - min_editor_height - splitter_rect.height);
    const on_move = (move_event: PointerEvent) => {
      const next_height = clamp(
        start_height - (move_event.clientY - start_y),
        min_output_height,
        max_height,
      );
      app_main.style.setProperty("--output-height", `${next_height}px`);
      schedule_editor_resize();
    };
    const stop = (end_event: PointerEvent) => {
      horizontal_splitter.releasePointerCapture(end_event.pointerId);
      horizontal_splitter.removeEventListener("pointermove", on_move);
      horizontal_splitter.removeEventListener("pointerup", stop);
      horizontal_splitter.removeEventListener("pointercancel", stop);
      schedule_editor_resize();
    };
    horizontal_splitter.setPointerCapture(event.pointerId);
    horizontal_splitter.addEventListener("pointermove", on_move);
    horizontal_splitter.addEventListener("pointerup", stop);
    horizontal_splitter.addEventListener("pointercancel", stop);
  });
};

const load_source_from_storage = () =>
  localStorage.getItem(local_storage_source_key) ?? default_source_code;

const run_python_code = async () => {
  if (!cm_editor || is_running) {
    return;
  }
  set_running_state(true);
  if (output_console) output_console.textContent = "";
  append_output(`▶ ${t("status_running")}`);

  // Listen for streaming output events
  stream_unlisten = await listen<run_output>("python-output", (event) => {
    const { stream, line } = event.payload;
    append_output(line, stream === "stderr" ? "output_stderr" : "output_stdout");
  });

  try {
    const result = await run_python(get_editor_value());
    const elapsed = (result.elapsed_ms / 1000).toFixed(2);
    const status_line = result.timed_out
      ? `\n⏱ ${t("status_timeout")} (${elapsed}s)`
      : `\n✓ ${t("status_finished")} (${elapsed}s, exit code: ${result.status})`;
    append_output(status_line, result.status !== 0 ? "output_stderr" : "output_status");
  } catch (error) {
    append_output(`${t("error_run")}: ${String(error)}`, "output_stderr");
  } finally {
    set_running_state(false);
    if (stream_unlisten) {
      stream_unlisten();
      stream_unlisten = null;
    }
  }
};

const python_keywords = [
  "False", "None", "True", "and", "as", "assert", "async", "await", "break",
  "class", "continue", "def", "del", "elif", "else", "except", "finally",
  "for", "from", "global", "if", "import", "in", "is", "lambda", "nonlocal",
  "not", "or", "pass", "raise", "return", "try", "while", "with", "yield",
];

const python_builtins = [
  "abs", "all", "any", "bin", "bool", "breakpoint", "bytearray", "bytes",
  "callable", "chr", "classmethod", "compile", "complex", "delattr", "dict",
  "dir", "divmod", "enumerate", "eval", "exec", "filter", "float", "format",
  "frozenset", "getattr", "globals", "hasattr", "hash", "help", "hex", "id",
  "input", "int", "isinstance", "issubclass", "iter", "len", "list", "locals",
  "map", "max", "memoryview", "min", "next", "object", "oct", "open", "ord",
  "pow", "print", "property", "range", "repr", "reversed", "round", "set",
  "setattr", "slice", "sorted", "staticmethod", "str", "sum", "super",
  "tuple", "type", "vars", "zip",
];

const python_modules = [
  "os", "sys", "math", "random", "json", "re", "datetime", "time",
  "collections", "itertools", "functools", "pathlib", "typing",
];

const get_document_identifiers = (doc: string): { label: string; type: string }[] => {
  const seen = new Set<string>();
  const results: { label: string; type: string }[] = [];
  const re = /^[ \t]*([A-Za-z_]\w*)\s*=/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(doc)) !== null) {
    const name = m[1];
    if (!seen.has(name)) {
      seen.add(name);
      results.push({ label: name, type: "variable" });
    }
  }
  return results;
};

const comment_highlight = HighlightStyle.define([
  { tag: tags.comment, color: "#22863a" },
  { tag: tags.lineComment, color: "#22863a" },
  { tag: tags.blockComment, color: "#22863a" },
]);

function python_completions(context: CompletionContext): CompletionResult | null {
  const tree = syntaxTree(context.state);
  const node = tree.resolveInner(context.pos, -1);
  if (node.type.name === "Comment" || node.type.name === "LineComment" || node.type.name === "BlockComment") {
    return null;
  }

  const word = context.matchBefore(/\w*/);
  if (!word || (word.from === word.to && !context.explicit)) return null;

  const completions = [
    ...python_keywords.map(k => ({ label: k, type: "keyword" })),
    ...python_builtins.map(b => ({ label: b, type: "function" })),
    ...python_modules.map(m => ({ label: m, type: "namespace" })),
    ...get_document_identifiers(context.state.doc.toString()),
  ];

  return { from: word.from, options: completions };
}

const create_codemirror = (parent: HTMLElement, initial_source: string) => {
  const update_listener = EditorView.updateListener.of((update) => {
    if (update.docChanged && !is_syncing) {
      const source_value = update.state.doc.toString();
      schedule_source_save(source_value);
      schedule_code_sync(source_value);
      const tab = get_active_tab();
      if (tab) {
        tab.code = source_value;
        tab.dirty = true;
        render_tabs();
      }
    }
  });

  cm_editor = new EditorView({
    state: EditorState.create({
      doc: initial_source,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        bracketMatching(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        python(),
        autocompletion({ override: [python_completions] }),
        syntaxHighlighting(comment_highlight),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        theme_compartment.of(current_theme === "dark" ? oneDark : []),
        update_listener,
        error_line_field,
        highlight_line_field,
        EditorView.theme({
          "&": {
            height: "100%",
            fontSize: "14px",
          },
          ".cm-scroller": {
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
            overflow: "auto",
          },
          ".cm-content": {
            caretColor: "var(--app_text)",
          },
          ".cm-error-line": {
            backgroundColor: "rgba(255, 0, 0, 0.15)",
            outline: "1px solid rgba(255, 0, 0, 0.3)",
          },
          ".cm-highlight-line": {
            backgroundColor: "rgba(59, 130, 246, 0.25)",
            outline: "1px solid rgba(59, 130, 246, 0.4)",
          },
        }),
      ],
    }),
    parent,
  });
};

const update_ui_text = () => {
  // Subtitle
  const subtitle = document.querySelector<HTMLElement>(".app_subtitle");
  if (subtitle) subtitle.textContent = t("title_subtitle");

  // Section headers
  const pane_headers = document.querySelectorAll<HTMLElement>(".pane_header");
  pane_headers.forEach((el) => {
    const key = el.dataset.i18n;
    if (key) el.textContent = t(key);
  });

  // Buttons
  if (run_button) run_button.textContent = t("btn_run");
  if (stop_button) stop_button.textContent = t("btn_stop");
  if (save_button) save_button.textContent = t("btn_save");
  if (load_button) load_button.textContent = t("btn_load");
  if (help_button) help_button.textContent = t("btn_help");
  if (theme_toggle_button) {
    theme_toggle_button.textContent = current_theme === "dark" ? t("theme_light") : t("theme_dark");
  }
  if (language_toggle_button) {
    language_toggle_button.textContent = get_language() === "ja" ? "日本語" : "English";
  }

  // Easy mode toggle visibility + label
  if (easy_mode_toggle_button) {
    easy_mode_toggle_button.style.display = get_language() === "ja" ? "" : "none";
    easy_mode_toggle_button.textContent = get_easy_mode()
      ? "イージーモード：ON"
      : "イージーモード：OFF";
  }

  // Tab close button titles
  document.querySelectorAll<HTMLButtonElement>(".tab_close").forEach((btn) => {
    btn.title = t("btn_close");
  });

  // Help modal
  const help_modal = document.querySelector<HTMLElement>(".help_modal");
  if (help_modal) {
    const h2 = help_modal.querySelector("h2");
    if (h2) h2.textContent = t("help_title");

    const h3s = help_modal.querySelectorAll<HTMLElement>("h3[data-i18n]");
    h3s.forEach((el) => {
      const key = el.dataset.i18n;
      if (key) el.textContent = t(key);
    });

    const lis = help_modal.querySelectorAll<HTMLElement>("li[data-i18n]");
    lis.forEach((el) => {
      const key = el.dataset.i18n;
      if (key) el.textContent = t(key);
    });

    const ps = help_modal.querySelectorAll<HTMLElement>("p[data-i18n]");
    ps.forEach((el) => {
      const key = el.dataset.i18n;
      if (key) el.textContent = t(key);
    });
  }
};

export const init_app = () => {
  window.addEventListener("DOMContentLoaded", () => {
    const editor_container = document.querySelector<HTMLElement>("#code_editor_container");
    output_console =
      document.querySelector<HTMLPreElement>("#output_console");
    theme_toggle_button =
      document.querySelector<HTMLButtonElement>("#theme_toggle");
    save_button = document.querySelector<HTMLButtonElement>("#save_button");
    load_button = document.querySelector<HTMLButtonElement>("#load_button");
    run_button = document.querySelector<HTMLButtonElement>("#run_button");
    stop_button = document.querySelector<HTMLButtonElement>("#stop_button");
    help_button = document.querySelector<HTMLButtonElement>("#help_button");
    help_modal_overlay = document.getElementById("help_modal_overlay");
    language_toggle_button =
      document.querySelector<HTMLButtonElement>("#language_toggle");
    easy_mode_toggle_button =
      document.querySelector<HTMLButtonElement>("#easy_mode_toggle");
    const help_modal_close = document.getElementById("help_modal_close");

    const raw_theme = localStorage.getItem(local_storage_theme_key);
    const stored_theme: theme_mode | null =
      (raw_theme === "light" || raw_theme === "dark") ? raw_theme : null;
    const prefers_dark =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;

    apply_theme(stored_theme ?? (prefers_dark ? "dark" : "light"));

    register_blocks();
    ensure_workspace();

    const initial_source = load_source_from_storage();
    if (editor_container) {
      create_codemirror(editor_container, initial_source);
    }
    init_pane_splitters();

    // Initialize default tab
    const default_tab: FileTab = {
      id: generate_tab_id(),
      name: "main.py",
      path: current_file_path,
      code: initial_source,
      dirty: false,
    };
    tabs.push(default_tab);
    active_tab_id = default_tab.id;
    render_tabs();

    // New tab button
    const new_tab_btn = document.getElementById("new_tab_btn");
    new_tab_btn?.addEventListener("click", () => {
      create_tab();
    });

    const workspace = get_workspace();
    if (workspace) {
      workspace.addChangeListener((event: Blockly.Events.Abstract) => {
        if (is_syncing) {
          return;
        }
        const dominated =
          event.type === Blockly.Events.UI ||
          event.type === Blockly.Events.VIEWPORT_CHANGE ||
          event.type === Blockly.Events.TOOLBOX_ITEM_SELECT ||
          event.type === Blockly.Events.CLICK ||
          event.type === Blockly.Events.SELECTED;
      if (dominated) {
        return;
      }
      schedule_blocks_sync();
    });

      workspace.addChangeListener((event: Blockly.Events.Abstract) => {
        if (event.type !== Blockly.Events.SELECTED || !cm_editor) {
          return;
        }
        const selected = event as Blockly.Events.Selected;
        if (selected.newElementId) {
          let block: Blockly.Block | null = workspace.getBlockById(selected.newElementId);
          // Walk up to find nearest block with a span (expression → parent statement)
          while (block && !get_block_span(block)) {
            block = block.getParent();
          }
          if (block) {
            const span = get_block_span(block);
            if (span) {
              cm_editor.dispatch({
                effects: set_highlight_effect.of({ from: span.start.line, to: span.end.line }),
              });
              return;
            }
          }
        }
        cm_editor.dispatch({
          effects: set_highlight_effect.of(null),
        });
      });

      // Middle-click: pan workspace canvas (don't move blocks)
      const blockly_div = document.querySelector<HTMLElement>(`#${workspace_container_id} .injectionDiv`);
      if (blockly_div) {
        let is_panning = false;
        let pan_start_x = 0;
        let pan_start_y = 0;
        let scroll_start_x = 0;
        let scroll_start_y = 0;

        blockly_div.addEventListener("pointerdown", (e) => {
          if (e.button === 1) {
            e.preventDefault();
            e.stopPropagation();
            is_panning = true;
            pan_start_x = e.clientX;
            pan_start_y = e.clientY;
            scroll_start_x = workspace.scrollX;
            scroll_start_y = workspace.scrollY;
            blockly_div.setPointerCapture(e.pointerId);
          }
        }, true);

        blockly_div.addEventListener("pointermove", (e) => {
          if (!is_panning) return;
          e.preventDefault();
          e.stopPropagation();
          const dx = e.clientX - pan_start_x;
          const dy = e.clientY - pan_start_y;
          workspace.scroll(scroll_start_x + dx, scroll_start_y + dy);
        }, true);

        const stop_pan = (e: PointerEvent) => {
          if (!is_panning) return;
          is_panning = false;
          blockly_div.releasePointerCapture(e.pointerId);
        };
        blockly_div.addEventListener("pointerup", stop_pan, true);
        blockly_div.addEventListener("pointercancel", stop_pan, true);

        // Also block mousedown to prevent Blockly's own middle-click handling
        blockly_div.addEventListener("mousedown", (e) => {
          if (e.button === 1) {
            e.preventDefault();
            e.stopPropagation();
          }
        }, true);
      }
    }

    save_button?.addEventListener("click", async () => {
      if (!cm_editor) {
        return;
      }
      const tab = get_active_tab();
      try {
        const path = await save({
          filters: [{ name: "Python", extensions: ["py"] }],
          defaultPath: tab?.path ?? current_file_path ?? undefined,
        });
        if (path) {
          await writeTextFile(path, get_editor_value());
          current_file_path = path;
          if (tab) {
            tab.path = path;
            tab.name = path.split(/[\\/]/).pop() ?? tab.name;
            tab.dirty = false;
          }
          localStorage.setItem(local_storage_source_key, get_editor_value());
          set_output(`${t("status_saved")}: ${path}`);
          render_tabs();
        }
      } catch (error) {
        set_output(`${t("error_save")}: ${String(error)}`);
      }
    });

    load_button?.addEventListener("click", async () => {
      if (!cm_editor) {
        return;
      }
      try {
        const path = await open({
          filters: [{ name: "Python", extensions: ["py"] }],
          multiple: false,
        });
        if (path) {
          const existing = tabs.find((t) => t.path === path);
          if (existing) {
            switch_tab(existing.id);
            return;
          }
          const content = await readTextFile(path);
          const file_name = path.split(/[\\/]/).pop() ?? "file.py";
          create_tab(file_name, content, path);
          localStorage.setItem(local_storage_source_key, content);
          set_output(`${t("status_loaded")}: ${path}`);
        }
      } catch (error) {
        set_output(`${t("error_load")}: ${String(error)}`);
      }
    });

    run_button?.addEventListener("click", () => {
      run_python_code();
    });

    stop_button?.addEventListener("click", async () => {
      try {
        const result = await stop_python();
        set_output(result);
      } catch (error) {
        set_output(`${t("error_stop")}: ${String(error)}`);
      }
    });

    theme_toggle_button?.addEventListener("click", () => {
      apply_theme(current_theme === "dark" ? "light" : "dark");
    });

    language_toggle_button?.addEventListener("click", () => {
      const new_lang: Language = get_language() === "ja" ? "en" : "ja";
      set_language(new_lang);
      // Re-register blocks so labels reflect new language
      register_blocks();
      update_ui_text();
      const workspace = get_workspace();
      if (workspace) {
        workspace.updateToolbox(get_toolbox());
      }
      // Force re-sync code→blocks to rebuild block labels
      trigger_code_to_blocks_sync();
    });

    easy_mode_toggle_button?.addEventListener("click", () => {
      set_easy_mode(!get_easy_mode());
      // Re-register blocks so labels use easy mode text
      register_blocks();
      update_ui_text();
      const workspace = get_workspace();
      if (workspace) {
        workspace.updateToolbox(get_toolbox());
      }
      // Force re-sync code→blocks to rebuild block labels
      trigger_code_to_blocks_sync();
    });

    help_button?.addEventListener("click", () => {
      help_modal_overlay?.removeAttribute("hidden");
    });

    help_modal_close?.addEventListener("click", () => {
      help_modal_overlay?.setAttribute("hidden", "");
    });

    help_modal_overlay?.addEventListener("click", (e) => {
      if (e.target === help_modal_overlay) {
        help_modal_overlay?.setAttribute("hidden", "");
      }
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "s" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        save_button?.click();
      } else if (e.key === "o" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        load_button?.click();
      }
    });

    update_ui_text();
    sync_code_to_blocks(initial_source);
    window.addEventListener("beforeunload", () => {
      flush_source_save();
    });

    window.addEventListener("resize", () => {
      schedule_editor_resize();
    });
  });
};
