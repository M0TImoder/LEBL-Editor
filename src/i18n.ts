type Language = "ja" | "en";

const translations: Record<Language, Record<string, string>> = {
  ja: {
    // UI Labels
    title_subtitle: "Pythonとブロックの双方向編集環境",
    label_python_code: "Pythonコード",
    label_blocks: "ブロック",
    label_output: "実行結果",
    btn_run: "実行",
    btn_stop: "停止",
    btn_save: "保存",
    btn_load: "読み込み",
    btn_help: "？",
    btn_close: "閉じる",

    // Theme
    theme_light: "ライト",
    theme_dark: "ダーク",

    // Status Messages
    status_running: "実行中...",
    status_no_output: "出力なし",
    status_saved: "保存しました",
    status_loaded: "読み込みました",
    error_sync: "同期エラー",
    error_sync_detail: "{line}行{col}列: {message}",
    error_run: "実行エラー",
    error_save: "保存エラー",
    error_load: "読み込みエラー",
    error_stop: "停止エラー",
    error_one_start_block: "startブロックは1つだけ配置",
    error_no_toplevel_outside_start: "startブロック以外のトップレベルは配置不可",
    error_pattern_only_id_or_literal: "patternは識別子かリテラルのみ",

    // Dialogs
    confirm_close_unsaved: "は未保存の変更があります。閉じますか？",

    // Toolbox Categories
    toolbox_events: "イベント",
    toolbox_control: "制御",
    toolbox_loops: "ループ",
    toolbox_assignment: "代入",
    toolbox_variables: "変数",
    toolbox_declared_vars: "定義済み変数",
    toolbox_declared_funcs: "定義済み関数",
    toolbox_definitions: "定義",
    toolbox_imports: "インポート",
    toolbox_output: "出力",
    toolbox_expressions: "式",
    toolbox_statements: "文",
    toolbox_builtins: "組み込み関数",
    msg_no_declared_vars: "定義済みの変数なし",
    msg_no_declared_funcs: "定義済みの関数なし",
    msg_sync_error: "同期エラー",

    // Help Modal
    help_title: "LEBL Editor - ヘルプ",
    help_basic_title: "■ 基本操作",
    help_basic_1:
      "左側のコードエディタにPythonコードを入力すると、右側にブロックが自動生成されます",
    help_basic_2:
      "右側のブロックを編集すると、左側のコードが自動更新されます",
    help_basic_3:
      "ツールボックス（右端）からブロックをドラッグして追加できます",
    help_file_title: "■ ファイル操作",
    help_file_1: "開く: ファイルを開いて編集",
    help_file_2: "保存: 現在のファイルを保存",
    help_file_3: "名前をつけて保存: 新しい名前で保存",
    help_file_4: "タブ: 複数ファイルを同時に編集可能",
    help_run_title: "■ 実行",
    help_run_1: "「実行」ボタンでPythonコードを実行",
    help_run_2: "「停止」ボタンで実行中のプログラムを停止",
    help_run_3: "実行結果は下部の出力エリアに表示されます",
    help_syntax_title: "■ 対応するPython構文",
    help_syntax_text:
      "変数代入、if/elif/else、for/while、関数定義、クラス定義、リスト/辞書/集合、演算子、比較、論理演算、import、try/except、with、return/break/continue、f-string、スライス、デコレータ、型アノテーション、assert/raise/del/global/nonlocal",
    help_shortcuts_title: "■ ショートカットキー",
    help_shortcut_1: "Ctrl+Z: 元に戻す",
    help_shortcut_2: "Ctrl+Y: やり直し",
    help_shortcut_3: "Ctrl+S: 保存",
    help_shortcut_4: "Ctrl+O: 開く",
  },
  en: {
    // UI Labels
    title_subtitle: "Bidirectional Python & Block Editor",
    label_python_code: "Python Code",
    label_blocks: "Blocks",
    label_output: "Execution Results",
    btn_run: "Run",
    btn_stop: "Stop",
    btn_save: "Save",
    btn_load: "Load",
    btn_help: "?",
    btn_close: "Close",

    // Theme
    theme_light: "Light",
    theme_dark: "Dark",

    // Status Messages
    status_running: "Running...",
    status_no_output: "No output",
    status_saved: "Saved",
    status_loaded: "Loaded",
    error_sync: "Sync Error",
    error_sync_detail: "Line {line}, Col {col}: {message}",
    error_run: "Run Error",
    error_save: "Save Error",
    error_load: "Load Error",
    error_stop: "Stop Error",
    error_one_start_block: "Only one start block is allowed",
    error_no_toplevel_outside_start: "No top-level blocks allowed outside start block",
    error_pattern_only_id_or_literal: "Pattern must be an identifier or literal",

    // Dialogs
    confirm_close_unsaved: "has unsaved changes. Close anyway?",

    // Toolbox Categories
    toolbox_events: "Events",
    toolbox_control: "Control",
    toolbox_loops: "Loops",
    toolbox_assignment: "Assignment",
    toolbox_variables: "Variables",
    toolbox_declared_vars: "Defined Variables",
    toolbox_declared_funcs: "Defined Functions",
    toolbox_definitions: "Definitions",
    toolbox_imports: "Import",
    toolbox_output: "Output",
    toolbox_expressions: "Expressions",
    toolbox_statements: "Statements",
    toolbox_builtins: "Built-in Functions",
    msg_no_declared_vars: "No defined variables",
    msg_no_declared_funcs: "No defined functions",
    msg_sync_error: "Sync Error",

    // Help Modal
    help_title: "LEBL Editor - Help",
    help_basic_title: "■ Basic Operations",
    help_basic_1:
      "Type Python code in the left editor and blocks are automatically generated on the right",
    help_basic_2:
      "Edit blocks on the right and the code on the left updates automatically",
    help_basic_3:
      "Drag blocks from the toolbox (right edge) to add them",
    help_file_title: "■ File Operations",
    help_file_1: "Open: Open a file for editing",
    help_file_2: "Save: Save the current file",
    help_file_3: "Save As: Save with a new name",
    help_file_4: "Tabs: Edit multiple files simultaneously",
    help_run_title: "■ Execution",
    help_run_1: "Click the \"Run\" button to execute Python code",
    help_run_2: "Click the \"Stop\" button to stop a running program",
    help_run_3: "Execution results are displayed in the output area below",
    help_syntax_title: "■ Supported Python Syntax",
    help_syntax_text:
      "Variable assignment, if/elif/else, for/while, function definitions, class definitions, list/dict/set, operators, comparisons, logical operations, import, try/except, with, return/break/continue, f-string, slicing, decorators, type annotations, assert/raise/del/global/nonlocal",
    help_shortcuts_title: "■ Keyboard Shortcuts",
    help_shortcut_1: "Ctrl+Z: Undo",
    help_shortcut_2: "Ctrl+Y: Redo",
    help_shortcut_3: "Ctrl+S: Save",
    help_shortcut_4: "Ctrl+O: Open",
  },
};

