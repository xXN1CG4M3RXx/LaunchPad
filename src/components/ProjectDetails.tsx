import React, { useEffect, useState, useRef, useMemo } from "react";
import { 
  ChevronLeft, Play, Square, Code, Folder, 
  Terminal, Trash2, Copy, GitBranch, AlertCircle, CheckCircle2, RefreshCw, Globe,
  Plus, Edit2, AlertTriangle, Eye, EyeOff, FileText,
  Search, ArrowUp, ArrowDown, Download, X
} from "lucide-react";
import { ProjectInfo, AppConfig, GitDetails, ActivePort, EnvEntry } from "../types";
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

  const [isEditingPort, setIsEditingPort] = useState(false);
  const [targetPortInput, setTargetPortInput] = useState("");
  const [activePorts, setActivePorts] = useState<ActivePort[]>([]);
  const [isFreeingPort, setIsFreeingPort] = useState(false);

  const checkActivePorts = async () => {
    try {
      const list = await invoke<ActivePort[]>("get_active_ports");
      setActivePorts(list);
    } catch (e) {
      console.error("Failed to load active ports:", e);
    }
  };

  useEffect(() => {
    checkActivePorts();
    const timer = setInterval(checkActivePorts, 5000);
    return () => clearInterval(timer);
  }, [project.path]);

  const activeCommand = config.projects[project.path]?.custom_command || project.default_command;

  const detectedPort = useMemo(() => {
    const configPort = config.projects[project.path]?.target_port;
    if (configPort) return configPort;

    const portRegex = /\b([1-9]\d{3,4})\b/;
    const match = activeCommand.match(portRegex);
    if (match) {
      const p = parseInt(match[1], 10);
      if (p >= 1024 && p <= 65535) return p;
    }

    switch (project.project_type) {
      case "Node":
        return 3000;
      case "Python":
        return 8000;
      case "Java":
      case "Go":
      case "Rust":
        return 8080;
      case "Static":
        return 3000;
      default:
        return null;
    }
  }, [project, activeCommand, config.projects]);

  const portOccupyingProcess = useMemo(() => {
    if (!detectedPort) return null;
    return activePorts.find((ap) => ap.port === detectedPort) || null;
  }, [detectedPort, activePorts]);

  const handleFreeProjectPort = async () => {
    if (!portOccupyingProcess) return;
    setIsFreeingPort(true);
    try {
      await invoke("kill_process_by_pid", { pid: portOccupyingProcess.pid });
      await checkActivePorts();
    } catch (e) {
      console.error("Failed to free port:", e);
    } finally {
      setIsFreeingPort(false);
    }
  };

  const handleEditPort = () => {
    setTargetPortInput(config.projects[project.path]?.target_port?.toString() || "");
    setIsEditingPort(true);
  };

  const handleSaveTargetPort = () => {
    const projectConf = config.projects[project.path] || { custom_command: null, is_pinned: false };
    const pVal = targetPortInput.trim() ? parseInt(targetPortInput.trim(), 10) : null;
    const updatedProjects = {
      ...config.projects,
      [project.path]: {
        ...projectConf,
        target_port: pVal && !isNaN(pVal) ? pVal : null,
      },
    };
    onSaveConfig({
      ...config,
      projects: updatedProjects,
    });
    setIsEditingPort(false);
  };

  // .env manager state
  const [envEntries, setEnvEntries] = useState<EnvEntry[] | null>(null);
  const [originalEnv, setOriginalEnv] = useState<EnvEntry[] | null>(null);
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});
  const [savingEnv, setSavingEnv] = useState(false);
  const [loadingEnv, setLoadingEnv] = useState(false);

  const fetchEnv = async () => {
    setLoadingEnv(true);
    try {
      const data = await invoke<EnvEntry[] | null>("read_env_file", { projectPath: project.path });
      if (data) {
        setEnvEntries(data);
        setOriginalEnv(JSON.parse(JSON.stringify(data)));
      } else {
        setEnvEntries(null);
        setOriginalEnv(null);
      }
    } catch (e) {
      console.error("Failed to load .env file:", e);
    } finally {
      setLoadingEnv(false);
    }
  };

  useEffect(() => {
    fetchEnv();
  }, [project.path]);

  const handleCreateEnv = async () => {
    try {
      await invoke("save_env_file", { projectPath: project.path, entries: [] });
      await fetchEnv();
    } catch (e) {
      console.error("Failed to create .env file:", e);
    }
  };

  const handleSaveEnv = async () => {
    if (!envEntries) return;
    setSavingEnv(true);
    try {
      const cleanEntries = envEntries.filter((e) => e.key.trim() !== "");
      await invoke("save_env_file", { projectPath: project.path, entries: cleanEntries });
      setOriginalEnv(JSON.parse(JSON.stringify(cleanEntries)));
      setEnvEntries(cleanEntries);
    } catch (e) {
      console.error("Failed to save .env file:", e);
    } finally {
      setSavingEnv(false);
    }
  };

  const handleCancelEnv = () => {
    if (originalEnv) {
      setEnvEntries(JSON.parse(JSON.stringify(originalEnv)));
    }
  };

  const handleAddEnvRow = () => {
    if (envEntries === null) {
      setEnvEntries([{ key: "", value: "" }]);
    } else {
      setEnvEntries([...envEntries, { key: "", value: "" }]);
    }
  };

  const handleUpdateEnvRow = (index: number, field: "key" | "value", val: string) => {
    if (!envEntries) return;
    const copy = [...envEntries];
    copy[index] = { ...copy[index], [field]: val };
    setEnvEntries(copy);
  };

  const handleDeleteEnvRow = (index: number) => {
    if (!envEntries) return;
    const copy = [...envEntries];
    copy.splice(index, 1);
    setEnvEntries(copy);
  };

  const isEnvChanged = useMemo(() => {
    if (!envEntries || !originalEnv) return false;
    return JSON.stringify(envEntries) !== JSON.stringify(originalEnv);
  }, [envEntries, originalEnv]);

  const isSensitiveKey = (key: string) => {
    const k = key.toUpperCase();
    return (
      k.includes("KEY") ||
      k.includes("SECRET") ||
      k.includes("PASSWORD") ||
      k.includes("TOKEN") ||
      k.includes("JWT") ||
      k.includes("AUTH") ||
      k.includes("PASS")
    );
  };

  const toggleKeyVisibility = (key: string) => {
    setRevealedKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Log Search, Highlight, Grep Filter & Export states
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [grepMode, setGrepMode] = useState(false);
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0);

  useEffect(() => {
    setCurrentMatchIdx(0);
  }, [searchQuery]);

  const totalMatches = useMemo(() => {
    if (!searchQuery) return 0;
    let count = 0;
    const queryLower = searchQuery.toLowerCase();
    for (const log of logs) {
      const clean = stripAnsi(log).toLowerCase();
      if (grepMode && !clean.includes(queryLower)) continue;
      const occurrences = clean.split(queryLower).length - 1;
      count += occurrences;
    }
    return count;
  }, [logs, searchQuery, grepMode]);

  const handleJumpToMatch = (direction: "up" | "down", matchCount: number) => {
    if (matchCount === 0) return;
    let nextIdx = currentMatchIdx;
    if (direction === "down") {
      nextIdx = (currentMatchIdx + 1) % matchCount;
    } else {
      nextIdx = (currentMatchIdx - 1 + matchCount) % matchCount;
    }
    setCurrentMatchIdx(nextIdx);

    const elements = document.querySelectorAll("[data-log-match]");
    if (elements && elements[nextIdx]) {
      elements[nextIdx].scrollIntoView({ block: "center", behavior: "smooth" });
    }
  };

  const highlightText = (text: string, query: string) => {
    if (!query) return <span>{text}</span>;
    const parts = text.split(new RegExp(`(${query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, "gi"));
    return (
      <span>
        {parts.map((part, i) => {
          const isMatch = part.toLowerCase() === query.toLowerCase();
          if (isMatch) {
            return (
              <mark
                key={i}
                data-log-match="true"
                className="bg-amber-500/35 text-white rounded px-0.5 font-bold transition-colors"
              >
                {part}
              </mark>
            );
          }
          return <span key={i}>{part}</span>;
        })}
      </span>
    );
  };

  useEffect(() => {
    const elements = document.querySelectorAll("[data-log-match]");
    elements.forEach((el, idx) => {
      if (idx === currentMatchIdx) {
        el.classList.add("bg-orange-500", "text-white");
        el.classList.remove("bg-amber-500/35");
      } else {
         el.classList.remove("bg-orange-500");
         el.classList.add("bg-amber-500/35");
      }
    });
  }, [currentMatchIdx, searchQuery, grepMode, logs]);

  const handleExportLogs = async () => {
    try {
      const cleanText = logs.map(l => stripAnsi(l)).join("\n");
      const defaultName = `${project.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}_console.log`;
      await invoke("save_log_file", { defaultName, content: cleanText });
    } catch (e) {
      console.error("Failed to export logs:", e);
    }
  };

  const [copiedLogs, setCopiedLogs] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const consoleContainerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Custom project actions state
  const [isAddingScript, setIsAddingScript] = useState(false);
  const [newScriptName, setNewScriptName] = useState("");
  const [newScriptCommand, setNewScriptCommand] = useState("");
  const [editingScriptIndex, setEditingScriptIndex] = useState<number | null>(null);
  const [editScriptName, setEditScriptName] = useState("");
  const [editScriptCommand, setEditScriptCommand] = useState("");

  const handleSaveScripts = (scripts: { name: string; command: string }[]) => {
    const projectConf = config.projects[project.path] || { custom_command: null, is_pinned: false };
    const updatedProjects = {
      ...config.projects,
      [project.path]: {
        ...projectConf,
        custom_scripts: scripts,
      },
    };
    onSaveConfig({
      ...config,
      projects: updatedProjects,
    });
  };

  const handleAddScript = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newScriptName.trim() || !newScriptCommand.trim()) return;
    const projectConf = config.projects[project.path] || { custom_command: null, is_pinned: false };
    const currentScripts = projectConf.custom_scripts || [];
    const updatedScripts = [
      ...currentScripts,
      { name: newScriptName.trim(), command: newScriptCommand.trim() }
    ];
    handleSaveScripts(updatedScripts);
    setNewScriptName("");
    setNewScriptCommand("");
    setIsAddingScript(false);
  };

  const handleDeleteScript = (index: number) => {
    const projectConf = config.projects[project.path] || { custom_command: null, is_pinned: false };
    const currentScripts = projectConf.custom_scripts || [];
    const updatedScripts = currentScripts.filter((_, i) => i !== index);
    handleSaveScripts(updatedScripts);
  };

  const handleStartEditScript = (index: number, name: string, command: string) => {
    setEditingScriptIndex(index);
    setEditScriptName(name);
    setEditScriptCommand(command);
  };

  const handleSaveEditScript = (index: number) => {
    if (!editScriptName.trim() || !editScriptCommand.trim()) return;
    const projectConf = config.projects[project.path] || { custom_command: null, is_pinned: false };
    const currentScripts = [...(projectConf.custom_scripts || [])];
    currentScripts[index] = { name: editScriptName.trim(), command: editScriptCommand.trim() };
    handleSaveScripts(currentScripts);
    setEditingScriptIndex(null);
  };

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
      case "Java":
        return (
          <svg className="w-3.5 h-3.5 mr-1 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
            <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
            <line x1="6" y1="2" x2="6" y2="4" />
            <line x1="10" y1="2" x2="10" y2="4" />
            <line x1="14" y1="2" x2="14" y2="4" />
          </svg>
        );
      case "Docker":
        return (
          <svg className="w-3.5 h-3.5 mr-1 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M13.98 11.08h2.12a.19.19 0 0 0 .19-.19V9.01a.19.19 0 0 0-.19-.19h-2.12a.18.18 0 0 0-.18.18v1.9c0 .1.08.18.18.18m-2.95-5.43h2.12a.19.19 0 0 0 .18-.19V3.57a.19.19 0 0 0-.18-.18h-2.12a.18.18 0 0 0-.19.18v1.9c0 .1.09.18.19.18m0 2.71h2.12a.19.19 0 0 0 .18-.18V6.29a.19.19 0 0 0-.18-.18h-2.12a.18.18 0 0 0-.19.18v1.89c0 .1.09.18.19.18m-2.93 0h2.12a.19.19 0 0 0 .18-.18V6.29a.18.18 0 0 0-.18-.18H8.1a.18.18 0 0 0-.18.18v1.89c0 .1.08.18.18.18m-2.96 0h2.11a.19.19 0 0 0 .19-.18V6.29a.18.18 0 0 0-.19-.18H5.14a.19.19 0 0 0-.19.18v1.89c0 .1.08.18.19.18m5.89 2.72h2.12a.19.19 0 0 0 .18-.19V9.01a.19.19 0 0 0-.18-.19h-2.12a.18.18 0 0 0-.19.18v1.9c0 .1.09.18.19.18m-2.93 0h2.12a.18.18 0 0 0 .18-.19V9.01a.18.18 0 0 0-.18-.19H8.1a.18.18 0 0 0-.18.18v1.9c0 .1.08.18.18.18m-2.96 0h2.11a.18.18 0 0 0 .19-.19V9.01a.18.18 0 0 0-.18-.19H5.14a.19.19 0 0 0-.19.19v1.88c0 .1.08.19.19.19m-2.92 0h2.12a.18.18 0 0 0 .18-.19V9.01a.18.18 0 0 0-.18-.19H2.22a.18.18 0 0 0-.19.18v1.9c0 .1.08.18.19.18m21.54-1.19c-.06-.05-.67-.51-1.95-.51-.34 0-.68.03-1.01.09a3.77 3.77 0 0 0-1.72-2.57l-.34-.2-.23.33a4.6 4.6 0 0 0-.6 1.43c-.24.97-.1 1.88.4 2.66a4.7 4.7 0 0 1-1.75.42H.76a.75.75 0 0 0-.76.75 11.38 11.38 0 0 0 .7 4.06 6.03 6.03 0 0 0 2.4 3.12c1.18.73 3.1 1.14 5.28 1.14.98 0 1.96-.08 2.93-.26a12.25 12.25 0 0 0 3.82-1.4 10.5 10.5 0 0 0 2.61-2.13c1.25-1.42 2-3 2.55-4.4h.23c1.37 0 2.21-.55 2.68-1 .3-.3.55-.66.7-1.06l.1-.28Z"/>
          </svg>
        );
      case "Static":
        return (
          <svg className="w-3.5 h-3.5 mr-1 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
            <line x1="14" y1="4" x2="10" y2="20" />
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
    if (autoScroll && consoleContainerRef.current) {
      const container = consoleContainerRef.current;
      container.scrollTop = container.scrollHeight;
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
    <div className="flex-1 flex flex-col min-h-0 space-y-6 animate-in fade-in duration-300">
      
      {/* Header Navigation */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/5 pb-4 shrink-0">
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
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-5 gap-8 min-h-0">
        
        {/* Left Column: Project Stats and Configurations */}
        <div className="lg:col-span-2 space-y-6 overflow-y-auto pr-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
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
              {portOccupyingProcess && !isRunning && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start justify-between gap-3 text-xs text-amber-700 dark:text-amber-400">
                  <div className="flex items-start space-x-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                    <div>
                      <p className="font-bold">Port {detectedPort} occupied</p>
                      <p className="text-[10px] opacity-80 mt-0.5">Held by {portOccupyingProcess.process_name} (PID {portOccupyingProcess.pid})</p>
                    </div>
                  </div>
                  <button
                    onClick={handleFreeProjectPort}
                    disabled={isFreeingPort}
                    className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500 hover:text-white rounded text-[10px] font-bold transition-all shrink-0 active:scale-95"
                  >
                    {isFreeingPort ? "Freeing..." : "Free Port"}
                  </button>
                </div>
              )}

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

            {/* Target Port Configuration */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-white/5">
              <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Target Port</label>
              {isEditingPort ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={targetPortInput}
                    onChange={(e) => setTargetPortInput(e.target.value)}
                    className="w-full text-xs font-mono bg-slate-55 dark:bg-slate-950/80 border border-brand-400 dark:border-brand-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-200 outline-none ring-1 ring-brand-300 dark:ring-brand-900"
                    placeholder="e.g. 3000 (leave blank to auto-detect)"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveTargetPort();
                      if (e.key === "Escape") setIsEditingPort(false);
                    }}
                    autoFocus
                  />
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => setIsEditingPort(false)}
                      className="px-3 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveTargetPort}
                      className="px-3 py-1 text-xs bg-brand-600 text-white rounded font-bold hover:bg-brand-700"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <div 
                  onClick={handleEditPort}
                  className="group flex items-center justify-between text-xs font-mono bg-slate-55 dark:bg-slate-950/40 border border-slate-200 dark:border-white/5 hover:border-brand-300 dark:hover:border-brand-850 text-slate-600 dark:text-slate-300 rounded-lg px-3 py-2.5 cursor-pointer transition-all"
                >
                  <span className="truncate pr-2">{config.projects[project.path]?.target_port || `Auto-detected: ${detectedPort}`}</span>
                  <span className="text-[9px] text-slate-400 font-sans uppercase tracking-wider font-bold shrink-0 group-hover:text-brand-500">Edit</span>
                </div>
              )}
            </div>
          </div>

          {/* .env Configuration Card */}
          <div className="bg-white dark:bg-slate-900/30 rounded-xl border border-slate-200 dark:border-white/5 p-6 shadow-sm space-y-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] brand-gradient-bg"></div>
            
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-slate-400" />
                <span>Environment Variables (.env)</span>
              </h3>
              
              {envEntries !== null && (
                <button
                  onClick={handleAddEnvRow}
                  className="flex items-center space-x-1 px-2 py-1 text-[10px] bg-slate-50 dark:bg-slate-950/40 text-slate-650 dark:text-slate-350 hover:bg-slate-100 dark:hover:bg-slate-900 border border-slate-200 dark:border-white/5 rounded font-semibold transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Var</span>
                </button>
              )}
            </div>

            {loadingEnv ? (
              <div className="py-4 text-center text-xs text-slate-400">Loading .env variables...</div>
            ) : envEntries === null ? (
              <div className="py-2 text-center space-y-2">
                <p className="text-[11px] text-slate-500 font-medium">No .env file found in this project.</p>
                <button
                  onClick={handleCreateEnv}
                  className="px-3 py-1.5 bg-brand-600 text-white rounded-lg text-xs font-bold hover:bg-brand-700 transition-colors"
                >
                  Create .env File
                </button>
              </div>
            ) : envEntries.length === 0 ? (
              <div className="py-4 text-center space-y-2 text-slate-450 dark:text-slate-500">
                <p className="text-[11px]">The .env file is empty.</p>
                <button
                  onClick={handleAddEnvRow}
                  className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950/60 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-all border border-slate-200 dark:border-white/5"
                >
                  Add Your First Variable
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="max-h-64 overflow-y-auto space-y-2.5 pr-1 scrollbar-thin">
                  {envEntries.map((entry, idx) => {
                    const sensitive = isSensitiveKey(entry.key);
                    const visible = revealedKeys[idx.toString()] || false;
                    return (
                      <div key={idx} className="flex items-center space-x-2 bg-slate-50/50 dark:bg-slate-950/20 p-2 rounded-lg border border-slate-150/40 dark:border-white/5 relative group/row">
                        <div className="flex-1 grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={entry.key}
                            onChange={(e) => handleUpdateEnvRow(idx, "key", e.target.value)}
                            className="bg-transparent border-none text-[11px] font-mono font-semibold text-slate-700 dark:text-slate-200 focus:ring-0 p-0 outline-none placeholder-slate-400"
                            placeholder="KEY"
                          />
                          <div className="flex items-center space-x-1 min-w-0">
                            <input
                              type={sensitive && !visible ? "password" : "text"}
                              value={entry.value}
                              onChange={(e) => handleUpdateEnvRow(idx, "value", e.target.value)}
                              className="bg-transparent border-none text-[11px] font-mono text-slate-650 dark:text-slate-350 focus:ring-0 p-0 outline-none w-full placeholder-slate-400 min-w-0"
                              placeholder="value"
                            />
                            {sensitive && (
                              <button
                                onClick={() => toggleKeyVisibility(idx.toString())}
                                className="text-slate-400 hover:text-slate-650 dark:hover:text-slate-200 p-0.5"
                                title={visible ? "Hide secret" : "Reveal secret"}
                              >
                                {visible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeleteEnvRow(idx)}
                          className="opacity-0 group-hover/row:opacity-100 text-rose-500 hover:text-rose-700 transition-opacity p-0.5 shrink-0"
                          title="Delete variable"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                {isEnvChanged && (
                  <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-white/5">
                    <button
                      onClick={handleCancelEnv}
                      className="px-2.5 py-1 text-[11px] text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveEnv}
                      disabled={savingEnv}
                      className="px-2.5 py-1 text-[11px] bg-brand-600 hover:bg-brand-700 text-white rounded font-bold transition-all"
                    >
                      {savingEnv ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Custom Actions Card */}
          <div className="bg-white dark:bg-slate-900/30 rounded-xl border border-slate-200 dark:border-white/5 p-6 shadow-sm space-y-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] brand-gradient-bg"></div>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <Code className="w-4 h-4 text-slate-400" />
                <span>Custom Actions</span>
              </h3>
              {!isAddingScript && (
                <button
                  onClick={() => setIsAddingScript(true)}
                  className="flex items-center space-x-1 text-[10px] font-bold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 uppercase tracking-wide transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Action</span>
                </button>
              )}
            </div>

            {/* List of Custom Actions */}
            <div className="space-y-2">
              {!(config.projects[project.path]?.custom_scripts?.length) && !isAddingScript && (
                <p className="text-xs text-slate-400 dark:text-slate-500 py-2">No custom actions defined yet. Add commands like test, build, lint, etc.</p>
              )}

              {(config.projects[project.path]?.custom_scripts || []).map((script, idx) => (
                <div key={idx} className="flex flex-col p-3 bg-slate-50 dark:bg-slate-950/40 rounded-lg border border-slate-100 dark:border-white/5 space-y-2">
                  {editingScriptIndex === idx ? (
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">Action Name</label>
                        <input
                          type="text"
                          value={editScriptName}
                          onChange={(e) => setEditScriptName(e.target.value)}
                          className="w-full text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded px-2.5 py-1.5 text-slate-800 dark:text-slate-200 outline-none focus:border-brand-500"
                          placeholder="e.g. Test"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">Command</label>
                        <input
                          type="text"
                          value={editScriptCommand}
                          onChange={(e) => setEditScriptCommand(e.target.value)}
                          className="w-full text-xs font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded px-2.5 py-1.5 text-slate-800 dark:text-slate-200 outline-none focus:border-brand-500"
                          placeholder="e.g. npm run test"
                        />
                      </div>
                      <div className="flex justify-end space-x-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setEditingScriptIndex(null)}
                          className="px-2.5 py-1 text-[10px] text-slate-550 hover:bg-slate-150 dark:hover:bg-slate-800 rounded font-semibold"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveEditScript(idx)}
                          className="px-2.5 py-1 text-[10px] bg-brand-600 text-white rounded font-bold hover:bg-brand-700"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1 pr-3">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 block truncate">{script.name}</span>
                        <code className="text-[10px] font-mono text-slate-450 dark:text-slate-550 truncate block mt-0.5">{script.command}</code>
                      </div>
                      <div className="flex items-center space-x-1.5 shrink-0">
                        <button
                          onClick={() => onStart(project.path, script.command)}
                          className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg border border-emerald-500/20 transition-all active:scale-95"
                          title={`Run action: ${script.name}`}
                        >
                          <Play className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleStartEditScript(idx, script.name, script.command)}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/40 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg border border-slate-200 dark:border-white/5 transition-all"
                          title="Edit action"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteScript(idx)}
                          className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-lg border border-rose-500/20 transition-all"
                          title="Delete action"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Add New Action Form */}
              {isAddingScript && (
                <form onSubmit={handleAddScript} className="p-3 bg-slate-50 dark:bg-slate-950/40 rounded-lg border border-brand-500/25 dark:border-brand-500/15 space-y-3 mt-2">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Action Name</label>
                    <input
                      type="text"
                      value={newScriptName}
                      onChange={(e) => setNewScriptName(e.target.value)}
                      className="w-full text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded px-2.5 py-1.5 text-slate-800 dark:text-slate-200 outline-none focus:border-brand-500"
                      placeholder="e.g. Build, Test, Lint"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Command</label>
                    <input
                      type="text"
                      value={newScriptCommand}
                      onChange={(e) => setNewScriptCommand(e.target.value)}
                      className="w-full text-xs font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded px-2.5 py-1.5 text-slate-800 dark:text-slate-200 outline-none focus:border-brand-500"
                      placeholder="e.g. npm run build"
                      required
                    />
                  </div>
                  <div className="flex justify-end space-x-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingScript(false);
                        setNewScriptName("");
                        setNewScriptCommand("");
                      }}
                      className="px-2.5 py-1 text-[10px] text-slate-550 hover:bg-slate-200 dark:hover:bg-slate-800 rounded font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-2.5 py-1 text-[10px] bg-brand-600 text-white rounded font-bold hover:bg-brand-700"
                    >
                      Add
                    </button>
                  </div>
                </form>
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
        <div className="lg:col-span-3 flex flex-col h-[500px] lg:h-full bg-slate-950 rounded-xl border border-slate-900 text-slate-100 overflow-hidden shadow-sm relative min-h-0">
          <div className="absolute top-0 left-0 right-0 h-[3px] brand-gradient-bg"></div>
          
          {/* Console Header */}
          <div className="flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-slate-900">
            <div className="flex items-center space-x-4 flex-1 min-w-0">
              <div className="flex items-center space-x-2 shrink-0">
                <Terminal className="w-4 h-4 text-brand-400" />
                <h3 className="text-sm font-semibold tracking-wide text-white">Console Output</h3>
              </div>

              {isSearchOpen ? (
                <div className="flex items-center space-x-2 bg-slate-950/80 border border-slate-800 px-2.5 py-1 rounded-lg flex-1 max-w-xs animate-in slide-in-from-left-2 duration-200">
                  <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-transparent border-none text-xs text-slate-205 focus:ring-0 p-0 outline-none w-full placeholder-slate-500 font-mono"
                    placeholder="Search logs..."
                    autoFocus
                  />
                  {searchQuery && (
                    <span className="text-[10px] font-mono text-slate-500 shrink-0 select-none">
                      {totalMatches > 0 ? `${currentMatchIdx + 1}/${totalMatches}` : "0/0"}
                    </span>
                  )}
                  {totalMatches > 0 && (
                    <div className="flex items-center space-x-0.5 border-l border-slate-800 pl-1.5 shrink-0">
                      <button
                        onClick={() => handleJumpToMatch("up", totalMatches)}
                        className="text-slate-400 hover:text-white p-0.5"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleJumpToMatch("down", totalMatches)}
                        className="text-slate-400 hover:text-white p-0.5"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  <button
                    onClick={() => {
                      setIsSearchOpen(false);
                      setSearchQuery("");
                      setGrepMode(false);
                    }}
                    className="text-slate-400 hover:text-white p-0.5 shrink-0"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsSearchOpen(true)}
                  className="flex items-center space-x-1 px-2.5 py-1 text-[11px] text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800 rounded-md transition-colors"
                  title="Search terminal logs"
                >
                  <Search className="w-3 h-3" />
                  <span>Search</span>
                </button>
              )}

              {isSearchOpen && searchQuery && (
                <button
                  onClick={() => setGrepMode(!grepMode)}
                  className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md border transition-all ${
                    grepMode
                      ? "bg-brand-650/15 text-brand-400 border-brand-500/30"
                      : "text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800"
                  }`}
                  title="Only show lines matching query"
                >
                  Grep Filter
                </button>
              )}
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
                onClick={handleExportLogs}
                className="flex items-center space-x-1 px-2.5 py-1 text-[11px] text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800 rounded-md transition-colors"
                title="Export logs to file"
              >
                <Download className="w-3 h-3" />
                <span>Export</span>
              </button>

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
          <div ref={consoleContainerRef} className="flex-1 overflow-y-auto p-6 font-mono text-xs leading-relaxed space-y-1 select-text scrollbar-thin scrollbar-track-slate-950 scrollbar-thumb-slate-800">
            {logs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2">
                <div className="p-2.5 bg-slate-900 rounded-full border border-slate-850 text-slate-500">
                  <Terminal className="w-5 h-5" />
                </div>
                <p className="text-[11px]">No output streams detected.</p>
                <p className="text-[10px] opacity-70">Click "Start Server" on the left to see logs.</p>
              </div>
            ) : (
              logs
                .filter((log) => {
                  if (!grepMode || !searchQuery) return true;
                  return stripAnsi(log).toLowerCase().includes(searchQuery.toLowerCase());
                })
                .map((log, index) => {
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
                      {highlightText(cleanLog, searchQuery)}
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
