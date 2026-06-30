import React, { useState, useMemo } from "react";
import { 
  Search, Play, Square, Terminal, 
  Folder, Pin, RefreshCw, FolderSearch, Code
} from "lucide-react";
import { ProjectInfo, AppConfig } from "../types";
import { invoke } from "@tauri-apps/api/core";

interface DashboardProps {
  projects: ProjectInfo[];
  runningProjects: Record<string, boolean>;
  config: AppConfig;
  onSaveConfig: (newConfig: AppConfig) => void;
  onStartProject: (projectPath: string, command: string) => void;
  onStopProject: (projectPath: string) => void;
  onOpenConsole: (project: ProjectInfo) => void;
  onRefresh: () => void;
  isScanning: boolean;
}

export const Dashboard: React.FC<DashboardProps> = ({
  projects,
  runningProjects,
  config,
  onSaveConfig,
  onStartProject,
  onStopProject,
  onOpenConsole,
  onRefresh,
  isScanning,
}) => {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("All");
  const [showRunningOnly, setShowRunningOnly] = useState(false);
  const [editingCommand, setEditingCommand] = useState<string | null>(null);
  const [tempCommandValue, setTempCommandValue] = useState("");

  // Helper to open VS Code
  const handleOpenIDE = async (path: string) => {
    try {
      await invoke("open_in_ide", { projectPath: path });
    } catch (e) {
      console.error("Failed to open VS Code:", e);
    }
  };

  // Helper to open Explorer
  const handleOpenExplorer = async (path: string) => {
    try {
      await invoke("open_in_explorer", { projectPath: path });
    } catch (e) {
      console.error("Failed to open Explorer:", e);
    }
  };

  // Pin / Unpin a project
  const togglePin = (path: string) => {
    const projectConf = config.projects[path] || { custom_command: null, is_pinned: false };
    const updatedProjects = {
      ...config.projects,
      [path]: {
        ...projectConf,
        is_pinned: !projectConf.is_pinned,
      },
    };
    onSaveConfig({
      ...config,
      projects: updatedProjects,
    });
  };

  // Start command editing
  const startEditing = (path: string, val: string) => {
    setEditingCommand(path);
    setTempCommandValue(val);
  };

  // Save the custom start command
  const saveCustomCommand = (path: string) => {
    const projectConf = config.projects[path] || { custom_command: null, is_pinned: false };
    const cleanCommand = tempCommandValue.trim();
    
    const updatedProjects = {
      ...config.projects,
      [path]: {
        ...projectConf,
        custom_command: cleanCommand || null,
      },
    };
    
    onSaveConfig({
      ...config,
      projects: updatedProjects,
    });
    setEditingCommand(null);
  };

  // Get active command for project (custom command or fallback default command)
  const getActiveCommand = (project: ProjectInfo) => {
    const custom = config.projects[project.path]?.custom_command;
    return custom !== undefined && custom !== null ? custom : project.default_command;
  };

  // Filters and sorts projects list
  const processedProjects = useMemo(() => {
    return projects
      .filter((p) => {
        // Name search
        const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
        
        // Project type filter
        const matchesType = filterType === "All" || p.project_type === filterType;
        
        // Status filter
        const isRunning = runningProjects[p.path] || false;
        const matchesStatus = !showRunningOnly || isRunning;

        return matchesSearch && matchesType && matchesStatus;
      })
      .sort((a, b) => {
        // Sort by Pinned first, then alphabetically
        const aPinned = config.projects[a.path]?.is_pinned ? 1 : 0;
        const bPinned = config.projects[b.path]?.is_pinned ? 1 : 0;
        if (aPinned !== bPinned) return bPinned - aPinned;
        return a.name.localeCompare(b.name);
      });
  }, [projects, search, filterType, showRunningOnly, config.projects, runningProjects]);

  // Project type rendering helper
  const getProjectTypeStyles = (type: string) => {
    switch (type) {
      case "Node":
        return {
          bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
          dot: "bg-emerald-500",
          label: "Node.js"
        };
      case "Rust":
        return {
          bg: "bg-orange-50 text-orange-700 border-orange-200",
          dot: "bg-orange-500",
          label: "Rust"
        };
      case "Go":
        return {
          bg: "bg-cyan-50 text-cyan-700 border-cyan-200",
          dot: "bg-cyan-500",
          label: "Go"
        };
      case "Python":
        return {
          bg: "bg-blue-50 text-blue-700 border-blue-200",
          dot: "bg-blue-500",
          label: "Python"
        };
      default:
        return {
          bg: "bg-slate-50 text-slate-700 border-slate-200",
          dot: "bg-slate-500",
          label: "Generisch"
        };
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Top action row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Projekte</h1>
          <p className="text-sm text-slate-500 mt-1">Verwalte und starte deine lokalen Entwicklungsserver.</p>
        </div>

        <button
          onClick={onRefresh}
          disabled={isScanning || !config.dev_dir}
          className="flex items-center justify-center space-x-2 bg-brand-50 hover:bg-brand-100 text-brand-700 font-medium px-4 py-2.5 rounded-lg border border-brand-200 transition-colors shadow-sm disabled:opacity-50 active:scale-[0.98] shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
          <span>{isScanning ? "Scanne..." : "Aktualisieren"}</span>
        </button>
      </div>

      {config.dev_dir ? (
        <>
          {/* Filters Bar */}
          <div className="bg-white rounded-xl border border-brand-100 p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
            {/* Search */}
            <div className="relative w-full md:max-w-xs">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Projekt suchen..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-brand-400 focus:ring-1 focus:ring-brand-400 transition-all text-slate-700"
              />
            </div>

            {/* Selection tags */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-start md:justify-end text-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 mr-1 hidden sm:inline">Typ:</span>
              {["All", "Node", "Rust", "Go", "Python", "Generic"].map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`px-3 py-1.5 rounded-lg font-medium border transition-colors ${
                    filterType === type 
                      ? 'bg-brand-600 border-brand-600 text-white shadow-sm'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {type === "All" ? "Alle" : type === "Generic" ? "Generisch" : type}
                </button>
              ))}

              <div className="h-6 w-px bg-slate-200 mx-2 hidden sm:block"></div>

              {/* Status filter Toggle */}
              <button
                onClick={() => setShowRunningOnly(!showRunningOnly)}
                className={`px-3 py-1.5 rounded-lg font-medium border transition-colors flex items-center space-x-1.5 ${
                  showRunningOnly 
                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${showRunningOnly ? 'bg-white animate-pulse' : 'bg-emerald-500'}`}></span>
                <span>Nur laufende</span>
              </button>
            </div>
          </div>

          {/* Project List / Grid */}
          {processedProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-brand-100 shadow-sm text-center">
              <div className="p-4 bg-brand-50 rounded-full text-brand-500 mb-4">
                <FolderSearch className="w-8 h-8" />
              </div>
              <h3 className="text-base font-semibold text-slate-800">Keine Projekte gefunden</h3>
              <p className="text-sm text-slate-500 mt-1 max-w-sm">
                Es wurden keine Projekte gefunden, die deinen Kriterien entsprechen. Passe deine Suche an oder füge Projekte im Entwicklungsordner hinzu.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
              {processedProjects.map((project) => {
                const isRunning = runningProjects[project.path] || false;
                const isPinned = config.projects[project.path]?.is_pinned || false;
                const activeCommand = getActiveCommand(project);
                const isEditing = editingCommand === project.path;
                const typeStyle = getProjectTypeStyles(project.project_type);

                return (
                  <div 
                    key={project.path}
                    className={`bg-white rounded-xl border transition-all duration-300 flex flex-col shadow-sm relative group ${
                      isRunning 
                        ? 'border-emerald-300 ring-2 ring-emerald-100 shadow-emerald-50' 
                        : 'border-brand-200/60 hover:border-brand-300 hover:shadow-md hover:translate-y-[-2px]'
                    }`}
                  >
                    
                    {/* Running Glow Indicator */}
                    {isRunning && (
                      <span className="absolute -top-1 -left-1 w-3 h-3 rounded-full bg-emerald-500 ring-4 ring-emerald-100 animate-pulse"></span>
                    )}

                    {/* Card Header */}
                    <div className="px-5 pt-5 pb-3 flex items-start justify-between">
                      <div className="space-y-1 flex-1 pr-4">
                        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                          <h3 className="text-base font-bold text-slate-800 tracking-tight leading-tight select-all">
                            {project.name}
                          </h3>
                          {/* Project Type Badge */}
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase border ${typeStyle.bg}`}>
                            {typeStyle.label}
                          </span>
                          
                          {/* Git Branch Badge */}
                          {project.git_branch && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-50 border border-slate-200 text-slate-500 font-mono">
                              <Code className="w-2.5 h-2.5 mr-1" />
                              {project.git_branch}
                            </span>
                          )}
                        </div>

                        {/* Filepath */}
                        <p className="text-xs text-slate-400 font-mono truncate cursor-help mt-1 select-all" title={project.path}>
                          {project.path}
                        </p>
                      </div>

                      {/* Pin Button */}
                      <button
                        onClick={() => togglePin(project.path)}
                        className={`p-1.5 rounded-lg border transition-all active:scale-95 ${
                          isPinned 
                            ? 'bg-amber-50 border-amber-200 text-amber-500 hover:bg-amber-100' 
                            : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                        }`}
                        title={isPinned ? "Vom Dashboard lospinnen" : "Favorisieren / Oben anpinnen"}
                      >
                        <Pin className={`w-3.5 h-3.5 ${isPinned ? 'fill-amber-400' : ''}`} />
                      </button>
                    </div>

                    {/* Execution Command Panel */}
                    <div className="px-5 py-2.5 bg-slate-50/50 border-t border-b border-slate-100 flex flex-col justify-center flex-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Ausführbefehl</label>
                      {isEditing ? (
                        <div className="flex space-x-2">
                          <input
                            type="text"
                            value={tempCommandValue}
                            onChange={(e) => setTempCommandValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveCustomCommand(project.path);
                              if (e.key === "Escape") setEditingCommand(null);
                            }}
                            autoFocus
                            className="flex-1 text-xs font-mono bg-white border border-brand-400 rounded px-2.5 py-1.5 outline-none ring-1 ring-brand-300 text-slate-800"
                          />
                          <button
                            onClick={() => saveCustomCommand(project.path)}
                            className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold px-3 py-1 rounded"
                          >
                            Speichern
                          </button>
                        </div>
                      ) : (
                        <div 
                          onClick={() => startEditing(project.path, activeCommand)}
                          className="flex items-center justify-between text-xs font-mono bg-slate-100 border border-slate-200 hover:border-brand-200 hover:bg-white text-slate-600 rounded px-2.5 py-1.5 cursor-pointer transition-all group-hover:bg-slate-50"
                          title="Klicken zum Ändern"
                        >
                          <span className="truncate pr-2 select-all">{activeCommand}</span>
                          <span className="text-[9px] text-slate-400 uppercase tracking-wider font-sans font-bold select-none shrink-0 group-hover:text-brand-500">Bearbeiten</span>
                        </div>
                      )}
                    </div>

                    {/* Card Actions Bottom */}
                    <div className="px-5 py-4 bg-slate-50/30 rounded-b-xl flex items-center justify-between gap-4 mt-auto">
                      {/* Left: Shell / IDE Shortcut actions */}
                      <div className="flex items-center space-x-1.5">
                        <button
                          onClick={() => handleOpenIDE(project.path)}
                          className="p-2 bg-white hover:bg-brand-50 text-slate-500 hover:text-brand-600 rounded-lg border border-slate-200 hover:border-brand-200 transition-colors shadow-sm"
                          title="In VS Code öffnen"
                        >
                          <Code className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenExplorer(project.path)}
                          className="p-2 bg-white hover:bg-brand-50 text-slate-500 hover:text-brand-600 rounded-lg border border-slate-200 hover:border-brand-200 transition-colors shadow-sm"
                          title="Im Explorer anzeigen"
                        >
                          <Folder className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Right: Launch Process / Logs */}
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => onOpenConsole(project)}
                          className="flex items-center space-x-1 px-3 py-2 bg-white hover:bg-brand-50 border border-slate-200 hover:border-brand-200 text-slate-600 hover:text-brand-700 text-xs font-semibold rounded-lg shadow-sm transition-colors active:scale-95"
                          title="Konsole öffnen"
                        >
                          <Terminal className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Konsole</span>
                        </button>

                        {isRunning ? (
                          <button
                            onClick={() => onStopProject(project.path)}
                            className="flex items-center space-x-1 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-md transition-colors active:scale-95 animate-pulse"
                            title="Prozess stoppen"
                          >
                            <Square className="w-3.5 h-3.5" />
                            <span>Stoppen</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => onStartProject(project.path, activeCommand)}
                            className="flex items-center space-x-1 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg shadow-md transition-colors active:scale-95"
                            title="Prozess starten"
                          >
                            <Play className="w-3.5 h-3.5" />
                            <span>Starten</span>
                          </button>
                        )}
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        /* Empty / Welcome State if dev dir is not set */
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-brand-200/60 shadow-sm text-center max-w-xl mx-auto mt-12 animate-in slide-in-from-bottom duration-300">
          <div className="p-4 bg-brand-50 rounded-full text-brand-600 mb-4 animate-bounce">
            <Folder className="w-10 h-10" />
          </div>
          <h3 className="text-xl font-bold text-slate-800">Willkommen bei LaunchPad!</h3>
          <p className="text-sm text-slate-500 mt-2 leading-relaxed">
            Um loszulegen, musst du zuerst deinen Stamm-Entwicklungsordner auswählen. LaunchPad scannt diesen Ordner automatisch nach lauffähigen Web- oder Desktop-Projekten.
          </p>
          <button
            onClick={onRefresh} // Wait, refresh on onboarding will scan or open settings. Actually, let's open the directory picker directly.
            className="mt-6 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-6 py-3 rounded-lg shadow-md hover:shadow-lg transition-all active:scale-[0.98] flex items-center space-x-2"
          >
            <FolderSearch className="w-4 h-4" />
            <span>Entwicklungsordner auswählen</span>
          </button>
        </div>
      )}

    </div>
  );
};
