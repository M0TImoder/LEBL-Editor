import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import * as Blockly from "blockly";
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, Decoration, type DecorationSet } from "@codemirror/view";
import { EditorState, Compartment, StateEffect, StateField } from "@codemirror/state";
import { python } from "@codemirror/lang-python";
import { defaultKeymap, indentWithTab, history, historyKeymap } from "@codemirror/commands";
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from "@codemirror/language";
import { oneDark } from "@codemirror/theme-one-dark";
import type { ir_program, run_result, theme_mode } from "./types";
import {
  blockly_theme_dark,
  blockly_theme_light,
  build_declared_variable_category,
  declared_variables_category_key,
  register_blocks,
  toolbox,
} from "./blockly_config";
import {
  blocks_from_ir,
  get_block_span,
  get_workspace,
  ir_from_blocks,
  refresh_declared_variable_category,
  set_workspace,
  show_sync_error_block,
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
let is_syncing = false;
let current_theme: theme_mode = "light";
let code_sync_timer: ReturnType<typeof setTimeout> | null = null;
let pending_code_sync: string | null = null;
let current_file_path: string | null = null;
const code_sync_delay_ms = 400;

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
    close_btn.title = "閉じる";
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
    if (!confirm(`「${tab.name}」は未保存の変更があります。閉じますか？`)) return;
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

const parse_error_line = (error_string: string): number | null => {
  const match = error_string.match(/line (\d+):/);
  return match ? parseInt(match[1], 10) : null;
};

const parse_python_to_ir = async (source: string) =>
  invoke<ir_program>("parse_python_to_ir", { source });

const generate_python_from_ir = async (ir: ir_program) =>
  invoke<string>("generate_python_from_ir", {
    ir,
    renderMode: "Lossless",
  });

const run_python = async (source: string) =>
  invoke<run_result>("run_python", { source });

const stop_python = async () =>
  invoke<string>("stop_python");

const set_output = (text: string) => {
  if (output_console) {
    output_console.textContent = text;
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
    theme_toggle_button.textContent = theme === "dark" ? "ライト" : "ダーク";
  }
};

const ensure_workspace = () => {
  if (get_workspace()) {
    return;
  }
  const workspace = Blockly.inject(workspace_container_id, {
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
  workspace.registerToolboxCategoryCallback(
    declared_variables_category_key,
    build_declared_variable_category,
  );
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
  } catch (error) {
    const error_str = String(error);
    set_output(`同期エラー: ${error_str}`);
    const line = parse_error_line(error_str);
    set_error_line(line);
    show_sync_error_block();
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
    return;
  }
  is_syncing = true;
  try {
    const ir = ir_from_blocks();
    const source = await generate_python_from_ir(ir);
    const current = get_editor_value();
    if (current !== source) {
      set_editor_value(source);
      localStorage.setItem(local_storage_source_key, source);
    }
  } catch (error) {
    set_output(`同期エラー: ${String(error)}`);
  } finally {
    is_syncing = false;
  }
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

const load_source_from_storage = () =>
  localStorage.getItem(local_storage_source_key) ?? default_source_code;

const run_python_code = async () => {
  if (!cm_editor) {
    return;
  }
  set_output("実行中...");
  try {
    const result = await run_python(get_editor_value());
    const combined = [result.stdout, result.stderr].filter(Boolean).join("\n");
    const text = combined.length > 0 ? combined : "出力なし";
    set_output(text);
  } catch (error) {
    set_output(`実行エラー: ${String(error)}`);
  }
};

const create_codemirror = (parent: HTMLElement, initial_source: string) => {
  const update_listener = EditorView.updateListener.of((update) => {
    if (update.docChanged && !is_syncing) {
      const source_value = update.state.doc.toString();
      localStorage.setItem(local_storage_source_key, source_value);
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
            backgroundColor: "rgba(59, 130, 246, 0.12)",
          },
        }),
      ],
    }),
    parent,
  });
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
    const help_modal_close = document.getElementById("help_modal_close");

    const stored_theme =
      (localStorage.getItem(local_storage_theme_key) as theme_mode | null) ?? null;
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
        sync_blocks_to_code().catch(() => {});
        refresh_declared_variable_category();
      });

      workspace.addChangeListener((event: Blockly.Events.Abstract) => {
        if (event.type !== Blockly.Events.SELECTED || !cm_editor) {
          return;
        }
        const selected = event as Blockly.Events.Selected;
        if (selected.newElementId) {
          const block = workspace.getBlockById(selected.newElementId);
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
          set_output(`保存しました: ${path}`);
          render_tabs();
        }
      } catch (error) {
        set_output(`保存エラー: ${String(error)}`);
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
          set_output(`読み込みました: ${path}`);
        }
      } catch (error) {
        set_output(`読み込みエラー: ${String(error)}`);
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
        set_output(`停止エラー: ${String(error)}`);
      }
    });

    theme_toggle_button?.addEventListener("click", () => {
      apply_theme(current_theme === "dark" ? "light" : "dark");
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

    sync_code_to_blocks(initial_source);

    window.addEventListener("resize", () => {
      const workspace_value = get_workspace();
      if (workspace_value) {
        Blockly.svgResize(workspace_value);
      }
    });
  });
};
