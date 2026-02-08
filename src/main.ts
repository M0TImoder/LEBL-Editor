import { invoke } from "@tauri-apps/api/core";
import * as Blockly from "blockly";
import "./styles.css";

type theme_mode = "light" | "dark";

type ast_node = {
  node_type: string;
  value: string | null;
  children: ast_node[];
};

const python_line_block_type = "python_line";
const workspace_container_id = "blockly_workspace";
const local_storage_source_key = "lebl_python_source";
const local_storage_theme_key = "lebl_theme_mode";
const code_sync_delay_ms = 180;

let workspace: Blockly.WorkspaceSvg | null = null;
let code_editor: HTMLTextAreaElement | null = null;
let theme_toggle_button: HTMLButtonElement | null = null;
let save_button: HTMLButtonElement | null = null;
let load_button: HTMLButtonElement | null = null;
let is_syncing = false;
let code_sync_timer: number | undefined;
let current_theme: theme_mode = "light";

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
  kind: "flyoutToolbox",
  contents: [{ kind: "block", type: python_line_block_type }],
};

const default_source_code = [
  "print('LEBL Editor')",
  "value = 42",
  "if value > 10:",
  "    print(value)",
].join("\n");

const parse_python_to_ast = async (source: string) =>
  invoke<ast_node>("parse_python_to_ast", { source });

const generate_python_from_ast = async (ast: ast_node) =>
  invoke<string>("generate_python_from_ast", { ast });

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

const register_blocks = () => {
  Blockly.Blocks[python_line_block_type] = {
    init() {
      this.appendDummyInput()
        .appendField("py")
        .appendField(new Blockly.FieldTextInput(""), "line_text");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(210);
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

const blocks_from_ast = (ast: ast_node) => {
  if (!workspace) {
    return;
  }
  const line_nodes = ast.children.length
    ? ast.children
    : [{ node_type: "line", value: "", children: [] }];
  Blockly.Events.disable();
  workspace.clear();
  let previous_block: Blockly.Block | null = null;
  line_nodes.forEach((line_node, index) => {
    const block = workspace?.newBlock(python_line_block_type);
    if (!block) {
      return;
    }
    block.setFieldValue(line_node.value ?? "", "line_text");
    block.initSvg();
    block.render();
    block.moveBy(24, 24 + index * 44);
    if (previous_block?.nextConnection && block.previousConnection) {
      previous_block.nextConnection.connect(block.previousConnection);
    }
    previous_block = block;
  });
  Blockly.Events.enable();
  workspace.render();
};

const sort_blocks = (blocks: Blockly.Block[]) =>
  blocks.sort(
    (left, right) =>
      left.getRelativeToSurfaceXY().y - right.getRelativeToSurfaceXY().y,
  );

const ast_from_blocks = (): ast_node => {
  if (!workspace) {
    return { node_type: "program", value: null, children: [] };
  }
  const line_nodes: ast_node[] = [];
  const top_blocks = sort_blocks(workspace.getTopBlocks(true));
  top_blocks.forEach((top_block) => {
    let current_block: Blockly.Block | null = top_block;
    while (current_block) {
      if (current_block.type === python_line_block_type) {
        const line_text = current_block.getFieldValue("line_text") ?? "";
        line_nodes.push({
          node_type: "line",
          value: line_text,
          children: [],
        });
      }
      current_block = current_block.getNextBlock();
    }
  });
  return { node_type: "program", value: null, children: line_nodes };
};

const sync_code_to_blocks = async (source: string) => {
  if (is_syncing) {
    return;
  }
  is_syncing = true;
  const ast = await parse_python_to_ast(source);
  blocks_from_ast(ast);
  is_syncing = false;
};

const sync_blocks_to_code = async () => {
  if (is_syncing || !code_editor) {
    return;
  }
  is_syncing = true;
  const ast = ast_from_blocks();
  const source = await generate_python_from_ast(ast);
  if (code_editor.value !== source) {
    code_editor.value = source;
    localStorage.setItem(local_storage_source_key, source);
  }
  is_syncing = false;
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

window.addEventListener("DOMContentLoaded", () => {
  code_editor = document.querySelector<HTMLTextAreaElement>("#code_editor");
  theme_toggle_button =
    document.querySelector<HTMLButtonElement>("#theme_toggle");
  save_button = document.querySelector<HTMLButtonElement>("#save_button");
  load_button = document.querySelector<HTMLButtonElement>("#load_button");

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
  });

  load_button?.addEventListener("click", () => {
    if (!code_editor) {
      return;
    }
    const stored_source = load_source_from_storage();
    code_editor.value = stored_source;
    schedule_code_sync(stored_source);
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
