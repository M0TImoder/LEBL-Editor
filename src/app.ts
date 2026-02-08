import { invoke } from "@tauri-apps/api/core";
import * as Blockly from "blockly";
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

let code_editor: HTMLTextAreaElement | null = null;
let output_console: HTMLPreElement | null = null;
let theme_toggle_button: HTMLButtonElement | null = null;
let save_button: HTMLButtonElement | null = null;
let load_button: HTMLButtonElement | null = null;
let run_button: HTMLButtonElement | null = null;
let is_syncing = false;
let current_theme: theme_mode = "light";

const parse_python_to_ir = async (source: string) =>
  invoke<ir_program>("parse_python_to_ir", { source });

const generate_python_from_ir = async (ir: ir_program) =>
  invoke<string>("generate_python_from_ir", {
    ir,
    renderMode: "Lossless",
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
  const workspace = get_workspace();
  if (workspace) {
    workspace.setTheme(theme === "dark" ? blockly_theme_dark : blockly_theme_light);
    Blockly.svgResize(workspace);
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
    return;
  }
  is_syncing = true;
  try {
    const ir = await parse_python_to_ir(source);
    update_node_counter(ir);
    blocks_from_ir(ir);
  } catch (error) {
    set_output(`同期エラー: ${String(error)}`);
    show_sync_error_block();
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
  sync_code_to_blocks(source);
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

export const init_app = () => {
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

    const workspace = get_workspace();
    if (workspace) {
      workspace.addChangeListener((event) => {
        if (is_syncing || event.type === Blockly.Events.UI) {
          return;
        }
        sync_blocks_to_code();
        refresh_declared_variable_category();
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
      const workspace_value = get_workspace();
      if (workspace_value) {
        Blockly.svgResize(workspace_value);
      }
    });
  });
};
