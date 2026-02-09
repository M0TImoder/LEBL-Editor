mod ast;
use serde::Serialize;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::Command;
use std::sync::Mutex;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};

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

#[derive(Serialize, Clone)]
struct RunResult {
    stdout: String,
    stderr: String,
    status: i32,
    elapsed_ms: u64,
    timed_out: bool,
}

/// Emitted per-line during execution for streaming output
#[derive(Serialize, Clone)]
struct RunOutput {
    stream: String, // "stdout" | "stderr"
    line: String,
}

static RUNNING_PID: Mutex<Option<u32>> = Mutex::new(None);
const TIMEOUT_SECS: u64 = 30;

/// Sandbox prelude: block dangerous modules before user code runs
fn sandbox_prelude() -> &'static str {
    r#"import time
from time import sleep
from random import random
import sys as _sys

class _BlockedModule:
    """Raises an error when any attribute is accessed."""
    def __init__(self, name):
        self._name = name
    def __getattr__(self, attr):
        raise PermissionError(f"Module '{self._name}' is blocked in sandbox")

for _mod_name in ["subprocess", "shutil", "socket", "http", "urllib",
                   "ftplib", "smtplib", "xmlrpc", "ctypes", "webbrowser",
                   "multiprocessing", "signal"]:
    _sys.modules[_mod_name] = _BlockedModule(_mod_name)

import os as _os
for _fn in ["system", "popen", "exec", "execvp", "execvpe", "spawnl",
            "spawnle", "spawnlp", "spawnlpe", "spawnv", "spawnve",
            "spawnvp", "spawnvpe", "fork", "kill", "remove", "unlink",
            "rmdir", "rename"]:
    if hasattr(_os, _fn):
        delattr(_os, _fn)

import builtins as _builtins
_original_import = _builtins.__import__
_BLOCKED = {"subprocess", "shutil", "socket", "http", "urllib",
            "ftplib", "smtplib", "xmlrpc", "ctypes", "webbrowser",
            "multiprocessing", "signal"}
def _safe_import(name, *args, **kwargs):
    top = name.split(".")[0]
    if top in _BLOCKED:
        raise ImportError(f"Import of '{name}' is blocked in sandbox")
    return _original_import(name, *args, **kwargs)
_builtins.__import__ = _safe_import
del _sys, _os, _builtins, _original_import, _BlockedModule
"#
}

#[tauri::command]
fn run_python(app: AppHandle, source: String) -> Result<RunResult, String> {
    let python_path = resolve_python_path()?;
    let full_source = format!("{}\n{}", sandbox_prelude(), source);
    let run_path = create_run_file(full_source)?;

    let mut child = Command::new(python_path)
        .arg(&run_path)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|err| format!("python run failed: {err}"))?;

    let child_id = child.id();
    {
        let mut pid = RUNNING_PID.lock().unwrap();
        *pid = Some(child_id);
    }

    let start = Instant::now();

    // Stream stdout in a background thread
    let stdout_pipe = child.stdout.take();
    let stderr_pipe = child.stderr.take();
    let app_out = app.clone();
    let app_err = app.clone();

    let stdout_handle = std::thread::spawn(move || {
        let mut lines = Vec::new();
        if let Some(pipe) = stdout_pipe {
            let reader = BufReader::new(pipe);
            for line in reader.lines() {
                if let Ok(l) = line {
                    let _ = app_out.emit("python-output", RunOutput {
                        stream: "stdout".into(),
                        line: l.clone(),
                    });
                    lines.push(l);
                }
            }
        }
        lines.join("\n")
    });

    let stderr_handle = std::thread::spawn(move || {
        let mut lines = Vec::new();
        if let Some(pipe) = stderr_pipe {
            let reader = BufReader::new(pipe);
            for line in reader.lines() {
                if let Ok(l) = line {
                    let _ = app_err.emit("python-output", RunOutput {
                        stream: "stderr".into(),
                        line: l.clone(),
                    });
                    lines.push(l);
                }
            }
        }
        lines.join("\n")
    });

    // Timeout watchdog
    let timed_out;
    loop {
        match child.try_wait() {
            Ok(Some(_)) => {
                timed_out = false;
                break;
            }
            Ok(None) => {
                if start.elapsed() > Duration::from_secs(TIMEOUT_SECS) {
                    kill_process(child_id);
                    timed_out = true;
                    break;
                }
                std::thread::sleep(Duration::from_millis(50));
            }
            Err(e) => return Err(format!("wait error: {e}")),
        }
    }

    let status = child.wait().map_err(|e| format!("wait failed: {e}"))?;

    {
        let mut pid = RUNNING_PID.lock().unwrap();
        *pid = None;
    }

    let elapsed_ms = start.elapsed().as_millis() as u64;
    let stdout = stdout_handle.join().unwrap_or_default();
    let mut stderr = stderr_handle.join().unwrap_or_default();

    if timed_out {
        stderr.push_str(&format!(
            "\n[Sandbox] Execution timed out after {}s",
            TIMEOUT_SECS
        ));
    }

    if let Err(err) = std::fs::remove_file(&run_path) {
        stderr.push_str(&format!("\ncleanup failed: {err}"));
    }

    let result = RunResult {
        stdout,
        stderr,
        status: status.code().unwrap_or(-1),
        elapsed_ms,
        timed_out,
    };
    let _ = app.emit("python-done", result.clone());
    Ok(result)
}

fn kill_process(id: u32) {
    #[cfg(windows)]
    {
        let _ = Command::new("taskkill")
            .args(["/PID", &id.to_string(), "/F", "/T"])
            .output();
    }
    #[cfg(not(windows))]
    {
        unsafe {
            libc::kill(id as i32, libc::SIGTERM);
        }
    }
}

#[tauri::command]
fn stop_python() -> Result<String, String> {
    let pid = {
        let mut guard = RUNNING_PID.lock().unwrap();
        guard.take()
    };
    match pid {
        Some(id) => {
            kill_process(id);
            Ok(format!("プロセス {} を停止しました", id))
        }
        None => Ok("実行中のプロセスはありません".to_string()),
    }
}

fn resolve_python_path() -> Result<PathBuf, String> {
    // 1. Bundled embeddable Python (next to the exe)
    if let Ok(exe) = std::env::current_exe() {
        if let Some(exe_dir) = exe.parent() {
            let embedded = if cfg!(windows) {
                exe_dir.join("python-embed").join("python.exe")
            } else {
                exe_dir.join("python-embed").join("python")
            };
            if embedded.exists() {
                return Ok(embedded);
            }
        }
    }

    // 2. Fallback: .venv relative to cwd (development)
    let current_dir = std::env::current_dir().map_err(|err| err.to_string())?;
    let mut candidates = vec![current_dir.clone()];
    if let Some(parent) = current_dir.parent() {
        candidates.push(parent.to_path_buf());
    }
    for base in &candidates {
        let path = if cfg!(windows) {
            base.join(".venv").join("Scripts").join("python.exe")
        } else {
            base.join(".venv").join("bin").join("python")
        };
        if path.exists() {
            return Ok(path);
        }
    }
    Err(format!(
        "python not found. Checked embedded and .venv in {:?}",
        candidates
    ))
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
