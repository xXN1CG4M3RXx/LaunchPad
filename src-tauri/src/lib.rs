use serde::{Serialize, Deserialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::Emitter;

// Structure for custom standalone scripts
#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct ScriptConfig {
    pub id: String,
    pub name: String,
    pub path: String,
    pub command: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct ProjectScript {
    pub name: String,
    pub command: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ActivePort {
    pub port: u16,
    pub pid: u32,
    pub process_name: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct EnvEntry {
    pub key: String,
    pub value: String,
}

// Structure for per-project configurations
#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct ProjectConfig {
    pub custom_command: Option<String>,
    pub is_pinned: bool,
    pub custom_scripts: Option<Vec<ProjectScript>>,
    pub target_port: Option<u16>,
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
    pub project_type: String, // Node, Rust, Go, Python, Java, Docker, Static, Generic
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
    let has_static = paths.iter().any(|p| p.file_name().map_or(false, |n| n == "index.html"));

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
    } else if has_static {
        is_project = true;
        p_type = "Static".to_string();
        def_cmd = "npx -y serve".to_string();
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
    cmd.current_dir(current_dir);
    cmd.env("PYTHONUNBUFFERED", "1");
    cmd.stdin(std::process::Stdio::piped());
    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.raw_arg("/C");
        cmd.raw_arg(&command);
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    #[cfg(not(windows))]
    {
        cmd.arg("/C");
        cmd.arg(&command);
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
        let mut stdout_reader = stdout;
        let stdout_path_for_thread = stdout_path.clone();
        std::thread::spawn(move || {
            use std::io::Read;
            let mut buf = [0; 4096];
            loop {
                match stdout_reader.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        let text = String::from_utf8_lossy(&buf[..n]).to_string();
                        let _ = stdout_app_handle.emit("project-log", LogPayload {
                            project_path: stdout_path_for_thread.clone(),
                            text,
                        });
                    }
                    Err(_) => break,
                }
            }
        });

        let stderr_app_handle = app_handle_clone.clone();
        let stderr_path = project_path_clone.clone();
        let mut stderr_reader = stderr;
        let stderr_path_for_thread = stderr_path.clone();
        std::thread::spawn(move || {
            use std::io::Read;
            let mut buf = [0; 4096];
            loop {
                match stderr_reader.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        let text = String::from_utf8_lossy(&buf[..n]).to_string();
                        let _ = stderr_app_handle.emit("project-log", LogPayload {
                            project_path: stderr_path_for_thread.clone(),
                            text,
                        });
                    }
                    Err(_) => break,
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
fn kill_process_by_pid(pid: u32) -> Result<(), String> {
    kill_process_tree(pid);
    Ok(())
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

#[tauri::command]
fn get_active_ports() -> Result<Vec<ActivePort>, String> {
    #[cfg(windows)]
    {
        // 1. Build a map of PID -> Process Name using tasklist
        let mut process_map = HashMap::new();
        let mut tasklist_cmd = std::process::Command::new("tasklist");
        tasklist_cmd.args(&["/FO", "CSV", "/NH"]);

        use std::os::windows::process::CommandExt;
        tasklist_cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

        if let Ok(output) = tasklist_cmd.output() {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                for line in stdout.lines() {
                    let parts: Vec<&str> = line.split("\",\"").collect();
                    if parts.len() >= 2 {
                        let image_name = parts[0].trim_start_matches('"').to_string();
                        let pid_str = parts[1].trim_end_matches('"').trim();
                        if let Ok(pid) = pid_str.parse::<u32>() {
                            process_map.insert(pid, image_name);
                        }
                    }
                }
            }
        }

        // 2. Parse netstat -ano to find active TCP listeners
        let mut netstat_cmd = std::process::Command::new("netstat");
        netstat_cmd.args(&["-ano"]);

        netstat_cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

        let output = netstat_cmd.output().map_err(|e| format!("Fehler beim Ausführen von netstat: {}", e))?;
        if !output.status.success() {
            return Err("netstat-Befehl fehlgeschlagen".to_string());
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        let mut raw_ports = Vec::new();

        for line in stdout.lines() {
            let tokens: Vec<&str> = line.split_whitespace().collect();
            if tokens.len() >= 5 {
                let proto = tokens[0];
                let local_addr = tokens[1];
                let state = tokens[3];
                let pid_str = tokens[4];

                if proto == "TCP" && state == "LISTENING" {
                    if let Some(port_idx) = local_addr.rfind(':') {
                        let port_str = &local_addr[port_idx + 1..];
                        if let Ok(port) = port_str.parse::<u16>() {
                            if let Ok(pid) = pid_str.parse::<u32>() {
                                let process_name = process_map.get(&pid).cloned().unwrap_or_else(|| "Unbekannt".to_string());
                                raw_ports.push(ActivePort {
                                    port,
                                    pid,
                                    process_name,
                                });
                            }
                        }
                    }
                }
            }
        }

        // Sort and deduplicate by port number
        raw_ports.sort_by_key(|p| p.port);
        let mut seen_ports = std::collections::HashSet::new();
        let mut active_ports = Vec::new();

        for ap in raw_ports {
            if seen_ports.insert(ap.port) {
                active_ports.push(ap);
            }
        }

        Ok(active_ports)
    }

    #[cfg(not(windows))]
    {
        Ok(Vec::new())
    }
}

#[tauri::command]
fn save_log_file(default_name: String, content: String) -> Result<bool, String> {
    let file_path = rfd::FileDialog::new()
        .set_title("Log-Datei speichern")
        .set_file_name(&default_name)
        .add_filter("Log-Dateien", &["log", "txt"])
        .save_file();

    if let Some(path) = file_path {
        std::fs::write(&path, content).map_err(|e| format!("Fehler beim Schreiben der Log-Datei: {}", e))?;
        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
fn read_env_file(project_path: String) -> Result<Option<Vec<EnvEntry>>, String> {
    let env_path = std::path::PathBuf::from(&project_path).join(".env");
    if !env_path.exists() {
        return Ok(None);
    }

    let content = std::fs::read_to_string(&env_path).map_err(|e| format!("Fehler beim Lesen der .env-Datei: {}", e))?;
    let mut entries = Vec::new();

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        if let Some(eq_idx) = line.find('=') {
            let key = line[..eq_idx].trim().to_string();
            let val_raw = line[eq_idx + 1..].trim();

            // Strip matching quotes
            let mut value = val_raw.to_string();
            if (value.starts_with('"') && value.ends_with('"')) || (value.starts_with('\'') && value.ends_with('\'')) {
                if value.len() >= 2 {
                    value = value[1..value.len() - 1].to_string();
                }
            }

            entries.push(EnvEntry { key, value });
        }
    }

    Ok(Some(entries))
}

#[tauri::command]
fn save_env_file(project_path: String, entries: Vec<EnvEntry>) -> Result<(), String> {
    use std::collections::HashSet;
    use std::io::Write;

    let env_path = std::path::PathBuf::from(&project_path).join(".env");
    let mut written_keys = HashSet::new();
    let mut new_lines = Vec::new();

    if env_path.exists() {
        let content = std::fs::read_to_string(&env_path).map_err(|e| format!("Fehler beim Lesen der .env-Datei: {}", e))?;
        for line in content.lines() {
            if let Some(eq_idx) = line.find('=') {
                let left_part = &line[..eq_idx];
                if left_part.trim().starts_with('#') {
                    new_lines.push(line.to_string());
                    continue;
                }

                let key = left_part.trim().to_string();
                if let Some(entry) = entries.iter().find(|e| e.key == key) {
                    new_lines.push(format!("{}={}", key, entry.value));
                    written_keys.insert(key);
                } else {
                    // Key was deleted, skip line
                }
            } else {
                new_lines.push(line.to_string());
            }
        }
    }

    // Append any new entries
    for entry in &entries {
        if !written_keys.contains(&entry.key) {
            new_lines.push(format!("{}={}", entry.key, entry.value));
        }
    }

    // Write back
    let mut file = std::fs::File::create(&env_path).map_err(|e| format!("Fehler beim Erstellen der .env-Datei: {}", e))?;
    for line in new_lines {
        writeln!(file, "{}", line).map_err(|e| format!("Fehler beim Schreiben der .env-Datei: {}", e))?;
    }

    Ok(())
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DockerContainer {
    pub id: String,
    pub name: String,
    pub image: String,
    pub status: String,
    pub ports: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct HttpResponse {
    pub status: u16,
    pub status_text: String,
    pub headers: HashMap<String, String>,
    pub body: String,
    pub elapsed_ms: u64,
    pub size_bytes: usize,
}

#[tauri::command]
async fn get_docker_containers() -> Result<Vec<DockerContainer>, String> {
    let mut cmd = std::process::Command::new("docker");
    cmd.args(&["ps", "-a", "--format", "{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}"]);

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let output = cmd.output().map_err(|e| format!("Fehler beim Ausführen von docker ps: {}", e))?;
    if !output.status.success() {
        return Err("Docker-Dienst läuft eventuell nicht oder ist nicht installiert".to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut containers = Vec::new();
    for line in stdout.lines() {
        let parts: Vec<&str> = line.split('|').collect();
        if parts.len() >= 4 {
            containers.push(DockerContainer {
                id: parts[0].trim().to_string(),
                name: parts[1].trim().to_string(),
                image: parts[2].trim().to_string(),
                status: parts[3].trim().to_string(),
                ports: parts.get(4).unwrap_or(&"").trim().to_string(),
            });
        }
    }
    Ok(containers)
}

#[tauri::command]
async fn manage_docker_container(id: String, action: String) -> Result<(), String> {
    let mut cmd = std::process::Command::new("docker");
    match action.as_str() {
        "start" => cmd.args(&["start", &id]),
        "stop" => cmd.args(&["stop", &id]),
        "restart" => cmd.args(&["restart", &id]),
        _ => return Err("Ungültige Docker-Aktion".to_string()),
    };

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let output = cmd.output().map_err(|e| format!("Fehler bei Docker-Aktion: {}", e))?;
    if !output.status.success() {
        let error_msg = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Docker-Aktion fehlgeschlagen: {}", error_msg.trim()));
    }
    Ok(())
}

#[tauri::command]
async fn get_docker_logs(id: String, tail: Option<usize>) -> Result<String, String> {
    let mut cmd = std::process::Command::new("docker");
    let tail_str = tail.unwrap_or(100).to_string();
    cmd.args(&["logs", "--tail", &tail_str, &id]);

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let output = cmd.output().map_err(|e| format!("Fehler beim Laden der Docker-Logs: {}", e))?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    
    let mut merged = String::new();
    if !stdout.is_empty() {
        merged.push_str(&stdout);
    }
    if !stderr.is_empty() {
        if !merged.is_empty() && !merged.ends_with('\n') {
            merged.push('\n');
        }
        merged.push_str(&stderr);
    }
    Ok(merged)
}

#[tauri::command]
async fn send_http_request(
    method: String,
    url: String,
    headers: Vec<(String, String)>,
    body: Option<String>,
) -> Result<HttpResponse, String> {
    use reqwest::header::{HeaderName, HeaderValue, HeaderMap};
    use std::time::Instant;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Fehler beim Erstellen des HTTP-Clients: {}", e))?;

    let req_method = match method.to_uppercase().as_str() {
        "GET" => reqwest::Method::GET,
        "POST" => reqwest::Method::POST,
        "PUT" => reqwest::Method::PUT,
        "DELETE" => reqwest::Method::DELETE,
        "PATCH" => reqwest::Method::PATCH,
        "HEAD" => reqwest::Method::HEAD,
        "OPTIONS" => reqwest::Method::OPTIONS,
        _ => return Err(format!("Ungültige HTTP-Methode: {}", method)),
    };

    let mut req_builder = client.request(req_method, &url);

    let mut req_headers = HeaderMap::new();
    for (k, v) in headers {
        if let Ok(name) = HeaderName::from_bytes(k.as_bytes()) {
            if let Ok(val) = HeaderValue::from_str(&v) {
                req_headers.insert(name, val);
            }
        }
    }
    req_builder = req_builder.headers(req_headers);

    if let Some(b) = body {
        if !b.is_empty() && method.to_uppercase() != "GET" && method.to_uppercase() != "HEAD" {
            req_builder = req_builder.body(b);
        }
    }

    let start = Instant::now();
    let res = req_builder.send().await.map_err(|e| format!("HTTP-Anfrage fehlgeschlagen: {}", e))?;
    let elapsed = start.elapsed().as_millis() as u64;

    let status = res.status().as_u16();
    let status_text = res.status().canonical_reason().unwrap_or("Unknown").to_string();

    let mut res_headers = HashMap::new();
    for (name, val) in res.headers().iter() {
        let name_str = name.as_str().to_string();
        if let Ok(val_str) = val.to_str() {
            res_headers.insert(name_str, val_str.to_string());
        }
    }

    let body_text = res.text().await.unwrap_or_default();
    let size_bytes = body_text.len();

    Ok(HttpResponse {
        status,
        status_text,
        headers: res_headers,
        body: body_text,
        elapsed_ms: elapsed,
        size_bytes,
    })
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
            open_in_browser,
            get_active_ports,
            kill_process_by_pid,
            read_env_file,
            save_env_file,
            save_log_file,
            get_docker_containers,
            manage_docker_container,
            get_docker_logs,
            send_http_request
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
