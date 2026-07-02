import React, { useState, useMemo, useEffect } from "react";
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

  const dynamicTypes = useMemo(() => {
    const types = new Set<string>();
    projects.forEach((p) => {
      if (p.project_type) {
        types.add(p.project_type);
      }
    });
    const sortedTypes = Array.from(types).sort();
    return ["All", ...sortedTypes];
  }, [projects]);

  useEffect(() => {
    if (!dynamicTypes.includes(filterType)) {
      setFilterType("All");
    }
  }, [dynamicTypes, filterType]);

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
          label: "Node.js",
          icon: (
            <svg className="w-3.5 h-3.5 mr-1 shrink-0 rounded-[2px]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M0 0h24v24H0V0zm22.034 18.376c-.186-.77-.83-1.43-1.64-1.841-.855-.425-2.019-.69-3.292-.78-.77-.05-1.46-.109-2.072-.272-.278-.076-.425-.21-.425-.455 0-.315.244-.506.761-.506.553 0 .895.203 1.024.629h2.905c-.149-1.374-1.253-2.217-2.91-2.217-1.9 0-3.084 1.011-3.084 2.634 0 1.59 1.198 2.236 2.905 2.46.786.1 1.693.189 2.418.349.356.076.554.24.554.526 0 .341-.326.568-.895.568-.697 0-1.13-.292-1.303-.802h-2.984c.247 1.612 1.568 2.378 3.267 2.378 2.23 0 3.637-1.138 3.637-2.774 0-1.748-1.077-2.3-2.965-2.559zm-14.218-.79c.142.562.661.987 1.343.987.756 0 1.132-.423 1.132-1.2v-7.142h2.977v7.26c0 2.23-1.365 3.39-3.799 3.39-2.31 0-3.738-1.129-4.004-3.295h2.351z"/>
            </svg>
          )
        };
      case "Rust":
        return {
          bg: "bg-orange-500/10 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 border border-orange-500/20",
          dot: "bg-orange-500",
          label: "Rust",
          icon: (
            <svg className="w-3.5 h-3.5 mr-1 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          )
        };
      case "Go":
        return {
          bg: "bg-cyan-500/10 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-500/20",
          dot: "bg-cyan-500",
          label: "Go",
          icon: (
            <svg className="w-3.5 h-3.5 mr-1 shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12.244 8.785l1.096-1.503c1.472.936 2.593 2.215 3.195 3.82.529 1.411.666 2.923.36 4.398-.242 1.164-.789 2.253-1.611 3.109-1.229 1.282-3.003 2.056-4.85 2.115-1.921.062-3.83-.585-5.263-1.785C3.398 17.514 2.138 15.65 1.7 13.565c-.394-1.874-.08-3.834.887-5.46 1.077-1.815 2.921-3.084 5.01-3.41 1.688-.264 3.428-.027 4.965.733L11.53 7.02c-1.073-.473-2.285-.595-3.447-.367-1.424.279-2.658 1.196-3.327 2.49-.661 1.28-.795 2.8-.358 4.195.347 1.109 1.157 2.05 2.186 2.585 1.144.596 2.512.647 3.738.21a4.238 4.238 0 0 0 2.247-2.128c.36-.807.447-1.724.281-2.604h-3.308v-2.626h5.882z"/>
            </svg>
          )
        };
      case "Python":
        return {
          bg: "bg-blue-500/10 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20",
          dot: "bg-blue-500",
          label: "Python",
          icon: (
            <svg className="w-3.5 h-3.5 mr-1 shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.923 0C8.368 0 8.01.15 6.865 1.583c-1.294 1.62-1.127 3.32-.232 5.07h6.634v.952H4.156C1.729 7.605 0 9.066 0 11.968c0 2.902 2.052 4.137 4.156 4.137h2.29v-3.218c0-2.483 2.062-4.5 4.606-4.5h6.634v-.951h-6.634c-1.818 0-3.355-1.39-3.355-3.25V4.28c0-1.86 1.537-3.218 3.355-3.218h4.436V0h-3.52zM19.844 7.895v3.218c0 2.483-2.062 4.5-4.606 4.5H8.604v.951h6.634c1.818 0 3.355 1.39 3.355 3.25v2.906c0 1.86-1.537 3.218-3.355 3.218h-4.436V24h3.52c3.555 0 3.913-.15 5.058-1.583 1.294-1.62 1.127-3.32.232-5.07h-6.634v-.952h9.111C22.271 16.395 24 14.934 24 12.032c0-2.902-2.052-4.137-4.156-4.137h-2.29z"/>
            </svg>
          )
        };
      case "Java":
        return {
          bg: "bg-red-500/10 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20",
          dot: "bg-red-500",
          label: "Java",
          icon: (
            <svg className="w-3.5 h-3.5 mr-1 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
              <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
              <line x1="6" y1="2" x2="6" y2="4" />
              <line x1="10" y1="2" x2="10" y2="4" />
              <line x1="14" y1="2" x2="14" y2="4" />
            </svg>
          )
        };
      case "Docker":
        return {
          bg: "bg-sky-500/10 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20",
          dot: "bg-sky-500",
          label: "Docker",
          icon: (
            <svg className="w-3.5 h-3.5 mr-1 shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M13.98 11.08h2.12a.19.19 0 0 0 .19-.19V9.01a.19.19 0 0 0-.19-.19h-2.12a.18.18 0 0 0-.18.18v1.9c0 .1.08.18.18.18m-2.95-5.43h2.12a.19.19 0 0 0 .18-.19V3.57a.19.19 0 0 0-.18-.18h-2.12a.18.18 0 0 0-.19.18v1.9c0 .1.09.18.19.18m0 2.71h2.12a.19.19 0 0 0 .18-.18V6.29a.19.19 0 0 0-.18-.18h-2.12a.18.18 0 0 0-.19.18v1.89c0 .1.09.18.19.18m-2.93 0h2.12a.19.19 0 0 0 .18-.18V6.29a.18.18 0 0 0-.18-.18H8.1a.18.18 0 0 0-.18.18v1.89c0 .1.08.18.18.18m-2.96 0h2.11a.19.19 0 0 0 .19-.18V6.29a.18.18 0 0 0-.19-.18H5.14a.19.19 0 0 0-.19.18v1.89c0 .1.08.18.19.18m5.89 2.72h2.12a.19.19 0 0 0 .18-.19V9.01a.19.19 0 0 0-.18-.19h-2.12a.18.18 0 0 0-.19.18v1.9c0 .1.09.18.19.18m-2.93 0h2.12a.18.18 0 0 0 .18-.19V9.01a.18.18 0 0 0-.18-.19H8.1a.18.18 0 0 0-.18.18v1.9c0 .1.08.18.18.18m-2.96 0h2.11a.18.18 0 0 0 .19-.19V9.01a.18.18 0 0 0-.18-.19H5.14a.19.19 0 0 0-.19.19v1.88c0 .1.08.19.19.19m-2.92 0h2.12a.18.18 0 0 0 .18-.19V9.01a.18.18 0 0 0-.18-.19H2.22a.18.18 0 0 0-.19.18v1.9c0 .1.08.18.19.18m21.54-1.19c-.06-.05-.67-.51-1.95-.51-.34 0-.68.03-1.01.09a3.77 3.77 0 0 0-1.72-2.57l-.34-.2-.23.33a4.6 4.6 0 0 0-.6 1.43c-.24.97-.1 1.88.4 2.66a4.7 4.7 0 0 1-1.75.42H.76a.75.75 0 0 0-.76.75 11.38 11.38 0 0 0 .7 4.06 6.03 6.03 0 0 0 2.4 3.12c1.18.73 3.1 1.14 5.28 1.14.98 0 1.96-.08 2.93-.26a12.25 12.25 0 0 0 3.82-1.4 10.5 10.5 0 0 0 2.61-2.13c1.25-1.42 2-3 2.55-4.4h.23c1.37 0 2.21-.55 2.68-1 .3-.3.55-.66.7-1.06l.1-.28Z"/>
            </svg>
          )
        };
      case "Static":
        return {
          bg: "bg-amber-500/10 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20",
          dot: "bg-amber-500",
          label: "Static Site",
          icon: (
            <svg className="w-3.5 h-3.5 mr-1 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
              <line x1="14" y1="4" x2="10" y2="20" />
            </svg>
          )
        };
      default:
        return {
          bg: "bg-slate-500/10 dark:bg-slate-500/10 text-slate-700 dark:text-slate-400 border border-slate-500/20",
          dot: "bg-slate-500",
          label: "Generic",
          icon: (
            <svg className="w-3.5 h-3.5 mr-1 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
          )
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
          <div className="bg-white dark:bg-slate-900/40 dark:backdrop-filter dark:backdrop-blur-md rounded-xl border border-slate-200 dark:border-white/5 p-4 shadow-sm flex flex-col lg:flex-row gap-4 items-center justify-between">
            {/* Search */}
            <div className="relative w-full lg:max-w-xs">
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
            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-start lg:justify-end text-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mr-1 hidden sm:inline">Type:</span>
              {dynamicTypes.map((type) => (
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                            {typeStyle.icon}
                            <span>{typeStyle.label}</span>
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
                          <span className="hidden lg:inline">Details</span>
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
                                <span className="hidden lg:inline">Browser</span>
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
