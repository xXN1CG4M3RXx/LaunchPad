import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { RefreshCw, Search, Trash2, Plug, AlertTriangle, CheckCircle2 } from "lucide-react";
import { ActivePort } from "../types";

const DEV_PORTS = [3000, 3001, 3002, 3306, 5000, 5173, 5432, 6379, 8000, 8080, 8081, 9000, 9200];

export const PortsManager: React.FC = () => {
  const [ports, setPorts] = useState<ActivePort[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showDevPortsOnly, setShowDevPortsOnly] = useState(true);
  const [killPid, setKillPid] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchPorts = async () => {
    setLoading(true);
    try {
      const activePorts = await invoke<ActivePort[]>("get_active_ports");
      setPorts(activePorts);
    } catch (e) {
      console.error("Failed to fetch active ports:", e);
      showToast("Failed to reload active ports.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPorts();
  }, []);

  const handleKillProcess = async (pid: number, port: number) => {
    setKillPid(pid);
    try {
      await invoke("kill_process_by_pid", { pid });
      showToast(`Process ${pid} on port ${port} terminated.`);
      // Refresh list
      await fetchPorts();
    } catch (e) {
      console.error("Failed to kill process:", e);
      showToast(`Failed to terminate process ${pid}.`);
    } finally {
      setKillPid(null);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const filteredPorts = ports.filter((p) => {
    const matchesSearch =
      p.process_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.port.toString().includes(searchQuery) ||
      p.pid.toString().includes(searchQuery);

    const matchesDevToggle = !showDevPortsOnly || DEV_PORTS.includes(p.port);

    return matchesSearch && matchesDevToggle;
  });

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-6 animate-in fade-in duration-300">
      
      {/* Header Panel */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/5 pb-4 shrink-0">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
            <Plug className="w-6 h-6 text-brand-500" />
            <span>Port Manager</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Scan occupied local listening ports and terminate blocking processes.
          </p>
        </div>

        <button
          onClick={fetchPorts}
          disabled={loading}
          className="flex items-center space-x-2 px-3 py-2 bg-white dark:bg-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-255 disabled:opacity-50 border border-slate-200 dark:border-white/5 text-xs font-semibold rounded-lg shadow-sm transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Scan Ports</span>
        </button>
      </div>

      {/* Control Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-white/5 rounded-xl shrink-0">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs bg-slate-50 dark:bg-slate-955/60 border border-slate-200 dark:border-white/5 rounded-lg pl-10 pr-4 py-2.5 text-slate-800 dark:text-slate-200 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            placeholder="Search by port number or process name..."
          />
        </div>

        {/* Filter Toggle */}
        <label className="flex items-center space-x-3 text-xs font-medium text-slate-600 dark:text-slate-350 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showDevPortsOnly}
            onChange={(e) => setShowDevPortsOnly(e.target.checked)}
            className="rounded border-slate-300 dark:border-slate-850 text-brand-600 focus:ring-brand-500 focus:ring-offset-slate-900 bg-slate-100 dark:bg-slate-950 w-4 h-4"
          />
          <span>Show common dev ports only (e.g. 3000, 5173, 8080)</span>
        </label>
      </div>

      {/* Table Container */}
      <div className="flex-1 min-h-0 bg-white dark:bg-slate-900/10 border border-slate-200 dark:border-white/5 rounded-xl overflow-hidden shadow-sm flex flex-col relative">
        <div className="absolute top-0 left-0 right-0 h-[3px] brand-gradient-bg shrink-0"></div>

        {/* Scrollable table viewport */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3 py-16">
              <RefreshCw className="w-8 h-8 animate-spin text-brand-500" />
              <p className="text-xs">Scanning system ports...</p>
            </div>
          ) : filteredPorts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-3 py-16">
              <div className="p-3.5 bg-slate-100 dark:bg-slate-955/60 rounded-full border border-slate-200/50 dark:border-white/5 text-slate-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <p className="text-xs font-medium">No occupied ports found.</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-550">
                {showDevPortsOnly ? "Try disabling the 'common dev ports' filter to scan all system listeners." : "Every system port is currently free!"}
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-55 dark:bg-slate-950/40 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-150 dark:border-white/5 sticky top-0 z-10 shrink-0">
                  <th className="px-6 py-3.5">Port</th>
                  <th className="px-6 py-3.5">Process</th>
                  <th className="px-6 py-3.5">PID</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-xs text-slate-700 dark:text-slate-350">
                {filteredPorts.map((p) => {
                  const isDevPort = DEV_PORTS.includes(p.port);
                  return (
                    <tr key={p.port} className="hover:bg-slate-50/50 dark:hover:bg-slate-955/25 transition-colors">
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold tracking-wide ${
                          isDevPort 
                            ? "bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/15" 
                            : "bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/5"
                        }`}>
                          {p.port}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-800 dark:text-slate-200">
                        {p.process_name}
                      </td>
                      <td className="px-6 py-4 font-mono text-slate-500 dark:text-slate-500">
                        {p.pid}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleKillProcess(p.pid, p.port)}
                          disabled={killPid === p.pid}
                          className="inline-flex items-center space-x-1 px-3 py-1.5 bg-rose-600/10 hover:bg-rose-600 hover:text-white border border-rose-500/20 hover:border-transparent text-rose-600 dark:text-rose-400 text-[11px] font-bold rounded-lg transition-all active:scale-[0.98]"
                          title={`Kill process ${p.process_name} (${p.pid})`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>{killPid === p.pid ? "Killing..." : "Free Port"}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-brand-600 text-white text-sm font-semibold px-5 py-3 rounded-xl shadow-xl shadow-brand-500/10 border border-brand-500/20 animate-toast z-50 flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

    </div>
  );
};
