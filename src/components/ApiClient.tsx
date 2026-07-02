import React, { useState, useEffect, useMemo } from "react";
import { Send, Plus, Trash2, History, Clock, Database, Copy, Check, ChevronDown, ChevronUp, Loader2, Globe } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { ProjectInfo, AppConfig, HttpResponse } from "../types";

interface ApiClientProps {
  projects: ProjectInfo[];
  config: AppConfig;
}

interface SavedRequest {
  id: string;
  method: string;
  url: string;
  headers: { key: string; value: string }[];
  body: string;
  timestamp: number;
}

export const ApiClient: React.FC<ApiClientProps> = ({ projects, config }) => {
  const [method, setMethod] = useState("GET");
  const [url, setUrl] = useState("http://localhost:");
  const [headers, setHeaders] = useState<{ key: string; value: string }[]>([
    { key: "Content-Type", value: "application/json" }
  ]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [response, setResponse] = useState<HttpResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // History & saved state
  const [history, setHistory] = useState<SavedRequest[]>([]);
  const [copied, setCopied] = useState(false);
  const [showHeaders, setShowHeaders] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("launchpad_api_history");
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load request history", e);
    }
  }, []);

  const saveToHistory = (req: Omit<SavedRequest, "id" | "timestamp">) => {
    const newReq: SavedRequest = {
      ...req,
      id: Math.random().toString(36).substring(2, 9),
      timestamp: Date.now()
    };
    const updated = [newReq, ...history.slice(0, 49)]; // Limit to 50 items
    setHistory(updated);
    localStorage.setItem("launchpad_api_history", JSON.stringify(updated));
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem("launchpad_api_history");
  };

  const loadRequest = (req: SavedRequest) => {
    setMethod(req.method);
    setUrl(req.url);
    setHeaders(req.headers.length > 0 ? req.headers : [{ key: "", value: "" }]);
    setBody(req.body);
  };

  // Autocomplete port suggestions from running projects
  const portSuggestions = useMemo(() => {
    const suggestions = new Set<string>();
    
    projects.forEach((p) => {
      // 1. Check target_port configuration
      const configPort = config.projects[p.path]?.target_port;
      if (configPort) {
        suggestions.add(`http://localhost:${configPort}`);
      }

      // 2. Check defaults based on project types
      switch (p.project_type) {
        case "Node":
          suggestions.add("http://localhost:3000");
          suggestions.add("http://localhost:5173");
          break;
        case "Python":
          suggestions.add("http://localhost:8000");
          break;
        case "Rust":
        case "Go":
        case "Java":
          suggestions.add("http://localhost:8080");
          break;
        default:
          break;
      }

      // 3. Extract port from commands
      const command = config.projects[p.path]?.custom_command || p.default_command;
      const portRegex = /\b([1-9]\d{2,4})\b/;
      const match = command.match(portRegex);
      if (match) {
        suggestions.add(`http://localhost:${match[1]}`);
      }
    });

    return Array.from(suggestions);
  }, [projects, config.projects]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setSending(true);
    setResponse(null);
    setError(null);

    const cleanHeaders = headers
      .filter((h) => h.key.trim() !== "")
      .map((h) => [h.key.trim(), h.value.trim()] as [string, string]);

    try {
      const res = await invoke<HttpResponse>("send_http_request", {
        method,
        url: url.trim(),
        headers: cleanHeaders,
        body: body || null
      });
      setResponse(res);
      saveToHistory({
        method,
        url: url.trim(),
        headers: headers.filter((h) => h.key.trim() !== ""),
        body
      });
    } catch (err: any) {
      setError(err?.toString() || "Ein Fehler ist aufgetreten.");
    } finally {
      setSending(false);
    }
  };

  const handleAddHeader = () => {
    setHeaders([...headers, { key: "", value: "" }]);
  };

  const handleUpdateHeader = (index: number, field: "key" | "value", val: string) => {
    const updated = [...headers];
    updated[index] = { ...updated[index], [field]: val };
    setHeaders(updated);
  };

  const handleDeleteHeader = (index: number) => {
    const updated = headers.filter((_, i) => i !== index);
    setHeaders(updated.length > 0 ? updated : [{ key: "", value: "" }]);
  };

  const handleCopyBody = () => {
    if (!response) return;
    navigator.clipboard.writeText(response.body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formattedBody = useMemo(() => {
    if (!response) return "";
    try {
      // Check if it is JSON
      const parsed = JSON.parse(response.body);
      return JSON.stringify(parsed, null, 2);
    } catch (e) {
      return response.body;
    }
  }, [response]);

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return "text-emerald-400 border-emerald-500/20 bg-emerald-500/5";
    if (status >= 300 && status < 400) return "text-amber-400 border-amber-500/20 bg-amber-500/5";
    return "text-rose-400 border-rose-500/20 bg-rose-500/5";
  };

  return (
    <div className="flex space-x-6 h-[calc(100vh-140px)]">
      {/* Left panel: Form and Response */}
      <div className="flex-1 flex flex-col space-y-6 overflow-y-auto pr-2 select-text">
        <div className="flex items-center space-x-2">
          <span className="p-2 bg-pink-600 rounded-lg text-white">
            <Globe className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-3xl font-black tracking-wider text-slate-100">API Client</h1>
            <p className="text-slate-400 text-sm mt-1">Sende REST-Anfragen an deine lokalen Server und Services.</p>
          </div>
        </div>

        {/* Request Form */}
        <form onSubmit={handleSend} className="glass-card p-6 rounded-2xl border border-slate-800/80 space-y-4">
          <div className="flex space-x-3">
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 font-bold focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
            >
              <option>GET</option>
              <option>POST</option>
              <option>PUT</option>
              <option>DELETE</option>
              <option>PATCH</option>
            </select>
            <div className="flex-1 relative">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder="http://localhost:3000/api"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              {/* Autocomplete suggestions popup overlay */}
              {isFocused && url.endsWith(":") && portSuggestions.length > 0 && (
                <div className="absolute top-12 left-0 right-0 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl z-20 max-h-40 overflow-y-auto">
                  {portSuggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setUrl(s);
                        setIsFocused(false);
                      }}
                      className="w-full text-left px-4 py-2 text-xs font-mono text-slate-400 hover:text-slate-200 hover:bg-slate-900 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="submit"
              disabled={sending}
              className="flex items-center space-x-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-bold px-6 py-2.5 rounded-xl transition-all active:scale-[0.98]"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span>Senden</span>
            </button>
          </div>

          {/* Tab Options: Headers and Body */}
          <div className="space-y-4 pt-2">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Header-Parameter</span>
                <button
                  type="button"
                  onClick={handleAddHeader}
                  className="flex items-center space-x-1 text-xs text-brand-400 hover:text-brand-300 font-semibold"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Header hinzufügen</span>
                </button>
              </div>
              <div className="space-y-2">
                {headers.map((h, idx) => (
                  <div key={idx} className="flex space-x-2 items-center">
                    <input
                      type="text"
                      value={h.key}
                      placeholder="Header Name"
                      onChange={(e) => handleUpdateHeader(idx, "key", e.target.value)}
                      className="flex-1 bg-slate-900/60 border border-slate-850 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-slate-700"
                    />
                    <input
                      type="text"
                      value={h.value}
                      placeholder="Header Wert"
                      onChange={(e) => handleUpdateHeader(idx, "value", e.target.value)}
                      className="flex-1 bg-slate-900/60 border border-slate-850 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-slate-700"
                    />
                    <button
                      type="button"
                      onClick={() => handleDeleteHeader(idx)}
                      className="p-2 hover:bg-slate-800 text-slate-500 hover:text-slate-300 rounded-lg"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {method !== "GET" && method !== "HEAD" && (
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Body Payload (JSON / Text)
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder='{ "key": "value" }'
                  rows={4}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-slate-300 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            )}
          </div>
        </form>

        {/* Response Panel */}
        {error && (
          <div className="glassmorphism p-5 rounded-2xl border border-red-500/20 bg-red-500/5 text-sm text-red-400">
            <strong>Anfrage fehlgeschlagen:</strong> {error}
          </div>
        )}

        {response && (
          <div className="glass-card rounded-2xl border border-slate-800/80 overflow-hidden flex-1 flex flex-col min-h-[300px]">
            {/* Response metadata header */}
            <div className="bg-slate-900/40 px-6 py-4 border-b border-slate-850 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(response.status)}`}>
                  {response.status} {response.status_text}
                </span>
                <span className="text-xs text-slate-400 flex items-center space-x-1">
                  <Clock className="w-3.5 h-3.5 mr-1" />
                  {response.elapsed_ms} ms
                </span>
                <span className="text-xs text-slate-400 flex items-center space-x-1">
                  <Database className="w-3.5 h-3.5 mr-1" />
                  {(response.size_bytes / 1024).toFixed(2)} KB
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleCopyBody}
                  className="flex items-center space-x-1 text-xs text-slate-400 hover:text-slate-200 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? "Kopiert" : "Kopieren"}</span>
                </button>
              </div>
            </div>

            {/* Response Headers Accordion */}
            <div className="border-b border-slate-850">
              <button
                onClick={() => setShowHeaders(!showHeaders)}
                className="w-full px-6 py-3 flex items-center justify-between text-xs font-semibold text-slate-400 hover:bg-slate-900/20 transition-colors"
              >
                <span>Antwort-Header ({Object.keys(response.headers).length})</span>
                {showHeaders ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showHeaders && (
                <div className="px-6 py-3 bg-slate-950/40 border-t border-slate-850 max-h-40 overflow-y-auto space-y-1">
                  {Object.entries(response.headers).map(([key, val]) => (
                    <div key={key} className="flex justify-between font-mono text-[10px] text-slate-400">
                      <span className="font-semibold text-slate-300">{key}:</span>
                      <span className="truncate ml-4 max-w-xs">{val}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Response Body Stream */}
            <div className="flex-1 bg-slate-950 p-6 overflow-y-auto font-mono text-xs text-slate-300 select-text whitespace-pre-wrap leading-relaxed">
              {formattedBody || <span className="text-slate-500 italic">Kein Inhalt zurückgegeben.</span>}
            </div>
          </div>
        )}
      </div>

      {/* Right panel: Request History */}
      <div className="w-72 border-l border-slate-850/80 pl-6 flex flex-col h-full bg-slate-950/20 rounded-2xl p-4 border border-slate-850">
        <div className="flex items-center justify-between mb-4 border-b border-slate-850 pb-3">
          <span className="font-bold text-sm text-slate-200 flex items-center space-x-1.5">
            <History className="w-4 h-4 text-brand-400" />
            <span>Verlauf</span>
          </span>
          {history.length > 0 && (
            <button
              onClick={clearHistory}
              className="text-[10px] text-rose-400 hover:text-rose-300 font-semibold"
            >
              Leeren
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {history.length === 0 ? (
            <div className="text-xs text-slate-500 text-center py-8 italic">Keine vorherigen Anfragen.</div>
          ) : (
            history.map((req) => (
              <button
                key={req.id}
                onClick={() => loadRequest(req)}
                className="w-full text-left p-3 bg-slate-900/40 hover:bg-slate-900 border border-slate-850 hover:border-slate-700 rounded-xl transition-all space-y-1 block"
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    req.method === "GET" ? "bg-emerald-500/10 text-emerald-400" :
                    req.method === "POST" ? "bg-blue-500/10 text-blue-400" :
                    "bg-amber-500/10 text-amber-400"
                  }`}>
                    {req.method}
                  </span>
                  <span className="text-[9px] text-slate-500">
                    {new Date(req.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="text-xs font-mono text-slate-300 truncate w-full" title={req.url}>
                  {req.url.replace(/^https?:\/\//i, "")}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
