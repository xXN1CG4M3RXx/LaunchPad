import React, { useState, useMemo } from "react";
import {
  Search, Play, Square, Terminal,
  Folder, Pin, RefreshCw, FolderSearch, Code, Eye, Globe
} from "lucide-react";
import { ProjectInfo, AppConfig } from "../types";
import { invoke } from "@tauri-apps/api/core";
import { stripAnsi } from "../utils";

interface DashboardProps {
  projects: ProjectInfo[];
  runningProjects: Record<string, boolean>;
  projectLogs: Record<string, string[]>;
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
  projectLogs,
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

  const handleOpenBrowser = async (url: string) => {
    try {
      await invoke("open_in_browser", { url });
    } catch (e) {
      console.error("Failed to open browser:", e);
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

  const startEditing = (path: string, currentCommand: string) => {
    setEditingCommand(path);
    setTempCommandValue(currentCommand);
  };

  const saveCommand = (path: string) => {
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
    return config.projects[project.path]?.custom_command || project.default_command;
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
          bg: "bg-emerald-500/10 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20",
          dot: "bg-emerald-500",
          label: "Node.js"
        };
      case "Rust":
        return {
          bg: "bg-orange-500/10 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 border border-orange-500/20",
          dot: "bg-orange-500",
          label: "Rust"
        };
      case "Go":
        return {
          bg: "bg-cyan-500/10 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-500/20",
          dot: "bg-cyan-500",
          label: "Go"
        };
      case "Python":
        return {
          bg: "bg-blue-500/10 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20",
          dot: "bg-blue-500",
          label: "Python"
        };
      default:
        return {
          bg: "bg-slate-500/10 dark:bg-slate-500/10 text-slate-700 dark:text-slate-400 border border-slate-500/20",
          dot: "bg-slate-500",
          label: "Generic"
        };
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Top action row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tight"><span className="gradient-text font-display">Projects</span></h1>
          <p className="text-sm text-slate-500 dark:text-slate-450 mt-0.5">Manage and run your local development servers.</p>
        </div>

        <button
          onClick={onRefresh}
          disabled={isScanning || !config.dev_dir}
          className="group flex items-center justify-center space-x-2 bg-white/5 hover:bg-white/10 dark:bg-slate-900/40 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200 font-semibold px-5 py-2.5 rounded-xl border border-slate-200 dark:border-white/5 transition-all shadow-sm disabled:opacity-50 active:scale-[0.98] shrink-0"
        >
          <RefreshCw className={`w-4 h-4 transition-transform duration-700 group-hover:rotate-180 ${isScanning ? 'animate-spin' : ''}`} />
          <span>{isScanning ? "Scanning..." : "Refresh"}</span>
        </button>
      </div>

      {config.dev_dir ? (
        <>
          {/* Filters Bar */}
          <div className="bg-white dark:bg-slate-900/40 dark:backdrop-filter dark:backdrop-blur-md rounded-xl border border-slate-200 dark:border-white/5 p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
            {/* Search */}
            <div className="relative w-full md:max-w-xs">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder="Search projects..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-white/5 rounded-lg outline-none focus:bg-white dark:focus:bg-slate-950 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all text-slate-700 dark:text-slate-200"
              />
            </div>

            {/* Selection tags */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-start md:justify-end text-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mr-1 hidden sm:inline">Type:</span>
              {["All", "Node", "Rust", "Go", "Python", "Generic"].map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`px-3 py-1.5 rounded-lg font-semibold border transition-all text-xs active:scale-[0.97] ${
                    filterType === type 
                      ? 'bg-brand-600 border-brand-600 text-white shadow-sm'
                      : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-white/5 text-slate-650 dark:text-slate-300 hover:bg-slate-55 dark:hover:bg-slate-800/80'
                  }`}
                >
                  {type === "All" ? "All" : type === "Generic" ? "Generic" : type}
                </button>
              ))}

              <div className="h-6 w-px bg-slate-200 dark:bg-white/5 mx-2 hidden sm:block"></div>

              {/* Status filter Toggle */}
              <button
                onClick={() => setShowRunningOnly(!showRunningOnly)}
                className={`px-3 py-1.5 rounded-lg font-semibold border transition-all text-xs active:scale-[0.97] flex items-center space-x-1.5 ${
                  showRunningOnly 
                    ? 'bg-emerald-650 border-emerald-650 text-white shadow-sm'
                    : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-white/5 text-slate-650 dark:text-slate-300 hover:bg-slate-55 dark:hover:bg-slate-800/80'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${showRunningOnly ? 'bg-white animate-pulse' : 'bg-emerald-500'}`}></span>
                <span>Running Only</span>
              </button>
            </div>
          </div>

          {/* Project List / Grid */}
          {processedProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-slate-900/30 rounded-xl border border-slate-200 dark:border-white/5 shadow-sm text-center">
              <div className="p-4 bg-brand-50 dark:bg-brand-950/20 rounded-full text-brand-500 mb-4 animate-pulse">
                <FolderSearch className="w-8 h-8" />
              </div>
              <h3 className="text-base font-semibold text-slate-800 dark:text-white">No projects found</h3>
              <p className="text-sm text-slate-500 dark:text-slate-450 mt-1 max-w-sm">
                No projects matched your criteria. Adjust your filters or add projects to your development directory.
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

                const logs = projectLogs[project.path] || [];
                let detectedUrl: string | null = null;
                const urlRegex = /(https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]):\d+)/i;
                for (const line of logs) {
                  const cleanLine = stripAnsi(line);
                  const match = cleanLine.match(urlRegex);
                  if (match) {
                    detectedUrl = match[1].replace("0.0.0.0", "localhost");
                    break;
                  }
                }

                return (
                  <div
                    key={project.path}
                    className={`bg-white dark:bg-slate-900/30 rounded-xl border border-slate-205 dark:border-white/5 flex flex-col shadow-sm relative group hover-scale ${isRunning
                        ? 'ring-1 ring-emerald-500/30'
                        : ''
                      }`}
                  >
                    <div className="absolute top-0 left-0 right-0 h-[3px] brand-gradient-bg rounded-t-xl"></div>

                    {/* Running Indicator Dot */}
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
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase ${typeStyle.bg}`}>
                            {typeStyle.label}
                          </span>

                          {project.git_branch && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/5 text-slate-500 dark:text-slate-400 font-mono">
                              <Code className="w-2.5 h-2.5 mr-1" />
                              {project.git_branch}
                            </span>
                          )}
                        </div>

                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono truncate cursor-help mt-1 select-all" title={project.path}>
                          {project.path}
                        </p>
                      </div>

                      {/* Pin Button */}
                      <button
                        onClick={() => togglePin(project.path)}
                        className={`p-1.5 rounded-lg border transition-all active:scale-95 ${isPinned
                            ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/60 text-amber-500 hover:bg-amber-100'
                            : 'bg-white dark:bg-slate-800/40 border-slate-205 dark:border-white/5 text-slate-400 dark:text-slate-500 hover:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800'
                          }`}
                        title={isPinned ? "Unpin project from dashboard" : "Pin project to top"}
                      >
                        <Pin className={`w-3.5 h-3.5 ${isPinned ? 'fill-amber-400 text-amber-500' : ''}`} />
                      </button>
                    </div>

                    {/* Execution Command Panel */}
                    <div className="px-5 py-2.5 bg-slate-50/50 dark:bg-slate-950/10 border-t border-b border-slate-100 dark:border-white/5 flex flex-col justify-center flex-1">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">Start Command</label>
                      {isEditing ? (
                        <div className="flex space-x-2">
                          <input
                            type="text"
                            value={tempCommandValue}
                            onChange={(e) => setTempCommandValue(e.target.value)}
                            className="flex-1 bg-white dark:bg-slate-950 border border-brand-300 dark:border-brand-700 text-xs font-mono rounded px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-brand-500 text-slate-800 dark:text-slate-200"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveCommand(project.path);
                              if (e.key === "Escape") setEditingCommand(null);
                            }}
                            autoFocus
                          />
                          <button
                            onClick={() => saveCommand(project.path)}
                            className="bg-brand-600 text-white font-semibold text-xs px-3 rounded hover:bg-brand-700 active:scale-95 transition-all"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingCommand(null)}
                            className="text-xs text-slate-500 hover:bg-slate-205 px-2 rounded"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div 
                          onClick={() => startEditing(project.path, activeCommand)}
                          className="flex items-center justify-between text-xs font-mono bg-slate-100/60 dark:bg-slate-950/40 border border-slate-200/60 dark:border-white/5 hover:border-brand-200 dark:hover:border-slate-700 hover:bg-white dark:hover:bg-slate-900 text-slate-600 dark:text-slate-350 rounded px-2.5 py-1.5 cursor-pointer transition-all group-hover:bg-slate-50/40"
                          title="Click to modify"
                        >
                          <span className="truncate pr-2 select-all">{activeCommand}</span>
                          <span className="text-[9px] text-slate-450 dark:text-slate-500 uppercase tracking-wider font-sans font-bold select-none shrink-0 group-hover:text-brand-500">Edit</span>
                        </div>
                      )}
                    </div>

                    {/* Card Actions Bottom */}
                    <div className="px-5 py-4 bg-slate-50/30 dark:bg-slate-950/10 rounded-b-xl flex items-center justify-between gap-4 mt-auto">
                      {/* Left: Shell / IDE Shortcut actions */}
                      <div className="flex items-center space-x-1.5">
                        <button
                          onClick={() => handleOpenIDE(project.path)}
                          className="p-2 bg-slate-50 dark:bg-slate-800/40 hover:bg-brand-50 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 rounded-lg border border-slate-200 dark:border-white/5 transition-colors shadow-sm"
                          title="Open in VS Code"
                        >
                          <Code className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenExplorer(project.path)}
                          className="p-2 bg-slate-50 dark:bg-slate-800/40 hover:bg-brand-50 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 rounded-lg border border-slate-200 dark:border-white/5 transition-colors shadow-sm"
                          title="Show in Explorer"
                        >
                          <Folder className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Right: Launch Process / Details / Logs */}
                      <div className="flex items-center space-x-2">
                        {/* Details View Toggle */}
                        <button
                          onClick={() => onSelectProject(project)}
                          className="flex items-center space-x-1 px-3 py-2 bg-slate-50 dark:bg-slate-800/40 hover:bg-brand-50 dark:hover:bg-slate-700 border border-slate-205 dark:border-white/5 hover:border-brand-200 dark:hover:border-brand-700 text-slate-600 dark:text-slate-300 hover:text-brand-700 dark:hover:text-brand-400 text-xs font-semibold rounded-lg shadow-sm transition-colors active:scale-95"
                          title="View Details & Console"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Details</span>
                        </button>

                        {/* Quick drawer log viewer icon */}
                        <button
                          onClick={() => onOpenConsole(project)}
                          className="p-2 bg-slate-50 dark:bg-slate-800/40 hover:bg-brand-50 dark:hover:bg-slate-700 border border-slate-205 dark:border-white/5 text-slate-550 dark:text-slate-300 hover:text-brand-700 dark:hover:text-brand-400 rounded-lg shadow-sm transition-colors"
                          title="Open Quick-Log Drawer"
                        >
                          <Terminal className="w-3.5 h-3.5" />
                        </button>

                        {/* Run Toggle */}
                        {isRunning ? (
                          <div className="flex space-x-1.5">
                            {detectedUrl && (
                              <button
                                onClick={() => handleOpenBrowser(detectedUrl!)}
                                className="flex items-center space-x-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-md transition-all active:scale-95 animate-pulse flex-row"
                                title="Open in Browser"
                              >
                                <Globe className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Browser</span>
                              </button>
                            )}
                            <button
                              onClick={() => onStopProject(project.path)}
                              className="flex items-center space-x-1 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-md transition-colors active:scale-95"
                              title="Stop server"
                            >
                              <Square className="w-3.5 h-3.5" />
                              <span>Stop</span>
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => onStartProject(project.path, activeCommand)}
                            className="flex items-center space-x-1 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg shadow-md transition-colors active:scale-95"
                            title="Start server"
                          >
                            <Play className="w-3.5 h-3.5" />
                            <span>Start</span>
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
        <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-slate-900/30 rounded-xl border border-slate-200 dark:border-white/5 shadow-sm text-center max-w-xl mx-auto mt-12 animate-in slide-in-from-bottom duration-300">
          <div className="p-4 bg-brand-50 dark:bg-brand-950/20 rounded-full text-brand-600 mb-4 animate-bounce">
            <Folder className="w-10 h-10" />
          </div>
          <h3 className="text-2xl font-bold text-slate-800 dark:text-white font-sans uppercase">Welcome to LaunchPad!</h3>
          <p className="text-sm text-slate-500 dark:text-slate-450 mt-2 leading-relaxed">
            To get started, please select your main development directory. LaunchPad will automatically scan it for runnable Projects.
          </p>
          <button
            onClick={onRefresh}
            className="mt-6 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-6 py-3 rounded-lg shadow-md hover:shadow-lg transition-all active:scale-[0.98] flex items-center space-x-2"
          >
            <FolderSearch className="w-4 h-4" />
            <span>Select Development Directory</span>
          </button>
        </div>
      )}

    </div>
  );
};
