# MarkBun Development Roadmap

This document outlines the development phases for MarkBun, from MVP to v1.0.

## 📊 Phase Overview

| Phase | Version | Focus | Status |
|-------|---------|-------|--------|
| Phase 0 | v0.0.x | Project Setup | ✅ Complete |
| Phase 1 | v0.1.0 | MVP - Core Editor | ✅ Complete |
| Phase 2 | v0.2.0 | File Management | ✅ Complete |
| Phase 3 | v0.3.0 | Enhanced Editing | ✅ Complete |
| Phase 4 | v0.4.0 | File Protection & Export | ✅ Complete |
| Phase 5 | v0.5.0 | Editor Productivity | ✅ Complete |
| Phase 6 | v0.6.0 | AI Support | ✅ Complete |
| Phase 7 | v0.7.0 | Writing Experience | ⏳ Planned |
| Phase 8 | v0.8.0 | Themes & Accessibility | ⏳ Planned |
| Phase 9 | v0.9.0 | Performance & Distribution | ⏳ Planned |
| Phase 10 | v0.10.0 | Polish & Cloud Sync | ⏳ Planned |
| Phase 11 | v1.0.0 | Production Ready | ⏳ Planned |

---

## ✅ Phase 0: Project Setup (v0.0.x)

**Status:** Complete

### Goals
- Set up project structure
- Configure development environment
- Create initial documentation

### Completed
- [x] Electrobun framework setup
- [x] React + Vite + Tailwind CSS configuration
- [x] HMR development environment
- [x] Project documentation (README, AGENTS, architecture)
- [x] Open source files (LICENSE, CONTRIBUTING, CHANGELOG)

---

## ✅ Phase 1: MVP - Core Editor (v0.1.0)

**Status:** Complete
**Target:** Basic working editor with markdown support
**Design Philosophy:** Chromeless interface - all UI elements (toolbar, title bar, status bar) are hidden by default to provide a distraction-free writing experience. Users can toggle individual elements via the View menu based on their workflow needs.

### Goals
- Integrate Milkdown WYSIWYG editor
- Implement basic file operations
- Add essential UI components

### Tasks

#### Editor Core
- [x] Install and configure Milkdown
  - [x] Core editor with commonmark preset
  - [x] GFM (GitHub Flavored Markdown) support
  - [x] History plugin (undo/redo)
  - [x] Clipboard plugin (copy/paste)
- [x] Create MilkdownEditor React component
- [x] Implement editor styles (seamless editing experience)

#### File Operations
- [x] IPC handlers for file operations
  - [x] `file:open` - Open file dialog and read content
  - [x] `file:save` - Save current content
  - [x] `file:saveAs` - Save with new name
- [x] Menu items (New, Open, Save, Save As)
- [x] Keyboard shortcuts (Ctrl/Cmd + N, O, S, Shift+S)

#### Basic UI
- [x] Simple toolbar with format buttons
  - [x] Bold, Italic, Code
  - [x] Heading 1, 2, 3
  - [x] Bullet list, Numbered list
  - [x] Quote, Link
- [x] Status bar
  - [x] Word count
  - [x] Save status indicator
- [x] Title bar with document name

#### Theming
- [x] Light mode default theme
- [x] Basic dark mode support
- [x] CSS variables for theming

---

## ✅ Phase 2: File Management (v0.2.0)

**Status:** Complete
**Target:** Full file explorer and navigation

### Goals
- ✅ File explorer sidebar
- ✅ Folder navigation
- ✅ Recent files
- ✅ Quick Open (Ctrl/Cmd+P)
- ✅ Outline Navigation

### Completed Tasks

#### Sidebar
- ✅ Collapsible sidebar component with resize handle
- ✅ File explorer tree view
  - ✅ Folder expansion/collapse
  - ✅ File icons by type
- ✅ Tab switching (Files / Outline)

#### Outline Navigation
- ✅ Parse document headings from markdown
- ✅ Outline panel in sidebar
- ✅ Click to jump to heading
- ✅ Hierarchical tree view

#### File Management
- ✅ Folder browsing IPC handlers
- ✅ File tree component
- ✅ Recent files persistence (JSON storage)
- ✅ Quick open dialog (Ctrl/Cmd+P)
- ✅ Fuzzy search in quick open

### Implementation Details
- **Main Process**: Added `folders.ts` and `recentFiles.ts` IPC handlers
- **Renderer**: Added Sidebar, FileExplorer, Outline, and QuickOpen components
- **Hooks**: Added `useSidebar`, `useFileExplorer`, `useOutline`, `useQuickOpen`
- **Storage**: Recent files stored in `~/.config/markbun/recent-files.json`

---

## ✅ Phase 3: Enhanced Editing (v0.3.0)

**Status:** Complete
**Target:** Advanced editor features, auto-save, and UI state persistence

### Tasks

