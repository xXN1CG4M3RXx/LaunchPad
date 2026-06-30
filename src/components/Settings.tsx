import React, { useEffect, useState } from "react";
import { FolderOpen, Sliders, Cpu, AlertTriangle, RefreshCw, Moon } from "lucide-react";
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

  const handleThemeChange = (theme: "dark" | "light") => {
    const updated = {
      ...config,
      theme,
    };
    onSaveConfig(updated);
    triggerSaveIndicator();
  };

  const triggerSaveIndicator = () => {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleResetConfig = async () => {
    if (confirm("Möchtest du wirklich alle Einstellungen zurücksetzen? Deine angepassten Startbefehle und das Theme gehen verloren.")) {
      const resetConfig: AppConfig = {
        dev_dir: null,
        scan_depth: 2,
        projects: {},
        theme: "dark",
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
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Einstellungen</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Konfiguriere das Verhalten von LaunchPad und verwalte Verzeichnisse.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left/Middle: General Configurations */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Dev Directory Config Card */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-brand-200/60 dark:border-slate-800 p-6 shadow-sm">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-brand-50 dark:bg-brand-950/20 rounded-lg text-brand-600 dark:text-brand-400">
                <FolderOpen className="w-5 h-5" />
              </div>
              <h2 className="text-base font-semibold text-slate-800 dark:text-white">Entwicklungsordner</h2>
            </div>
            
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 leading-relaxed font-sans">
              LaunchPad scannt dieses Stammverzeichnis nach Projekten (z.B. Ordnern, die eine package.json, Cargo.toml oder go.mod enthalten).
            </p>

            <div className="flex space-x-3">
              <input
                type="text"
                readOnly
                placeholder="Kein Ordner ausgewählt"
                value={devDir}
                className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-205 dark:border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-brand-300 select-all font-mono"
              />
              <button
                onClick={handlePickDirectory}
                className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shadow-sm flex items-center space-x-2 shrink-0 active:scale-[0.98]"
              >
                <span>Ordner wählen</span>
              </button>
            </div>
          </div>

          {/* Theme Selector Card */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-brand-200/60 dark:border-slate-800 p-6 shadow-sm">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-brand-50 dark:bg-brand-950/20 rounded-lg text-brand-600 dark:text-brand-400">
                <Moon className="w-5 h-5" />
              </div>
              <h2 className="text-base font-semibold text-slate-800 dark:text-white">Darstellung</h2>
            </div>
            
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 leading-relaxed font-sans">
              Wähle dein bevorzugtes Farbschema für das LaunchPad-Interface.
            </p>

            <div className="flex space-x-4">
              <button
                onClick={() => handleThemeChange("dark")}
                className={`flex-1 py-2.5 rounded-lg border text-sm font-semibold transition-all ${
                  (config.theme || "dark") === "dark"
                    ? "bg-brand-600 border-brand-600 text-white shadow-sm"
                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                Dunkel (Standard)
              </button>
              <button
                onClick={() => handleThemeChange("light")}
                className={`flex-1 py-2.5 rounded-lg border text-sm font-semibold transition-all ${
                  config.theme === "light"
                    ? "bg-brand-600 border-brand-600 text-white shadow-sm"
                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                Hell
              </button>
            </div>
          </div>

          {/* Scanner Config Card */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-brand-200/60 dark:border-slate-800 p-6 shadow-sm">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-brand-50 dark:bg-brand-950/20 rounded-lg text-brand-600 dark:text-brand-400">
                <Sliders className="w-5 h-5" />
              </div>
              <h2 className="text-base font-semibold text-slate-800 dark:text-white">Scan-Einstellungen</h2>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400 mb-2">
                  <label htmlFor="scan-depth" className="font-medium">Scan-Tiefe</label>
                  <span className="font-mono bg-brand-50 dark:bg-brand-950/40 px-2 py-0.5 rounded text-brand-700 dark:text-brand-400 font-semibold">{scanDepth} Ebenen</span>
                </div>
                <input
                  id="scan-depth"
                  type="range"
                  min="1"
                  max="3"
                  value={scanDepth}
                  onChange={handleDepthChange}
                  className="w-full h-2 bg-slate-105 dark:bg-slate-950 rounded-lg appearance-none cursor-pointer accent-brand-600 focus:outline-none"
                />
                <div className="flex justify-between text-xs text-slate-400 dark:text-slate-500 mt-1.5 font-medium">
                  <span>1 (Flach, nur direkte Unterordner)</span>
                  <span>2 (Empfohlen)</span>
                  <span>3 (Tief, längere Ladezeit)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Reset / Danger Zone Card */}
          <div className="bg-white dark:bg-slate-900 border border-rose-200/60 dark:border-rose-900/50 p-6 rounded-xl shadow-sm">
            <div className="flex items-center space-x-3 mb-4 text-rose-700 dark:text-rose-450">
              <div className="p-2 bg-rose-50 dark:bg-rose-955/20 rounded-lg text-rose-650 dark:text-rose-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h2 className="text-base font-semibold">Gefahrenzone</h2>
            </div>
            
            <p className="text-sm text-slate-500 dark:text-slate-450 mb-4 leading-relaxed font-sans">
              Dadurch werden alle benutzerdefinierten Befehle für Projekte und das Verzeichnis gelöscht.
            </p>

            <button
              onClick={handleResetConfig}
              className="bg-rose-55 dark:bg-rose-950/20 hover:bg-rose-100/80 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-400 text-sm font-medium px-4 py-2 rounded-lg transition-all active:scale-[0.98]"
            >
              Einstellungen zurücksetzen
            </button>
          </div>

        </div>

        {/* Right Panel: System Information */}
        <div className="space-y-6">
          <div className="bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-2 text-slate-705 dark:text-slate-200 font-semibold">
                <Cpu className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                <span>Systemumgebung</span>
              </div>
              <button
                onClick={fetchSystemInfo}
                disabled={loadingSysInfo}
                className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-350 transition-colors p-1 rounded hover:bg-slate-205 dark:hover:bg-slate-800 disabled:opacity-50"
                title="Aktualisieren"
              >
                <RefreshCw className={`w-4 h-4 ${loadingSysInfo ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800/80">
                <span className="text-xs text-slate-400 dark:text-slate-550 font-medium">Node.js</span>
                <span className="text-sm font-mono text-slate-700 dark:text-slate-300 mt-1 truncate">
                  {systemInfo?.node_version || (loadingSysInfo ? "Prüfen..." : "Nicht installiert")}
                </span>
              </div>

              <div className="flex flex-col p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800/80">
                <span className="text-xs text-slate-400 dark:text-slate-550 font-medium">Rust / Cargo</span>
                <span className="text-sm font-mono text-slate-700 dark:text-slate-300 mt-1 truncate">
                  {systemInfo?.cargo_version || (loadingSysInfo ? "Prüfen..." : "Nicht installiert")}
                </span>
              </div>

              <div className="flex flex-col p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800/80">
                <span className="text-xs text-slate-400 dark:text-slate-550 font-medium">Git Version</span>
                <span className="text-sm font-mono text-slate-700 dark:text-slate-300 mt-1 truncate">
                  {systemInfo?.git_version || (loadingSysInfo ? "Prüfen..." : "Nicht installiert")}
                </span>
              </div>
            </div>
            
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-6 leading-relaxed font-sans">
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
