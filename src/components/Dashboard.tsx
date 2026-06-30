import React, { useState, useMemo } from "react";
import {
  Search, Play, Square, Terminal,
  Folder, Pin, RefreshCw, FolderSearch, Code, Eye
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
  onSelectProject: (project: ProjectInfo) => void;
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
  onSelectProject,
  onRefresh,
  isScanning,
}) => {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("All");
  const [showRunningOnly, setShowRunningOnly] = useState(false);
  const [editingCommand, setEditingCommand] = useState<string | null>(null);
  const [tempCommandValue, setTempCommandValue] = useState("");

  const handleOpenIDE = async (path: string) => {
    try {
      await invoke("open_in_ide", { projectPath: path });
    } catch (e) {
      console.error("Failed to open VS Code:", e);
    }
  };

  const handleOpenExplorer = async (path: string) => {
    try {
      await invoke("open_in_explorer", { projectPath: path });
    } catch (e) {
      console.error("Failed to open Explorer:", e);
    }
  };

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

  const startEditing = (path: string, val: string) => {
    setEditingCommand(path);
    setTempCommandValue(val);
  };

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

  const getActiveCommand = (project: ProjectInfo) => {
    const custom = config.projects[project.path]?.custom_command;
    return custom !== undefined && custom !== null ? custom : project.default_command;
  };

  const processedProjects = useMemo(() => {
    return projects
      .filter((p) => {
        const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
        const matchesType = filterType === "All" || p.project_type === filterType;
        const isRunning = runningProjects[p.path] || false;
        const matchesStatus = !showRunningOnly || isRunning;
        return matchesSearch && matchesType && matchesStatus;
      })
      .sort((a, b) => {
        const aPinned = config.projects[a.path]?.is_pinned ? 1 : 0;
        const bPinned = config.projects[b.path]?.is_pinned ? 1 : 0;
        if (aPinned !== bPinned) return bPinned - aPinned;
        return a.name.localeCompare(b.name);
      });
  }, [projects, search, filterType, showRunningOnly, config.projects, runningProjects]);

  const getProjectTypeStyles = (type: string) => {
    switch (type) {
      case "Node":
        return {
          bg: "bg-emerald-500/10 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-500/20",
          dot: "bg-emerald-500",
          label: "Node.js"
        };
      case "Rust":
        return {
          bg: "bg-orange-500/10 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 border border-orange-200/50 dark:border-orange-500/20",
          dot: "bg-orange-500",
          label: "Rust"
        };
      case "Go":
        return {
          bg: "bg-cyan-500/10 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-200/50 dark:border-cyan-500/20",
          dot: "bg-cyan-500",
          label: "Go"
        };
      case "Python":
        return {
          bg: "bg-blue-500/10 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200/50 dark:border-blue-500/20",
          dot: "bg-blue-500",
          label: "Python"
        };
      default:
        return {
          bg: "bg-slate-500/10 dark:bg-slate-500/10 text-slate-700 dark:text-slate-400 border border-slate-200/50 dark:border-slate-500/20",
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
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Projekte</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Verwalte und starte deine lokalen Entwicklungsserver.</p>
        </div>

        <button
          onClick={onRefresh}
          disabled={isScanning || !config.dev_dir}
          className="flex items-center justify-center space-x-2 bg-brand-50 hover:bg-brand-100 text-brand-700 dark:bg-brand-950/20 dark:hover:bg-brand-950/40 dark:text-brand-400 dark:border-brand-900/50 font-medium px-4 py-2.5 rounded-lg border border-brand-200 transition-colors shadow-sm disabled:opacity-50 active:scale-[0.98] shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
          <span>{isScanning ? "Scanne..." : "Aktualisieren"}</span>
        </button>
      </div>

      {config.dev_dir ? (
        <>
          {/* Filters Bar */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-brand-100 dark:border-slate-800/80 p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
            {/* Search */}
            <div className="relative w-full md:max-w-xs">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Projekt suchen..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:bg-white dark:focus:bg-slate-950 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all text-slate-700 dark:text-slate-200"
              />
            </div>

            {/* Selection tags */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-start md:justify-end text-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mr-1 hidden sm:inline">Typ:</span>
              {["All", "Node", "Rust", "Go", "Python", "Generic"].map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`px-3 py-1.5 rounded-lg font-medium border transition-colors ${filterType === type
                      ? 'bg-brand-600 border-brand-600 text-white shadow-sm'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                >
                  {type === "All" ? "Alle" : type === "Generic" ? "Generisch" : type}
                </button>
              ))}

              <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-2 hidden sm:block"></div>

              {/* Status filter Toggle */}
              <button
                onClick={() => setShowRunningOnly(!showRunningOnly)}
                className={`px-3 py-1.5 rounded-lg font-medium border transition-colors flex items-center space-x-1.5 ${showRunningOnly
                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
              >
                <span className={`w-2 h-2 rounded-full ${showRunningOnly ? 'bg-white animate-pulse' : 'bg-emerald-500'}`}></span>
                <span>Nur laufende</span>
              </button>
            </div>
          </div>

          {/* Project List / Grid */}
          {processedProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-slate-900 rounded-xl border border-brand-100 dark:border-slate-800 shadow-sm text-center">
              <div className="p-4 bg-brand-50 dark:bg-brand-950/20 rounded-full text-brand-500 mb-4">
                <FolderSearch className="w-8 h-8" />
              </div>
              <h3 className="text-base font-semibold text-slate-800 dark:text-white">Keine Projekte gefunden</h3>
              <p className="text-sm text-slate-500 dark:text-slate-450 mt-1 max-w-sm">
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
                    className={`bg-white dark:bg-slate-900 rounded-xl border transition-all duration-300 flex flex-col shadow-sm relative group ${isRunning
                        ? 'border-emerald-300 dark:border-emerald-800 ring-2 ring-emerald-100 dark:ring-emerald-950/60 shadow-emerald-50 dark:shadow-emerald-950/10'
                        : 'border-brand-200/60 dark:border-slate-800 hover:border-brand-300 dark:hover:border-slate-750 hover:shadow-md hover:translate-y-[-2px]'
                      }`}
                  >

                    {/* Running Glow Indicator */}
                    {isRunning && (
                      <span className="absolute -top-1 -left-1 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100 dark:ring-emerald-950 animate-pulse"></span>
                    )}

                    {/* Card Header */}
                    <div className="px-5 pt-5 pb-3 flex items-start justify-between">
                      <div className="space-y-1 flex-1 pr-4">
                        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                          <h3 className="text-base font-bold text-slate-800 dark:text-white tracking-tight leading-tight select-all">
                            {project.name}
                          </h3>
                          {/* Project Type Badge */}
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase border ${typeStyle.bg}`}>
                            {typeStyle.label}
                          </span>

                          {/* Git Branch Badge */}
                          {project.git_branch && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 text-slate-550 dark:text-slate-400 font-mono">
                              <Code className="w-2.5 h-2.5 mr-1" />
                              {project.git_branch}
                            </span>
                          )}
                        </div>

                        {/* Filepath */}
                        <p className="text-xs text-slate-400 dark:text-slate-500 font-mono truncate cursor-help mt-1 select-all" title={project.path}>
                          {project.path}
                        </p>
                      </div>

                      {/* Pin Button */}
                      <button
                        onClick={() => togglePin(project.path)}
                        className={`p-1.5 rounded-lg border transition-all active:scale-95 ${isPinned
                            ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900 text-amber-500 hover:bg-amber-100'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-650 hover:bg-slate-50 dark:hover:bg-slate-800'
                          }`}
                        title={isPinned ? "Vom Dashboard lospinnen" : "Favorisieren / Oben anpinnen"}
                      >
                        <Pin className={`w-3.5 h-3.5 ${isPinned ? 'fill-amber-400' : ''}`} />
                      </button>
                    </div>

                    {/* Execution Command Panel */}
                    <div className="px-5 py-2.5 bg-slate-50/50 dark:bg-slate-950/20 border-t border-b border-slate-100 dark:border-slate-850/80 flex flex-col justify-center flex-1">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">Ausführbefehl</label>
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
                            className="flex-1 text-xs font-mono bg-white dark:bg-slate-955 border border-brand-400 dark:border-brand-800 rounded px-2.5 py-1.5 outline-none ring-1 ring-brand-300 dark:ring-brand-900 text-slate-800 dark:text-slate-200"
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
                          className="flex items-center justify-between text-xs font-mono bg-slate-100 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-850 hover:border-brand-200 dark:hover:border-slate-700 hover:bg-white dark:hover:bg-slate-900 text-slate-655 dark:text-slate-350 rounded px-2.5 py-1.5 cursor-pointer transition-all group-hover:bg-slate-50/40"
                          title="Klicken zum Ändern"
                        >
                          <span className="truncate pr-2 select-all">{activeCommand}</span>
                          <span className="text-[9px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-sans font-bold select-none shrink-0 group-hover:text-brand-500">Bearbeiten</span>
                        </div>
                      )}
                    </div>
                    {/* Card Actions Bottom */}
                    <div className="px-5 py-4 bg-slate-50/30 dark:bg-slate-950/10 rounded-b-xl flex items-center justify-between gap-4 mt-auto">
                      {/* Left: Shell / IDE Shortcut actions */}
                      <div className="flex items-center space-x-1.5">
                        <button
                          onClick={() => handleOpenIDE(project.path)}
                          className="p-2 bg-slate-50 dark:bg-slate-800 hover:bg-brand-50 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-355 hover:text-brand-600 dark:hover:text-brand-400 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors shadow-sm"
                          title="In VS Code öffnen"
                        >
                          <Code className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenExplorer(project.path)}
                          className="p-2 bg-slate-50 dark:bg-slate-800 hover:bg-brand-50 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-355 hover:text-brand-600 dark:hover:text-brand-400 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors shadow-sm"
                          title="Im Explorer anzeigen"
                        >
                          <Folder className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Right: Launch Process / Details / Logs */}
                      <div className="flex items-center space-x-2">
                        {/* Details View Toggle */}
                        <button
                          onClick={() => onSelectProject(project)}
                          className="flex items-center space-x-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-brand-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 hover:border-brand-200 dark:hover:border-brand-700 text-slate-600 dark:text-slate-300 hover:text-brand-700 dark:hover:text-brand-400 text-xs font-semibold rounded-lg shadow-sm transition-colors active:scale-95"
                          title="Details & Konsole anzeigen"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Details</span>
                        </button>

                        {/* Quick drawer log viewer icon */}
                        <button
                          onClick={() => onOpenConsole(project)}
                          className="p-2 bg-slate-50 dark:bg-slate-800 hover:bg-brand-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-550 dark:text-slate-300 hover:text-brand-700 dark:hover:text-brand-400 rounded-lg shadow-sm transition-colors"
                          title="Quick-Log Drawer öffnen"
                        >
                          <Terminal className="w-3.5 h-3.5" />
                        </button>

                        {/* Run Toggle */}
                        {isRunning ? (
                          <button
                            onClick={() => onStopProject(project.path)}
                            className="flex items-center space-x-1 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-md transition-colors active:scale-95"
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
        <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-slate-900 rounded-xl border border-brand-200/60 dark:border-slate-800/80 shadow-sm text-center max-w-xl mx-auto mt-12 animate-in slide-in-from-bottom duration-300">
          <div className="p-4 bg-brand-50 dark:bg-brand-950/20 rounded-full text-brand-600 mb-4 animate-bounce">
            <Folder className="w-10 h-10" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 dark:text-white font-sans">Willkommen bei LaunchPad!</h3>
          <p className="text-sm text-slate-500 dark:text-slate-450 mt-2 leading-relaxed font-sans">
            Um loszulegen, musst du zuerst deinen Stamm-Entwicklungsordner auswählen. LaunchPad scannt diesen Ordner automatisch nach lauffähigen Web- oder Desktop-Projekten.
          </p>
          <button
            onClick={onRefresh}
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
