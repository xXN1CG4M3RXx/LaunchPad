use serde::{Serialize, Deserialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::io::BufRead;
use tauri::Emitter;

// Structure for custom standalone scripts
#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct ScriptConfig {
    pub id: String,
    pub name: String,
    pub path: String,
    pub command: String,
}

// Structure for per-project configurations
#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct ProjectConfig {
    pub custom_command: Option<String>,
    pub is_pinned: bool,
}

// Global application configuration structure
#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct AppConfig {
    pub dev_dir: Option<String>,
    pub scan_depth: Option<usize>,
    pub projects: HashMap<String, ProjectConfig>,
    pub theme: Option<String>,
    pub scripts: Option<Vec<ScriptConfig>>,
}

// Project info returned to the frontend
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ProjectInfo {
    pub name: String,
    pub path: String,
    pub project_type: String, // Node, Rust, Go, Python, Generic
    pub default_command: String,
    pub git_branch: Option<String>,
}

// System tools version information
#[derive(Serialize)]
pub struct SystemInfo {
    pub node_version: Option<String>,
    pub cargo_version: Option<String>,
    pub git_version: Option<String>,
}

// Shared application state to track running process IDs and stdin writers
pub struct ProcessState {
    pub running_processes: Arc<Mutex<HashMap<String, u32>>>,
    pub stdin_writers: Arc<Mutex<HashMap<String, std::process::ChildStdin>>>,
}

// Helper to determine path of the config file
fn get_config_path() -> Option<std::path::PathBuf> {
    dirs::config_dir().map(|mut p| {
        p.push("LaunchPad");
        p.push("config.json");
        p
    })
}

#[tauri::command]
fn get_config() -> AppConfig {
    if let Some(path) = get_config_path() {
        if path.exists() {
            if let Ok(content) = std::fs::read_to_string(path) {
                if let Ok(config) = serde_json::from_str::<AppConfig>(&content) {
                    return config;
                }
            }
        }
    }
    AppConfig::default()
}

