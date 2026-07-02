# LaunchPad 🚀

[![Tauri](https://img.shields.io/badge/Tauri-v2-FFC131?logo=tauri&logoColor=white&style=flat-square)](https://tauri.app/)
[![Rust](https://img.shields.io/badge/Rust-1.75+-000000?logo=rust&logoColor=white&style=flat-square)](https://www.rust-lang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black&style=flat-square)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white&style=flat-square)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?logo=tailwind-css&logoColor=white&style=flat-square)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](LICENSE)

LaunchPad is a sleek, premium, and lightweight developer cockpit designed to organize, scan, configure, and launch your development projects. Powered by **Tauri v2**, **React 19**, **Vite 7**, and **Rust**, LaunchPad provides a high-performance central dashboard to monitor local active ports, manage multi-framework workspaces, and stream process execution logs in real time.

---

## Key Features

- **📂 Auto-Workspace Scanner**  
  Scan local directories recursively at customizable depths to automatically discover projects.
- **⚡ Smart Framework Auto-Detection**  
  Detects project structures and configures optimal default execution commands:
  - **Rust** (`Cargo.toml`) $\rightarrow$ `cargo run`
  - **Node.js** (`package.json`) $\rightarrow$ Parse script keys for `dev` or `start`
  - **Go** (`go.mod`) $\rightarrow$ `go run .`
  - **Python** (`requirements.txt`/`pyproject.toml`) $\rightarrow$ `python main.py`
  - **Static Web** (`index.html`) $\rightarrow$ `npx -y serve`
  - **Java** (`pom.xml` / Gradle build files) and generic directory fallbacks.
- **🔌 Embedded Port Manager**  
  - **Global Dashboard**: A system-wide ports inspector listing all active local TCP listening ports, process names (e.g. `node.exe`, `python.exe`), and PIDs with a one-click process termination tool.
  - **Inline Warnings**: Automatically warns you inside a project details drawer if its target port is occupied, showing the occupant process name/PID with a quick "Free Port" release button.
- **🛠️ Custom Action Scripts**  
  Create, run, edit, and delete custom action scripts (e.g., `Build`, `Test`, `Lint`, `Clean`) on a per-project basis. If you run a custom action while a development server is already active, LaunchPad stops the active server, issues a slide-in toast notification, and runs your script.
- **📟 Log Streaming & Independent Scrolling Layout**  
  Spawns background processes as asynchronous tasks managed by the Rust core. Logs are piped via Tauri events into a terminal panel with robust, instant auto-scrolling (`scrollTop = scrollHeight`). The detail drawer uses locked page layouts so settings and consoles scroll independently.
- **🛠️ System Toolchain Diagnostics**  
  Displays global status indicators showing active version numbers for `git`, `rust`/`cargo`, and `node`.
- **🎨 Premium Dark Mode UI**  
  A modern, high-contrast dashboard with glassmorphism effects, curated color systems, and polished transition micro-animations.

---

## Technical Architecture

LaunchPad is built with a decoupled architecture ensuring a lightweight frontend combined with a low-overhead, native backend:

| Layer | Component / Tech | Role |
| :--- | :--- | :--- |
| **Backend** | [Rust](https://www.rust-lang.org/) | Handles native file scanning, spawns subprocesses, captures stdio logs, monitors active system sockets (`netstat`), and terminates process trees. |
| **App Runtime** | [Tauri v2](https://tauri.app/) | Secure desktop bridge utilizing OS-native webview renderers. |
| **Frontend UI** | [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) | Renders the dashboard shell, terminal logs, and custom configuration forms. |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) | Adaptive layouts, transitions, responsive columns, and curated color systems. |

---

## Getting Started

### Prerequisites

Ensure you have the following packages installed on your local environment:
1. **Node.js** (v18+) & **npm**
2. **Rust & Cargo** (v1.75+)
3. **C++ Build Tools** (e.g., Visual Studio Build Tools for Windows target compilation)

### Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/xXN1CG4M3RXx/LaunchPad.git
   cd LaunchPad
   ```

2. **Install frontend dependencies:**
   ```bash
   npm install
   ```

3. **Launch in development mode:**
   ```bash
   npm run tauri dev
   ```
   *This starts the Vite client server and runs the native Tauri desktop window in debug mode.*

---

## Building & Packaging Installers

LaunchPad includes automated scripts to package production bundles and desktop installers.

### Required Tools (Windows Target)
- **WiX Toolset v3** (to build `.msi` installers).
- **NSIS** (to build `.exe` setup installers).

### Generate Production Binaries

Run the bundled release package pipeline:
```bash
npm run build:all
```

Once compilation completes, the release script moves the final installer binaries to the project root for immediate access:
- `LaunchPad.exe` (Raw standalone executable)
- `LaunchPad_0.1.0_x64-setup.exe` (NSIS Installer)
- `LaunchPad_0.1.0_x64_en-US.msi` (MSI Windows Installer)

---

## Project Structure

```text
LaunchPad/
├── src/                      # React Frontend Application
│   ├── components/           # UI Layout Components
│   │   ├── Dashboard.tsx     # Workspace overview & project grid
│   │   ├── ProjectDetails.tsx# Scrollable stats drawer, console logs, and settings
│   │   ├── PortsManager.tsx  # System-wide port search & process killer
│   │   ├── Settings.tsx      # Global directory path configurator
│   │   ├── Scripts.tsx       # Global custom script tools
│   │   └── ConsoleDrawer.tsx # Floating real-time log viewer
│   ├── App.tsx               # App router, process triggers, and layout wrap
│   ├── types.ts              # TypeScript interface contracts
│   └── index.css             # Main styling layer and design tokens
├── src-tauri/                # Tauri Rust Core Backend
│   ├── src/
│   │   ├── lib.rs            # Rust backend commands, command execution, and netstat parser
│   │   └── main.rs           # Tauri launcher entry point
│   ├── Cargo.toml            # Rust cargo dependency manifest
│   └── tauri.conf.json       # Bundle settings, app icon mappings, and permissions
├── package.json              # Client scripts and dependencies
└── vite.config.ts            # Vite compiler configuration
```

---

## License

Distributed under the MIT License. See `LICENSE` for details.
