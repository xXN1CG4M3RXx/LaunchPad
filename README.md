# LaunchPad

[![Tauri](https://img.shields.io/badge/Tauri-v2-FFC131?logo=tauri&logoColor=white&style=flat-square)](https://tauri.app/)
[![Rust](https://img.shields.io/badge/Rust-1.75+-000000?logo=rust&logoColor=white&style=flat-square)](https://www.rust-lang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black&style=flat-square)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white&style=flat-square)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?logo=tailwind-css&logoColor=white&style=flat-square)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](LICENSE)

LaunchPad is a sleek, modern, and lightweight developer cockpit designed to organize, scan, and launch your development projects. Powered by **Tauri v2**, **React 19**, and **Rust**, LaunchPad provides a centralized dashboard to manage your workspace and trigger project tasks instantly, without cluttering your system shell.

---

## Features

- **Recursive Workspace Scanning**  
  Scan your specified development directory recursively at a configurable depth (e.g., `depth=2`) to discover projects automatically.
- **Smart Framework Detection**  
  Auto-detects project types and configures smart defaults:
  - **Rust** (`Cargo.toml`) $\rightarrow$ `cargo run`
  - **Node.js** (`package.json`) $\rightarrow$ Parses `scripts` to select `npm run dev` or `npm start`
  - **Go** (`go.mod`) $\rightarrow$ `go run .`
  - **Python** (`requirements.txt`/`pyproject.toml`) $\rightarrow$ `python main.py`
  - **Java** (`pom.xml` / Gradle) and **Generic** fallback structures.
- **Process Management & Streaming Logs**  
  Spawn development servers or commands as asynchronous background tasks managed by the Rust core. Real-time stdout/stderr log output is streamed via Tauri event emitters directly to a frontend **Console Drawer**.
- **Pin & Customize**  
  Pin your most important projects for fast access, and customize the default execution commands for individual projects.
- **System Diagnostics**  
  Displays global toolchain status indicating active version numbers for `git`, `rust`/`cargo`, and `node`.
- **Premium Dark Mode UI**  
  A modern, high-contrast dashboard with glassmorphism effects, built with Tailwind CSS, and polished with smooth transitions and Lucide React icons.

---

## Technology Stack

| Component        | Technology                                                                     | Description                                                                 |
| :--------------- | :----------------------------------------------------------------------------- | :-------------------------------------------------------------------------- |
| **Backend Core** | [Rust](https://www.rust-lang.org/)                                             | Orchestrates system files, processes, configurations, and git repositories. |
| **App Shell**    | [Tauri v2](https://tauri.app/)                                                 | Secure cross-platform app runtime utilizing native webviews.                |
| **Frontend**     | [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) | Highly interactive and type-safe user interface.                            |
| **Build Tool**   | [Vite 7](https://vite.dev/)                                                    | Ultra-fast frontend bundler.                                                |
| **Styling**      | [Tailwind CSS](https://tailwindcss.com/)                                       | Responsive utility-first styling and dark mode control.                     |

---

## Getting Started

### Prerequisites

Ensure you have the following installed on your machine:

1. **Node.js** (v18+) & **npm**
2. **Rust & Cargo** (v1.75+)
3. **C++ Build Tools** (e.g., Visual Studio Build Tools for Windows target compilation)

### Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/LaunchPad.git
   cd LaunchPad
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run tauri dev
   ```
   *This starts the Vite server and launches the native Tauri desktop window in debug mode.*

---

## Building & Packaging Installers

Tauri can bundle the app into native installer packages (`.msi`, `.exe`) and standalone executables.

### Dependencies for Installer Builds (Windows)
- **WiX Toolset v3** (Required to compile `.msi` installers).
- **NSIS** (Required to compile `.exe` setup installers).

### Generate Production Builds
We have set up an automated script that compiles your application in release mode and copies all generated installers to the root directory for easy access.

Simply run:
```bash
npm run build:all
```

Once the compilation succeeds, you will find your output files directly in the project root:
- `LaunchPad.exe` (Raw executable)
- `LaunchPad_0.1.0_x64-setup.exe` (NSIS Installer)
- `LaunchPad_0.1.0_x64_en-US.msi` (WiX/MSI Installer)

---

## Repository Structure

```text
LaunchPad/
├── src/                      # React Frontend Source
│   ├── components/           # UI Components (Dashboard, Settings, ConsoleDrawer, etc.)
│   ├── App.tsx               # Main frontend coordinator & event routing
│   ├── main.tsx              # React mounting root
│   └── types.ts              # TypeScript interface definitions
├── src-tauri/                # Rust Backend Source (Tauri)
│   ├── src/
│   │   ├── lib.rs            # Core backend Rust logic (commands, folder scanner, process execution)
│   │   └── main.rs           # Tauri entry point
│   ├── Cargo.toml            # Rust dependency manifest
│   └── tauri.conf.json       # Tauri configuration (bundle details, permissions)
├── package.json              # NPM dependencies and project scripts
├── tailwind.config.js        # UI utility definitions and styles
└── vite.config.ts            # Vite configuration
```

---

## License

Distributed under the MIT License. See `LICENSE` for more information.