#[tauri::command]
fn save_config(config: AppConfig) -> Result<(), String> {
    if let Some(path) = get_config_path() {
        if let Some(parent) = path.parent() {
            if !parent.exists() {
                std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
        }
        let content = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
        std::fs::write(path, content).map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("Could not determine config directory".to_string())
    }
}

#[tauri::command]
fn select_directory(current_dir: Option<String>) -> Option<String> {
    let mut dialog = rfd::FileDialog::new().set_title("Wähle Entwicklungsordner");
    if let Some(curr) = current_dir {
        if std::path::Path::new(&curr).exists() {
            dialog = dialog.set_directory(curr);
        }
    }
    dialog.pick_folder().map(|p| p.to_string_lossy().to_string())
}

fn scan_dir_recursive(
    dir: &std::path::Path,
    current_depth: usize,
    max_depth: usize,
    projects: &mut Vec<ProjectInfo>,
) {
    if current_depth > max_depth {
        return;
    }

    let read_dir = match std::fs::read_dir(dir) {
        Ok(r) => r,
        Err(_) => return,
    };

    let mut is_project = false;
    let mut p_type = "Generic".to_string();
    let mut def_cmd = "".to_string();

    let paths: Vec<std::path::PathBuf> = read_dir
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .collect();

    let has_cargo = paths.iter().any(|p| p.file_name().map_or(false, |n| n == "Cargo.toml"));
    let has_package = paths.iter().any(|p| p.file_name().map_or(false, |n| n == "package.json"));
    let has_go = paths.iter().any(|p| p.file_name().map_or(false, |n| n == "go.mod"));
    let has_py = paths.iter().any(|p| p.file_name().map_or(false, |n| n == "requirements.txt" || n == "pyproject.toml"));
    let has_mvn = paths.iter().any(|p| p.file_name().map_or(false, |n| n == "pom.xml"));
    let has_gradle = paths.iter().any(|p| p.file_name().map_or(false, |n| n == "build.gradle" || n == "build.gradle.kts"));
    let has_docker = paths.iter().any(|p| p.file_name().map_or(false, |n| n == "docker-compose.yml" || n == "docker-compose.yaml"));

    if has_cargo {
        is_project = true;
        p_type = "Rust".to_string();
        def_cmd = "cargo run".to_string();
    } else if has_package {
        is_project = true;
        p_type = "Node".to_string();
        let mut cmd = "npm run dev".to_string();
        let package_json_path = dir.join("package.json");
        if let Ok(json_content) = std::fs::read_to_string(package_json_path) {
            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&json_content) {
                if let Some(scripts) = parsed.get("scripts").and_then(|s| s.as_object()) {
                    if scripts.contains_key("dev") {
                        cmd = "npm run dev".to_string();
                    } else if scripts.contains_key("start") {
                        cmd = "npm run start".to_string();
                    } else if let Some((first_script, _)) = scripts.iter().next() {
                        cmd = format!("npm run {}", first_script);
                    }
                }
            }
        }
        def_cmd = cmd;
    } else if has_go {
        is_project = true;
        p_type = "Go".to_string();
        def_cmd = "go run .".to_string();
    } else if has_py {
        is_project = true;
        p_type = "Python".to_string();
        let has_main = paths.iter().any(|p| p.file_name().map_or(false, |n| n == "main.py"));
        if has_main {
            def_cmd = "python main.py".to_string();
        } else {
            def_cmd = "python -m venv venv".to_string();
        }
    } else if has_mvn {
        is_project = true;
        p_type = "Java".to_string();
        def_cmd = "mvn spring-boot:run".to_string();
    } else if has_gradle {
        is_project = true;
        p_type = "Java".to_string();
        let has_bat = paths.iter().any(|p| p.file_name().map_or(false, |n| n == "gradlew.bat" || n == "gradlew"));
        if has_bat {
            def_cmd = if cfg!(target_os = "windows") { "gradlew.bat bootRun".to_string() } else { "./gradlew bootRun".to_string() };
        } else {
            def_cmd = "gradle bootRun".to_string();
        }
    } else if has_docker {
        is_project = true;
        p_type = "Docker".to_string();
        def_cmd = "docker compose up".to_string();
    }

    if is_project {
        let name = dir
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "Unbekannt".to_string());
        let path_str = dir.to_string_lossy().to_string();
        let git_branch = get_git_branch(dir);

        projects.push(ProjectInfo {
            name,
            path: path_str,
            project_type: p_type,
            default_command: def_cmd,
            git_branch,
        });
        return;
    }

    for path in paths {
        if path.is_dir() {
            if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                if name.starts_with('.') || name == "node_modules" || name == "target" || name == "venv" || name == "dist" || name == "build" {
                    continue;
                }
            }
            scan_dir_recursive(&path, current_depth + 1, max_depth, projects);
        }
    }
}

fn get_git_branch(dir: &std::path::Path) -> Option<String> {
    let mut cmd = std::process::Command::new("git");
    cmd.args(&["branch", "--show-current"]).current_dir(dir);

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let output = cmd.output();
    if let Ok(out) = output {
        if out.status.success() {
            let branch = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !branch.is_empty() {
                return Some(branch);
            }
        }
    }
    None
}

#[tauri::command]
fn scan_projects(dev_dir: String, scan_depth: Option<usize>) -> Result<Vec<ProjectInfo>, String> {
    let path = std::path::Path::new(&dev_dir);
    if !path.exists() || !path.is_dir() {
        return Err("Ordner existiert nicht".to_string());
    }
    let depth = scan_depth.unwrap_or(2);
    let mut projects = Vec::new();
    scan_dir_recursive(path, 1, depth, &mut projects);
    Ok(projects)
}

#[derive(Clone, Serialize)]
struct LogPayload {
    project_path: String,
    text: String,
}

#[derive(Clone, Serialize)]
struct StoppedPayload {
    project_path: String,
    exit_code: i32,
}

