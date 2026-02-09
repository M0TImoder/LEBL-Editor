mod ast;
use serde::Serialize;
use std::path::PathBuf;
use std::process::Command;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

#[tauri::command]
fn get_empty_ir() -> ast::IrProgram {
    ast::IrProgram {
        meta: ast::NodeMeta::default(),
        indent_width: 4,
        body: Vec::new(),
        token_store: None,
        dirty: true,
    }
}

#[tauri::command]
fn parse_python_to_ir(source: String) -> Result<ast::IrProgram, String> {
    let config = ast::ParserConfig::default();
    let program = ast::Program::parse(source, config).map_err(|error| error.to_string())?;
    Ok(ast::python_to_ir(&program))
}

#[tauri::command]
fn generate_python_from_ir(
    ir: ast::IrProgram,
    render_mode: ast::RenderMode,
) -> Result<String, String> {
    let features = ast::FeatureSet::from_version(ast::PythonVersion::Py310);
    let program = ast::ir_to_python(&ir, &features).map_err(|error| error.to_string())?;
    Ok(program.to_python(ast::RenderConfig {
        mode: render_mode,
        reuse_token_ranges: false,
    }))
}

#[derive(Serialize)]
struct RunResult {
    stdout: String,
    stderr: String,
    status: i32,
}

static RUNNING_PID: Mutex<Option<u32>> = Mutex::new(None);

#[tauri::command]
fn run_python(source: String) -> Result<RunResult, String> {
    let python_path = resolve_python_path()?;
    let prelude = "import time\nfrom time import sleep\nfrom random import random\n";
    let run_path = create_run_file(format!("{prelude}\n{source}"))?;
    let child = Command::new(python_path)
        .arg(&run_path)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|err| format!("python run failed: {err}"))?;
    {
        let mut pid = RUNNING_PID.lock().unwrap();
        *pid = Some(child.id());
    }
    let output = child
        .wait_with_output()
        .map_err(|err| format!("python wait failed: {err}"))?;
    {
        let mut pid = RUNNING_PID.lock().unwrap();
        *pid = None;
    }
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let mut stderr = String::from_utf8_lossy(&output.stderr).to_string();
    if let Err(err) = std::fs::remove_file(&run_path) {
        stderr.push_str(&format!("\ncleanup failed: {err}"));
    }
    Ok(RunResult {
        stdout,
        stderr,
        status: output.status.code().unwrap_or(-1),
    })
}

#[tauri::command]
fn stop_python() -> Result<String, String> {
    let pid = {
        let mut guard = RUNNING_PID.lock().unwrap();
        guard.take()
    };
    match pid {
        Some(id) => {
            #[cfg(windows)]
            {
                let _ = Command::new("taskkill")
                    .args(["/PID", &id.to_string(), "/F", "/T"])
                    .output();
            }
            #[cfg(not(windows))]
            {
                unsafe { libc::kill(id as i32, libc::SIGTERM); }
            }
            Ok(format!("プロセス {} を停止しました", id))
        }
        None => Ok("実行中のプロセスはありません".to_string()),
    }
}

fn resolve_python_path() -> Result<PathBuf, String> {
    let current_dir = std::env::current_dir().map_err(|err| err.to_string())?;
    let mut candidates = vec![current_dir.clone()];
    if let Some(parent) = current_dir.parent() {
        candidates.push(parent.to_path_buf());
    }
    for base in &candidates {
        let mut path = base.clone();
        if cfg!(windows) {
            path = path.join(".venv").join("Scripts").join("python.exe");
        } else {
            path = path.join(".venv").join("bin").join("python");
        }
        if path.exists() {
            return Ok(path);
        }
    }
    Err(format!("python venv not found in {:?}. current dir is {:?}", candidates, current_dir))
}

fn create_run_file(source: String) -> Result<PathBuf, String> {
    let mut path = std::env::temp_dir();
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|err| err.to_string())?
        .as_millis();
    path.push(format!("lebl_run_{timestamp}.py"));
    std::fs::write(&path, source).map_err(|err| err.to_string())?;
    Ok(path)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            get_empty_ir,
            parse_python_to_ir,
            generate_python_from_ir,
            run_python,
            stop_python
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
