import React, { useEffect, useState, useRef, useMemo } from "react";
import { 
  ChevronLeft, Play, Square, Code, Folder, 
  Terminal, Trash2, Copy, GitBranch, AlertCircle, CheckCircle2, RefreshCw, Globe
} from "lucide-react";
import { ProjectInfo, AppConfig, GitDetails } from "../types";
import { invoke } from "@tauri-apps/api/core";
import { stripAnsi } from "../utils";

interface ProjectDetailsProps {
  project: ProjectInfo;
  isRunning: boolean;
  logs: string[];
  config: AppConfig;
  onBack: () => void;
  onStart: (projectPath: string, command: string) => void;
  onStop: (projectPath: string) => void;
  onClearLogs: () => void;
  onSaveConfig: (newConfig: AppConfig) => void;
}

export const ProjectDetails: React.FC<ProjectDetailsProps> = ({
  project,
  isRunning,
  logs,
  config,
  onBack,
  onStart,
  onStop,
  onClearLogs,
  onSaveConfig,
}) => {
  const [gitDetails, setGitDetails] = useState<GitDetails | null>(null);
  const [loadingGit, setLoadingGit] = useState(false);
  const [editingCommand, setEditingCommand] = useState(false);
  const [tempCommand, setTempCommand] = useState("");
  const [copiedLogs, setCopiedLogs] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const getProjectTypeIcon = (type: string) => {
    switch (type) {
      case "Node":
        return (
          <svg className="w-3.5 h-3.5 mr-1 shrink-0 rounded-[2px]" viewBox="0 0 24 24" fill="currentColor">
            <path d="M0 0h24v24H0V0zm22.034 18.376c-.186-.77-.83-1.43-1.64-1.841-.855-.425-2.019-.69-3.292-.78-.77-.05-1.46-.109-2.072-.272-.278-.076-.425-.21-.425-.455 0-.315.244-.506.761-.506.553 0 .895.203 1.024.629h2.905c-.149-1.374-1.253-2.217-2.91-2.217-1.9 0-3.084 1.011-3.084 2.634 0 1.59 1.198 2.236 2.905 2.46.786.1 1.693.189 2.418.349.356.076.554.24.554.526 0 .341-.326.568-.895.568-.697 0-1.13-.292-1.303-.802h-2.984c.247 1.612 1.568 2.378 3.267 2.378 2.23 0 3.637-1.138 3.637-2.774 0-1.748-1.077-2.3-2.965-2.559zm-14.218-.79c.142.562.661.987 1.343.987.756 0 1.132-.423 1.132-1.2v-7.142h2.977v7.26c0 2.23-1.365 3.39-3.799 3.39-2.31 0-3.738-1.129-4.004-3.295h2.351z"/>
          </svg>
        );
      case "Rust":
        return (
          <svg className="w-3.5 h-3.5 mr-1 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        );
      case "Go":
        return (
          <svg className="w-3.5 h-3.5 mr-1 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12.244 8.785l1.096-1.503c1.472.936 2.593 2.215 3.195 3.82.529 1.411.666 2.923.36 4.398-.242 1.164-.789 2.253-1.611 3.109-1.229 1.282-3.003 2.056-4.85 2.115-1.921.062-3.83-.585-5.263-1.785C3.398 17.514 2.138 15.65 1.7 13.565c-.394-1.874-.08-3.834.887-5.46 1.077-1.815 2.921-3.084 5.01-3.41 1.688-.264 3.428-.027 4.965.733L11.53 7.02c-1.073-.473-2.285-.595-3.447-.367-1.424.279-2.658 1.196-3.327 2.49-.661 1.28-.795 2.8-.358 4.195.347 1.109 1.157 2.05 2.186 2.585 1.144.596 2.512.647 3.738.21a4.238 4.238 0 0 0 2.247-2.128c.36-.807.447-1.724.281-2.604h-3.308v-2.626h5.882z"/>
          </svg>
        );
      case "Python":
        return (
          <svg className="w-3.5 h-3.5 mr-1 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.923 0C8.368 0 8.01.15 6.865 1.583c-1.294 1.62-1.127 3.32-.232 5.07h6.634v.952H4.156C1.729 7.605 0 9.066 0 11.968c0 2.902 2.052 4.137 4.156 4.137h2.29v-3.218c0-2.483 2.062-4.5 4.606-4.5h6.634v-.951h-6.634c-1.818 0-3.355-1.39-3.355-3.25V4.28c0-1.86 1.537-3.218 3.355-3.218h4.436V0h-3.52zM19.844 7.895v3.218c0 2.483-2.062 4.5-4.606 4.5H8.604v.951h6.634c1.818 0 3.355 1.39 3.355 3.25v2.906c0 1.86-1.537 3.218-3.355 3.218h-4.436V24h3.52c3.555 0 3.913-.15 5.058-1.583 1.294-1.62 1.127-3.32.232-5.07h-6.634v-.952h9.111C22.271 16.395 24 14.934 24 12.032c0-2.902-2.052-4.137-4.156-4.137h-2.29z"/>
          </svg>
        );
      default:
        return (
          <svg className="w-3.5 h-3.5 mr-1 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
        );
    }
  };

  // Fetch git details on mount or path change
  const fetchGitDetails = async () => {
    setLoadingGit(true);
    try {
      const details = await invoke<GitDetails>("get_git_details", {
        projectPath: project.path,
      });
      setGitDetails(details);
    } catch (e) {
      console.error("Failed to load git details:", e);
    } finally {
      setLoadingGit(false);
    }
  };

  useEffect(() => {
    fetchGitDetails();
  }, [project.path]);

  // Scroll terminal logs to bottom
  useEffect(() => {
    if (autoScroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll]);

  // Scan logs for localhost URL to support opening in browser
  const detectedUrl = useMemo(() => {
    const urlRegex = /(https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]):\d+)/i;
    for (const line of logs) {
      const cleanLine = stripAnsi(line);
      const match = cleanLine.match(urlRegex);
      if (match) {
        return match[1].replace("0.0.0.0", "localhost");
      }
    }
    return null;
  }, [logs]);

  const handleOpenBrowser = async () => {
    if (detectedUrl) {
      try {
        await invoke("open_in_browser", { url: detectedUrl });
      } catch (e) {
        console.error("Failed to open browser:", e);
      }
    }
  };

  const activeCommand = config.projects[project.path]?.custom_command || project.default_command;

  const handleEditCommand = () => {
    setTempCommand(activeCommand);
    setEditingCommand(true);
  };

  const handleSaveCommand = () => {
    const projectConf = config.projects[project.path] || { custom_command: null, is_pinned: false };
    const cleanCommand = tempCommand.trim();
    const updatedProjects = {
      ...config.projects,
      [project.path]: {
        ...projectConf,
        custom_command: cleanCommand || null,
      },
    };
    onSaveConfig({
      ...config,
      projects: updatedProjects,
    });
    setEditingCommand(false);
  };

  const handleOpenIDE = async () => {
    try {
      await invoke("open_in_ide", { projectPath: project.path });
    } catch (e) {
      console.error("Failed to open VS Code:", e);
    }
  };

  const handleOpenExplorer = async () => {
    try {
      await invoke("open_in_explorer", { projectPath: project.path });
    } catch (e) {
      console.error("Failed to open Explorer:", e);
    }
  };

  const copyToClipboard = () => {
    const text = logs.map(l => stripAnsi(l)).join("\n");
    navigator.clipboard.writeText(text);
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header Navigation */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/5 pb-4">
        <button
          onClick={onBack}
          className="flex items-center space-x-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 font-semibold text-sm transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          <span>Back to Overview</span>
        </button>

        <div className="flex space-x-2">
          {detectedUrl && (
            <button
              onClick={handleOpenBrowser}
              className="flex items-center space-x-2 px-3 py-2 bg-brand-50 hover:bg-brand-100 dark:bg-brand-950/20 dark:hover:bg-brand-950/40 text-brand-700 dark:text-brand-400 rounded-lg border border-brand-200 dark:border-brand-900/50 text-xs font-semibold shadow-sm transition-all"
              title="Open in default browser"
            >
              <Globe className="w-4 h-4" />
              <span>Browser</span>
            </button>
          )}
          <button
            onClick={handleOpenIDE}
            className="flex items-center space-x-2 px-3 py-2 bg-white dark:bg-slate-800/40 hover:bg-slate-55 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg border border-slate-200 dark:border-white/5 text-xs font-semibold shadow-sm transition-all"
            title="Open in VS Code"
          >
            <Code className="w-4 h-4" />
            <span>VS Code</span>
          </button>
          <button
            onClick={handleOpenExplorer}
            className="flex items-center space-x-2 px-3 py-2 bg-white dark:bg-slate-800/40 hover:bg-slate-55 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg border border-slate-200 dark:border-white/5 text-xs font-semibold shadow-sm transition-all"
            title="Show in File Explorer"
          >
            <Folder className="w-4 h-4" />
            <span>Explorer</span>
          </button>
        </div>
      </div>

      {/* Detail Content Grid split */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        
        {/* Left Column: Project Stats and Configurations */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-900/30 rounded-xl border border-slate-200 dark:border-white/5 p-6 shadow-sm space-y-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[3px] brand-gradient-bg"></div>
            
            {/* Title / Description info block */}
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <span className={`w-3.5 h-3.5 rounded-full ${isRunning ? 'bg-emerald-500 animate-pulse ring-4 ring-emerald-500/20' : 'bg-rose-500'}`}></span>
                <span className="text-[10px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
                  {isRunning ? 'Active' : 'Stopped'}
                </span>
              </div>
              <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight break-words leading-tight">{project.name}</h2>
              <span className="inline-flex items-center mt-2 px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase border border-brand-200/50 dark:border-brand-900 bg-brand-50/50 dark:bg-brand-950/20 text-brand-700 dark:text-brand-400">
                {getProjectTypeIcon(project.project_type)}
                <span>{project.project_type === "Node" ? "Node.js" : project.project_type}</span>
              </span>
            </div>

            {/* Location */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Path</span>
              <p className="text-xs text-slate-600 dark:text-slate-300 font-mono bg-slate-50 dark:bg-slate-950/40 p-2.5 rounded-lg border border-slate-100 dark:border-white/5 select-all overflow-x-auto whitespace-nowrap scrollbar-thin">
                {project.path}
              </p>
            </div>

            {/* Run Button controls */}
            <div className="pt-2 space-y-3">
              {isRunning ? (
                <>
                  <button
                    onClick={() => onStop(project.path)}
                    className="w-full flex items-center justify-center space-x-2 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-md transition-all active:scale-[0.98]"
                  >
                    <Square className="w-4.5 h-4.5" />
                    <span>Stop Server</span>
                  </button>
                  {detectedUrl && (
                    <button
                      onClick={handleOpenBrowser}
                      className="w-full flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-md transition-all active:scale-[0.98] animate-pulse"
                    >
                      <Globe className="w-4.5 h-4.5" />
                      <span>Open Browser</span>
                    </button>
                  )}
                </>
              ) : (
                <button
                  onClick={() => onStart(project.path, activeCommand)}
                  className="w-full flex items-center justify-center space-x-2 bg-brand-600 hover:bg-brand-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-md transition-all active:scale-[0.98]"
                >
                  <Play className="w-4.5 h-4.5" />
                  <span>Start Server</span>
                </button>
              )}
            </div>
          </div>

          {/* Config Settings Card */}
          <div className="bg-white dark:bg-slate-900/30 rounded-xl border border-slate-200 dark:border-white/5 p-6 shadow-sm space-y-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] brand-gradient-bg"></div>
            <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">Execution Settings</h3>
            
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Start Command</label>
              {editingCommand ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={tempCommand}
                    onChange={(e) => setTempCommand(e.target.value)}
                    className="w-full text-xs font-mono bg-slate-55 dark:bg-slate-950/80 border border-brand-400 dark:border-brand-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-200 outline-none ring-1 ring-brand-300 dark:ring-brand-900"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveCommand();
                      if (e.key === "Escape") setEditingCommand(false);
                    }}
                    autoFocus
                  />
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => setEditingCommand(false)}
                      className="px-3 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveCommand}
                      className="px-3 py-1 text-xs bg-brand-600 text-white rounded font-bold hover:bg-brand-700"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <div 
                  onClick={handleEditCommand}
                  className="group flex items-center justify-between text-xs font-mono bg-slate-55 dark:bg-slate-950/40 border border-slate-200 dark:border-white/5 hover:border-brand-300 dark:hover:border-brand-850 text-slate-600 dark:text-slate-300 rounded-lg px-3 py-2.5 cursor-pointer transition-all"
                >
                  <span className="truncate pr-2">{activeCommand}</span>
                  <span className="text-[9px] text-slate-400 font-sans uppercase tracking-wider font-bold shrink-0 group-hover:text-brand-500">Edit</span>
                </div>
              )}
            </div>
          </div>

          {/* Git Inspection Details Card */}
          <div className="bg-white dark:bg-slate-900/30 rounded-xl border border-slate-200 dark:border-white/5 p-6 shadow-sm space-y-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] brand-gradient-bg"></div>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <GitBranch className="w-4 h-4 text-slate-400" />
                <span>Git Status</span>
              </h3>
              <button 
                onClick={fetchGitDetails} 
                disabled={loadingGit}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-250 disabled:opacity-50"
                title="Refresh Git status"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingGit ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {loadingGit ? (
              <p className="text-xs text-slate-400">Loading git details...</p>
            ) : (
              <div className="space-y-4 text-sm">
                
                {/* Branch Name */}
                <div className="flex justify-between items-center pb-2.5 border-b border-slate-100 dark:border-white/5">
                  <span className="text-xs font-medium text-slate-400 dark:text-slate-500">Branch</span>
                  <span className="text-xs font-mono bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded font-bold">
                    {project.git_branch || "No Git Repository"}
                  </span>
                </div>

                {/* Changes badge */}
                {project.git_branch && (
                  <div className="flex justify-between items-center pb-2.5 border-b border-slate-100 dark:border-white/5">
                    <span className="text-xs font-medium text-slate-400 dark:text-slate-500">Status</span>
                    {gitDetails?.has_changes ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/60">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Unsaved Changes
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Clean
                      </span>
                    )}
                  </div>
                )}

                {/* Commit info block */}
                {project.git_branch && gitDetails?.last_commit && (
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-slate-400 dark:text-slate-500 block mb-1">Last Commit</span>
                    <div className="p-2.5 bg-slate-50 dark:bg-slate-950/40 rounded-lg border border-slate-100 dark:border-white/5 font-mono text-[11px] leading-relaxed text-slate-600 dark:text-slate-400 max-h-24 overflow-y-auto">
                      {gitDetails.last_commit}
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>

        </div>

        {/* Right Column: Embedded Console Log Output */}
        <div className="lg:col-span-3 flex flex-col h-[600px] lg:h-auto bg-slate-950 rounded-xl border border-slate-900 text-slate-100 overflow-hidden shadow-sm relative">
          <div className="absolute top-0 left-0 right-0 h-[3px] brand-gradient-bg"></div>
          
          {/* Console Header */}
          <div className="flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-slate-900">
            <div className="flex items-center space-x-2">
              <Terminal className="w-4 h-4 text-brand-400" />
              <h3 className="text-sm font-semibold tracking-wide text-white">Console Output</h3>
            </div>

            <div className="flex items-center space-x-2">
              <label className="flex items-center space-x-1.5 text-xs text-slate-400 cursor-pointer select-none hover:text-slate-200 transition-colors mr-2">
                <input
                  type="checkbox"
                  checked={autoScroll}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                  className="rounded border-slate-800 text-brand-500 focus:ring-brand-500 focus:ring-offset-slate-900 bg-slate-900 w-3.5 h-3.5"
                />
                <span>Auto-Scroll</span>
              </label>

              <button
                onClick={copyToClipboard}
                className="flex items-center space-x-1 px-2.5 py-1 text-[11px] text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800 rounded-md transition-colors"
                title="Copy console output"
              >
                <Copy className="w-3 h-3" />
                <span>{copiedLogs ? "Copied!" : "Copy"}</span>
              </button>

              <button
                onClick={onClearLogs}
                className="flex items-center space-x-1 px-2.5 py-1 text-[11px] text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800 rounded-md transition-colors"
                title="Clear console"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear</span>
              </button>
            </div>
          </div>

          {/* Console Output Area */}
          <div className="flex-1 overflow-y-auto p-6 font-mono text-xs leading-relaxed space-y-1 select-text scrollbar-thin scrollbar-track-slate-950 scrollbar-thumb-slate-800">
            {logs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2">
                <div className="p-2.5 bg-slate-900 rounded-full border border-slate-850 text-slate-500">
                  <Terminal className="w-5 h-5" />
                </div>
                <p className="text-[11px]">No output streams detected.</p>
                <p className="text-[10px] opacity-70">Click "Start Server" on the left to see logs.</p>
              </div>
            ) : (
              logs.map((log, index) => {
                const cleanLog = stripAnsi(log);
                let textClass = "text-slate-350";
                if (cleanLog.toLowerCase().includes("error") || cleanLog.toLowerCase().includes("failed") || cleanLog.startsWith("[Prozess mit Code") || cleanLog.startsWith("[Process exited")) {
                  textClass = "text-rose-400";
                } else if (cleanLog.toLowerCase().includes("warning") || cleanLog.toLowerCase().includes("warn")) {
                  textClass = "text-amber-400";
                } else if (cleanLog.toLowerCase().includes("success") || cleanLog.toLowerCase().includes("compiled successfully") || cleanLog.toLowerCase().includes("ready in")) {
                  textClass = "text-emerald-400";
                } else if (cleanLog.startsWith("> ")) {
                  textClass = "text-brand-400 font-semibold";
                }

                return (
                  <div key={index} className={`whitespace-pre-wrap ${textClass}`}>
                    {cleanLog}
                  </div>
                );
              })
            )}
            <div ref={terminalEndRef} />
          </div>
        </div>

      </div>

    </div>
  );
};