#[tauri::command]
fn select_file() -> Option<String> {
    rfd::FileDialog::new()
        .set_title("Script-Datei auswählen")
        .pick_file()
        .map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
fn send_stdin(
    state: tauri::State<'_, ProcessState>,
    project_path: String,
    text: String,
) -> Result<(), String> {
    let mut writers = state.stdin_writers.lock().unwrap();
    if let Some(stdin) = writers.get_mut(&project_path) {
        use std::io::Write;
        stdin.write_all(text.as_bytes()).map_err(|e| e.to_string())?;
        stdin.write_all(b"\n").map_err(|e| e.to_string())?;
        stdin.flush().map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("Prozess läuft nicht oder hat keinen Standard-Input-Stream".to_string())
    }
}

#[tauri::command]
fn start_project(
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, ProcessState>,
    project_path: String,
    command: String,
) -> Result<(), String> {
    let mut running = state.running_processes.lock().unwrap();
    if let Some(pid) = running.get(&project_path) {
        kill_process_tree(*pid);
        running.remove(&project_path);
        state.stdin_writers.lock().unwrap().remove(&project_path);
        let _ = app_handle.emit("project-stopped", StoppedPayload {
            project_path: project_path.clone(),
            exit_code: -1,
        });
    }

    let path = std::path::Path::new(&project_path);
    let current_dir = if path.is_file() {
        path.parent().unwrap_or(path)
    } else {
        path
    };

    let mut cmd = std::process::Command::new("cmd");
    cmd.args(&["/C", &format!("\"{}\"", command)]);
    cmd.current_dir(current_dir);
    cmd.stdin(std::process::Stdio::piped());
    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let mut child = cmd.spawn().map_err(|e| format!("Fehler beim Starten des Befehls: {}", e))?;
    let pid = child.id();
    running.insert(project_path.clone(), pid);
    if let Some(stdin) = child.stdin.take() {
        state.stdin_writers.lock().unwrap().insert(project_path.clone(), stdin);
    }

    let stdout = child.stdout.take().ok_or("Fehler beim Öffnen von stdout")?;
    let stderr = child.stderr.take().ok_or("Fehler beim Öffnen von stderr")?;

    let project_path_clone = project_path.clone();
    let app_handle_clone = app_handle.clone();
    let running_processes_clone = Arc::clone(&state.running_processes);
    let stdin_writers_clone = Arc::clone(&state.stdin_writers);

    std::thread::spawn(move || {
        let stdout_app_handle = app_handle_clone.clone();
        let stdout_path = project_path_clone.clone();
        let stdout_reader = std::io::BufReader::new(stdout);
        let stdout_path_for_thread = stdout_path.clone();
        std::thread::spawn(move || {
            for line in stdout_reader.lines() {
                if let Ok(l) = line {
                    let _ = stdout_app_handle.emit("project-log", LogPayload {
                        project_path: stdout_path_for_thread.clone(),
                        text: l,
                    });
                }
            }
        });

        let stderr_app_handle = app_handle_clone.clone();
        let stderr_path = project_path_clone.clone();
        let stderr_reader = std::io::BufReader::new(stderr);
        let stderr_path_for_thread = stderr_path.clone();
        std::thread::spawn(move || {
            for line in stderr_reader.lines() {
                if let Ok(l) = line {
                    let _ = stderr_app_handle.emit("project-log", LogPayload {
                        project_path: stderr_path_for_thread.clone(),
                        text: l,
                    });
                }
            }
        });

        let exit_status = child.wait();
        
        let mut running = running_processes_clone.lock().unwrap();
        if let Some(&current_pid) = running.get(&stdout_path) {
            if current_pid == pid {
                running.remove(&stdout_path);
            }
        }
        stdin_writers_clone.lock().unwrap().remove(&stdout_path);
        
        let code = match exit_status {
            Ok(status) => status.code().unwrap_or(0),
            Err(_) => -1,
        };

        let _ = app_handle_clone.emit("project-stopped", StoppedPayload {
            project_path: stdout_path.clone(),
            exit_code: code,
        });
        
        let _ = app_handle_clone.emit("project-log", LogPayload {
            project_path: stdout_path.clone(),
            text: format!("\n[Prozess mit Code {} beendet]", code),
        });
    });

    Ok(())
}

#[tauri::command]
fn stop_project(
    state: tauri::State<'_, ProcessState>,
    project_path: String,
) -> Result<(), String> {
    let mut running = state.running_processes.lock().unwrap();
    state.stdin_writers.lock().unwrap().remove(&project_path);
    if let Some(pid) = running.remove(&project_path) {
        kill_process_tree(pid);
        Ok(())
    } else {
        Err("Prozess läuft nicht".to_string())
    }
}

#[tauri::command]
fn is_project_running(
    state: tauri::State<'_, ProcessState>,
    project_path: String,
) -> bool {
    let running = state.running_processes.lock().unwrap();
    running.contains_key(&project_path)
}

fn kill_process_tree(pid: u32) {
    let mut cmd = std::process::Command::new("taskkill");
    cmd.args(&["/F", "/T", "/PID", &pid.to_string()]);
    
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    let _ = cmd.status();
}

#[tauri::command]
fn open_in_ide(project_path: String, editor: Option<String>) -> Result<(), String> {
    let editor_cmd = editor.unwrap_or_else(|| "code".to_string());
    let mut cmd = std::process::Command::new("cmd");
    cmd.args(&["/C", &format!("{} .", editor_cmd)]);
    cmd.current_dir(&project_path);
    
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000);
    }
    
    cmd.spawn().map_err(|e| format!("Fehler beim Öffnen der IDE: {}", e))?;
    Ok(())
}