const stored_language = localStorage.getItem("lebl_language");
let current_language: Language =
  (stored_language === "ja" || stored_language === "en") ? stored_language : "ja";

let easy_mode: boolean =
  localStorage.getItem("lebl_easy_mode") === "true";

export const t = (key: string): string => {
  if (easy_mode && current_language === "ja") {
    const easy = easy_labels[key];
    if (easy) return easy;
  }
  return translations[current_language]?.[key] ?? translations["ja"]?.[key] ?? key;
};

export const set_language = (lang: Language) => {
  current_language = lang;
  localStorage.setItem("lebl_language", lang);
};

export const get_language = (): Language => current_language;

export const set_easy_mode = (enabled: boolean) => {
  easy_mode = enabled;
  localStorage.setItem("lebl_easy_mode", String(enabled));
};

export const get_easy_mode = (): boolean => easy_mode;

export type { Language };

const easy_labels: Record<string, string> = {
  // Event
  block_start: "はじめ",
  block_do: "じっこう",

  // Control
  block_if: "もし",
  block_elif: "それとも もし",
  block_else: "そうでなければ",
  block_match: "あたいが",
  block_case: "のとき",

  // Loops
  block_while: "くりかえす あいだ",
  block_while_else: "くりかえしが おわったら",
  block_for: "くりかえす",
  block_for_in: "のなかの",
  block_for_else: "くりかえしが おわったら",

  // Variables
  block_var_set: "へんすう",
  block_assign_set: "にいれる",
  block_assign_eq: "＝",

  // Functions
  block_def: "かんすう をつくる",
  block_return: "もどす",
  block_call: "よびだす",
  block_lambda: "かんたん かんすう",

  // Class
  block_class: "クラス をつくる",

  // Flow
  block_pass: "なにもしない",
  block_break: "くりかえし をやめる",
  block_continue: "つぎへすすむ",

  // Print / IO
  block_print: "ひょうじする",
  block_input: "にゅうりょく",
  block_wait: "まつ",

  // Literals
  block_num: "すうじ",
  block_str: "もじ",
  block_bool: "しんぎ",
  block_none: "なし",
  block_id: "なまえ",

  // Collections
  block_list: "リスト",
  block_tuple: "タプル",
  block_dict: "じしょ",
  block_set: "セット",
  block_items: "なかみ",
  block_key: "キー",
  block_value: "あたい",

  // Operators
  block_compare: "くらべる",
  block_boolop: "ろんり",
  block_ifexpr: "もし～なら",

  // Error handling
  block_try: "ためす",
  block_except: "エラーのとき",
  block_finally: "さいごに",
  block_raise: "エラーをだす",
  block_assert: "たしかめる",

  // With
  block_with: "つかう",

  // Import
  block_import: "よみこむ",
  block_module: "モジュール",

  // Scope
  block_del: "けす",
  block_global: "ぜんたいの へんすう",
  block_nonlocal: "そとの へんすう",

  // Comprehension
  block_comp: "まとめてつくる",
  block_element: "ようそ",
  block_cond: "じょうけん",

  // Built-in functions
  block_range: "はんい",
  block_range_stop: "おわり",
  block_range_start: "はじめ",
  block_range_step: "きざみ",
  block_len: "ながさ",
  block_sorted: "ならべかえ",
  block_reversed: "ぎゃくならべ",
  block_math_func: "けいさん",
  block_type_check: "かた",
  block_isinstance: "かた チェック",
  block_enumerate: "ばんごうつき",
  block_zip: "くみあわせ",
  block_type_convert: "かた へんかん",

  // Misc
  block_attr: "のなかの",
  block_index: "ばんめ",
  block_group: "グループ",
  block_slice: "きりだし",
  block_fstring: "ぶんしょう",
  block_yield: "わたす",
  block_yield_from: "ぜんぶ わたす",
  block_await: "まつ",
  block_named_expr: "いれて つかう",
  block_ann_assign: "かた つき だいにゅう",
  block_async: "ひどうき",

  // Toolbox
  toolbox_events: "イベント",
  toolbox_control: "せいぎょ",
  toolbox_loops: "くりかえし",
  toolbox_assignment: "だいにゅう",
  toolbox_variables: "へんすう",
  toolbox_declared_vars: "つかった へんすう",
  toolbox_declared_funcs: "つくった かんすう",
  toolbox_definitions: "ていぎ",
  toolbox_imports: "よみこみ",
  toolbox_output: "しゅつりょく",
  toolbox_expressions: "しき",
  toolbox_statements: "ぶん",
  toolbox_builtins: "べんりな きのう",

  // UI
  btn_easy_mode: "イージーモード",
};
