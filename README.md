# MarkBun

**[中文](README-cn.md)** | English

> 📝 A fast, beautiful, Typora-like markdown desktop editor

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Built with Milkdown](https://img.shields.io/badge/Built%20with-Milkdown-orange)](https://milkdown.dev)
[![Powered by Electrobun](https://img.shields.io/badge/Powered%20by-Electrobun-purple)](https://electrobun.dev)

MarkBun is an open-source, cross-platform markdown editor designed for seamless writing. Like Typora, it provides a distraction-free WYSIWYG editing experience where markdown syntax fades away to reveal beautifully formatted content.

<div align="center">
  <img src="docs/assets/logo.svg" alt="MarkBun Logo" width="200">
</div>

**Mark** (from Markdown) + **Bun** (from Electrobun) = MarkBun

> 🍞 **Why "MarkBun"?**
>
> In the Age of AI, Markdown is the *lingua franca* — the universal currency of digital communication.
> Learn Markdown, earn your bread. It's that simple.
> (Plus, "Markbun" sounds way tastier than "Plaintextbun")

## 🚧 Development Status

> **⚠️ Early Development Stage**
>
> MarkBun is currently in active development. 
>
> **Current Status:**
> - ✅ Electrobun desktop framework configured
> - ✅ React + Vite + Tailwind CSS setup
> - ✅ Development environment with HMR
> - ✅ Milkdown WYSIWYG editor integration
> - ✅ File operations (New, Open, Save, Save As)
> - ✅ Dark mode support
> - ✅ Toolbar and status bar (hidden by default)
> - ✅ File explorer sidebar (v0.2.0)
> - ✅ Outline navigation (v0.2.0)
> - ✅ Quick Open (Ctrl/Cmd+P)
> - ✅ Auto-save (v0.3.0)
> - ✅ Settings UI (v0.3.0)
> - ✅ Multi-monitor support (v0.3.0)
> - ✅ Three-layer file protection (v0.4.0)
> - ✅ Export to PNG/HTML (v0.4.0)
> - ✅ Math equations (v0.4.0)
> - ✅ Find & Replace (v0.5.0)
> - ✅ Command Palette (v0.5.0)
> - ✅ Session Persistence (v0.5.0)
> - ✅ Windows Support (v0.5.0)
> - ⏳ AI Support (v0.6.0)
>
> See [ROADMAP.md](./ROADMAP.md) for detailed development phases.

## ✨ Features

### Design Philosophy

MarkBun follows a **chromeless editing philosophy** inspired by the pioneering work of [iA Writer](https://ia.net/writer) and [Typora](https://typora.io). The interface is intentionally minimal — all toolbars, title bars, and status bars are hidden by default to eliminate visual distractions and keep you focused on your content.

When you need them, every UI element can be instantly toggled via the **View menu** or keyboard shortcuts. This approach puts the written word at the center of the experience, not the application chrome.

### Core Features

- 🎯 **Seamless WYSIWYG Editing** - Write markdown naturally without distraction
- ⚡ **Lightning Fast** - Built with Bun and native webviews for <50ms startup
- 🎨 **Beautiful Typography** - Carefully crafted themes and styles
- 🖼️ **Chromeless Interface** - Distraction-free writing with all UI elements hidden by default
- 🌙 **Dark Mode** - Easy on the eyes for night writing
- 📁 **File Management** - Built-in file browser with folder support
- 🔍 **Outline Navigation** - Jump to any heading instantly
- ⚡ **Quick Open** - Fuzzy file finder with Ctrl/Cmd+P
- 🧮 **Math Support** - LaTeX equations with live preview
- 📊 **Tables** - Intuitive table editing with header styling
- 💾 **Auto Save** - Hybrid throttle/debounce strategy
- ⚙️ **Settings** - Persistent settings with UI
- 🖥️ **Multi-Monitor** - Window position saved per display with smart fallback
- 🛡️ **File Protection** - Atomic write, crash recovery, and version history
- 📤 **Export** - Export to PNG and HTML
- 🔍 **Find & Replace** - Search with highlighting across WYSIWYG and code blocks (`Cmd/Ctrl + F`)
- 🎛️ **Command Palette** - Unified command palette with fuzzy search and history (`Cmd/Ctrl + P`)
- 💾 **Session Restore** - Cursor position and scroll state saved between sessions
- 🪟 **Windows Support** - Native menu bar, icons, and CI for Windows
- ⌨️ **Keyboard Shortcuts** - Comprehensive shortcuts for formatting and navigation
- 🔤 **Source Mode** - Toggle between WYSIWYG and source code editing (`Cmd/Ctrl + /`)
- 🌐 **i18n** - Multi-language support (English, Chinese, Japanese, Korean, etc.)

![MarkBun Preview](docs/assets/preview1.png)

![MarkBun Preview](docs/assets/preview2.png)

## 🚀 Quick Start

### Prerequisites

- [Bun](https://bun.sh) 1.0+
- macOS 11+, Windows 10+, or Linux

### Installation

```bash
# Install dependencies
bun install

# Development without HMR (uses bundled assets)
bun run dev

# Development with HMR (recommended)
bun run dev:hmr
```

### macOS Note

Since MarkBun is not yet code-signed, macOS Gatekeeper may show a "damaged" warning. Run this command after installing:

```bash
xattr -cr /Applications/MarkBun.app
```

### Build

```bash
# Build for canary release
bun run build:canary

# Build for stable release
bun run build:stable
```

## How HMR Works

When you run `bun run dev:hmr`:

1. **Vite dev server** starts on `http://localhost:5173` with HMR enabled
2. **Electrobun** starts and detects the running Vite server
3. The app loads from the Vite dev server instead of bundled assets
4. Changes to React components update instantly without full page reload

When you run `bun run dev` (without HMR):

1. Electrobun starts with file watch and loads from `views://mainview/index.html`
2. You need to rebuild (`bun run build:canary`) to see changes

## 🏗️ Tech Stack

| Technology | Purpose |
|------------|---------|
| [Milkdown](https://milkdown.dev) | WYSIWYG Markdown editor core |
| [Electrobun](https://electrobun.dev) | Cross-platform desktop framework |
| [CodeMirror](https://codemirror.net) | Source mode editor |
| [Bun](https://bun.sh) | JavaScript runtime and bundler |
| [TypeScript](https://typescriptlang.org) | Type-safe development |
| [Tailwind CSS](https://tailwindcss.com) | Utility-first styling |
| [Zod](https://zod.dev) | Settings schema validation |
| [i18next](https://www.i18next.com) | Internationalization |

## 📁 Project Structure

```
markbun/
├── src/
│   ├── bun/                  # Main process (Electrobun/Bun)
│   │   ├── index.ts          # Main entry point and RPC handlers
│   │   ├── menu.ts           # Application menus
│   │   ├── services/         # Backend services (settings, backup, uiState)
│   │   └── ipc/              # IPC handlers
│   │
│   ├── mainview/             # Renderer process (WebView)
│   │   ├── components/       # React components
│   │   │   ├── editor/       # Milkdown/Crepe editor wrapper
│   │   │   ├── file-explorer/# File explorer sidebar
│   │   │   ├── layout/       # Toolbar, StatusBar, TitleBar, Sidebar
│   │   │   ├── outline/      # Outline navigation
│   │   │   ├── quick-open/   # Quick Open dialog
│   │   │   ├── settings/     # Settings dialog
│   │   │   └── recovery-dialog/ # Crash recovery dialog
│   │   │
│   │   ├── hooks/            # Custom React hooks
│   │   ├── lib/              # Utilities and helpers
│   │   ├── i18n/             # Internationalization (8 locales)
│   │   ├── styles/           # Global styles
│   │   ├── main.tsx          # React entry point
│   │   ├── App.tsx           # Main App component
│   │   └── index.html        # HTML entry
│   │
│   └── shared/               # Shared types, settings schema, and utilities
│
├── docs/                     # Documentation
│   └── architecture.md       # Architecture overview
│
├── electrobun.config.ts      # Electrobun configuration
├── vite.config.ts            # Vite configuration
├── tailwind.config.js        # Tailwind configuration
├── package.json
└── README.md
```

## 🎮 Usage

### Basic Editing

1. **New File**: `Cmd/Ctrl + N`
2. **Open File**: `Cmd/Ctrl + O`
3. **Save**: `Cmd/Ctrl + S`
4. **Save As**: `Cmd/Ctrl + Shift + S`

### Interface Controls

MarkBun uses a **chromeless interface** — all toolbars and UI elements are hidden by default for distraction-free writing. Toggle UI elements via the **View menu** or shortcuts:

| UI Element | Menu Command | Default State |
|------------|--------------|---------------|
| Title Bar | `View → Show Title Bar` | Hidden |
| Toolbar | `View → Show Tool Bar` | Hidden |
| Status Bar | `View → Show Status Bar` | Hidden |
| Sidebar | `View → Show Sidebar` | Hidden (`Cmd/Ctrl + Shift + B`) |
| Dark Mode | `View → Toggle Dark Mode` | `Cmd/Ctrl + Shift + D` |
| Source Mode | `View → Toggle Source Mode` | `Cmd/Ctrl + /` |
| Settings | `MarkBun → Preferences` | `Cmd/Ctrl + ,` |

### Formatting Shortcuts

| Action | Shortcut |
|--------|----------|
| Bold | `Cmd/Ctrl + B` |
| Italic | `Cmd/Ctrl + I` |
| Inline Code | `Cmd/Ctrl + Shift + C` |
| Strikethrough | `Cmd/Ctrl + Shift + ~` |
| Highlight | `Cmd/Ctrl + Shift + H` |
| Inline Math | `Ctrl + M` |
| Link | `Cmd/Ctrl + K` |
| Image | `Cmd/Ctrl + Shift + I` |

### Paragraph Shortcuts

| Action | Shortcut |
|--------|----------|
| Heading 1-6 | `Cmd/Ctrl + 1/2/3/4/5/6` |
| Paragraph | `Cmd/Ctrl + 0` |
| Increase Heading Level | `Cmd/Ctrl + =` |
| Decrease Heading Level | `Cmd/Ctrl + -` |
| Bullet List | `Alt + Cmd/Ctrl + U` |
| Ordered List | `Alt + Cmd/Ctrl + O` |
| Task List | `Alt + Cmd/Ctrl + X` |
| Quote | `Alt + Cmd/Ctrl + Q` |
| Code Block | `Alt + Cmd/Ctrl + C` |
| Math Block | `Alt + Cmd/Ctrl + B` |
| Horizontal Rule | `Alt + Cmd/Ctrl + -` |
| Table | `Alt + Cmd/Ctrl + T` |

## 🎨 Customization

### Settings

Settings are stored in `~/.config/markbun/settings.json`:

```json
{
  "__version": 1,
  "general": {
    "autoSave": true,
    "autoSaveInterval": 2000,
    "language": "en"
  },
  "editor": {
    "fontSize": 15,
    "lineHeight": 1.65
  },
  "appearance": {
    "theme": "system",
    "sidebarWidth": 280
  },
  "backup": {
    "enabled": true,
    "maxVersions": 20,
    "retentionDays": 30,
    "recoveryInterval": 30000
  }
}
```

UI state is stored separately in `~/.config/markbun/ui-state.json`:

```json
{
  "showTitleBar": false,
  "showToolBar": false,
  "showStatusBar": false,
  "showSidebar": false,
  "sidebarWidth": 280,
  "sidebarActiveTab": "files",
  "windowX": 200,
  "windowY": 200,
  "windowWidth": 1200,
  "windowHeight": 800
}
```

The window position and size are automatically saved and restored on restart. If the saved position is outside the visible screen area (e.g., when a monitor is disconnected), the window will be reset to a safe default position on the primary display.

### Multi-Monitor Support

MarkBun fully supports multi-monitor setups:
- Window position is saved per display
- Automatically detects when a display is disconnected
- Falls back to primary display when the original display is unavailable
- Validates window visibility before restoring to ensure the window is always accessible

## 🛠️ Development

### Scripts

```bash
bun run dev            # Start development with file watch
bun run dev:hmr        # Start development with HMR (recommended)
bun run build:canary   # Build canary release
bun run build:stable   # Build stable release
bun run test           # Run tests once
bun run test:watch     # Run tests in watch mode
bun run test:coverage  # Run tests with coverage
bun run lint           # Run typecheck and tests
```

### Adding Milkdown Plugins

```bash
bun add @milkdown/plugin-math
```

## 🧪 Testing

### Running Tests

MarkBun uses **Bun's built-in test runner**:

```bash
# Run all tests
bun test

# Run tests in watch mode (during development)
bun run test:watch

# Run tests with coverage report
bun run test:coverage
```

### Editor Module Tests

After refactoring, the editor module has comprehensive unit tests:

```
tests/unit/components/editor/
├── types.test.ts              # Type definition tests
├── utils/
│   ├── tableHelpers.test.ts   # Table utility tests
│   └── editorActions.test.ts  # Editor action tests
├── hooks/
│   └── index.test.ts          # React hooks tests
└── commands/
    ├── formatting.test.ts     # Formatting command tests
    ├── paragraph.test.ts      # Paragraph command tests
    └── table.test.ts          # Table command tests
```

**Test Directory Structure:**
- Tests are in `tests/unit/` mirroring the `src/` structure
- `tests/unit/setup.ts` - Test helper for simplified imports
- Future: `tests/integration/` and `tests/e2e/` for other test types

**Simplified Imports:**
```typescript
// Import from setup.ts instead of long relative paths
import { isTableCell, toggleBold } from '../setup';
```

### Writing Tests

When modifying the editor, you **must** run tests:

```bash
# Before committing
bunx tsc --noEmit  # Type check
bun test           # Run all tests
```

Test naming convention:
- `should [expected behavior] when [condition]`
- Example: `should return false when editor is not initialized`

### Test Coverage

Minimum coverage requirements:
- Utils: 90%+
- Commands: 80%+
- Hooks: 70%+

Generate coverage report:
```bash
bun test --coverage
```

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 Roadmap

### v0.1.0 (MVP) ✅ Completed
- [x] Basic WYSIWYG editing
- [x] File open/save
- [x] Markdown syntax support
- [x] Dark mode

### v0.2.0 ✅ Completed
- [x] File explorer sidebar
- [x] Outline navigation
- [x] Image drag & drop
- [x] Quick Open (Ctrl/Cmd+P)
- [x] Recent files

### v0.3.0 ✅ Completed
- [x] Table header styling
- [x] Auto-save (with hybrid throttle/debounce strategy)
- [x] Settings UI (General, Editor, Appearance tabs)
- [x] UI state persistence (sidebar width, visibility)
- [x] Theme management (light/dark/system)
- [x] Multi-monitor support with display detection

### v0.4.0 ✅ Completed
- [x] Three-layer file protection (atomic write, crash recovery, version history)
- [x] Export to PNG image
- [x] Export to HTML
- [x] Math equations (LaTeX inline and block support)

### v0.5.0 ✅ Completed
- [x] Find & Replace with search highlighting (WYSIWYG and code blocks)
- [x] Unified Command Palette (Ctrl/Cmd+P)
- [x] Session persistence (cursor/scroll position restore)
- [x] Windows platform support (menu bar, icons, CI)

### v0.6.0 ⏳ Planned
- [ ] AI Writing Assistant (continue writing, generate content)
- [ ] AI Editor (polish, summarize, translate)
- [ ] AI Agent (auto-optimize structure, title suggestions)

### v0.7.0 ⏳ Planned
- [ ] Focus Mode (distraction-free writing)
- [ ] Document Statistics (word count, writing speed)
- [ ] Typewriter Mode (cursor centered)

### v0.8.0 ⏳ Planned
- [ ] Custom Themes
- [ ] Advanced Keybindings
- [ ] Accessibility Support

### v0.9.0 ⏳ Planned
- [ ] Performance Optimization (large files)
- [ ] Cross-platform Distribution (macOS/Windows/Linux)
- [ ] Workspace Management
- [ ] Tabbed Editing (multiple documents)

### v0.10.0 ⏳ Planned
- [ ] Auto Updater
- [ ] Cloud Sync (iCloud, Dropbox, OneDrive, Google Drive)
- [ ] Final Polish

### v1.0.0
- Stable release

### Post v1.0
- [ ] Plugin System
- [ ] Git Integration
- [ ] Real-time Collaboration

## 📄 License

MarkBun is licensed under the [MIT License](LICENSE).

## 🙏 Acknowledgements

- [Milkdown](https://milkdown.dev) - The amazing WYSIWYG markdown framework
- [Electrobun](https://electrobun.dev) - Ultra-fast desktop framework
- [CodeMirror](https://codemirror.net) - Source mode editor
- [ProseMirror](https://prosemirror.net) - The foundation of Milkdown
- [Typora](https://typora.io) - Inspiration for the editing experience

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/xiaochong">@xiaochong</a>
</p>
