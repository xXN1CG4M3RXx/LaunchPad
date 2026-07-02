import React, { useState, useEffect, useMemo } from "react";
import { Cpu, AlertTriangle, Search, Trash2, Loader2 } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { PerformanceSnapshot } from "../types";

export const PerformanceMonitor: React.FC = () => {
  const [snapshot, setSnapshot] = useState<PerformanceSnapshot | null>(null);
  const [history, setHistory] = useState<{ cpu: number; memory: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [devOnly, setDevOnly] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [terminatingPids, setTerminatingPids] = useState<Record<number, boolean>>({});

  const fetchSnapshot = async () => {
    try {
      const data = await invoke<PerformanceSnapshot>("get_performance_snapshot");
      setSnapshot(data);
      setError(null);
      
      // Update history timeline (max 30 points representing 60 seconds)
      setHistory((prev) => {
        const next = [...prev, { cpu: data.total_cpu, memory: data.memory_used_percent }];
        if (next.length > 30) {
          return next.slice(1);
        }
        return next;
      });
    } catch (err: any) {
      console.error(err);
      setError(err?.toString() || "Failed to fetch performance snapshot");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSnapshot();
    const interval = setInterval(fetchSnapshot, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleKillProcess = async (pid: number) => {
    setTerminatingPids((prev) => ({ ...prev, [pid]: true }));
    try {
      await invoke("kill_process_by_pid", { pid });
      // Instantly refresh list
      await fetchSnapshot();
    } catch (err: any) {
      alert(`Failed to kill process: ${err}`);
    } finally {
      setTerminatingPids((prev) => ({ ...prev, [pid]: false }));
    }
  };

  // Developer-specific keywords for filtering process list
  const devProcessKeywords = useMemo(() => [
    "node", "deno", "python", "py", "ruby", "java", "javac", "go", "cargo", "rustc",
    "gcc", "clang", "dotnet", "npm", "yarn", "pnpm", "docker", "docker-compose",
    "git", "code", "idea", "cursor", "sublime", "webstorm", "pycharm", "vscode", "electron"
  ], []);

  const isDevProcess = (name: string) => {
    const lowercase = name.toLowerCase();
    const baseName = lowercase.replace(/\.exe$/, "");
    return devProcessKeywords.some((keyword) => baseName.includes(keyword));
  };

  // Filter process list
  const filteredProcesses = useMemo(() => {
    if (!snapshot) return [];
    
    return snapshot.processes.filter((p) => {
      const matchesSearch = 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        p.pid.toString().includes(searchQuery);

      const matchesFilter = !devOnly || isDevProcess(p.name);
      
      return matchesSearch && matchesFilter;
    });
  }, [snapshot, searchQuery, devOnly, devProcessKeywords]);

  // Generate SVG Points
  const getSvgPoints = (type: "cpu" | "memory") => {
    if (history.length < 2) return "";
    return history
      .map((h, i) => {
        const x = (i / (history.length - 1)) * 100;
        const val = type === "cpu" ? h.cpu : h.memory;
        // Invert Y axis for SVG coordinates (0 is top, 100 is bottom)
        const y = 100 - val;
        return `${x},${y}`;
      })
      .join(" ");
  };

  const getSvgAreaPoints = (type: "cpu" | "memory") => {
    const points = getSvgPoints(type);
    if (!points) return "";
    return `${points} 100,100 0,100`;
  };

  const hasHighCpu = snapshot && snapshot.total_cpu > 90;
  const hasHighMemory = snapshot && snapshot.memory_used_percent > 90;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-wider text-slate-100 flex items-center space-x-2">
            <span className="p-2 bg-purple-600 rounded-lg text-white mr-2">
              <Cpu className="w-6 h-6 animate-pulse" />
            </span>
            System Performance
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Monitor real-time system performance, CPU/memory usage history, and runtimes.
          </p>
        </div>
      </div>

      {error && (
        <div className="glassmorphism p-5 rounded-2xl border border-red-500/20 bg-red-500/5 text-sm text-red-400 flex items-center space-x-2">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && !snapshot ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin mb-2" />
          <span>Collecting performance metrics...</span>
        </div>
      ) : snapshot ? (
        <>
          {/* Timeline charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* CPU Chart */}
            <div className={`glass-card p-6 rounded-2xl border ${hasHighCpu ? "border-red-500/20 bg-red-500/5" : "border-slate-800/80"} space-y-4`}>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">CPU Load</span>
                  <div className="text-2xl font-black text-slate-100 mt-1">{snapshot.total_cpu.toFixed(1)}%</div>
                </div>
                {hasHighCpu && (
                  <span className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-red-500/10 text-red-400 border-red-500/20 animate-bounce">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>High CPU Warning</span>
                  </span>
                )}
              </div>
              
              {/* SVG Sparkline */}
              <div className="h-28 relative overflow-hidden rounded-xl bg-slate-950/40 border border-slate-850">
                {history.length > 1 && (
                  <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    <polygon points={getSvgAreaPoints("cpu")} fill="url(#cpuGradient)" />
                    <polyline
                      fill="none"
                      stroke="#8b5cf6"
                      strokeWidth="2.5"
                      points={getSvgPoints("cpu")}
                    />
                  </svg>
                )}
              </div>
            </div>

            {/* Memory Chart */}
            <div className={`glass-card p-6 rounded-2xl border ${hasHighMemory ? "border-red-500/20 bg-red-500/5" : "border-slate-800/80"} space-y-4`}>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Memory Utilization</span>
                  <div className="text-2xl font-black text-slate-100 mt-1">
                    {snapshot.memory_used_percent.toFixed(1)}%
                    <span className="text-xs text-slate-450 font-normal ml-2 font-mono">
                      ({snapshot.memory_used_gb.toFixed(2)} / {snapshot.memory_total_gb.toFixed(1)} GB)
                    </span>
                  </div>
                </div>
                {hasHighMemory && (
                  <span className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-red-500/10 text-red-400 border-red-500/20 animate-bounce">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>High Memory Warning</span>
                  </span>
                )}
              </div>

              {/* SVG Sparkline */}
              <div className="h-28 relative overflow-hidden rounded-xl bg-slate-950/40 border border-slate-850">
                {history.length > 1 && (
                  <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="memGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    <polygon points={getSvgAreaPoints("memory")} fill="url(#memGradient)" />
                    <polyline
                      fill="none"
                      stroke="#f43f5e"
                      strokeWidth="2.5"
                      points={getSvgPoints("memory")}
                    />
                  </svg>
                )}
              </div>
            </div>

          </div>

          {/* Processes section */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search process name or PID..."
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl pl-11 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div className="flex items-center space-x-2">
                <label className="flex items-center space-x-2 text-xs font-semibold text-slate-400 select-none cursor-pointer">
                  <input
                    type="checkbox"
                    checked={devOnly}
                    onChange={(e) => setDevOnly(e.target.checked)}
                    className="w-4.5 h-4.5 accent-brand-500 rounded border-slate-700 bg-slate-900 focus:ring-brand-500 cursor-pointer"
                  />
                  <span>Developer Processes Only</span>
                </label>
              </div>
            </div>

            {/* Processes Table */}
            <div className="glass-card rounded-2xl overflow-hidden border border-slate-800/80">
              <div className="overflow-x-auto max-h-[400px]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/40 text-slate-400 text-xs uppercase tracking-wider font-bold sticky top-0 z-10">
                      <th className="py-4 px-6 bg-slate-900/90 backdrop-blur">Process</th>
                      <th className="py-4 px-6 bg-slate-900/90 backdrop-blur">PID</th>
                      <th className="py-4 px-6 bg-slate-900/90 backdrop-blur">CPU</th>
                      <th className="py-4 px-6 bg-slate-900/90 backdrop-blur">Memory</th>
                      <th className="py-4 px-6 text-right bg-slate-900/90 backdrop-blur">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850 text-slate-300">
                    {filteredProcesses.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 px-6 text-center text-slate-500 italic text-sm">
                          No matching active processes found.
                        </td>
                      </tr>
                    ) : (
                      filteredProcesses.map((p) => {
                        const killing = terminatingPids[p.pid] || false;
                        return (
                          <tr key={p.pid} className="hover:bg-slate-950/20 transition-colors">
                            <td className="py-3.5 px-6 font-semibold text-slate-200 max-w-xs truncate">
                              {p.name}
                            </td>
                            <td className="py-3.5 px-6 font-mono text-xs text-slate-400">
                              {p.pid}
                            </td>
                            <td className="py-3.5 px-6 font-mono text-xs">
                              <span className={p.cpu_usage > 5.0 ? "text-purple-400 font-bold" : ""}>
                                {p.cpu_usage.toFixed(1)}%
                              </span>
                            </td>
                            <td className="py-3.5 px-6 font-mono text-xs">
                              <span className={p.memory_mb > 500 ? "text-red-400 font-bold" : ""}>
                                {p.memory_mb} MB
                              </span>
                            </td>
                            <td className="py-3.5 px-6 text-right">
                              <button
                                onClick={() => handleKillProcess(p.pid)}
                                disabled={killing}
                                title="Kill Process Tree"
                                className="p-2 bg-slate-800 hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/20 text-slate-400 rounded-lg border border-slate-700 transition-colors inline-flex items-center justify-center disabled:opacity-50"
                              >
                                {killing ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};
