mod ast;

#[tauri::command]
fn get_empty_ast() -> ast::AstNode {
    ast::AstNode::empty_program()
}

#[tauri::command]
fn parse_python_to_ast(source: String) -> ast::AstNode {
    ast::AstNode::from_python(source)
}

#[tauri::command]
fn generate_python_from_ast(ast: ast::AstNode) -> String {
    ast.to_python()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_empty_ast,
            parse_python_to_ast,
            generate_python_from_ast
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
