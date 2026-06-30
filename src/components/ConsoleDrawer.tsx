import React, { useEffect, useRef, useState } from "react";
import { X, Trash2, Square, ChevronsDown } from "lucide-react";
import { stripAnsi } from "../utils";

interface ConsoleDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  projectPath: string;
  isRunning: boolean;
  logs: string[];
  onClear: () => void;
  onStop: () => void;
}

export const ConsoleDrawer: React.FC<ConsoleDrawerProps> = ({
  isOpen,
  onClose,
  projectName,
  projectPath,
  isRunning,
  logs,
  onClear,
  onStop,
}) => {
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Scroll to bottom when logs change
  useEffect(() => {
    if (autoScroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm transition-all duration-300">
      {/* Backdrop area click to close */}
      <div className="flex-1" onClick={onClose}></div>

      {/* Drawer Content */}
      <div className="w-full max-w-2xl bg-slate-950 border-l border-brand-800/20 text-slate-100 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-brand-900/40">
          <div className="flex items-center space-x-3">
            <span className={`w-3 h-3 rounded-full ${isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-white flex items-center gap-2">
                Console: {projectName}
              </h2>
              <p className="text-xs text-slate-400 font-mono select-all mt-0.5">{projectPath}</p>
            </div>
          </div>
          
          <button 
            onClick={onClose} 
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-3 bg-slate-900/50 border-b border-brand-900/20">
          <div className="flex items-center space-x-4 text-sm">
            <label className="flex items-center space-x-2 text-slate-400 cursor-pointer select-none hover:text-slate-200 transition-colors">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="rounded border-slate-700 text-brand-500 focus:ring-brand-500 focus:ring-offset-slate-900 bg-slate-800 w-4 h-4 cursor-pointer"
              />
              <span>Auto-Scroll</span>
            </label>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClear}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg border border-slate-800 transition-colors"
              title="Clear console"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
            {isRunning && (
              <button
                onClick={onStop}
                className="flex items-center space-x-1.5 px-3 py-1.5 text-xs text-rose-400 hover:text-rose-100 hover:bg-rose-950/40 rounded-lg border border-rose-900/50 transition-colors"
                title="Stop process"
              >
                <Square className="w-3.5 h-3.5" />
                <span>Stop</span>
              </button>
            )}
          </div>
        </div>

        {/* Terminal Body */}
        <div className="flex-1 overflow-y-auto p-6 font-mono text-sm leading-relaxed space-y-1 select-text scrollbar-thin scrollbar-track-slate-950 scrollbar-thumb-slate-800">
          {logs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2">
              <div className="p-3 bg-slate-900 rounded-full text-slate-600 border border-slate-800/40">
                <ChevronsDown className="w-6 h-6 animate-bounce" />
              </div>
              <p className="text-xs">No console output logged yet.</p>
              <p className="text-[10px] opacity-75">Click "Start" on the card to see logs.</p>
            </div>
          ) : (
            logs.map((log, index) => {
              const cleanLog = stripAnsi(log);
              let textClass = "text-slate-300";
              if (cleanLog.toLowerCase().includes("error") || cleanLog.toLowerCase().includes("failed") || cleanLog.startsWith("[Prozess mit Code") || cleanLog.startsWith("[Process exited")) {
                textClass = "text-rose-400";
              } else if (cleanLog.toLowerCase().includes("warning") || cleanLog.toLowerCase().includes("warn")) {
                textClass = "text-amber-400";
              } else if (cleanLog.toLowerCase().includes("success") || cleanLog.toLowerCase().includes("compiled successfully")) {
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
  );
};
