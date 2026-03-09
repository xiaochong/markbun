# PingWrite Development Roadmap

This document outlines the development phases for PingWrite, from MVP to v1.0.

## 📊 Phase Overview

| Phase | Version | Focus | Status |
|-------|---------|-------|--------|
| Phase 0 | v0.0.x | Project Setup | ✅ Complete |
| Phase 1 | v0.1.0 | MVP - Core Editor | 🚧 In Progress |
| Phase 2 | v0.2.0 | File Management | ⏳ Planned |
| Phase 3 | v0.3.0 | Enhanced Editing | ⏳ Planned |
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

## 🚧 Phase 1: MVP - Core Editor (v0.1.0)

**Status:** In Progress  
**Target:** Basic working editor with markdown support

### Goals
- Integrate Milkdown WYSIWYG editor
- Implement basic file operations
- Add essential UI components

### Tasks

#### Editor Core
- [ ] Install and configure Milkdown
  - [ ] Core editor with commonmark preset
  - [ ] GFM (GitHub Flavored Markdown) support
  - [ ] History plugin (undo/redo)
  - [ ] Clipboard plugin (copy/paste)
- [ ] Create MilkdownEditor React component
- [ ] Implement editor styles (seamless editing experience)

#### File Operations
- [ ] IPC handlers for file operations
  - [ ] `file:open` - Open file dialog and read content
  - [ ] `file:save` - Save current content
  - [ ] `file:saveAs` - Save with new name
- [ ] Menu items (New, Open, Save, Save As)
- [ ] Keyboard shortcuts (Ctrl/Cmd + N, O, S, Shift+S)

#### Basic UI
- [ ] Simple toolbar with format buttons
  - [ ] Bold, Italic, Code
  - [ ] Heading 1, 2, 3
  - [ ] Bullet list, Numbered list
  - [ ] Quote, Link
- [ ] Status bar
  - [ ] Word count
  - [ ] Save status indicator
- [ ] Title bar with document name

#### Theming
- [ ] Light mode default theme
- [ ] Basic dark mode support
- [ ] CSS variables for theming

---

## ⏳ Phase 2: File Management (v0.2.0)

**Status:** Planned  
**Target:** Full file explorer and navigation

### Goals
- File explorer sidebar
- Folder navigation
- Recent files

### Tasks

#### Sidebar
- [ ] Collapsible sidebar component
- [ ] File explorer tree view
  - [ ] Folder expansion/collapse
  - [ ] File icons by type
  - [ ] Context menu (New, Delete, Rename)
- [ ] File watching for external changes
- [ ] Drag and drop file support

#### Outline Navigation
- [ ] Parse document headings
- [ ] Outline panel in sidebar
- [ ] Click to jump to heading
- [ ] Highlight current section

#### Recent Files
- [ ] Recent files list
- [ ] Persist recent files to settings
- [ ] Quick open (Ctrl/Cmd + P)

---

## ⏳ Phase 3: Enhanced Editing (v0.3.0)

**Status:** Planned  
**Target:** Advanced editor features

### Tasks

#### Advanced Markdown
- [ ] Math support (LaTeX)
  - [ ] Inline math: `$...$`
  - [ ] Block math: `$$...$$`
  - [ ] Live preview
- [ ] Table editing
  - [ ] Insert table dialog
  - [ ] Add/remove rows and columns
  - [ ] Column resizing
- [ ] Image support
  - [ ] Drag and drop images
  - [ ] Image upload/paste
  - [ ] Image resizing

#### Auto-save
- [ ] Auto-save on change (debounced)
- [ ] Configurable auto-save interval
- [ ] Unsaved changes indicator

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

#### Settings
- [ ] Settings UI dialog
- [ ] Font family and size
- [ ] Line height
- [ ] Word wrap toggle
- [ ] Show/hide line numbers

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

*Last updated: 2026-03-09*
