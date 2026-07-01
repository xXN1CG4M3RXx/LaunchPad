import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { Rocket, FolderKanban, Settings as SettingsIcon, Terminal, FileCode } from "lucide-react";

import { AppConfig, ProjectInfo } from "./types";
import { Dashboard } from "./components/Dashboard";
import { Settings } from "./components/Settings";
import { ConsoleDrawer } from "./components/ConsoleDrawer";
import { ProjectDetails } from "./components/ProjectDetails";
import { Scripts } from "./components/Scripts";

function App() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "settings" | "scripts">("dashboard");
  const [config, setConfig] = useState<AppConfig>({
    dev_dir: null,
    scan_depth: 2,
    projects: {},
    theme: "dark",
    scripts: [],
  });
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectInfo | null>(null);
  
  // Track running projects status
  const [runningProjects, setRunningProjects] = useState<Record<string, boolean>>({});
  
  // Track logs for each running project
  const [projectLogs, setProjectLogs] = useState<Record<string, string[]>>({});
  
  // Console Drawer state
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [consoleProject, setConsoleProject] = useState<{ name: string; path: string } | null>(null);

  const handleSendStdin = async (projectPath: string, text: string) => {
    // Append command prompt log locally in stdout log immediately to maintain correct stream ordering
    setProjectLogs((prev) => {
      const currentLogs = prev[projectPath] || [];
      const lines = [`> ${text}`];
      
      if (currentLogs.length === 0) {
        return {
          ...prev,
          [projectPath]: [...lines, ""],
        };
      }
      
      const newLogs = [...currentLogs];
      newLogs[newLogs.length - 1] = newLogs[newLogs.length - 1] + lines[0];
      newLogs.push(""); // Force a new line because the user pressed Enter/Submit
      
      if (newLogs.length > 2000) {
        newLogs.splice(0, newLogs.length - 2000);
      }
      
      return {
        ...prev,
        [projectPath]: newLogs,
      };
    });

    try {
      await invoke("send_stdin", { projectPath, text });
    } catch (e) {
      console.error("Fehler beim Senden von stdin:", e);
      setProjectLogs((prev) => ({
        ...prev,
        [projectPath]: [...(prev[projectPath] || []), `[Fehler beim Senden an stdin: ${e}]`],
      }));
    }
  };

  // 1. Load config on startup and bind global event listeners
  useEffect(() => {
    let unlistenLog: (() => void) | null = null;
    let unlistenStopped: (() => void) | null = null;
    let isDestroyed = false;

    const setupGlobalListeners = async () => {
      try {
        const uLog = await listen<{ project_path: string; text: string }>(
          "project-log",
          (event) => {
            const { project_path, text } = event.payload;
            setProjectLogs((prev) => {
              const currentLogs = prev[project_path] || [];
              const lines = text.split("\n");
              
              if (currentLogs.length === 0) {
                return {
                  ...prev,
                  [project_path]: lines,
                };
              }
              
              const newLogs = [...currentLogs];
              newLogs[newLogs.length - 1] = newLogs[newLogs.length - 1] + lines[0];
              
              for (let i = 1; i < lines.length; i++) {
                newLogs.push(lines[i]);
              }
              
              if (newLogs.length > 2000) {
                newLogs.splice(0, newLogs.length - 2000);
              }
              
              return {
                ...prev,
                [project_path]: newLogs,
              };
            });
          }
        );

        if (isDestroyed) {
          uLog();
        } else {
          unlistenLog = uLog;
        }

        const uStopped = await listen<{ project_path: string; exit_code: number }>(
          "project-stopped",
          (event) => {
            const { project_path } = event.payload;
            setRunningProjects((prev) => ({
              ...prev,
              [project_path]: false,
            }));
          }
        );

        if (isDestroyed) {
          uStopped();
        } else {
          unlistenStopped = uStopped;
        }
      } catch (e) {
        console.error("Fehler beim Einrichten der globalen Event-Listener:", e);
      }
    };

    setupGlobalListeners();

    const loadConfig = async () => {
      try {
        const loadedConfig = await invoke<AppConfig>("get_config");
        setConfig(loadedConfig);
        
        // If dev directory is already configured, scan immediately
        if (loadedConfig.dev_dir) {
          scanProjects(loadedConfig.dev_dir, loadedConfig.scan_depth || 2);
        }
      } catch (e) {
        console.error("Fehler beim Laden der Konfiguration:", e);
      }
    };
    loadConfig();

    return () => {
      isDestroyed = true;
      // Clean up global event listeners on unmount
      if (unlistenLog) unlistenLog();
      if (unlistenStopped) unlistenStopped();
    };
  }, []);

  // Theme Manager: Dark mode is default
  useEffect(() => {
    const currentTheme = config.theme || "dark";
    if (currentTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [config.theme]);

  // 3. Scan projects
  const scanProjects = async (dir: string, depth: number) => {
    setIsScanning(true);
    try {
      const scanned = await invoke<ProjectInfo[]>("scan_projects", {
        devDir: dir,
        scanDepth: depth,
      });
      setProjects(scanned);

      // Verify running status for each scanned project
      const statusMap: Record<string, boolean> = {};
      for (const p of scanned) {
        const isRunning = await invoke<boolean>("is_project_running", {
          projectPath: p.path,
        });
        statusMap[p.path] = isRunning;
      }
      setRunningProjects(statusMap);
    } catch (e) {
      console.error("Fehler beim Scannen der Projekte:", e);
    } finally {
      setIsScanning(false);
    }
  };

  // Save config wrapper
  const handleSaveConfig = async (newConfig: AppConfig) => {
    try {
      await invoke("save_config", { config: newConfig });
      setConfig(newConfig);

      // If directory changed, trigger a re-scan
      if (newConfig.dev_dir) {
        scanProjects(newConfig.dev_dir, newConfig.scan_depth || 2);
      } else {
        setProjects([]);
        setRunningProjects({});
      }
    } catch (e) {
      console.error("Fehler beim Speichern der Konfiguration:", e);
    }
  };

  // Trigger directory picker directly from Welcome screen
  const handleWelcomeDirectoryPick = async () => {
    try {
      const selected = await invoke<string | null>("select_directory", {
        currentDir: null,
      });
      if (selected) {
        const newConfig = {
          ...config,
          dev_dir: selected,
        };
        handleSaveConfig(newConfig);
      }
    } catch (e) {
      console.error("Fehler beim Auswählen des Ordners:", e);
    }
  };

  // Trigger project start
  const handleStartProject = async (projectPath: string, command: string) => {
    // Clear logs from previous runs
    setProjectLogs((prev) => ({
      ...prev,
      [projectPath]: [`> ${command}\n`],
    }));
    
    setRunningProjects((prev) => ({
      ...prev,
      [projectPath]: true,
    }));

    try {
      await invoke("start_project", { projectPath, command });
    } catch (e) {
      console.error("Fehler beim Starten des Projekts:", e);
      setRunningProjects((prev) => ({
        ...prev,
        [projectPath]: false,
      }));
      setProjectLogs((prev) => ({
        ...prev,
        [projectPath]: [...(prev[projectPath] || []), `[Fehler beim Starten: ${e}]`],
      }));
    }
  };

  // Trigger project stop
  const handleStopProject = async (projectPath: string) => {
    try {
      await invoke("stop_project", { projectPath });
      setRunningProjects((prev) => ({
        ...prev,
        [projectPath]: false,
      }));
    } catch (e) {
      console.error("Fehler beim Stoppen des Projekts:", e);
    }
  };

  // Open the terminal console drawer
  const handleOpenConsole = (project: { name: string; path: string }) => {
    setConsoleProject(project);
    setConsoleOpen(true);
  };

  // Get count of currently running servers
  const runningCount = Object.values(runningProjects).filter(Boolean).length;

  return (
    <div className="flex h-screen w-screen bg-brand-50 dark:bg-slate-950 overflow-hidden font-sans text-slate-700 dark:text-slate-200 select-none transition-colors duration-300">
      
      {/* Sidebar navigation */}
      <aside className="w-64 bg-slate-900 dark:bg-slate-955 border-r border-slate-800 dark:border-slate-900 flex flex-col shrink-0">
        {/* Sidebar Brand header */}
        <div className="h-16 px-6 border-b border-slate-850 flex items-center space-x-3 bg-slate-950/40 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] brand-gradient-bg"></div>
          <div className="p-1.5 bg-brand-500 rounded-lg text-white">
            <Rocket className="w-5 h-5" />
          </div>
          <span className="gradient-text font-black text-xl tracking-wider font-display">LaunchPad</span>
        </div>

        {/* Sidebar Navigation Options */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-medium text-sm transition-all active:scale-[0.98] ${
              activeTab === "dashboard"
                ? "bg-brand-600 text-white shadow-md shadow-brand-900/10"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            <div className="flex items-center space-x-3">
              <FolderKanban className="w-4.5 h-4.5" />
              <span>Projects</span>
            </div>
            {runningCount > 0 && (
              <span className={`inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded-full shrink-0 ${
                activeTab === "dashboard" ? "bg-white text-brand-700" : "bg-emerald-500 text-white animate-pulse"
              }`}>
                {runningCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("scripts")}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium text-sm transition-all active:scale-[0.98] ${
              activeTab === "scripts"
                ? "bg-brand-600 text-white shadow-md shadow-brand-900/10"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            <FileCode className="w-4.5 h-4.5" />
            <span>Scripts</span>
          </button>

          <button
            onClick={() => setActiveTab("settings")}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium text-sm transition-all active:scale-[0.98] ${
              activeTab === "settings"
                ? "bg-brand-600 text-white shadow-md shadow-brand-900/10"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            <SettingsIcon className="w-4.5 h-4.5" />
            <span>Settings</span>
          </button>
        </nav>

        {/* Console shortcut footer if something is running */}
        {runningCount > 0 && (
          <div className="p-4 border-t border-slate-800 bg-slate-950/20">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
              <div className="flex items-center space-x-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="font-semibold text-slate-400">Active Processes</span>
              </div>
            </div>
            <button
              onClick={() => {
                // Find first running project
                const runningPath = Object.keys(runningProjects).find((k) => runningProjects[k]);
                if (runningPath) {
                  const runningProj = projects.find((p) => p.path === runningPath);
                  if (runningProj) {
                    handleOpenConsole(runningProj);
                  } else {
                    const runningScript = config.scripts?.find((s) => s.path === runningPath);
                    if (runningScript) {
                      handleOpenConsole({ name: runningScript.name, path: runningScript.path });
                    }
                  }
                }
              }}
              className="w-full flex items-center justify-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold py-2 px-3 rounded-lg border border-slate-700 text-xs transition-colors"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Open Latest Console</span>
            </button>
          </div>
        )}
      </aside>

      {/* Main panel area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-brand-50/30 dark:bg-slate-900/50">
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-8 py-8">
          {activeTab === "dashboard" ? (
            selectedProject ? (
              <ProjectDetails
                project={selectedProject}
                isRunning={runningProjects[selectedProject.path] || false}
                logs={projectLogs[selectedProject.path] || []}
                config={config}
                onBack={() => setSelectedProject(null)}
                onStart={handleStartProject}
                onStop={handleStopProject}
                onClearLogs={() => setProjectLogs((prev) => ({ ...prev, [selectedProject.path]: [] }))}
                onSaveConfig={handleSaveConfig}
              />
            ) : (
              <Dashboard
                projects={projects}
                runningProjects={runningProjects}
                projectLogs={projectLogs}
                config={config}
                onSaveConfig={handleSaveConfig}
                onStartProject={handleStartProject}
                onStopProject={handleStopProject}
                onOpenConsole={handleOpenConsole}
                onSelectProject={setSelectedProject}
                onRefresh={
                  config.dev_dir 
                    ? () => scanProjects(config.dev_dir!, config.scan_depth || 2) 
                    : handleWelcomeDirectoryPick
                }
                isScanning={isScanning}
              />
            )
          ) : activeTab === "scripts" ? (
            <Scripts
              config={config}
              runningProjects={runningProjects}
              onSaveConfig={handleSaveConfig}
              onStartScript={handleStartProject}
              onStopScript={handleStopProject}
              onOpenConsole={handleOpenConsole}
            />
          ) : (
            <Settings config={config} onSaveConfig={handleSaveConfig} />
          )}
        </div>
      </main>

      {/* Real-time Console Log Drawer */}
      {consoleProject && (
        <ConsoleDrawer
          isOpen={consoleOpen}
          onClose={() => setConsoleOpen(false)}
          projectName={consoleProject.name}
          projectPath={consoleProject.path}
          isRunning={runningProjects[consoleProject.path] || false}
          logs={projectLogs[consoleProject.path] || []}
          onClear={() => setProjectLogs((prev) => ({ ...prev, [consoleProject.path]: [] }))}
          onStop={() => handleStopProject(consoleProject.path)}
          onSendInput={(text) => handleSendStdin(consoleProject.path, text)}
        />
      )}

    </div>
  );
}

export default App;
