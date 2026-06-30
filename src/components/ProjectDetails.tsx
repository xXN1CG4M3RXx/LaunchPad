import React, { useEffect, useState, useRef } from "react";
import { 
  ChevronLeft, Play, Square, Code, Folder, 
  Terminal, Trash2, Copy, GitBranch, AlertCircle, CheckCircle2, RefreshCw
} from "lucide-react";
import { ProjectInfo, AppConfig, GitDetails } from "../types";
import { invoke } from "@tauri-apps/api/core";

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
    const text = logs.join("\n");
    navigator.clipboard.writeText(text);
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header Navigation */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
        <button
          onClick={onBack}
          className="flex items-center space-x-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 font-semibold text-sm transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          <span>Zurück zur Übersicht</span>
        </button>

        <div className="flex space-x-2">
          <button
            onClick={handleOpenIDE}
            className="flex items-center space-x-2 px-3 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 rounded-lg border border-slate-200 dark:border-slate-750 text-xs font-semibold shadow-sm transition-all"
            title="In VS Code öffnen"
          >
            <Code className="w-4 h-4" />
            <span>VS Code</span>
          </button>
          <button
            onClick={handleOpenExplorer}
            className="flex items-center space-x-2 px-3 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 rounded-lg border border-slate-200 dark:border-slate-750 text-xs font-semibold shadow-sm transition-all"
            title="Im Explorer anzeigen"
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
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
            
            {/* Title / Description info block */}
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <span className={`w-3.5 h-3.5 rounded-full ${isRunning ? 'bg-emerald-500 animate-pulse ring-4 ring-emerald-500/20' : 'bg-rose-500'}`}></span>
                <span className="text-xs font-semibold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
                  {isRunning ? 'Server Aktiv' : 'Gestoppt'}
                </span>
              </div>
              <h2 className="text-xl font-black text-slate-800 dark:text-white tracking-tight break-words leading-tight">{project.name}</h2>
              <span className="inline-flex items-center mt-2 px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase border border-brand-200 dark:border-brand-900 bg-brand-50/50 dark:bg-brand-950/20 text-brand-700 dark:text-brand-400">
                {project.project_type}
              </span>
            </div>

            {/* Location */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Pfad</span>
              <p className="text-xs text-slate-600 dark:text-slate-300 font-mono bg-slate-50 dark:bg-slate-950/60 p-2.5 rounded-lg border border-slate-100 dark:border-slate-900 select-all overflow-x-auto whitespace-nowrap scrollbar-thin">
                {project.path}
              </p>
            </div>

            {/* Run Button controls */}
            <div className="pt-2">
              {isRunning ? (
                <button
                  onClick={() => onStop(project.path)}
                  className="w-full flex items-center justify-center space-x-2 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-md transition-all active:scale-[0.98]"
                >
                  <Square className="w-4.5 h-4.5" />
                  <span>Prozess Stoppen</span>
                </button>
              ) : (
                <button
                  onClick={() => onStart(project.path, activeCommand)}
                  className="w-full flex items-center justify-center space-x-2 bg-brand-600 hover:bg-brand-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-md transition-all active:scale-[0.98]"
                >
                  <Play className="w-4.5 h-4.5" />
                  <span>Server Starten</span>
                </button>
              )}
            </div>
          </div>

          {/* Config Settings Card */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">Start-Einstellungen</h3>
            
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 dark:text-slate-500">Ausführbefehl</label>
              {editingCommand ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={tempCommand}
                    onChange={(e) => setTempCommand(e.target.value)}
                    className="w-full text-xs font-mono bg-slate-50 dark:bg-slate-950/80 border border-brand-400 dark:border-brand-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-200 outline-none ring-1 ring-brand-300 dark:ring-brand-900"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveCommand();
                      if (e.key === "Escape") setEditingCommand(false);
                    }}
                    autoFocus
                  />
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => setEditingCommand(false)}
                      className="px-3 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded font-medium"
                    >
                      Abbrechen
                    </button>
                    <button
                      onClick={handleSaveCommand}
                      className="px-3 py-1 text-xs bg-brand-600 text-white rounded font-semibold hover:bg-brand-700"
                    >
                      Speichern
                    </button>
                  </div>
                </div>
              ) : (
                <div 
                  onClick={handleEditCommand}
                  className="group flex items-center justify-between text-xs font-mono bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 hover:border-brand-300 dark:hover:border-brand-800 text-slate-600 dark:text-slate-300 rounded-lg px-3 py-2.5 cursor-pointer transition-all"
                >
                  <span className="truncate pr-2">{activeCommand}</span>
                  <span className="text-[10px] text-slate-400 font-sans uppercase tracking-wider font-bold shrink-0 group-hover:text-brand-500">Bearbeiten</span>
                </div>
              )}
            </div>
          </div>

          {/* Git Inspection Details Card */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <GitBranch className="w-4 h-4 text-slate-400" />
                <span>Git Status</span>
              </h3>
              <button 
                onClick={fetchGitDetails} 
                disabled={loadingGit}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-50"
                title="Git aktualisieren"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingGit ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {loadingGit ? (
              <p className="text-xs text-slate-400">Git Details werden abgefragt...</p>
            ) : (
              <div className="space-y-4 text-sm">
                
                {/* Branch Name */}
                <div className="flex justify-between items-center pb-2.5 border-b border-slate-100 dark:border-slate-900">
                  <span className="text-xs font-medium text-slate-400 dark:text-slate-500">Branch</span>
                  <span className="text-xs font-mono bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded font-bold">
                    {project.git_branch || "kein Git-Repo"}
                  </span>
                </div>

                {/* Changes badge */}
                {project.git_branch && (
                  <div className="flex justify-between items-center pb-2.5 border-b border-slate-100 dark:border-slate-900">
                    <span className="text-xs font-medium text-slate-400 dark:text-slate-500">Status</span>
                    {gitDetails?.has_changes ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Ungesicherte Änderungen
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Bereinigt (Clean)
                      </span>
                    )}
                  </div>
                )}

                {/* Commit info block */}
                {project.git_branch && gitDetails?.last_commit && (
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-slate-400 dark:text-slate-500 block mb-1">Letzter Commit</span>
                    <div className="p-2.5 bg-slate-50 dark:bg-slate-950/40 rounded-lg border border-slate-100 dark:border-slate-900 font-mono text-[11px] leading-relaxed text-slate-600 dark:text-slate-400 max-h-24 overflow-y-auto">
                      {gitDetails.last_commit}
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>

        </div>

        {/* Right Column: Embedded Console Log Output */}
        <div className="lg:col-span-3 flex flex-col h-[600px] lg:h-auto bg-slate-950 rounded-xl border border-slate-900 text-slate-100 overflow-hidden shadow-sm">
          
          {/* Console Header */}
          <div className="flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-slate-900">
            <div className="flex items-center space-x-2">
              <Terminal className="w-4 h-4 text-brand-400" />
              <h3 className="text-sm font-semibold tracking-wide text-white">Konsolenausgabe</h3>
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
                title="Logs kopieren"
              >
                <Copy className="w-3 h-3" />
                <span>{copiedLogs ? "Kopiert!" : "Kopieren"}</span>
              </button>

              <button
                onClick={onClearLogs}
                className="flex items-center space-x-1 px-2.5 py-1 text-[11px] text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800 rounded-md transition-colors"
                title="Konsole leeren"
              >
                <Trash2 className="w-3 h-3" />
                <span>Leeren</span>
              </button>
            </div>
          </div>

          {/* Console Output Area */}
          <div className="flex-1 overflow-y-auto p-6 font-mono text-xs leading-relaxed space-y-1 select-text scrollbar-thin scrollbar-track-slate-950 scrollbar-thumb-slate-800">
            {logs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-2">
                <div className="p-2.5 bg-slate-900 rounded-full border border-slate-850 text-slate-500">
                  <Terminal className="w-5 h-5" />
                </div>
                <p className="text-[11px]">Keine Programmausgaben gestreamt.</p>
                <p className="text-[10px] opacity-70">Drücke links auf "Server Starten", um Ausgaben zu sehen.</p>
              </div>
            ) : (
              logs.map((log, index) => {
                let textClass = "text-slate-300";
                if (log.toLowerCase().includes("error") || log.toLowerCase().includes("failed") || log.startsWith("[Prozess mit Code") || log.startsWith("[Process exited")) {
                  textClass = "text-rose-400";
                } else if (log.toLowerCase().includes("warning") || log.toLowerCase().includes("warn")) {
                  textClass = "text-amber-400";
                } else if (log.toLowerCase().includes("success") || log.toLowerCase().includes("compiled successfully")) {
                  textClass = "text-emerald-400";
                } else if (log.startsWith("> ")) {
                  textClass = "text-brand-400 font-semibold";
                }

                return (
                  <div key={index} className={`whitespace-pre-wrap ${textClass}`}>
                    {log}
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
