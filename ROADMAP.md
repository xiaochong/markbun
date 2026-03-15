# MarkBun Development Roadmap

This document outlines the development phases for MarkBun, from MVP to v1.0.

## 📊 Phase Overview

| Phase | Version | Focus | Status |
|-------|---------|-------|--------|
| Phase 0 | v0.0.x | Project Setup | ✅ Complete |
| Phase 1 | v0.1.0 | MVP - Core Editor | ✅ Complete |
| Phase 2 | v0.2.0 | File Management | ✅ Complete |
| Phase 3 | v0.3.0 | Enhanced Editing | ✅ Complete |
| Phase 4 | v1.0.0 | Production Ready | ⏳ Planned |

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
- [ ] Math support (LaTeX)
  - [ ] Inline math: `$...$`
  - [ ] Block math: `$$...$$`
  - [ ] Live preview
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

## ⏳ Phase 4: Production Ready (v1.0.0)

**Status:** Planned  
**Target:** Stable, feature-complete editor

### Tasks

#### Editor Enhancements
- [ ] Vim mode
- [ ] Command palette (Ctrl/Cmd + Shift + P)
- [ ] Multiple cursors
- [ ] Split view (edit + preview)

#### Settings (Completed in v0.3.0)
- [x] Settings UI dialog
- [x] Font family and size
- [x] Line height
- [x] Word wrap toggle
- [x] Show/hide line numbers

#### Polish
- [ ] Custom themes support
- [ ] Plugin system
- [ ] Performance optimization for large files
- [ ] Comprehensive error handling

#### Distribution
- [ ] macOS app bundle
- [ ] Windows installer
- [ ] Linux AppImage
- [ ] Auto-updater

---

## 🎯 Long-term Ideas (Post v1.0)

- Cloud sync (iCloud, Dropbox)
- Git integration
- Real-time collaboration
- Mobile companion app
- Plugin marketplace

---

## 📝 Notes

- Each phase should result in a working, usable application
- Features may be added or removed based on feedback
- Security and performance are considerations at every phase

### Design Principles

**Chromeless Interface**: MarkBun prioritizes content over chrome. All UI elements (toolbar, title bar, status bar) are hidden by default to minimize visual distraction. This design decision follows the philosophy pioneered by iA Writer and Typora — the editor should be invisible, letting the writer focus entirely on their words.

Users retain full control: every UI element can be toggled on demand via the View menu or keyboard shortcuts. This approach accommodates different workflows while maintaining a clean, minimal default state.

---

*Last updated: 2026-03-15*