#### Advanced Markdown
- [x] Math support (LaTeX)
  - [x] Inline math: `$...$`
  - [x] Block math: `$$...$$`
  - [x] Live preview
- [x] Table editing
  - [x] Insert table dialog
  - [x] Add/remove rows and columns
  - [x] Header styling
- [x] Image support
  - [x] Drag and drop images
  - [x] Image upload/paste
  - [ ] Image resizing

#### Auto-save
- [x] Auto-save on change (hybrid throttle/debounce strategy)
- [x] Configurable auto-save interval
- [x] Unsaved changes indicator

#### UI State Persistence
- [x] Save and restore window position and size
- [x] Multi-monitor support with display detection
- [x] Sidebar width and visibility state
- [x] Active sidebar tab (Files/Outline)
- [x] Theme preference (light/dark/system)

#### Search
- [ ] Find in document (Ctrl/Cmd + F)
- [ ] Find and replace
- [ ] Search highlighting

---

## ✅ Phase 4: File Protection & Export (v0.4.0)

**Status:** Complete
**Target:** Robust file protection and export capabilities

### Goals
- Three-layer file protection system
- Export to multiple formats
- Math equation support

### Completed Tasks

#### File Protection
- [x] **Atomic Write** - Write to temp file then rename
- [x] **Crash Recovery** - Recovery files on unexpected shutdown
- [x] **Version History** - Automatic backup versions
- [x] Recovery dialog on startup
- [x] Settings tab for backup configuration

#### Export
- [x] Export to PNG image
- [x] Export to HTML
- [x] Export to PDF with Chinese font support (NotoSansSC)
- [x] Export menu in File menu

#### Math Support
- [x] LaTeX inline math support
- [x] LaTeX block math support
- [x] Code block editing for LaTeX

### Implementation Details
- **Backup Service**: `src/bun/services/backup.ts` with 35+ unit tests
- **Export Hook**: `src/mainview/hooks/useExport.ts`
- **Recovery Dialog**: `src/mainview/components/recovery-dialog/RecoveryDialog.tsx`

---

## ✅ Phase 5: Editor Productivity (v0.5.0)

**Status:** Complete
**Target:** Improve editing efficiency with advanced features

### Completed Tasks

#### Find & Replace
- [x] Find in document (Ctrl/Cmd + F)
- [x] Find and replace (Ctrl/Cmd + H)
- [x] Search highlighting (WYSIWYG and code blocks)
- [ ] Regex support
- [ ] Case sensitivity toggle

#### Command Palette
- [x] Unified command palette (Ctrl/Cmd + P)
- [x] Fuzzy search for all commands
- [x] Recent commands and usage tracking

#### Session Persistence
- [x] Cursor position saved and restored between sessions
- [x] Scroll position saved and restored between sessions
- [x] Session state service with save hook

#### Windows Platform Support
- [x] Frontend menu bar for Windows
- [x] Icon embedding in executables
- [x] CI/release pipeline for Windows

### Implementation Details
- **Find & Replace**: `src/mainview/components/search/` — search across WYSIWYG and CodeMirror code blocks
- **Command Palette**: `src/mainview/components/command-palette/` — unified palette replacing Quick Open
- **Session State**: `src/bun/services/sessionState.ts` — cursor/scroll position persistence
- **Windows Menu**: `src/mainview/components/menu-bar/` — custom frontend menu for Windows

### Deferred
- Tabbed Editing → moved to Phase 9 (v0.9.0)

---

## ✅ Phase 6: AI Support (v0.6.0)

**Status:** Complete
**Target:** AI assistant with multi-provider support, tool calling, and session persistence

### Completed Tasks

#### AI Chat Interface
- [x] Resizable AI chat panel (280–600px width)
- [x] Real-time streaming responses with smart buffering (50ms/3 tokens)
- [x] Multi-turn conversation with tool call loop
- [x] Rich message display (markdown rendering, tool call cards with status)
- [x] Abort support for in-progress responses
- [x] Setup guide when AI is not configured

#### AI Tools (Document Manipulation)
- [x] `read` tool — retrieve full document content
- [x] `edit` tool — find and replace text in document
- [x] `write` tool — replace entire document content
- [x] Tool call visualization (status indicators, duration, expandable details)

#### Multi-Provider Support
- [x] OpenAI-compatible provider support (OpenAI, DeepSeek, Kimi, GLM, Qwen, etc.)
- [x] Native provider support (Anthropic, Google, xAI, Mistral, Groq, etc.)
- [x] Local model support (Ollama)
- [x] OpenRouter aggregator support
- [x] Custom base URL for any OpenAI-compatible API
- [x] Model selector with combobox, synced from pi-ai

#### Session Persistence
- [x] Session history saved to `~/.config/markbun/ai-sessions/`
- [x] Auto-restore latest session on app launch
- [x] Session history dialog (browse, restore, auto-cleanup at 50 sessions)
- [x] Session title generation from first user message

