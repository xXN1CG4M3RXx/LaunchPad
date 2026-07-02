import React, { useState, useEffect } from "react";
import { RefreshCw, Play, Square, RotateCw, Terminal, AlertTriangle, X, Database } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { DockerContainer } from "../types";

export const DockerManager: React.FC = () => {
  const [containers, setContainers] = useState<DockerContainer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // State for Docker logs drawer
  const [logContainer, setLogContainer] = useState<DockerContainer | null>(null);
  const [logs, setLogs] = useState<string>("");
  const [loadingLogs, setLoadingLogs] = useState(false);

  const fetchContainers = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await invoke<DockerContainer[]>("get_docker_containers");
      setContainers(list);
    } catch (err: any) {
      console.error(err);
      setError(err?.toString() || "Fehler beim Laden der Docker-Container");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContainers();
  }, []);

  const handleAction = async (id: string, action: "start" | "stop" | "restart") => {
    try {
      await invoke("manage_docker_container", { id, action });
      fetchContainers();
      // If we are showing logs of this container, update them too
      if (logContainer && logContainer.id === id) {
        fetchLogs(id);
      }
    } catch (err: any) {
      alert(`Aktion fehlgeschlagen: ${err}`);
    }
  };

  const fetchLogs = async (id: string) => {
    setLoadingLogs(true);
    try {
      const logText = await invoke<string>("get_docker_logs", { id, tail: 100 });
      setLogs(logText);
    } catch (err: any) {
      setLogs(`Fehler beim Laden der Logs: ${err}`);
    } finally {
      setLoadingLogs(false);
    }
  };

  const openLogs = (container: DockerContainer) => {
    setLogContainer(container);
    setLogs("");
    fetchLogs(container.id);
  };

  const isRunning = (status: string) => {
    return status.toLowerCase().includes("up");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-wider text-slate-100 flex items-center space-x-2">
            <span className="p-2 bg-blue-600 rounded-lg text-white mr-2">
              <Database className="w-6 h-6" />
            </span>
            Docker Container
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Verwalte deine lokalen Docker-Dienste und verfolge deren Logs in Echtzeit.
          </p>
        </div>
        <button
          onClick={fetchContainers}
          disabled={loading}
          className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold py-2.5 px-4 rounded-xl border border-slate-700 transition-all active:scale-[0.98] disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          <span>Aktualisieren</span>
        </button>
      </div>

      {error ? (
        <div className="glassmorphism p-6 rounded-2xl border border-red-500/20 bg-red-500/5 flex flex-col items-center justify-center text-center space-y-3">
          <AlertTriangle className="w-12 h-12 text-red-400" />
          <h3 className="text-lg font-bold text-red-200">Docker Verbindung fehlgeschlagen</h3>
          <p className="text-slate-400 max-w-md text-sm">
            Der Docker-Daemon läuft eventuell nicht oder die CLI ist nicht im Systempfad (PATH) konfiguriert. Stelle sicher, dass Docker Desktop oder die Docker Engine aktiv ist.
          </p>
          <button
            onClick={fetchContainers}
            className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-xl text-sm transition-all"
          >
            Erneut versuchen
          </button>
        </div>
      ) : containers.length === 0 ? (
        <div className="glassmorphism p-12 rounded-2xl text-center space-y-4">
          <div className="w-16 h-16 bg-slate-800/60 rounded-full flex items-center justify-center mx-auto text-slate-400">
            <Database className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-200">Keine Container gefunden</h3>
          <p className="text-slate-400 max-w-sm mx-auto text-sm">
            Es wurden keine lokalen Docker-Container auf deinem System gefunden.
          </p>
        </div>
      ) : (
        <div className="glass-card rounded-2xl overflow-hidden border border-slate-800/80">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/40 text-slate-400 text-xs uppercase tracking-wider font-bold">
                  <th className="py-4 px-6">Name</th>
                  <th className="py-4 px-6">Image</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6">Ports</th>
                  <th className="py-4 px-6 text-right">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {containers.map((c) => {
                  const running = isRunning(c.status);
                  return (
                    <tr key={c.id} className="hover:bg-slate-950/20 transition-colors">
                      <td className="py-4 px-6 font-semibold text-slate-200">
                        {c.name}
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">{c.id}</div>
                      </td>
                      <td className="py-4 px-6 font-mono text-xs text-slate-300 max-w-xs truncate">
                        {c.image}
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                          running 
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                            : "bg-slate-850 text-slate-400 border-slate-700"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${running ? "bg-emerald-500 animate-pulse" : "bg-slate-500"}`}></span>
                          {c.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 font-mono text-xs text-slate-400 max-w-xs truncate">
                        {c.ports || "-"}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          {running ? (
                            <>
                              <button
                                onClick={() => handleAction(c.id, "stop")}
                                title="Container stoppen"
                                className="p-2 bg-slate-800 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 text-slate-400 rounded-lg border border-slate-700 transition-colors"
                              >
                                <Square className="w-4 h-4 fill-current" />
                              </button>
                              <button
                                onClick={() => handleAction(c.id, "restart")}
                                title="Container neu starten"
                                className="p-2 bg-slate-800 hover:bg-blue-500/10 hover:text-blue-400 hover:border-blue-500/20 text-slate-400 rounded-lg border border-slate-700 transition-colors"
                              >
                                <RotateCw className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleAction(c.id, "start")}
                              title="Container starten"
                              className="p-2 bg-emerald-600/10 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/20 hover:border-emerald-600 rounded-lg transition-colors"
                            >
                              <Play className="w-4 h-4 fill-current" />
                            </button>
                          )}
                          <button
                            onClick={() => openLogs(c)}
                            title="Logs anzeigen"
                            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded-lg border border-slate-700 transition-colors"
                          >
                            <Terminal className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Logs Drawer */}
      {logContainer && (
        <div className="fixed inset-y-0 right-0 w-[550px] bg-slate-950 border-l border-slate-850 shadow-2xl flex flex-col z-50 animate-slide-in">
          <div className="h-16 px-6 border-b border-slate-850 flex items-center justify-between bg-slate-900/60">
            <div className="flex items-center space-x-2">
              <Terminal className="w-4 h-4 text-blue-400" />
              <span className="font-bold text-slate-100 truncate max-w-[320px]">
                Logs: {logContainer.name}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => fetchLogs(logContainer.id)}
                disabled={loadingLogs}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg transition-colors"
                title="Logs aktualisieren"
              >
                <RefreshCw className={`w-4 h-4 ${loadingLogs ? "animate-spin" : ""}`} />
              </button>
              <button
                onClick={() => setLogContainer(null)}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 p-6 overflow-y-auto font-mono text-xs text-slate-300 bg-slate-950 select-text whitespace-pre-wrap leading-relaxed">
            {loadingLogs && !logs ? (
              <div className="flex items-center justify-center h-full text-slate-500">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                Lade Logs...
              </div>
            ) : logs ? (
              logs
            ) : (
              <div className="text-slate-500 italic">Keine Log-Ausgabe vorhanden.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
