import React, { useEffect, useState } from "react";
import { FolderOpen, Sliders, Cpu, AlertTriangle, RefreshCw } from "lucide-react";
import { AppConfig, SystemInfo } from "../types";
import { invoke } from "@tauri-apps/api/core";

interface SettingsProps {
  config: AppConfig;
  onSaveConfig: (newConfig: AppConfig) => void;
}

export const Settings: React.FC<SettingsProps> = ({ config, onSaveConfig }) => {
  const [devDir, setDevDir] = useState(config.dev_dir || "");
  const [scanDepth, setScanDepth] = useState(config.scan_depth || 2);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [loadingSysInfo, setLoadingSysInfo] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load system info on component mount
  useEffect(() => {
    fetchSystemInfo();
  }, []);

  const fetchSystemInfo = async () => {
    setLoadingSysInfo(true);
    try {
      const info = await invoke<SystemInfo>("get_system_info");
      setSystemInfo(info);
    } catch (e) {
      console.error("Failed to load system info:", e);
    } finally {
      setLoadingSysInfo(false);
    }
  };

  const handlePickDirectory = async () => {
    try {
      const selected = await invoke<string | null>("select_directory", {
        currentDir: devDir || null,
      });
      if (selected) {
        setDevDir(selected);
        const updated = {
          ...config,
          dev_dir: selected,
        };
        onSaveConfig(updated);
        triggerSaveIndicator();
      }
    } catch (e) {
      console.error("Error picking directory:", e);
    }
  };

  const handleDepthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const depth = parseInt(e.target.value, 10);
    setScanDepth(depth);
    const updated = {
      ...config,
      scan_depth: depth,
    };
    onSaveConfig(updated);
    triggerSaveIndicator();
  };

  const triggerSaveIndicator = () => {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleResetConfig = async () => {
    if (confirm("Möchtest du wirklich alle Einstellungen zurücksetzen? Deine angepassten Startbefehle gehen verloren.")) {
      const resetConfig: AppConfig = {
        dev_dir: null,
        scan_depth: 2,
        projects: {},
      };
      setDevDir("");
      setScanDepth(2);
      onSaveConfig(resetConfig);
      triggerSaveIndicator();
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Einstellungen</h1>
        <p className="text-sm text-slate-500 mt-1">Konfiguriere das Verhalten von LaunchPad und verwalte Verzeichnisse.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left/Middle: General Configurations */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Dev Directory Config Card */}
          <div className="bg-white rounded-xl border border-brand-200/60 p-6 shadow-sm">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-brand-50 rounded-lg text-brand-600">
                <FolderOpen className="w-5 h-5" />
              </div>
              <h2 className="text-base font-semibold text-slate-800">Entwicklungsordner</h2>
            </div>
            
            <p className="text-sm text-slate-500 mb-4 leading-relaxed">
              LaunchPad scannt dieses Stammverzeichnis nach Projekten (z.B. Ordnern, die eine package.json, Cargo.toml oder go.mod enthalten).
            </p>

            <div className="flex space-x-3">
              <input
                type="text"
                readOnly
                placeholder="Kein Ordner ausgewählt"
                value={devDir}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm text-slate-700 outline-none focus:border-brand-300 select-all font-mono"
              />
              <button
                onClick={handlePickDirectory}
                className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shadow-sm flex items-center space-x-2 shrink-0 active:scale-[0.98]"
              >
                <span>Ordner wählen</span>
              </button>
            </div>
          </div>

          {/* Scanner Config Card */}
          <div className="bg-white rounded-xl border border-brand-200/60 p-6 shadow-sm">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-brand-50 rounded-lg text-brand-600">
                <Sliders className="w-5 h-5" />
              </div>
              <h2 className="text-base font-semibold text-slate-800">Scan-Einstellungen</h2>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm text-slate-600 mb-2">
                  <label htmlFor="scan-depth" className="font-medium">Scan-Tiefe</label>
                  <span className="font-mono bg-brand-50 px-2 py-0.5 rounded text-brand-700 font-semibold">{scanDepth} Ebenen</span>
                </div>
                <input
                  id="scan-depth"
                  type="range"
                  min="1"
                  max="3"
                  value={scanDepth}
                  onChange={handleDepthChange}
                  className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-brand-600 focus:outline-none"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-1.5 font-medium">
                  <span>1 (Flach, nur direkte Unterordner)</span>
                  <span>2 (Empfohlen)</span>
                  <span>3 (Tief, längere Ladezeit)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Reset / Danger Zone Card */}
          <div className="bg-white rounded-xl border border-rose-200/60 p-6 shadow-sm">
            <div className="flex items-center space-x-3 mb-4 text-rose-700">
              <div className="p-2 bg-rose-50 rounded-lg text-rose-600">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h2 className="text-base font-semibold">Gefahrenzone</h2>
            </div>
            
            <p className="text-sm text-slate-500 mb-4 leading-relaxed">
              Dadurch werden alle benutzerdefinierten Befehle für Projekte und das Verzeichnis gelöscht.
            </p>

            <button
              onClick={handleResetConfig}
              className="bg-rose-50 hover:bg-rose-100/80 border border-rose-200 text-rose-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors active:scale-[0.98]"
            >
              Einstellungen zurücksetzen
            </button>
          </div>

        </div>

        {/* Right Panel: System Information */}
        <div className="space-y-6">
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-2 text-slate-700 font-semibold">
                <Cpu className="w-5 h-5 text-slate-500" />
                <span>Systemumgebung</span>
              </div>
              <button
                onClick={fetchSystemInfo}
                disabled={loadingSysInfo}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded hover:bg-slate-200 disabled:opacity-50"
                title="Aktualisieren"
              >
                <RefreshCw className={`w-4 h-4 ${loadingSysInfo ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col p-3 bg-white rounded-lg border border-slate-100">
                <span className="text-xs text-slate-400 font-medium">Node.js</span>
                <span className="text-sm font-mono text-slate-700 mt-1 truncate">
                  {systemInfo?.node_version || (loadingSysInfo ? "Prüfen..." : "Nicht installiert")}
                </span>
              </div>

              <div className="flex flex-col p-3 bg-white rounded-lg border border-slate-100">
                <span className="text-xs text-slate-400 font-medium">Rust / Cargo</span>
                <span className="text-sm font-mono text-slate-700 mt-1 truncate">
                  {systemInfo?.cargo_version || (loadingSysInfo ? "Prüfen..." : "Nicht installiert")}
                </span>
              </div>

              <div className="flex flex-col p-3 bg-white rounded-lg border border-slate-100">
                <span className="text-xs text-slate-400 font-medium">Git Version</span>
                <span className="text-sm font-mono text-slate-700 mt-1 truncate">
                  {systemInfo?.git_version || (loadingSysInfo ? "Prüfen..." : "Nicht installiert")}
                </span>
              </div>
            </div>
            
            <p className="text-[11px] text-slate-400 mt-6 leading-relaxed">
              LaunchPad verwendet diese lokalen CLI-Tools, um deine Entwicklungsprozesse auszuführen und Informationen anzuzeigen.
            </p>
          </div>
        </div>

      </div>

      {/* Floating Save Toast notification */}
      {saveSuccess && (
        <div className="fixed bottom-6 right-6 bg-brand-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-300 z-50">
          Einstellungen gespeichert
        </div>
      )}

    </div>
  );
};
