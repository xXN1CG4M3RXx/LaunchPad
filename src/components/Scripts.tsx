import React, { useState } from "react";
import { 
  Play, Square, Terminal, Plus, Trash2, Edit3, FileCode, FolderOpen, X 
} from "lucide-react";
import { ScriptConfig, AppConfig } from "../types";
import { invoke } from "@tauri-apps/api/core";

interface ScriptsProps {
  config: AppConfig;
  runningProjects: Record<string, boolean>;
  onSaveConfig: (newConfig: AppConfig) => void;
  onStartScript: (scriptPath: string, command: string) => void;
  onStopScript: (scriptPath: string) => void;
  onOpenConsole: (project: { name: string; path: string }) => void;
}

const getScriptLanguageInfo = (path: string) => {
  const filename = path.split(/[/\\]/).pop() || "";
  const ext = filename.split(".").pop()?.toLowerCase();
  
  switch (ext) {
    case "py":
      return { label: "Python", style: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20" };
    case "js":
      return { label: "JavaScript", style: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20" };
    case "ts":
      return { label: "TypeScript", style: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20" };
    case "java":
    case "jar":
      return { label: "Java", style: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20" };
    case "bat":
      return { label: "Batch", style: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" };
    case "ps1":
      return { label: "PowerShell", style: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20" };
    case "sh":
      return { label: "Shell", style: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" };
    default:
      return { label: "Script", style: "bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/20" };
  }
};

export const Scripts: React.FC<ScriptsProps> = ({
  config,
  runningProjects,
  onSaveConfig,
  onStartScript,
  onStopScript,
  onOpenConsole,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingScript, setEditingScript] = useState<ScriptConfig | null>(null);
  
  // Form states
  const [name, setName] = useState("");
  const [filePath, setFilePath] = useState("");
  const [command, setCommand] = useState("");

  const scriptsList = config.scripts || [];

  const handleOpenAddModal = () => {
    setEditingScript(null);
    setName("");
    setFilePath("");
    setCommand("");
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (script: ScriptConfig) => {
    setEditingScript(script);
    setName(script.name);
    setFilePath(script.path);
    setCommand(script.command);
    setIsModalOpen(true);
  };

  const handleBrowseFile = async () => {
    try {
      const selected = await invoke<string | null>("select_file");
      if (selected) {
        setFilePath(selected);
        
        // Generate name from filename if empty
        const filename = selected.split(/[/\\]/).pop() || "";
        if (!name) {
          const nameWithoutExt = filename.substring(0, filename.lastIndexOf(".")) || filename;
          setName(nameWithoutExt);
        }

        // Generate default command based on extension
        const ext = filename.split(".").pop()?.toLowerCase();
        let defaultCmd = `"${selected}"`;
        if (ext === "py") {
          defaultCmd = `python "${selected}"`;
        } else if (ext === "js") {
          defaultCmd = `node "${selected}"`;
        } else if (ext === "ts") {
          defaultCmd = `ts-node "${selected}"`;
        } else if (ext === "java") {
          defaultCmd = `java "${selected}"`;
        } else if (ext === "jar") {
          defaultCmd = `java -jar "${selected}"`;
        } else if (ext === "bat") {
          defaultCmd = `cmd /C "${selected}"`;
        } else if (ext === "ps1") {
          defaultCmd = `powershell -File "${selected}"`;
        } else if (ext === "sh") {
          defaultCmd = `bash "${selected}"`;
        }
        setCommand(defaultCmd);
      }
    } catch (e) {
      console.error("Fehler beim Auswählen der Datei:", e);
    }
  };

  const handleSave = () => {
    if (!name.trim() || !filePath.trim() || !command.trim()) return;

    let updatedScripts = [...scriptsList];
    
    if (editingScript) {
      // Edit
      updatedScripts = updatedScripts.map((s) => 
        s.id === editingScript.id 
          ? { ...s, name: name.trim(), path: filePath.trim(), command: command.trim() } 
          : s
      );
    } else {
      // Add new
      const newScript: ScriptConfig = {
        id: Math.random().toString(36).substring(2, 9),
        name: name.trim(),
        path: filePath.trim(),
        command: command.trim(),
      };
      updatedScripts.push(newScript);
    }

    onSaveConfig({
      ...config,
      scripts: updatedScripts,
    });
    setIsModalOpen(false);
  };

  const handleDelete = (id: string, path: string) => {
    if (runningProjects[path]) {
      onStopScript(path);
    }
    const updatedScripts = scriptsList.filter((s) => s.id !== id);
    onSaveConfig({
      ...config,
      scripts: updatedScripts,
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tight"><span className="gradient-text font-display">Scripts</span></h1>
          <p className="text-sm text-slate-500 dark:text-slate-450 mt-0.5">Configure and execute custom scripts (Python, JS, batch, shell, etc.)</p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="flex items-center justify-center space-x-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-all shadow-md hover:shadow-brand-900/10 active:scale-[0.98] shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>New Script</span>
        </button>
      </div>

      {/* Main content grid */}
      {scriptsList.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-slate-900/30 rounded-xl border border-slate-200 dark:border-white/5 shadow-sm text-center max-w-xl mx-auto mt-12 animate-in slide-in-from-bottom duration-300">
          <div className="p-4 bg-brand-50 dark:bg-brand-950/20 rounded-full text-brand-650 mb-4 animate-pulse">
            <FileCode className="w-10 h-10" />
          </div>
          <h3 className="text-2xl font-bold text-slate-800 dark:text-white font-sans uppercase">No custom scripts</h3>
          <p className="text-sm text-slate-500 dark:text-slate-450 mt-2 leading-relaxed">
            Configure custom scripting files here to execute them in one click directly from LaunchPad and interact with them in the terminal drawer.
          </p>
          <button
            onClick={handleOpenAddModal}
            className="mt-6 bg-brand-650 hover:bg-brand-700 text-white text-sm font-semibold px-6 py-3 rounded-lg shadow-md transition-all active:scale-[0.98]"
          >
            Add your First Script
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {scriptsList.map((script) => {
            const isRunning = runningProjects[script.path] || false;
            
            return (
              <div 
                key={script.id}
                className={`bg-white dark:bg-slate-900/30 rounded-xl border border-slate-205 dark:border-white/5 flex flex-col shadow-sm relative group hover-scale ${isRunning ? 'ring-1 ring-emerald-500/30' : ''}`}
              >
                <div className="absolute top-0 left-0 right-0 h-[3px] brand-gradient-bg rounded-t-xl"></div>
                
                {/* Active Indicator Dot */}
                {isRunning && (
                  <span className="absolute -top-1 -left-1 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100 dark:ring-emerald-950 animate-pulse"></span>
                )}

                {/* Card Header */}
                <div className="px-5 pt-5 pb-3 flex items-start justify-between">
                  <div className="space-y-1 flex-1 pr-4">
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                      <h3 className="text-base font-bold text-slate-800 dark:text-white tracking-tight leading-tight select-all">
                        {script.name}
                      </h3>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase bg-violet-500/10 text-violet-700 dark:text-violet-400 border border-violet-500/20">
                        Script
                      </span>
                      {(() => {
                        const lang = getScriptLanguageInfo(script.path);
                        if (lang.label === "Script") return null;
                        return (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase border ${lang.style}`}>
                            {lang.label}
                          </span>
                        );
                      })()}
                    </div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono truncate mt-1 cursor-help select-all" title={script.path}>
                      {script.path}
                    </p>
                  </div>

                  <div className="flex space-x-1.5 shrink-0">
                    <button
                      onClick={() => handleOpenEditModal(script)}
                      disabled={isRunning}
                      className="p-1.5 bg-white dark:bg-slate-800/40 border border-slate-205 dark:border-white/5 text-slate-400 dark:text-slate-500 hover:text-brand-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-all active:scale-95 disabled:opacity-50"
                      title="Edit script"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(script.id, script.path)}
                      className="p-1.5 bg-white dark:bg-slate-800/40 border border-slate-205 dark:border-white/5 text-slate-400 dark:text-slate-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-all active:scale-95"
                      title="Delete script"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Execution command preview */}
                <div className="px-5 py-2.5 bg-slate-50/50 dark:bg-slate-950/10 border-t border-b border-slate-100 dark:border-white/5 flex flex-col justify-center flex-1">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">Execution Command</label>
                  <div className="flex items-center justify-between text-xs font-mono bg-slate-100/60 dark:bg-slate-950/40 border border-slate-200/60 dark:border-white/5 text-slate-650 dark:text-slate-350 rounded px-2.5 py-1.5">
                    <span className="truncate pr-2 select-all">{script.command}</span>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="px-5 py-4 bg-slate-50/30 dark:bg-slate-950/10 rounded-b-xl flex items-center justify-end gap-2 mt-auto">
                  <button
                    onClick={() => onOpenConsole({ name: script.name, path: script.path })}
                    className="p-2 bg-slate-50 dark:bg-slate-800/40 hover:bg-brand-50 dark:hover:bg-slate-700 border border-slate-205 dark:border-white/5 text-slate-550 dark:text-slate-300 hover:text-brand-700 dark:hover:text-brand-400 rounded-lg shadow-sm transition-colors"
                    title="Open Console Output"
                  >
                    <Terminal className="w-3.5 h-3.5" />
                  </button>

                  {isRunning ? (
                    <button
                      onClick={() => onStopScript(script.path)}
                      className="flex items-center space-x-1 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-md transition-colors active:scale-95"
                    >
                      <Square className="w-3.5 h-3.5" />
                      <span>Stop</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => onStartScript(script.path, script.command)}
                      className="flex items-center space-x-1 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg shadow-md transition-colors active:scale-95"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Start</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/5 shadow-2xl p-6 relative overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="absolute top-0 left-0 right-0 h-[4px] brand-gradient-bg"></div>
            
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-xl font-bold text-slate-800 dark:text-white uppercase font-sans">
              {editingScript ? "Edit Script" : "New Script"}
            </h3>
            
            <div className="mt-6 space-y-4 text-sm">
              {/* File Select */}
              <div>
                <label className="block text-xs font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wide mb-1.5">Script File</label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={filePath}
                    onChange={(e) => setFilePath(e.target.value)}
                    placeholder="c:\path\to\script.py"
                    className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/5 rounded-lg px-3 py-2 text-xs font-mono outline-none text-slate-700 dark:text-slate-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  />
                  <button
                    onClick={handleBrowseFile}
                    className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-lg text-xs transition-colors border border-slate-200 dark:border-white/5"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>Browse</span>
                  </button>
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wide mb-1.5">Script Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My Python Utility"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/5 rounded-lg px-3 py-2 text-xs outline-none text-slate-700 dark:text-slate-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                />
              </div>

              {/* Command */}
              <div>
                <label className="block text-xs font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wide mb-1.5">Execution Command</label>
                <input
                  type="text"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder='python "c:\path\to\script.py"'
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/5 rounded-lg px-3 py-2 text-xs font-mono outline-none text-slate-700 dark:text-slate-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                />
              </div>
            </div>

            <div className="mt-8 flex justify-end space-x-2">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 border border-slate-200 dark:border-white/5 text-slate-550 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!name.trim() || !filePath.trim() || !command.trim()}
                className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg shadow-md transition-colors disabled:opacity-50"
              >
                Save
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