#### Settings & i18n
- [x] AI settings tab (provider, model, base URL, local-only mode)
- [x] Full i18n support for AI features (8 locales)
- [x] Context-aware system prompt (file name, document language)

### Implementation Details
- **AI Streaming**: `src/bun/services/ai-stream.ts` — buffered streaming with retryable error classification
- **AI Tools**: `src/mainview/lib/ai-tools.ts` — 3 atomic tools via `window.__markbunAI`
- **AI Session**: `src/bun/services/ai-session.ts` — persistent session storage
- **Chat Hook**: `src/mainview/hooks/useAIChat.ts` — conversation state management
- **Chat Components**: `src/mainview/components/ai-chat/` — panel, messages, input, tool cards
- **Provider**: `@mariozechner/pi-ai` + `@anthropic-ai/sdk`

---

## ⏳ Phase 7: Writing Experience (v0.7.0)

**Status:** Planned
**Target:** Immersive writing environment

### Tasks

#### Focus Mode
- [ ] Highlight current paragraph, dim others
- [ ] Optional typewriter mode (cursor centered)
- [ ] Full-screen distraction-free writing
- [ ] Optional background white noise

#### Document Statistics
- [ ] Word count, character count, line count
- [ ] Reading time estimation
- [ ] Writing speed tracking (words/hour)
- [ ] Daily writing goal setting

#### Typewriter Mode
- [ ] Current line fixed at screen center
- [ ] Smooth scroll animation
- [ ] Reduced visual fatigue

---

## ⏳ Phase 8: Themes & Accessibility (v0.8.0)

**Status:** Planned
**Target:** Personalization and accessibility

### Tasks

#### Custom Themes
- [ ] Theme configuration files (~/.markbun/themes/)
- [ ] Theme marketplace/preset themes
- [ ] Editor colors, fonts, line height customization
- [ ] Syntax highlighting themes

#### Advanced Keybindings
- [ ] Keybindings configuration UI
- [ ] Support modifying all shortcuts
- [ ] VS Code / Sublime presets
- [ ] Keybinding conflict detection

#### Accessibility
- [ ] Screen reader support
- [ ] Keyboard navigation optimization
- [ ] High contrast mode
- [ ] Quick font size adjustment

---

## ⏳ Phase 9: Performance & Distribution (v0.9.0)

**Status:** Planned
**Target:** Large file support and cross-platform distribution

### Tasks

#### Performance Optimization
- [ ] Smooth editing for large files (>10MB)
- [ ] Virtual scroll optimization
- [ ] Lazy image loading
- [ ] Memory usage optimization
- [ ] Startup speed optimization

#### Distribution
- [ ] macOS DMG installer
- [ ] Windows MSI/EXE installer
- [ ] Linux AppImage/Snap/Flatpak
- [ ] Code signing

#### Workspace Management
- [ ] Multi-folder workspaces
- [ ] Workspace switching
- [ ] Workspace-specific settings

---

## ⏳ Phase 10: Polish & Cloud Sync (v0.10.0)

**Status:** Planned
**Target:** Final polish and cloud service integration

### Tasks

#### Auto Updater
- [ ] Auto-detect new versions
- [ ] Background download
- [ ] One-click update install
- [ ] Changelog display

#### Cloud Sync (Basic)
- [ ] Config export/import
- [ ] Third-party cloud integration (iCloud Drive, Dropbox, OneDrive, Google Drive)
- [ ] Recent documents cross-device sync
- [ ] Cloud backup recovery

#### Polish & Bugfix
- [ ] Comprehensive error handling
- [ ] Edge case fixes
- [ ] Accessibility improvements
- [ ] Internationalization completion
- [ ] Final performance optimization

---

## ⏳ Phase 11: Production Ready (v1.0.0)

**Status:** Planned
**Target:** Stable, feature-complete editor release

### v1.0.0 Goals
- Stable core functionality
- Comprehensive documentation
- Full platform distribution
- User community building

---

## 🎯 Long-term Ideas (Post v1.0)

- **Plugin System** - Extensible plugin architecture
- **Git Integration** - Version control integration
- **Real-time Collaboration** - Multi-user editing
- **Mobile Companion** - Mobile companion app
- **Plugin Marketplace** - Plugin discovery and distribution

---

## 📝 Notes

- Each phase should result in a working, usable application
- Features may be added or removed based on feedback
- Security and performance are considerations at every phase

### Design Principles

**Chromeless Interface**: MarkBun prioritizes content over chrome. All UI elements (toolbar, title bar, status bar) are hidden by default to minimize visual distraction. This design decision follows the philosophy pioneered by iA Writer and Typora — the editor should be invisible, letting the writer focus entirely on their words.

Users retain full control: every UI element can be toggled on demand via the View menu or keyboard shortcuts. This approach accommodates different workflows while maintaining a clean, minimal default state.

---

*Last updated: 2026-04-04*
