export interface ProjectScript {
  name: string;
  command: string;
}

export interface ActivePort {
  port: number;
  pid: number;
  process_name: string;
}

export interface EnvEntry {
  key: string;
  value: string;
}

export interface ProjectConfig {
  custom_command: string | null;
  is_pinned: boolean;
  custom_scripts?: ProjectScript[];
  target_port?: number | null;
}

export interface ScriptConfig {
  id: string;
  name: string;
  path: string;
  command: string;
}

export interface AppConfig {
  dev_dir: string | null;
  scan_depth: number | null;
  projects: Record<string, ProjectConfig>;
  theme: string | null;
  scripts?: ScriptConfig[];
}

export interface ProjectInfo {
  name: string;
  path: string;
  project_type: string;
  default_command: string;
  git_branch: string | null;
}

export interface SystemInfo {
  node_version: string | null;
  cargo_version: string | null;
  git_version: string | null;
}

export interface GitDetails {
  last_commit: string | null;
  has_changes: boolean;
}

export interface DockerContainer {
  id: string;
  name: string;
  image: string;
  status: string;
  ports: string;
}

export interface HttpResponse {
  status: number;
  status_text: string;
  headers: Record<string, string>;
  body: string;
  elapsed_ms: number;
  size_bytes: number;
}

export interface ProcessSnapshot {
  pid: number;
  name: string;
  cpu_usage: number;
  memory_mb: number;
}

export interface PerformanceSnapshot {
  total_cpu: number;
  memory_used_percent: number;
  memory_used_gb: number;
  memory_total_gb: number;
  processes: ProcessSnapshot[];
}
