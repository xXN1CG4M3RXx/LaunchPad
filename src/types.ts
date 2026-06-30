export interface ProjectConfig {
  custom_command: string | null;
  is_pinned: boolean;
}

export interface AppConfig {
  dev_dir: string | null;
  scan_depth: number | null;
  projects: Record<string, ProjectConfig>;
  theme: string | null;
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