#[tauri::command]
fn open_in_explorer(project_path: String) -> Result<(), String> {
    let mut cmd = std::process::Command::new("explorer");
    cmd.arg(&project_path);
    
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000);
    }
    
    cmd.spawn().map_err(|e| format!("Fehler beim Öffnen des Explorers: {}", e))?;
    Ok(())
}

#[derive(Serialize)]
pub struct GitDetails {
    pub last_commit: Option<String>,
    pub has_changes: bool,
}

#[tauri::command]
fn get_git_details(project_path: String) -> GitDetails {
    let run_cmd = |args: &[&str]| -> Option<String> {
        let mut cmd = std::process::Command::new("git");
        cmd.args(args).current_dir(&project_path);
        
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }

        let output = cmd.output().ok()?;
        if output.status.success() {
            let s = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !s.is_empty() {
                return Some(s);
            }
        }
        None
    };

    let last_commit = run_cmd(&["log", "-1", "--format=%h - %s (%cr)"]);
    let status_out = run_cmd(&["status", "--porcelain"]);
    let has_changes = status_out.map_or(false, |s| !s.trim().is_empty());

    GitDetails {
        last_commit,
        has_changes,
    }
}

#[tauri::command]
fn open_in_browser(url: String) -> Result<(), String> {
    let mut cmd = std::process::Command::new("cmd");
    cmd.args(&["/C", "start", &url]);
    
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    
    cmd.spawn().map_err(|e| format!("Fehler beim Öffnen des Browsers: {}", e))?;
    Ok(())
}

#[tauri::command]
fn get_system_info() -> SystemInfo {
    let get_ver = |cmd_name: &str, arg: &str| -> Option<String> {
        let mut cmd = std::process::Command::new("cmd");
        cmd.args(&["/C", &format!("{} {}", cmd_name, arg)]);
        
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x08000000);
        }

        let output = cmd.output();
        if let Ok(out) = output {
            if out.status.success() {
                let ver = String::from_utf8_lossy(&out.stdout).trim().to_string();
                if !ver.is_empty() {
                    return Some(ver);
                }
            }
        }
        None
    };

    SystemInfo {
        node_version: get_ver("node", "--version"),
        cargo_version: get_ver("cargo", "--version"),
        git_version: get_ver("git", "--version"),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(ProcessState {
            running_processes: Arc::new(Mutex::new(HashMap::new())),
            stdin_writers: Arc::new(Mutex::new(HashMap::new())),
        })
        .invoke_handler(tauri::generate_handler![
            get_config,
            save_config,
            select_directory,
            select_file,
            send_stdin,
            scan_projects,
            start_project,
            stop_project,
            is_project_running,
            open_in_ide,
            open_in_explorer,
            get_system_info,
            get_git_details,
            open_in_browser
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
